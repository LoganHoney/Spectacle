import * as store from '../core/store.js';
import * as dbcore from '../core/db.js';
import * as backup from '../core/backup.js';
import * as supabaseClient from '../core/supabaseClient.js';
import * as sync from '../core/sync.js';
import { pickFiles } from '../core/media.js';
import { DEFAULT_AGREEMENT } from '../report/agreement.js';
import { EMAIL_TEMPLATE_TYPES, getEmailTemplate } from '../report/emailTemplates.js';
import { mountSignaturePad } from './signature.js';
import { html, raw, esc, on, setTopbar, toast, chooseSheet, downloadBlob, debounce } from '../core/ui.js';

export async function settingsView(view) {
  const settings = await store.getSettings();
  // Settings are stored as one row per field (see store.saveSettings), so a
  // single shared debounce would let editing two different fields within the
  // same 400ms window silently drop whichever one wasn't typed last. Debounce
  // per field instead — each field's pending save is independent.
  const fieldDebouncers = new Map();
  // Separate, slightly longer debounce for the cloud push — batches multiple
  // quick field edits into one network call instead of one per field. Local
  // save (above) always happens regardless of sign-in state or connectivity;
  // this is a best-effort side-channel on top of it, never a blocker.
  const pushCloud = debounce(() => {
    sync.pushSettingsToCloud().catch((err) => console.warn('Cloud settings sync failed', err));
  }, 800);
  function persist(patch) {
    for (const [key, value] of Object.entries(patch)) {
      if (!fieldDebouncers.has(key)) fieldDebouncers.set(key, debounce((v) => store.saveSettings({ [key]: v }), 400));
      fieldDebouncers.get(key)(value);
    }
    if (supabaseClient.isConfigured()) pushCloud();
  }
  const defaultAgreementPlaceholder = DEFAULT_AGREEMENT;

  let [persistence, counts] = await Promise.all([
    dbcore.requestPersistence(),
    countAll(),
  ]);

  // Locked by default so scrolling/tapping around a field on a touchscreen
  // can't silently change a saved value — Edit unlocks every field on this
  // page, Done flushes anything pending and locks again.
  let editing = false;
  const dis = () => (editing ? '' : 'disabled');

  draw();

  function draw() {
    setTopbar({ title: 'Setup', actions: [{ label: editing ? 'Done' : 'Edit', onClick: toggleEdit }] });
    render();
  }

  async function toggleEdit() {
    if (editing) {
      for (const d of fieldDebouncers.values()) d.flush?.();
    }
    editing = !editing;
    draw();
  }

  function render() {
    view.innerHTML = html`
    <h2 style="margin-top:6px">Account</h2>
    <div class="card stack">
      <div class="small muted">Cloud sign-in, so your data isn't only on this device.</div>
      <a class="btn wide" href="#/account">Manage Account</a>
    </div>

    <h2>Company & Inspector</h2>
    <div class="card stack">
      <div class="row" style="align-items:flex-start">
        <div id="logo-preview" style="width:64px;height:64px;border-radius:14px;border:1px solid var(--line);
          background:var(--surface-2);display:grid;place-content:center;overflow:hidden;flex:0 0 auto">
          ${raw(settings.logoDataUrl ? `<img src="${settings.logoDataUrl}" style="width:100%;height:100%;object-fit:contain">` : '<span class="muted small">Logo</span>')}
        </div>
        <div class="stack" style="flex:1">
          ${raw(editing ? '<button class="btn sm ghost" data-logo>Upload logo</button>' : '')}
          ${raw(editing && settings.logoDataUrl ? '<button class="btn sm ghost" data-logo-clear>Remove logo</button>' : '')}
        </div>
      </div>
      <label class="f"><span>Company name</span><input type="text" data-k="companyName" value="${esc(settings.companyName)}" ${dis()}></label>
      <label class="f"><span>Inspector name</span><input type="text" data-k="inspectorName" value="${esc(settings.inspectorName)}" ${dis()}></label>
      <div class="grid2">
        <label class="f"><span>License #</span><input type="text" data-k="license" value="${esc(settings.license)}" ${dis()}></label>
        <label class="f"><span>License type</span><input type="text" data-k="licenseType" value="${esc(settings.licenseType)}" ${dis()}></label>
      </div>
      <div class="grid2">
        <label class="f"><span>Phone</span><input type="tel" data-k="phone" value="${esc(settings.phone)}" ${dis()}></label>
        <label class="f"><span>Email</span><input type="email" data-k="email" value="${esc(settings.email)}" ${dis()}></label>
      </div>
      <label class="f"><span>Business address</span><input type="text" data-k="addressLine" value="${esc(settings.addressLine)}" ${dis()}></label>
      <label class="f"><span>Default signature</span></label>
      <div class="small muted" style="margin:-4px 0 4px">Fills in automatically on new forms and jobs — still editable per-signature if you need to re-sign.</div>
      ${raw(editing ? '<div id="sig-default-host"></div>' : (settings.savedSignature
        ? `<img src="${settings.savedSignature}" alt="Saved signature" style="max-height:70px;display:block">`
        : '<div class="small muted">No signature saved yet — tap Edit above.</div>'))}
    </div>

    <h2>Report Defaults</h2>
    <div class="card stack">
      <label class="f"><span>Default fee ($)</span><input type="number" data-k="defaultFee" value="${esc(settings.defaultFee)}" ${dis()}></label>
      <label class="f"><span>Report footer / legal text</span><textarea data-k="reportFooter" ${dis()}>${esc(settings.reportFooter)}</textarea></label>
    </div>

    <h2>Pre-Inspection Agreement</h2>
    <div class="card stack">
      <div class="note small">
        Merge fields fill in automatically per job: <code>{InspectionAddressInline}</code> <code>{Inspectee}</code>
        <code>{InspecteeEmail}</code> <code>{InspecteePhone}</code> <code>{InspectionDateWithTime}</code>
        <code>{InspectionDate}</code> <code>{InspectorCompany}</code> <code>{Inspector}</code> <code>{TotalAmount}</code>.
        Signatures are captured separately on the job's Agreement screen, not typed here.
      </div>
      <label class="f"><span>Agreement text</span><textarea data-k="agreementTemplate" rows="10" style="min-height:220px" ${dis()}>${esc(settings.agreementTemplate || defaultAgreementPlaceholder)}</textarea></label>
      ${raw(editing ? '<button class="btn sm ghost" data-reset-agreement>Reset to default text</button>' : '')}
    </div>

    <h2>Remote Signing</h2>
    <div class="card stack">
      <div class="note small">Optional — lets a client sign the agreement on their own device before you arrive. Requires the signing server from the <code>backend/</code> folder to be deployed (see backend/README.md). Leave blank to only sign in person or by sharing a copy.</div>
      <label class="f"><span>Signing server URL</span><input type="text" data-k="signingApiUrl" value="${esc(settings.signingApiUrl)}" placeholder="https://your-app.onrender.com" ${dis()}></label>
    </div>

    <h2>Email Templates</h2>
    <div class="note">Used as the subject/message text when you share a document — the agreement, or a report — from a job.</div>
    ${raw(EMAIL_TEMPLATE_TYPES.map((t) => emailTemplateCard(t, settings, editing)).join(''))}

    <h2>Photo Storage</h2>
    <div class="card stack">
      <label class="f"><span>Max photo dimension (pixels) — smaller saves space</span>
        <select data-k="photoMaxEdge" ${dis()}>
          ${raw([1200, 1600, 2000, 2400].map((v) => `<option value="${v}" ${v === settings.photoMaxEdge ? 'selected' : ''}>${v}px</option>`).join(''))}
        </select></label>
      <div class="small muted">Persistent storage: ${persistence.supported ? (persistence.granted ? 'granted — the browser won’t auto-clear your data' : 'not granted yet') : 'not supported on this browser'}
        ${persistence.usage?.quota ? ` · Using ${humanBytes(persistence.usage.usage)} of ${humanBytes(persistence.usage.quota)}` : ''}</div>
      ${raw(!persistence.granted ? '<button class="btn sm ghost" data-persist>Request persistent storage</button>' : '')}
    </div>

    <h2>Your Data</h2>
    <div class="card stack">
      <div class="small muted">${counts.clients} clients · ${counts.inspections} inspections · ${counts.media} photos/videos · ${counts.comments} library comments</div>
      <div class="note warn">Everything lives only on this device. Back up regularly — reinstalling the app or clearing browser data will erase it otherwise.</div>
      <button class="btn primary wide" data-backup>Export Full Backup</button>
      ${raw(editing ? '<button class="btn wide" data-restore>Restore from Backup</button>' : '<div class="small muted">Tap Edit above to restore from a backup file.</div>')}
    </div>

    <h2>Comment Library</h2>
    <div class="card stack">
      <a class="btn wide" href="#/library">Manage Library & Master Template</a>
    </div>

    <h2>Contacts</h2>
    <div class="card stack">
      <div class="small muted">Realtors, lenders and other repeat referral contacts you can pick on a job instead of retyping.</div>
      <a class="btn wide" href="#/contacts">Manage Contacts</a>
    </div>

    <div class="small muted" style="text-align:center;margin:24px 0 8px">Hernando Inspections — installed as an offline app</div>
  `;

  if (editing) {
    mountSignaturePad(view.querySelector('#sig-default-host'), {
      value: settings.savedSignature,
      onChange: (dataUrl) => {
        settings.savedSignature = dataUrl;
        store.saveSettings({ savedSignature: dataUrl });
        if (supabaseClient.isConfigured()) pushCloud();
      },
    });
  }

  view.querySelectorAll('[data-k]').forEach((el) => {
    el.addEventListener('input', () => {
      const val = el.type === 'number' ? el.value : el.value;
      const patchVal = el.dataset.k === 'photoMaxEdge' ? Number(el.value) : val;
      settings[el.dataset.k] = patchVal;
      persist({ [el.dataset.k]: patchVal });
    });
  });

  view.querySelector('[data-reset-agreement]')?.addEventListener('click', async () => {
    settings.agreementTemplate = '';
    await store.saveSettings({ agreementTemplate: '' });
    if (supabaseClient.isConfigured()) pushCloud();
    toast('Agreement text reset to default');
    draw();
  });

  view.querySelectorAll('[data-email-subject],[data-email-body]').forEach((el) => {
    el.addEventListener('input', () => {
      const key = el.dataset.emailSubject || el.dataset.emailBody;
      const field = el.dataset.emailSubject ? 'subject' : 'body';
      const current = { ...(settings.emailTemplates || {}) };
      current[key] = { ...getEmailTemplate(settings, key), ...current[key], [field]: el.value };
      persist({ emailTemplates: current });
      settings.emailTemplates = current;
    });
  });

  view.querySelectorAll('[data-reset-email]').forEach((btn) => {
    btn.onclick = async () => {
      const key = btn.dataset.resetEmail;
      const current = { ...(settings.emailTemplates || {}) };
      delete current[key];
      settings.emailTemplates = current;
      await store.saveSettings({ emailTemplates: current });
      if (supabaseClient.isConfigured()) pushCloud();
      toast('Template reset to default');
      draw();
    };
  });

  view.querySelector('[data-logo]')?.addEventListener('click', async () => {
    const [file] = await pickFiles({ accept: 'image/*', multiple: false });
    if (!file) return;
    const dataUrl = await fileToCompressedDataUrl(file);
    settings.logoDataUrl = dataUrl;
    await store.saveSettings({ logoDataUrl: dataUrl });
    if (supabaseClient.isConfigured()) pushCloud();
    toast('Logo saved');
    draw();
  });
  view.querySelector('[data-logo-clear]')?.addEventListener('click', async () => {
    settings.logoDataUrl = '';
    await store.saveSettings({ logoDataUrl: '' });
    if (supabaseClient.isConfigured()) pushCloud();
    draw();
  });

  const persistBtn = view.querySelector('[data-persist]');
  if (persistBtn) persistBtn.onclick = async () => {
    persistence = await dbcore.requestPersistence();
    toast(persistence.granted ? 'Persistent storage granted' : 'Browser declined — try again after using the app more');
    draw();
  };

  view.querySelector('[data-backup]').onclick = async () => {
    toast('Building backup file…', 30000);
    try {
      const blob = await backup.exportBackupBlob();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `hernando-inspections-backup-${stamp}.json`);
      toast('Backup saved');
    } catch (err) {
      console.error(err);
      toast('Backup failed — see console');
    }
  };

  view.querySelector('[data-restore]')?.addEventListener('click', async () => {
    const [file] = await pickFiles({ accept: 'application/json', multiple: false });
    if (!file) return;
    const mode = await chooseSheet('Restore Backup', [
      { value: 'merge', label: 'Merge', hint: 'Adds/updates records from the file. Nothing currently on this device is deleted.' },
      { value: 'replace', label: 'Replace everything', hint: 'Wipes this device first. Use when restoring onto a fresh install.' },
    ]);
    if (!mode) return;
    try {
      toast('Restoring…', 30000);
      const json = await backup.readFileAsJson(file);
      await backup.importBackup(json, { mode });
      toast('Backup restored');
      Object.assign(settings, await store.getSettings());
      draw();
    } catch (err) {
      console.error(err);
      toast(`Restore failed: ${err.message}`);
    }
  });
  }
}

function emailTemplateCard(t, settings, editing) {
  const tpl = getEmailTemplate(settings, t.key);
  return `<div class="card stack">
    <h3 style="margin:0">${esc(t.label)}</h3>
    <label class="f"><span>Subject</span><input type="text" data-email-subject="${t.key}" value="${esc(tpl.subject)}" ${editing ? '' : 'disabled'}></label>
    <label class="f"><span>Body</span><textarea data-email-body="${t.key}" rows="6" ${editing ? '' : 'disabled'}>${esc(tpl.body)}</textarea></label>
    ${editing ? `<button class="btn sm ghost" data-reset-email="${t.key}">Reset to default</button>` : ''}
  </div>`;
}

async function countAll() {
  const [clients, inspections, media_, comments] = await Promise.all([
    dbcore.count('clients'), dbcore.count('inspections'), dbcore.count('media'), dbcore.count('comments'),
  ]);
  return { clients, inspections, media: media_, comments };
}

function humanBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 300 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}
