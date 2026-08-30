import * as store from '../core/store.js';
import * as media from '../core/media.js';
import { renderFullReport, renderFormReport } from '../report/render.js';
import { buildFullReportHtml, buildFormReportHtml } from '../report/export.js';
import { buildReportPdfBlob } from '../report/pdf.js';
import { buildWindMitOfficialPdf } from '../report/windmitPdfFill.js';
import { getForm, FORM_MENU } from '../forms/engine.js';
import { gatherCandidates, applyCandidates } from '../forms/crosspopulate.js';
import { getEmailTemplate } from '../report/emailTemplates.js';
import { buildMergeContext, mergeText } from '../core/merge.js';
import * as reportClient from '../core/reportClient.js';
import { html, raw, esc, setTopbar, toast, downloadBlob, slug, copyRichLink } from '../core/ui.js';
import { go } from '../core/router.js';

/**
 * Builds a real PDF, hosts it on the signing backend for a shareable link,
 * and hands both to the native share sheet pre-filled with the matching
 * email template — used by the report page's own "Send Report" button and
 * by the "mark complete" prompt on the main job page. Throws if no signing
 * server is set.
 *
 * For a 4-Point/Wind Mit report, this also silently pulls in whatever the
 * main checklist already answers (roof, panel, HVAC, plumbing) before
 * building — the same one-click convenience the removed "Generate" buttons
 * on the inspection page offered, just folded into the actual send action
 * instead of a separate step. Wind Mit sends the genuine official
 * OIR-B1-1802 PDF (see windmitPdfFill.js), not the look-alike HTML render.
 */
export async function emailReportToClient(hydrated, formId) {
  if (!reportClient.isConfigured(hydrated.settings)) {
    throw new Error('No signing server configured — set one in Setup.');
  }
  const { inspection, property, client } = hydrated;
  const base = slug([property ? store.propertyLabel(property).split(',')[0] : client?.name, formId].filter(Boolean).join(' ')) || 'inspection-report';

  let pdfBlob;
  if (formId === 'fourpoint' || formId === 'windmit') {
    inspection.forms[formId] = inspection.forms[formId] || {};
    const values = inspection.forms[formId];
    const candidates = gatherCandidates(inspection, formId, values).filter((c) => c.checkedByDefault);
    if (candidates.length) {
      applyCandidates(values, candidates);
      await store.saveInspection(inspection);
    }
    pdfBlob = formId === 'windmit' ? await buildWindMitOfficialPdf(values) : await buildReportPdfBlob(hydrated, formId);
  } else {
    pdfBlob = await buildReportPdfBlob(hydrated, formId);
  }
  const { viewUrl } = await reportClient.uploadReport(hydrated.settings, pdfBlob, `${base}.pdf`);

  const templateKey = formId === 'fourpoint' ? 'fourpoint' : formId === 'windmit' ? 'windmit' : 'full';
  const tpl = getEmailTemplate(hydrated.settings, templateKey);
  const fields = buildMergeContext(hydrated);
  const title = mergeText(tpl.subject, fields);
  const text = `${mergeText(tpl.body, fields)}\n\nYour Report: ${viewUrl}`;
  const file = new File([pdfBlob], `${base}.pdf`, { type: 'application/pdf' });

  if (navigator.share) {
    const shareData = { title, text, files: [file] };
    try {
      if (navigator.canShare && !navigator.canShare(shareData)) throw new Error('files unsupported');
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // Fall through to share without the attachment — the hosted link still gets the report to the client.
    }
    try { await navigator.share({ title, text }); return; } catch (err) { if (err?.name === 'AbortError') return; }
  }
  // Web Share isn't available in every mobile browser — DuckDuckGo's iOS
  // browser, notably, doesn't support it at all. mailto: is handled by iOS
  // itself, not the browser, so it reliably opens the native Mail app
  // regardless. It can't carry the PDF as a real attachment (mailto: has no
  // attachment mechanism), but the hosted link in the body still gets the
  // client the report.
  try {
    const qs = [`subject=${encodeURIComponent(title || '')}`, `body=${encodeURIComponent(text)}`].join('&');
    window.location.href = `mailto:${client?.email ? encodeURIComponent(client.email) : ''}?${qs}`;
    toast('Opening Mail…');
  } catch {
    try {
      const rich = await copyRichLink(viewUrl, 'Your Report');
      toast(rich ? 'Report link copied — paste into Mail for a clickable "Your Report" link' : 'Report link copied');
    } catch {
      toast(`Share this with the client: ${viewUrl}`, 8000);
    }
  }
}

