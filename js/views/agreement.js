import * as store from '../core/store.js';
import { DEFAULT_AGREEMENT, mergeAgreement } from '../report/agreement.js';
import { getEmailTemplate } from '../report/emailTemplates.js';
import { buildMergeContext, mergeText } from '../core/merge.js';
import * as signing from '../core/signingClient.js';
import { html, raw, esc, setTopbar, toast, downloadBlob, debounce, confirmSheet, copyRichLink } from '../core/ui.js';
import { go } from '../core/router.js';
import { mountSignaturePad } from './signature.js';

export async function agreementView(view, { id }) {
  const hydrated = await store.hydrate(id);
  if (!hydrated) { go('/inspections', { replace: true }); return; }
  const { inspection, client, property, settings } = hydrated;

  const template = settings.agreementTemplate || DEFAULT_AGREEMENT;
  const mergedText = mergeAgreement(template, { inspection, client, property, settings });

  const agreement = inspection.agreement || {
    inspectorSignature: '', inspectorSignedAt: '',
    customer1Name: client?.name || '', customer1Signature: '', customer1SignedAt: '',
    customer2Name: '', customer2Signature: '', customer2SignedAt: '',
    remoteToken: '', remoteSignUrl: '', remoteSentAt: '',
  };
  inspection.agreement = agreement;

  const save = debounce(async () => { await store.saveInspection(inspection); }, 400);

  if (!agreement.inspectorSignature && settings.savedSignature) {
    agreement.inspectorSignature = settings.savedSignature;
    agreement.inspectorSignedAt = Date.now();
    await save.flush();
  }

  const isFullySigned = !!(agreement.inspectorSignature && agreement.customer1Signature);

  setTopbar({
    title: 'Inspection Agreement', back: () => go(`/inspection/${id}`),
    actions: [],
  });

  view.innerHTML = html`
    <div class="note">
      ${raw(isFullySigned
        ? '<strong>Signed.</strong> Editing a signature below re-dates it — use this only to correct a mistake.'
        : 'Have the client read and sign below, in person or by handing them this device. To send the agreement ahead of time for the client to review on their own, use <strong>Share Unsigned Copy</strong> — they can read and print it, or you can capture their signature here when you arrive.')}
    </div>

    <div class="row wrap no-print" style="margin:0 0 16px;gap:8px">
      <button class="btn" data-print>Print</button>
      <button class="btn" data-share-unsigned>Share Unsigned Copy</button>
      ${raw(isFullySigned ? '<button class="btn ghost" data-share-signed>Share Signed Copy</button>' : '')}
    </div>

    ${raw(remoteSigningCard())}

    <div id="report-root" class="rp-root">
      <div class="rp-block agreement-text">${raw(nl2p(mergedText))}</div>

      <div class="rp-block">
        <h2 class="rp-h2">Signatures</h2>

        <h3 class="rp-h4" style="margin-top:0">Inspector</h3>
        <div class="grid2">
          <label class="f"><span>Name</span><input type="text" data-insp-name value="${esc(inspection.inspectorName || settings.inspectorName || '')}" readonly></label>
          <label class="f"><span>Date</span><input type="text" value="${esc(agreement.inspectorSignedAt ? fmtStamp(agreement.inspectorSignedAt) : 'Not yet signed')}" readonly></label>
        </div>
        <div id="sig-inspector"></div>

        <h3 class="rp-h4">Client 1</h3>
        <div class="grid2">
          <label class="f"><span>Name</span><input type="text" data-c1-name value="${esc(agreement.customer1Name || '')}"></label>
          <label class="f"><span>Date</span><input type="text" value="${esc(agreement.customer1SignedAt ? fmtStamp(agreement.customer1SignedAt) : 'Not yet signed')}" readonly></label>
        </div>
        <div id="sig-c1"></div>

        <h3 class="rp-h4">Client 2 <span class="rp-muted">(optional — co-buyer/co-owner)</span></h3>
        <div class="grid2">
          <label class="f"><span>Name</span><input type="text" data-c2-name value="${esc(agreement.customer2Name || '')}"></label>
          <label class="f"><span>Date</span><input type="text" value="${esc(agreement.customer2SignedAt ? fmtStamp(agreement.customer2SignedAt) : 'Not yet signed')}" readonly></label>
        </div>
        <div id="sig-c2"></div>
      </div>
    </div>
  `;

  mountSignaturePad(view.querySelector('#sig-inspector'), {
    value: agreement.inspectorSignature,
    onChange: (dataUrl) => {
      agreement.inspectorSignature = dataUrl;
      agreement.inspectorSignedAt = dataUrl ? Date.now() : '';
      save();
    },
  });
  mountSignaturePad(view.querySelector('#sig-c1'), {
    value: agreement.customer1Signature,
    onChange: (dataUrl) => {
      agreement.customer1Signature = dataUrl;
      agreement.customer1SignedAt = dataUrl ? Date.now() : '';
      save();
    },
  });
  mountSignaturePad(view.querySelector('#sig-c2'), {
    value: agreement.customer2Signature,
    onChange: (dataUrl) => {
      agreement.customer2Signature = dataUrl;
      agreement.customer2SignedAt = dataUrl ? Date.now() : '';
      save();
    },
  });

  view.querySelector('[data-c1-name]').addEventListener('input', (e) => { agreement.customer1Name = e.target.value; save(); });
  view.querySelector('[data-c2-name]').addEventListener('input', (e) => { agreement.customer2Name = e.target.value; save(); });

  view.querySelector('[data-print]').onclick = () => window.print();

  const emailTpl = getEmailTemplate(settings, 'preinspection');
  const fields = buildMergeContext(hydrated);
  const shareTitle = mergeText(emailTpl.subject, fields);
  const shareText = mergeText(emailTpl.body, fields);

  view.querySelector('[data-share-unsigned]').onclick = async () => {
    await shareOrDownload(buildStandaloneHtml(mergedText, settings, null), filename('unsigned'), shareTitle, shareText);
  };
  view.querySelector('[data-share-signed]')?.addEventListener('click', async () => {
    await shareOrDownload(buildStandaloneHtml(mergedText, settings, agreement), filename('signed'), shareTitle, shareText);
  });

  function filename(suffix) {
    const base = (property ? store.propertyLabel(property).split(',')[0] : client?.name || 'agreement').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${base}-agreement-${suffix}.html`;
  }

  function remoteSigningCard() {
    if (isFullySigned) return '';
    if (!signing.isConfigured(settings)) {
      return `<div class="note small">Remote signing isn't set up. Add a signing server URL in <a href="#/settings">Setup</a> to let a client sign this on their own device before you arrive.</div>`;
    }
    if (agreement.remoteToken) {
      return `<div class="card">
        <div class="spread"><strong>Sent for Remote Signing</strong><span class="pill accent">Pending</span></div>
        <div class="small muted" style="margin:4px 0 12px">Sent ${esc(agreement.remoteSentAt ? fmtStamp(agreement.remoteSentAt) : '')}. The client can open the link and sign on their own device — check back here once they have.</div>
        <div class="row wrap" style="gap:8px">
          <button class="btn sm primary" data-check-status>Check Signing Status</button>
          <button class="btn sm ghost" data-copy-link>Copy Link</button>
          <button class="btn sm danger" data-cancel-remote>Cancel</button>
        </div>
      </div>`;
    }
    return `<div class="card">
      <strong>Sign Remotely</strong>
      <div class="small muted" style="margin:4px 0 12px">Send a link so the client can review and sign on their own device before you arrive. You choose how to send it — nothing goes out automatically.</div>
      <button class="btn sm primary" data-send-remote>Send Link for Remote Signing</button>
    </div>`;
  }

  view.querySelector('[data-send-remote]')?.addEventListener('click', async () => {
    toast('Creating signing link…', 15000);
    try {
      await sendRemoteSigningLink(hydrated);
      agreementView(view, { id });
    } catch (err) {
      console.error(err);
      toast(`Could not create signing link: ${err.message}`);
    }
  });

  view.querySelector('[data-check-status]')?.addEventListener('click', async () => {
    toast('Checking…', 10000);
    try {
      const record = await signing.checkStatus(settings, agreement.remoteToken);
      if (!record) { toast('Link expired or was already used'); return; }
      if (record.status !== 'signed') { toast('Not signed yet'); return; }
      agreement.customer1Name = record.customer1Name || agreement.customer1Name;
      agreement.customer1Signature = record.customer1Signature;
      agreement.customer1SignedAt = record.customer1SignedAt;
      if (record.customer2Signature) {
        agreement.customer2Name = record.customer2Name || agreement.customer2Name;
        agreement.customer2Signature = record.customer2Signature;
        agreement.customer2SignedAt = record.customer2SignedAt;
      }
      await store.saveInspection(inspection);
      await signing.deleteAgreement(settings, agreement.remoteToken);
      toast('Signed — pulled into this job');
      agreementView(view, { id });
    } catch (err) {
      console.error(err);
      toast(`Could not check status: ${err.message}`);
    }
  });

  view.querySelector('[data-copy-link]')?.addEventListener('click', async () => {
    try {
      const rich = await copyRichLink(agreement.remoteSignUrl, 'Pre-Inspection Agreement');
      toast(rich ? 'Link copied — paste into Mail for a clickable "Pre-Inspection Agreement" link' : 'Link copied');
    } catch {
      await shareLink(agreement.remoteSignUrl, shareTitle, shareText, client?.email);
    }
  });

  view.querySelector('[data-cancel-remote]')?.addEventListener('click', async () => {
    if (!await confirmSheet('Cancel remote signing?', 'The link will stop working. This does not affect anything already recorded on this job.', { okLabel: 'Cancel Link' })) return;
    await signing.deleteAgreement(settings, agreement.remoteToken);
    agreement.remoteToken = ''; agreement.remoteSignUrl = ''; agreement.remoteSentAt = '';
    await store.saveInspection(inspection);
    toast('Remote signing cancelled');
    agreementView(view, { id });
  });
}

