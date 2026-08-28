import * as store from '../core/store.js';
import * as media from '../core/media.js';
import { html, raw, esc, on, setTopbar, sheet, chooseSheet, toast, confirmSheet, debounce, fmtDate, today } from '../core/ui.js';
import { go } from '../core/router.js';
import { editClientSheet, editPropertySheet } from './clients.js';
import { editContactSheet } from './contacts.js';
import { isFlagged } from './checklist.js';
import { FORM_MENU, getForm, completion } from '../forms/engine.js';
import { statusCls } from './dashboard.js';
import { sendRemoteSigningLink } from './agreement.js';
import * as signing from '../core/signingClient.js';

function agreementStatus(inspection) {
  const a = inspection.agreement;
  if (a?.inspectorSignature && a?.customer1Signature) return { label: 'Signed', cls: 'ok' };
  if (a?.remoteToken) return { label: 'Sent — pending', cls: 'accent' };
  if (a?.inspectorSignature || a?.customer1Signature) return { label: 'Partially signed', cls: 'warn' };
  return { label: 'Not signed', cls: '' };
}

function computeChecklistStats(inspection) {
  let total = 0, answered = 0, flagged = 0;
  for (const section of inspection.template.sections) {
    for (const item of section.items) {
      total += 1;
      const r = inspection.data[item.id];
      if (!r) continue;
      const hasValue = Array.isArray(r.value) ? r.value.length > 0 : r.value !== undefined && r.value !== '';
      if (hasValue || r.comment) answered += 1;
      if (isFlagged(inspection, item)) flagged += 1;
    }
  }
  return { total, answered, flagged };
}

// ---------------------------------------------------------------- new job

export async function newInspectionFlow(view, params) {
  setTopbar({ title: 'New Inspection', back: () => go('/inspections') });

  const clients = await store.listClients();
  let clientId = params.client || '';
  let propertyId = params.property || '';
  let properties = clientId ? await store.propertiesFor(clientId) : [];
  const selectedServices = new Set([store.SERVICE_TYPES[0]]);
  let scheduledAt = today();
  let scheduledTime = '';

  draw();
  bind(); // delegated listeners on the stable `view` — attach once, not per draw, or picks fire once per past draw

  function draw() {
    view.innerHTML = html`
      <div class="card">
        <h3>Client</h3>
        ${raw(clientId
          ? clientPill()
          : `<button class="btn wide" data-pick-client>Choose or add client</button>`)}
      </div>
      <div class="card">
        <h3>Property</h3>
        ${raw(!clientId ? `<p class="muted small">Choose a client first.</p>`
          : propertyId ? propertyPill() : `<button class="btn wide" data-pick-property>Choose or add property</button>`)}
      </div>
      <div class="card">
        <div class="spread"><h3 style="margin-bottom:0">Services</h3><span class="small muted">Tap all that apply</span></div>
        <div class="opts" data-services style="margin-top:8px">
          ${raw(store.SERVICE_TYPES.map((s) => `<button data-v="${esc(s)}" aria-pressed="${selectedServices.has(s)}">${esc(s)}</button>`).join(''))}
        </div>
      </div>
      <div class="card">
        <h3>Schedule</h3>
        <div class="grid2">
          <label class="f"><span>Date</span><input type="date" data-sched value="${esc(scheduledAt)}"></label>
          <label class="f"><span>Time</span><input type="time" data-time value="${esc(scheduledTime)}"></label>
        </div>
      </div>
      <button class="btn primary wide" data-create ${clientId && propertyId && selectedServices.size ? '' : 'disabled'}>Create Inspection</button>
    `;
    view.querySelector('[data-sched]')?.addEventListener('input', (e) => { scheduledAt = e.target.value; });
    view.querySelector('[data-time]')?.addEventListener('input', (e) => { scheduledTime = e.target.value; });
    view.querySelector('[data-create]')?.addEventListener('click', create);
  }

  function clientPill() {
    const c = clients.find((x) => x.id === clientId);
    return `<div class="spread"><span>${esc(c?.name || 'Unknown')}</span>
      <button class="btn sm ghost" data-change-client>Change</button></div>`;
  }
  function propertyPill() {
    const p = properties.find((x) => x.id === propertyId);
    return `<div class="spread"><span>${esc(store.propertyLabel(p))}</span>
      <button class="btn sm ghost" data-change-property>Change</button></div>`;
  }

  function bind() {
    on(view, 'click', '[data-pick-client],[data-change-client]', pickClient);
    on(view, 'click', '[data-pick-property],[data-change-property]', pickProperty);
    on(view, 'click', '[data-services] [data-v]', (_e, el) => {
      if (selectedServices.has(el.dataset.v)) {
        if (selectedServices.size > 1) selectedServices.delete(el.dataset.v);
      } else {
        selectedServices.add(el.dataset.v);
      }
      el.setAttribute('aria-pressed', selectedServices.has(el.dataset.v));
      view.querySelector('[data-create]').disabled = !(clientId && propertyId && selectedServices.size);
    });
  }

  async function pickClient() {
    const options = [{ value: '__new', label: '+ Add new client' }, ...clients.map((c) => ({ value: c.id, label: c.name, hint: c.phone || c.email }))];
    const choice = await chooseSheet('Choose Client', options);
    if (!choice) return;
    if (choice === '__new') {
      const c = await editClientSheet(store.newClient());
      if (!c) return;
      await store.saveClient(c);
      clients.push(c);
      clientId = c.id;
    } else {
      clientId = choice;
    }
    propertyId = '';
    properties = await store.propertiesFor(clientId);
    draw();
  }

  async function pickProperty() {
    const options = [{ value: '__new', label: '+ Add new property' }, ...properties.map((p) => ({ value: p.id, label: store.propertyLabel(p) }))];
    const choice = await chooseSheet('Choose Property', options);
    if (!choice) return;
    if (choice === '__new') {
      const p = await editPropertySheet(store.newProperty({ clientId }));
      if (!p) return;
      await store.saveProperty(p);
      properties.push(p);
      propertyId = p.id;
    } else {
      propertyId = choice;
    }
    draw();
  }

  let creating = false;
  async function create() {
    if (!clientId || !propertyId || !selectedServices.size || creating) return;
    creating = true; // guards a double-tap on "Create Inspection" from firing this twice and creating two job records
    const btn = view.querySelector('[data-create]');
    if (btn) btn.disabled = true;
    try {
      const inspection = await store.newInspection({
        clientId, propertyId, services: [...selectedServices],
        scheduledAt, scheduledTime, inspectorName: (await store.getSettings()).inspectorName,
      });
      await store.saveInspection(inspection);
      toast('Inspection created');
      go(`/inspection/${inspection.id}`, { replace: true });
    } finally {
      creating = false;
    }
  }
}

