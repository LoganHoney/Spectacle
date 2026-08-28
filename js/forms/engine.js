// Shared behaviour for the insurance forms: registry, visibility rules,
// completion tracking and value coercion.

import { FOURPOINT } from './fourpoint.js';
import { WINDMIT } from './windmit.js';

export const FORMS = { fourpoint: FOURPOINT, windmit: WINDMIT };

export const getForm = (id) => FORMS[id] || null;

export const FORM_MENU = [
  { id: 'fourpoint', name: 'Citizens 4-Point', code: 'Form Insp4pt 03/25' },
  { id: 'windmit', name: 'Wind Mitigation', code: 'OIR-B1-1802' },
];

/** A field is hidden when its `showIf: [otherFieldId, [allowedValues]]` isn't satisfied. */
export function visible(field, values) {
  if (!field.showIf) return true;
  const [dep, allowed] = field.showIf;
  return allowed.includes(values[dep]);
}

export function isAnswered(field, values) {
  const v = values[field.id];
  switch (field.type) {
    case 'checkgroup': return Array.isArray(v) && v.length > 0;
    case 'table': return !!v && Object.values(v).some((row) => Object.values(row || {}).some((c) => c !== '' && c != null && c !== false));
    case 'photos': return Array.isArray(v) ? v.length > 0 : false; // photos live in the media store; see photoSlotFilled
    case 'computed': return true;
    default: return v !== undefined && v !== '' && v !== null;
  }
}

/**
 * Completion percentage. Photo slots count as answered only when the media
 * store actually holds something for that slot.
 */
export function completion(form, values, mediaSlots = new Set()) {
  let total = 0; let done = 0;
  for (const section of form.sections) {
    for (const field of section.fields) {
      if (field.type === 'computed' || field.type === 'static') continue;
      if (!visible(field, values)) continue;
      total += 1;
      if (field.type === 'photos') {
        if (mediaSlots.has(slotKey(form.id, field.id))) done += 1;
      } else if (isAnswered(field, values)) done += 1;
    }
  }
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const slotKey = (formId, fieldId) => `form:${formId}:${fieldId}`;

/** Which required-ish answers are still blank — shown before export. */
export function missingCritical(form, values) {
  const missing = [];
  for (const section of form.sections) {
    if (!/^\d\./.test(section.title) && !/^q\d/.test(section.id)) continue;
    for (const field of section.fields) {
      if (field.type !== 'radio') continue;
      if (!visible(field, values)) continue;
      if (!values[field.id]) missing.push(`${section.title} — ${field.label}`);
    }
  }
  return missing;
}

/** Copy what we already know into a blank form so the inspector isn't retyping. */
export function prefill(formId, { inspection, client, property, settings }) {
  const v = {};
  const set = (k, val) => { if (val !== undefined && val !== null && val !== '') v[k] = val; };

  set('owner_name', client?.name);
  set('address', property?.address || '');
  set('year_built', property?.yearBuilt);
  set('stories', property?.stories);
  set('inspection_date', inspection?.inspectedAt || inspection?.scheduledAt);
  set('insp_name', inspection?.inspectorName || settings?.inspectorName);
  set('insp_company', settings?.companyName);
  set('insp_license_no', settings?.license);
  set('insp_license_type', settings?.licenseType);
  set('insp_phone', settings?.phone);
  set('insp_date', inspection?.inspectedAt || inspection?.scheduledAt);
  set('insp_signature', settings?.savedSignature);

  if (formId === 'windmit') {
    set('city', property?.city);
    set('zip', property?.zip);
    set('county', property?.county);
    set('home_phone', client?.phone);
    set('cell_phone', client?.altPhone);
    set('email', client?.email);
    set('year_of_home', property?.yearBuilt);
    set('owner_sign_name', client?.name);

    // If the client already signed this job's pre-inspection agreement, that's the
    // same homeowner attesting to the same inspector's visit — reuse it here instead
    // of sending a second remote-signing link just for the wind mit homeowner line.
    const a = inspection?.agreement;
    if (a?.customer1Signature) {
      set('owner_signature', a.customer1Signature);
      set('owner_sign_name', a.customer1Name || client?.name);
      if (a.customer1SignedAt) set('owner_sign_date', new Date(a.customer1SignedAt).toISOString().slice(0, 10));
    }
  }
  return v;
}

export function evaluateComputed(field, values) {
  try { return field.compute ? field.compute(values) : ''; } catch { return ''; }
}