export async function reportView(view, { id, form: formId }) {
  const hydrated = await store.hydrate(id);
  if (!hydrated) { go('/inspections', { replace: true }); return; }
  const { inspection, property, client } = hydrated;
  const form = formId ? getForm(formId) : null;

  setTopbar({
    title: form ? (FORM_MENU.find((f) => f.id === formId)?.name || form.title) : 'Report',
    back: () => go(`/inspection/${id}`),
    actions: [],
  });

  view.innerHTML = html`
    <div class="row wrap no-print" style="margin:0 0 16px">
      ${form ? '' : raw(`<a class="chip" aria-pressed="false" href="#/inspection/${id}/report">Full Report</a>`)}
      ${raw(await formChips())}
      <span class="spacer"></span>
    </div>
    <div class="row wrap no-print" style="margin:0 0 18px;gap:8px">
      ${raw(reportClient.isConfigured(hydrated.settings) ? '<button class="btn primary" data-email-report>Send Report</button>' : '')}
      ${raw(formId === 'windmit' ? '<button class="btn ghost" data-windmit-official>Download Official State Form (PDF)</button>' : '')}
      <button class="btn ghost" data-print>Print / Save PDF</button>
      <button class="btn ghost" data-export>Export Digital Copy</button>
      ${raw(navigator.share ? '<button class="btn ghost" data-share>Share</button>' : '')}
    </div>
    <div id="report-root" class="rp-root"><div class="empty small">Building report…</div></div>
  `;

  async function formChips() {
    const { FORM_MENU } = await import('../forms/engine.js');
    return FORM_MENU.map((f) => {
      const active = f.id === formId;
      return `<a class="chip" aria-pressed="${active}" href="#/inspection/${id}/report?form=${f.id}">${esc(f.code)}</a>`;
    }).join('');
  }

  const root = view.querySelector('#report-root');
  const urlFor = (record, which) => media.objectUrl(record, which);
  const bodyHtml = form ? await renderFormReport(hydrated, formId, urlFor) : await renderFullReport(hydrated, urlFor);
  root.innerHTML = bodyHtml;

  const filename = () => {
    const base = slug([property ? store.propertyLabel(property).split(',')[0] : client?.name, form?.code].filter(Boolean).join(' '));
    return `${base || 'inspection-report'}.html`;
  };

  view.querySelector('[data-print]').onclick = () => window.print();

  view.querySelector('[data-export]').onclick = async () => {
    toast('Building report file…', 15000);
    try {
      const htmlStr = form ? await buildFormReportHtml(hydrated, formId) : await buildFullReportHtml(hydrated);
      const blob = new Blob([htmlStr], { type: 'text/html' });
      downloadBlob(blob, filename());
      toast('Report saved');
    } catch (err) {
      console.error(err);
      toast('Could not build the report file');
    }
  };

  const shareBtn = view.querySelector('[data-share]');
  if (shareBtn) {
    shareBtn.onclick = async () => {
      toast('Preparing to share…', 15000);
      try {
        const htmlStr = form ? await buildFormReportHtml(hydrated, formId) : await buildFullReportHtml(hydrated);
        const file = new File([htmlStr], filename(), { type: 'text/html' });
        const templateKey = formId === 'fourpoint' ? 'fourpoint' : formId === 'windmit' ? 'windmit' : 'full';
        const tpl = getEmailTemplate(hydrated.settings, templateKey);
        const fields = buildMergeContext(hydrated);
        const shareData = { files: [file], title: mergeText(tpl.subject, fields), text: mergeText(tpl.body, fields) };
        if (navigator.canShare && !navigator.canShare(shareData)) {
          downloadBlob(new Blob([htmlStr], { type: 'text/html' }), filename());
          toast('Sharing unsupported here — saved instead');
          return;
        }
        await navigator.share(shareData);
      } catch (err) {
        if (err?.name !== 'AbortError') { console.error(err); toast('Could not share the report'); }
      }
    };
  }

  view.querySelector('[data-windmit-official]')?.addEventListener('click', async () => {
    toast('Building official form…', 15000);
    try {
      inspection.forms.windmit = inspection.forms.windmit || {};
      const values = inspection.forms.windmit;
      const candidates = gatherCandidates(inspection, 'windmit', values).filter((c) => c.checkedByDefault);
      if (candidates.length) {
        applyCandidates(values, candidates);
        await store.saveInspection(inspection);
      }
      const blob = await buildWindMitOfficialPdf(values);
      downloadBlob(blob, `${filename().replace(/\.html$/, '')}-OIR-B1-1802.pdf`);
      toast('Official form saved');
    } catch (err) {
      console.error(err);
      toast(`Could not build the official form: ${err.message}`);
    }
  });

  view.querySelector('[data-email-report]')?.addEventListener('click', async () => {
    toast('Building PDF and uploading…', 30000);
    try {
      await emailReportToClient(hydrated, formId);
      toast('Report sent');
    } catch (err) {
      console.error(err);
      toast(`Could not send the report: ${err.message}`);
    }
  });
}