// ---------------------------------------------------------------- workspace

export async function inspectionWorkspace(view, { id }) {
  const hydrated = await store.hydrate(id);
  if (!hydrated) { go('/inspections', { replace: true }); return; }
  let { inspection, client, property, settings } = hydrated;

  const persist = debounce(async () => { await store.saveInspection(inspection); }, 400);
  const persistNow = () => store.saveInspection(inspection);

  setTopbar({
    title: property ? store.propertyLabel(property).split(',')[0] : 'Inspection',
    back: () => go('/inspections'),
    actions: [{ label: 'Report', onClick: () => go(`/inspection/${id}/report`) }],
  });

  await render();
  bindOnce(); // delegated listener on the stable `view` — attach once, or contact removal fires once per past render
  function bindOnce() {
    on(view, 'click', '[data-remove-contact]', async (_e, el) => {
      inspection.jobContacts = (inspection.jobContacts || []).filter((cid) => cid !== el.dataset.removeContact);
      await persistNow();
      render();
    });
  }

  async function render() {
    const media_ = await media.mediaFor(id);
    const slotSet = new Set(media_.map((m) => m.slot));
    const formCards = await Promise.all(FORM_MENU.map(async (f) => {
      const form = getForm(f.id);
      const values = inspection.forms[f.id] || {};
      const c = completion(form, values, slotSet);
      return { ...f, c, active: !!inspection.forms[f.id] };
    }));
    const jobContacts = await store.contactsFor(inspection);
    const checklistStats = computeChecklistStats(inspection);

    view.innerHTML = html`
      <div class="card">
        <div class="spread" style="margin-bottom:8px">
          <span class="pill ${statusCls(inspection.status)}" data-status-pill style="cursor:pointer">${esc(inspection.status)}</span>
          <span class="small muted">${esc(store.formatServices(inspection.services))}</span>
        </div>
        <div class="kv">
          <dt>Client</dt><dd>${raw(client ? `<a href="#/client/${client.id}">${esc(client.name)}</a>` : '—')}</dd>
          <dt>Property</dt><dd>${esc(property ? store.propertyLabel(property) : '—')}</dd>
          <dt>Scheduled</dt><dd>${esc(inspection.scheduledAt ? fmtDate(inspection.scheduledAt) : 'Unscheduled')} ${esc(inspection.scheduledTime || '')}</dd>
        </div>
        <button class="btn sm ghost" data-edit-job style="margin-top:10px">Edit Job Details</button>
      </div>

      <div class="card">
        <div class="spread" style="margin-bottom:8px">
          <h3 style="margin:0">Inspection Cost</h3>
          <span class="pill ${inspection.paid ? 'ok' : ''}" data-paid-toggle style="cursor:pointer">${inspection.paid ? 'Paid' : 'Unpaid'}</span>
        </div>
        <label class="f"><span>Fee ($)</span><input type="number" inputmode="decimal" data-cost value="${esc(inspection.fee || '')}" placeholder="e.g. 450"></label>
        <div class="small muted" style="margin-top:6px">Feeds the {TotalAmount} field in the Inspection Agreement.</div>
      </div>

      <div class="card">
        <div class="spread" style="margin-bottom:${jobContacts.length ? '10px' : '0'}">
          <h3 style="margin:0">Contacts on This Job</h3>
          <button class="btn sm ghost" data-add-contact>+ Add</button>
        </div>
        ${raw(jobContacts.length ? `<div class="list">${jobContacts.map((c) => `
          <div class="item">
            <div class="g"><div class="t">${esc(c.name)} <span class="pill">${esc(c.role)}</span></div>
              <div class="s">${esc([c.company, c.phone, c.email].filter(Boolean).join(' · '))}</div></div>
            <button class="btn sm ghost" data-remove-contact="${c.id}">Remove</button>
          </div>`).join('')}</div>` : `<div class="small muted">No realtors, lenders or other contacts added yet.</div>`)}
      </div>

      <div class="list">
        <a class="item" href="#/inspection/${id}/agreement">
          <div class="g"><div class="t">Inspection Agreement</div><div class="s">Merge fields, signatures, share</div></div>
          <span class="pill ${agreementStatus(inspection).cls}">${agreementStatus(inspection).label}</span>
          <span class="chev">&#8250;</span></a>
      </div>
      ${raw(signing.isConfigured(settings) && !(inspection.agreement?.customer1Signature)
        ? '<button class="btn wide" data-email-agreement style="margin:-4px 0 14px">Email Client — Send Agreement to Sign</button>'
        : '')}

      <h2>Insurance Forms</h2>
      <div class="list">
        ${raw(formCards.map((f) => `<a class="item" href="#/inspection/${id}/form/${f.id}">
          <div class="g"><div class="t">${esc(f.name)}</div><div class="s">${esc(f.code)}</div></div>
          <span class="pill ${f.c.pct === 100 ? 'ok' : f.c.done ? 'accent' : ''}">${f.c.done}/${f.c.total}</span>
          <span class="chev">&#8250;</span></a>`).join(''))}
      </div>

      <div class="list">
        <a class="item" href="#/inspection/${id}/checklist">
          <div class="g"><div class="t">Checklist</div><div class="s">${checklistStats.total} items across ${inspection.template.sections.length} sections</div></div>
          ${raw(checklistStats.flagged ? `<span class="pill bad">${checklistStats.flagged} flagged</span>` : '')}
          <span class="pill ${checklistStats.answered === checklistStats.total && checklistStats.total ? 'ok' : 'accent'}">${checklistStats.answered}/${checklistStats.total}</span>
          <span class="chev">&#8250;</span></a>
      </div>

      <h2>Job Notes & Summary</h2>
      <div class="card">
        <label class="f"><span>Summary for client</span>
          <textarea data-summary placeholder="Overall condition, highlights, closing notes…">${esc(inspection.summaryNote || '')}</textarea></label>
        <div class="grid2">
          <label class="f"><span>Weather</span><input type="text" data-weather value="${esc(inspection.weather || '')}"></label>
          <label class="f"><span>Temp (°F)</span><input type="number" data-temp value="${esc(inspection.tempF || '')}"></label>
        </div>
      </div>

      <button class="btn primary wide" data-report style="margin:6px 0 8px">Generate Report</button>
      <button class="btn danger wide" data-delete-job>Delete Inspection</button>
    `;

    bind();
  }

  function bind() {
    view.querySelector('[data-status-pill]').onclick = async () => {
      const s = await chooseSheet('Job Status', store.STATUS.map((v) => ({ value: v, label: v })), { current: inspection.status });
      if (!s) return;
      inspection.status = s;
      await persistNow();
      render();
    };

    view.querySelector('[data-edit-job]').onclick = async () => {
      await editJobSheet();
    };

    view.querySelector('[data-email-agreement]')?.addEventListener('click', async () => {
      toast('Creating signing link…', 15000);
      try {
        await sendRemoteSigningLink({ inspection, client, property, settings });
        render();
      } catch (err) {
        console.error(err);
        toast(`Could not create signing link: ${err.message}`);
      }
    });

    view.querySelector('[data-cost]').addEventListener('input', (e) => {
      inspection.fee = e.target.value;
      persist();
    });

    view.querySelector('[data-paid-toggle]').onclick = async () => {
      inspection.paid = !inspection.paid;
      await persistNow();
      render();
    };

    view.querySelector('[data-add-contact]').onclick = async () => {
      const all = await store.listContacts();
      const already = new Set(inspection.jobContacts || []);
      const available = all.filter((c) => !already.has(c.id));
      const options = [{ value: '__new', label: '+ Add new contact' },
        ...available.map((c) => ({ value: c.id, label: c.name, hint: `${c.role}${c.company ? ' · ' + c.company : ''}` }))];
      if (!available.length) options.length = 1; // just the "+ Add new" option if everyone saved is already on this job
      const choice = await chooseSheet('Add Contact to Job', options);
      if (!choice) return;
      let contactId = choice;
      if (choice === '__new') {
        const c = await editContactSheet(store.newContact());
        if (!c) return;
        await store.saveContact(c);
        contactId = c.id;
      }
      inspection.jobContacts = [...(inspection.jobContacts || []), contactId];
      await persistNow();
      render();
    };

    view.querySelector('[data-summary]').addEventListener('input', (e) => { inspection.summaryNote = e.target.value; persist(); });
    view.querySelector('[data-weather]').addEventListener('input', (e) => { inspection.weather = e.target.value; persist(); });
    view.querySelector('[data-temp]').addEventListener('input', (e) => { inspection.tempF = e.target.value; persist(); });

    view.querySelector('[data-report]').onclick = () => go(`/inspection/${id}/report`);

    view.querySelector('[data-delete-job]').onclick = async () => {
      if (!await confirmSheet('Delete this inspection?', 'All checklist data, forms and photos for this job will be permanently deleted.')) return;
      await persistNow();
      await store.deleteInspection(id);
      toast('Inspection deleted');
      go('/inspections');
    };
  }

  async function editJobSheet() {
    const jobServices = new Set(inspection.services || []);
    await sheet('Edit Job Details', (body, close) => {
      body.innerHTML = html`
        <label class="f"><span>Services — tap all that apply</span></label>
        <div class="opts" data-svc style="margin:0 0 14px">
          ${raw(store.SERVICE_TYPES.map((s) => `<button type="button" data-v="${esc(s)}" aria-pressed="${jobServices.has(s)}">${esc(s)}</button>`).join(''))}
        </div>
        <div class="grid2">
          <label class="f"><span>Scheduled date</span><input type="date" data-date value="${esc(inspection.scheduledAt || '')}"></label>
          <label class="f"><span>Time</span><input type="time" data-time value="${esc(inspection.scheduledTime || '')}"></label>
        </div>
        <label class="f"><span>Inspector</span><input type="text" data-insp value="${esc(inspection.inspectorName || '')}"></label>
        <label class="f"><span>Attendees</span><input type="text" data-att value="${esc(inspection.attendees || '')}" placeholder="Buyer, buyer's agent, seller…"></label>
        <button class="btn primary wide" data-save>Save</button>`;
      on(body, 'click', '[data-svc] [data-v]', (_e, el) => {
        if (jobServices.has(el.dataset.v)) {
          if (jobServices.size > 1) jobServices.delete(el.dataset.v);
        } else {
          jobServices.add(el.dataset.v);
        }
        el.setAttribute('aria-pressed', jobServices.has(el.dataset.v));
      });
      body.querySelector('[data-save]').onclick = async () => {
        if (!jobServices.size) { toast('Choose at least one service'); return; }
        inspection.services = [...jobServices];
        inspection.scheduledAt = body.querySelector('[data-date]').value;
        inspection.scheduledTime = body.querySelector('[data-time]').value;
        inspection.inspectorName = body.querySelector('[data-insp]').value.trim();
        inspection.attendees = body.querySelector('[data-att]').value.trim();
        await persistNow();
        close(true);
        render();
      };
    });
  }
}