/**
 * Creates a remote-signing link and hands it straight to the native share
 * sheet, pre-filled with the "Pre-Inspection Agreement" email template plus
 * the link itself — used both by the button on the Agreement page and by the
 * quick-action on the main job page. Throws if no signing server is set up.
 */
export async function sendRemoteSigningLink({ inspection, client, property, settings }) {
  if (!signing.isConfigured(settings)) throw new Error('No signing server configured — set one in Setup.');
  const template = settings.agreementTemplate || DEFAULT_AGREEMENT;
  const mergedText = mergeAgreement(template, { inspection, client, property, settings });
  const agreement = inspection.agreement || {
    inspectorSignature: '', inspectorSignedAt: '',
    customer1Name: client?.name || '', customer1Signature: '', customer1SignedAt: '',
    customer2Name: '', customer2Signature: '', customer2SignedAt: '',
    remoteToken: '', remoteSignUrl: '', remoteSentAt: '',
  };
  inspection.agreement = agreement;

  const emailTpl = getEmailTemplate(settings, 'preinspection');
  const fields = buildMergeContext({ inspection, client, property, settings });
  const shareTitle = mergeText(emailTpl.subject, fields);
  const shareText = mergeText(emailTpl.body, fields);

  const { token, signUrl } = await signing.createAgreement(settings, {
    agreementText: mergedText,
    propertyAddress: property ? store.propertyLabel(property) : '',
    clientName: client?.name || '',
    companyName: settings.companyName || '',
    inspectorName: inspection.inspectorName || settings.inspectorName || '',
    customer1Name: agreement.customer1Name || client?.name || '',
    customer2Name: agreement.customer2Name || '',
  });
  agreement.remoteToken = token;
  agreement.remoteSignUrl = signUrl;
  agreement.remoteSentAt = Date.now();
  await store.saveInspection(inspection);
  await shareLink(signUrl, shareTitle, `${shareText}\n\nPre-Inspection Agreement: ${signUrl}`, client?.email);
}

