import { getForm, visible, completion, slotKey, prefill, evaluateComputed, missingCritical } from '../forms/engine.js';
import { CROSSPOPULATE_FORMS, gatherCandidates, applyCandidates } from '../forms/crosspopulate.js';
import * as store from '../core/store.js';
import * as media from '../core/media.js';
import { html, raw, esc, on, setTopbar, toast, debounce, confirmSheet, sheet } from '../core/ui.js';
import { go } from '../core/router.js';
import { mountPhotos } from './photos.js';
import { mountSignaturePad } from './signature.js';

export async function formView(view, { id, formId }) {
  const form = getForm(formId);
  if (!form) { go(`/inspection/${id}`, { replace: true }); return; }

  const hydrated = await store.hydrate(id);
  if (!hydrated) { go('/inspections', { replace: true }); return; }
  const { inspection } = hydrated;
  inspection.forms[formId] = inspection.forms[formId] || {};
  const save = debounce(async () => { await store.saveInspection(inspection); }, 400);
  if (Object.keys(inspection.forms[formId]).length === 0) {
    Object.assign(inspection.forms[formId], prefill(formId, hydrated));
    await save.flush();
  }
  const values = inspection.forms[formId];

  // The agreement is commonly signed *after* the Wind Mit form was first opened
  // (blank), so the one-time prefill above can miss it — check again on every
  // visit, not just the first, and never overwrite a signature already captured
  // here (e.g. the client signed windmit separately from the agreement).
  if (formId === 'windmit' && !values.owner_signature && inspection.agreement?.customer1Signature) {
    values.owner_signature = inspection.agreement.customer1Signature;
    values.owner_sign_name = inspection.agreement.customer1Name || values.owner_sign_name || '';
    if (inspection.agreement.customer1SignedAt) {
      values.owner_sign_date = new Date(inspection.agreement.customer1SignedAt).toISOString().slice(0, 10);
    }
    await save.flush();
  }
  const mediaSlots = new Set((await media.mediaFor(id)).map((m) => m.slot));

  setTopbar({
    title: form.code, back: () => go(`/inspection/${id}`),
    actions: [{ label: 'Report', onClick: () => go(`/inspection/${id}/report`) }],
  });

  render();
  bind(); // delegated listeners on the stable `view` — attach once, not per render, or handlers fire once per past render

  function render() {
    const c = completion(form, values, mediaSlots);
    view.innerHTML = html`
      <div class="card tight">
        <div class="spread" style="margin-bottom:6px">
          <strong>${esc(form.title)}</strong>
          <span class="pill ${c.pct === 100 ? 'ok' : 'accent'}">${c.done}/${c.total}</span>
        </div>
        <div class="progress"><i style="width:${c.pct}%"></i></div>
      </div>
      ${raw(form.intro ? `<div class="note">${esc(form.intro)}</div>` : '')}
      ${raw(CROSSPOPULATE_FORMS.has(formId) ? `<button class="btn wide" data-copy-inspection style="margin-bottom:14px">↓ Copy from Inspection</button>` : '')}
      ${raw(form.sections.map(sectionHtml).join(''))}
      <button class="btn primary wide" data-review style="margin-top:6px">Review & Generate Form</button>
    `;
    view.querySelectorAll('[data-formphoto]').forEach((el) => {
      mountPhotos(el, { inspectionId: id, slot: slotKey(formId, el.dataset.formphoto), label: 'Photos' });
    });
    view.querySelectorAll('[data-sig]').forEach((el) => {
      mountSignaturePad(el, {
        value: values[el.dataset.sig],
        onChange: (dataUrl) => { values[el.dataset.sig] = dataUrl; save(); },
      });
    });
  }

  function sectionHtml(section) {
    const fields = section.fields.filter((f) => visible(f, values));
    if (!fields.length) return '';
    return `<details class="sec" open data-section="${section.id}">
      <summary><span>${esc(section.title)}</span></summary>
      <div class="body">
        ${section.prompt ? `<p class="small muted">${esc(section.prompt)}</p>` : ''}
        <div class="stack">${fields.map(fieldHtml).join('')}</div>
      </div>
    </details>`;
  }

  function fieldHtml(field) {
    switch (field.type) {
      case 'text': return wrap(field, `<input type="text" data-f="${field.id}" value="${esc(values[field.id] ?? '')}">`);
      case 'number': return wrap(field, `<input type="number" data-f="${field.id}" value="${esc(values[field.id] ?? '')}" inputmode="decimal">`);
      case 'date': return wrap(field, `<input type="date" data-f="${field.id}" value="${esc(values[field.id] ?? '')}">`);
      case 'textarea': return wrap(field, `<textarea data-f="${field.id}">${esc(values[field.id] ?? '')}</textarea>`);
      case 'select': return wrap(field, `<select data-f="${field.id}">
          <option value="">— Select —</option>
          ${field.options.map((o) => `<option value="${esc(o)}" ${o === values[field.id] ? 'selected' : ''}>${esc(o)}</option>`).join('')}
        </select>`);
      case 'radio': return radioField(field);
      case 'checkgroup': return checkgroupField(field);
      case 'table': return tableField(field);
      case 'computed': return computedField(field);
      case 'photos': return photosField(field);
      case 'signature': return signatureField(field);
      default: return '';
    }
  }

  function wrap(field, controlHtml) {
    return `<label class="f" style="${widthStyle(field)}"><span>${esc(field.label)}</span>${controlHtml}
      ${field.hint ? `<div class="small muted" style="margin-top:4px">${esc(field.hint)}</div>` : ''}</label>`;
  }

  function widthStyle(field) {
    return field.width === 'half' ? 'display:inline-block;width:calc(50% - 5px);vertical-align:top'
      : field.width === 'third' ? 'display:inline-block;width:calc(33.3% - 7px);vertical-align:top'
        : '';
  }

  function radioField(field) {
    const cur = values[field.id];
    return `<div class="f" style="${widthStyle(field)}">
      <span style="display:block;font-size:13px;font-weight:600;color:var(--ink-2);margin:0 0 5px">${esc(field.label)}</span>
      <div class="opts" data-radio="${field.id}">
        ${field.options.map((o) => `<button data-v="${esc(o.key)}" aria-pressed="${o.key === cur}">
          <span class="k">${esc(o.key)}.</span>${esc(o.label)}
          ${o.sub ? `<div class="small muted" style="margin-top:3px">${esc(o.sub)}</div>` : ''}
        </button>`).join('')}
      </div></div>`;
  }

  function checkgroupField(field) {
    const cur = new Set(values[field.id] || []);
    return `<div class="f"><span style="display:block;font-size:13px;font-weight:600;color:var(--ink-2);margin:0 0 5px">${esc(field.label)}</span>
      <div class="opts" data-check="${field.id}">
        ${field.options.map((o) => `<button data-v="${esc(o)}" aria-pressed="${cur.has(o)}">${esc(o)}</button>`).join('')}
      </div></div>`;
  }

  function tableField(field) {
    const data = values[field.id] || {};
    return `<div class="f"><span style="display:block;font-size:13px;font-weight:600;color:var(--ink-2);margin:0 0 8px">${esc(field.label)}</span>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr>${field.columns.map((c) => `<th style="text-align:left;padding:4px 6px;color:var(--ink-3);font-weight:600;white-space:nowrap">${esc(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${field.rows.map((rowLabel) => {
          const row = data[rowLabel] || {};
          return `<tr>${field.columns.map((col) => `<td style="padding:4px 6px;border-top:1px solid var(--line)">${tableCell(field.id, rowLabel, col, row[col.id])}</td>`).join('')}</tr>`;
        }).join('')}</tbody>
      </table></div></div>`;
  }

  function tableCell(fieldId, rowLabel, col, val) {
    if (col.type === 'static') return `<span style="white-space:nowrap">${esc(rowLabel)}</span>`;
    if (col.type === 'check') return `<input type="checkbox" data-tcell="${fieldId}|${esc(rowLabel)}|${col.id}" ${val ? 'checked' : ''} style="width:20px;height:20px">`;
    if (col.type === 'select') return `<select data-tcell="${fieldId}|${esc(rowLabel)}|${col.id}" style="min-height:32px;padding:2px 4px">
        <option value=""></option>${col.options.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    return `<input type="${col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'}"
      data-tcell="${fieldId}|${esc(rowLabel)}|${col.id}" value="${esc(val ?? '')}" style="min-height:32px;width:100%;min-width:90px">`;
  }

  function computedField(field) {
    const result = evaluateComputed(field, values);
    return `<div class="f" style="${widthStyle(field)}"><span style="display:block;font-size:13px;font-weight:600;color:var(--ink-2);margin:0 0 5px">${esc(field.label)}</span>
      <div class="pill accent" style="display:inline-block">${esc(result || 'Enter values above')}</div></div>`;
  }

  function photosField(field) {
    return `<div class="f"><div data-formphoto="${field.id}"></div></div>`;
  }

  function signatureField(field) {
    return `<div class="f"><span style="display:block;font-size:13px;font-weight:600;color:var(--ink-2);margin:0 0 5px">${esc(field.label)}</span>
      <div data-sig="${field.id}"></div></div>`;
  }

  function bind() {
    on(view, 'input', '[data-f]', (e, el) => {
      values[el.dataset.f] = el.value;
      if (el.tagName === 'SELECT' || el.type === 'date') render(); // computed fields may depend on it
      save();
    });
    on(view, 'click', '[data-radio] [data-v]', (_e, el) => {
      const fieldId = el.closest('[data-radio]').dataset.radio;
      values[fieldId] = el.dataset.v;
      save(); render();
    });
    on(view, 'click', '[data-check] [data-v]', (_e, el) => {
      const fieldId = el.closest('[data-check]').dataset.check;
      const set = new Set(values[fieldId] || []);
      set.has(el.dataset.v) ? set.delete(el.dataset.v) : set.add(el.dataset.v);
      values[fieldId] = [...set];
      el.setAttribute('aria-pressed', set.has(el.dataset.v));
      save();
    });
    on(view, 'input', '[data-tcell]', (e, el) => {
      const [fieldId, rowLabel, colId] = el.dataset.tcell.split('|');
      values[fieldId] = values[fieldId] || {};
      values[fieldId][rowLabel] = values[fieldId][rowLabel] || {};
      values[fieldId][rowLabel][colId] = el.type === 'checkbox' ? el.checked : el.value;
      save();
    });
    on(view, 'change', 'select[data-tcell]', () => { save(); render(); });

    on(view, 'click', '[data-copy-inspection]', async () => {
      const candidates = gatherCandidates(inspection, formId, values);
      if (!candidates.length) {
        toast('Nothing new to copy — either the checklist is blank, or the form already has these answers');
        return;
      }
      const chosen = await reviewCopySheet(candidates);
      if (!chosen || !chosen.length) return;
      applyCandidates(values, chosen);
      save.flush();
      toast(`Copied ${chosen.length} field${chosen.length === 1 ? '' : 's'} from the inspection`);
      render();
    });

    on(view, 'click', '[data-review]', async () => {
      const missing = missingCritical(form, values);
      if (missing.length) {
        const ok = await confirmSheet('Some questions are unanswered', `${missing.length} required question${missing.length === 1 ? ' is' : 's are'} still blank:\n${missing.slice(0, 6).join('\n')}${missing.length > 6 ? `\n…and ${missing.length - 6} more` : ''}\n\nContinue to the printable form anyway?`, { danger: false, okLabel: 'Continue' });
        if (!ok) return;
      }
      go(`/inspection/${id}/report?form=${formId}`);
    });
  }
}

function reviewCopySheet(candidates) {
  return sheet('Copy from Inspection', (body, close) => {
    body.innerHTML = html`
      <p class="small muted" style="margin-top:0">From the checklist you already filled out. Review before applying — nothing here overwrites the form until you tap Apply.</p>
      <div class="stack" data-list>
        ${raw(candidates.map((c, i) => `
          <label class="finding" style="display:flex;gap:10px;align-items:flex-start;cursor:pointer">
            <input type="checkbox" data-idx="${i}" ${c.checkedByDefault ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px;flex:0 0 auto">
            <span>
              <div class="ft" style="margin-bottom:2px">${esc(c.fieldLabel)}</div>
              <div class="small">→ <strong>${esc(c.kind === 'setTableCheck' ? `Check "${c.suggested}"` : Array.isArray(c.suggested) ? c.suggested.join(', ') : c.suggested)}</strong></div>
              <div class="small muted">From “${esc(c.sourceLabel)}” in ${esc(c.sourceSection)}${c.currentValue && c.kind !== 'setTableCheck' ? ` — currently: ${esc(Array.isArray(c.currentValue) ? c.currentValue.join(', ') : c.currentValue)}` : ''}</div>
            </span>
          </label>`).join(''))}
      </div>
      <button class="btn primary wide" data-apply style="margin-top:14px">Apply Selected</button>`;
    body.querySelector('[data-apply]').onclick = () => {
      const chosen = [...body.querySelectorAll('[data-idx]:checked')].map((el) => candidates[Number(el.dataset.idx)]);
      close(chosen);
    };
  });
}