async function shareLink(url, title, text, toEmail) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; }
    catch (err) { if (err?.name === 'AbortError') return; }
  }
  // Web Share isn't available in every mobile browser — DuckDuckGo's iOS
  // browser, notably, doesn't support it at all. mailto: is handled by iOS
  // itself, not the browser, so it reliably opens the native Mail app
  // regardless of which browser this is running in.
  try {
    window.location.href = buildMailto(toEmail, title, text);
    toast('Opening Mail…');
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied — paste it into a text or email to the client');
    } catch {
      toast(`Share this link with the client: ${url}`, 8000);
    }
  }
}

function buildMailto(toEmail, subject, body) {
  const qs = [`subject=${encodeURIComponent(subject || '')}`, `body=${encodeURIComponent(body || '')}`].join('&');
  return `mailto:${toEmail ? encodeURIComponent(toEmail) : ''}?${qs}`;
}

async function shareOrDownload(htmlStr, name, title, text) {
  const blob = new Blob([htmlStr], { type: 'text/html' });
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([htmlStr], name, { type: 'text/html' });
      const shareData = { files: [file], title: title || name, text };
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  downloadBlob(blob, name);
  toast('Saved');
}

function buildStandaloneHtml(mergedText, settings, agreement) {
  const sigBlock = (label, name, sig, at) => `
    <div style="margin:14px 0">
      <div style="font-size:12px;color:#5b6472;font-family:-apple-system,sans-serif">${esc(label)}${name ? ` — ${esc(name)}` : ''}</div>
      ${sig ? `<img src="${sig}" style="max-height:70px;display:block;margin:4px 0">` : '<div style="height:50px;border-bottom:1px solid #ccc;margin:8px 0"></div>'}
      <div style="font-size:11px;color:#94a3b8;font-family:-apple-system,sans-serif">${at ? `Signed ${fmtStamp(at)}` : 'Signature'}</div>
    </div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inspection Agreement</title>
  <style>
    body{margin:0;background:#f4f5f7;font:15px/1.6 Georgia,'Times New Roman',serif;color:#1a1a1a}
    .wrap{max-width:760px;margin:0 auto;padding:32px 22px;background:#fff}
    h1{font-family:-apple-system,sans-serif;font-size:22px}
    p{margin:0 0 12px}
  </style></head><body><div class="wrap">
    ${nl2p(mergedText)}
    <h1>Signatures</h1>
    ${sigBlock('Inspector', settings.inspectorName || settings.companyName, agreement?.inspectorSignature, agreement?.inspectorSignedAt)}
    ${sigBlock('Client 1', agreement?.customer1Name, agreement?.customer1Signature, agreement?.customer1SignedAt)}
    ${agreement?.customer2Signature || agreement?.customer2Name ? sigBlock('Client 2', agreement?.customer2Name, agreement?.customer2Signature, agreement?.customer2SignedAt) : ''}
  </div></body></html>`;
}

function nl2p(text) {
  return text.split(/\n{2,}/).map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`).join('');
}

function fmtStamp(ms) {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
