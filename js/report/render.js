// Builds the printable report DOM (both the on-screen preview and the basis
// for the standalone HTML export). Kept framework-free so the same markup
// can be serialized verbatim into a self-contained file.

import { esc } from '../core/ui.js';
import * as store from '../core/store.js';
import * as media from '../core/media.js';
import { slotKey, getForm, visible as fieldVisible } from '../forms/engine.js';

const SEV_LABEL = { 0: 'Info', 1: 'Maintenance', 2: 'Minor', 3: 'Major', 4: 'Safety' };
const SEV_COLOR = { 0: '#64748b', 1: '#0284c7', 2: '#b45309', 3: '#dc2626', 4: '#7c2d12' };
const NEEDS_ATTENTION = new Set(['Marginal', 'Defective', 'No']);

const displayValue = (v) => (Array.isArray(v) ? v.join(', ') : v);

/**
 * Renders the full inspection report as an HTML string. Media is embedded as
 * <img>/<video> tags whose `src` is provided by `urlFor(mediaRecord)` — the
 * caller controls whether that's an object URL (preview) or a data URL (export).
 */
export async function renderFullReport({ inspection, client, property, settings, jobContacts }, urlFor) {
  const allMedia = await media.mediaFor(inspection.id);
  const bySlot = groupBy(allMedia, (m) => m.slot);

  const flagged = [];
  const inSummary = [];
  for (const section of inspection.template.sections) {
    for (const item of section.items) {
      const r = inspection.data[item.id];
      if (!r || r.hidden) continue; // "Hide" keeps the answer recorded but off the client-facing report
      const isFlag = NEEDS_ATTENTION.has(r.value) || (r.severity && Number(r.severity) >= 2);
      if (isFlag) flagged.push({ section, item, r });
      if (r.inSummary) inSummary.push({ section, item, r });
    }
  }
  flagged.sort((a, b) => (b.r.severity || 0) - (a.r.severity || 0));

  const nav = [];
  const body = `
    ${inSummary.length ? executiveSummaryBlock(inSummary, bySlot, urlFor, nav) : ''}
    ${summaryBlock(inspection, flagged, nav)}
    ${flagged.length ? findingsBlock(flagged, bySlot, urlFor, nav) : ''}
    ${sectionsBlock(inspection, bySlot, urlFor, nav)}
    ${formsSummaryBlock(inspection, bySlot, urlFor, nav)}
    ${signatureBlock(inspection, settings, nav)}
    ${footerBlock(settings)}
  `;

  return `
    ${coverBlock(inspection, client, property, settings, jobContacts, bySlot, urlFor)}
    ${jumpNavBlock(nav)}
    ${body}
  `;
}

export async function renderFormReport({ inspection, client, property, settings, jobContacts }, formId, urlFor) {
  const form = getForm(formId);
  const allMedia = await media.mediaFor(inspection.id);
  const bySlot = groupBy(allMedia, (m) => m.slot);
  const values = inspection.forms[formId] || {};
  const nav = [];

  const body = `
    <section class="rp-block">
      ${form.intro ? `<p class="rp-note">${esc(form.intro)}</p>` : ''}
      ${form.sections.map((s) => formSectionHtml(s, values, formId, bySlot, urlFor, nav)).join('')}
    </section>
    ${footerBlock(settings)}
  `;

  return `
    ${coverBlock(inspection, client, property, settings, jobContacts, bySlot, urlFor, form.title, form.code)}
    ${jumpNavBlock(nav)}
    ${body}
  `;
}

/** The one media slot every report type shares — a single photo of the front
 * of the house, set once on the job page, used on every cover sheet. */
export const COVER_PHOTO_SLOT = slotKey('cover', 'photo');

// ---------------------------------------------------------------- pieces

function coverBlock(inspection, client, property, settings, jobContacts, bySlot, urlFor, subtitle, code) {
  const addrLine1 = property?.address || '';
  const addrLine2 = property ? [property.city, [property.state, property.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
  const photo = bySlot?.[COVER_PHOTO_SLOT]?.[0];
  const logo = settings.logoDataUrl
    ? `<img class="rp-cover2-logo-img" src="${settings.logoDataUrl}" alt="${esc(settings.companyName || 'Company')} logo">`
    : `<div class="rp-logo-fallback">${esc(initials(settings.companyName))}</div>`;
  const licenseTag = settings.license ? `${esc(settings.licenseType || 'Lic.')}#${esc(settings.license)}` : '';

  return `
  <header class="rp-cover2">
    <div class="rp-cover2-logo">${logo}</div>
    <h1 class="rp-cover2-title">${esc(subtitle || 'Residential Inspection Report')}</h1>
    ${code ? `<div class="rp-code">${esc(code)}</div>` : ''}

    ${addrLine1 ? `<div class="rp-cover2-block">
      <div class="rp-cover2-label">Located At:</div>
      <div class="rp-cover2-value">${esc(addrLine1)}</div>
      ${addrLine2 ? `<div class="rp-cover2-value">${esc(addrLine2)}</div>` : ''}
    </div>` : ''}

    <div class="rp-cover2-block">
      <div class="rp-cover2-label">Prepared Exclusively For:</div>
      <div class="rp-cover2-value">${esc(client?.name || '—')}</div>
    </div>

    <div class="rp-cover2-block">
      <div class="rp-cover2-label">Inspected On:</div>
      <div class="rp-cover2-value">${esc(fmtFull(inspection.inspectedAt || inspection.scheduledAt))}</div>
    </div>

    ${photo ? `<img class="rp-cover2-photo" src="${urlFor(photo, 'full')}" alt="Front of the home">` : ''}

    <div class="rp-cover2-inspector">
      <div>Inspector, ${esc(inspection.inspectorName || settings.inspectorName || '—')}${licenseTag ? ` ${licenseTag}` : ''}</div>
      ${settings.companyName ? `<div>${esc(settings.companyName)}</div>` : ''}
    </div>

    <div class="rp-cover2-logo rp-cover2-logo-bottom">${logo}</div>
  </header>`;
}

function jumpNavBlock(nav) {
  if (nav.length < 2) return '';
  return `
  <nav class="rp-jump no-print" aria-label="Report sections">
    <div class="rp-jump-title">Jump to Section</div>
    <div class="rp-jump-grid">
      ${nav.map((n) => `<a href="#${n.id}" class="${n.level === 3 ? 'rp-jump-sub' : ''}">${esc(n.label)}</a>`).join('')}
    </div>
  </nav>`;
}

function heading(tag, cls, label, nav, level) {
  const id = slugify(label);
  if (nav) nav.push({ id, label, level });
  return `<${tag} class="${cls}" id="${id}">${esc(label)}</${tag}>`;
}

function slugify(s) {
  return 'sec-' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function executiveSummaryBlock(items, bySlot, urlFor, nav) {
  return `
  <section class="rp-block">
    ${heading('h2', 'rp-h2', 'Executive Summary', nav, 2)}
    ${items.map(({ section, item, r }) => `
      <div class="rp-finding" style="${r.severity ? `border-left-color:${SEV_COLOR[r.severity] || SEV_COLOR[2]}` : 'border-left-color:#94a3b8'}">
        <div class="rp-finding-h">
          ${r.severity !== undefined ? `<span class="rp-sevtag" style="background:${SEV_COLOR[r.severity] || SEV_COLOR[2]}">${esc(SEV_LABEL[r.severity] ?? '')}</span>` : ''}
          <strong>${esc(item.label)}</strong>
          <span class="rp-muted"> — ${esc(section.title)}</span>
        </div>
        ${ratingLine(item, section, r)}
        ${r.comment ? `<p class="rp-body">${nl2br(esc(r.comment))}</p>` : ''}
        ${mediaGrid(bySlot[slotKey('item', item.id)], urlFor)}
      </div>`).join('')}
  </section>`;
}

function summaryBlock(inspection, flagged, nav) {
  const counts = [1, 2, 3, 4].map((s) => ({ s, n: flagged.filter((f) => Number(f.r.severity || 2) === s).length }));
  return `
  <section class="rp-block">
    ${heading('h2', 'rp-h2', 'Summary', nav, 2)}
    ${inspection.summaryNote ? `<p class="rp-body">${nl2br(esc(inspection.summaryNote))}</p>` : ''}
    <div class="rp-sevrow">
      ${counts.map(({ s, n }) => `<div class="rp-sevstat" style="border-color:${SEV_COLOR[s]}">
        <div class="rp-sevn" style="color:${SEV_COLOR[s]}">${n}</div>
        <div class="rp-sevl">${esc(SEV_LABEL[s])}</div></div>`).join('')}
    </div>
  </section>`;
}

function findingsBlock(flagged, bySlot, urlFor, nav) {
  return `
  <section class="rp-block">
    ${heading('h2', 'rp-h2', 'Findings Requiring Attention', nav, 2)}
    ${flagged.map(({ section, item, r }) => `
      <div class="rp-finding" style="border-left-color:${SEV_COLOR[r.severity || 2]}">
        <div class="rp-finding-h">
          <span class="rp-sevtag" style="background:${SEV_COLOR[r.severity || 2]}">${esc(SEV_LABEL[r.severity || 2])}</span>
          <strong>${esc(item.label)}</strong>
          <span class="rp-muted"> — ${esc(section.title)}</span>
        </div>
        ${ratingLine(item, section, r)}
        ${r.comment ? `<p class="rp-body">${nl2br(esc(r.comment))}</p>` : ''}
        ${mediaGrid(bySlot[slotKey('item', item.id)], urlFor)}
      </div>`).join('')}
  </section>`;
}

function sectionsBlock(inspection, bySlot, urlFor, nav) {
  return `
  <section class="rp-block">
    ${heading('h2', 'rp-h2', 'Full Inspection Detail', nav, 2)}
    ${inspection.template.sections.map((section) => sectionHtml(section, inspection.data, bySlot, urlFor, nav)).join('')}
  </section>`;
}

// Bare "Label: 5 years" reads as a warranted fact. For age-type fields that's
// exactly the kind of statement that comes back to bite an inspector when the
// true age turns out different — so those get rendered as a hedged estimate
// sentence instead. Every other short field (material, color, yes/no) stays
// as a plain Label: Value line; hedging every field would bury the ones that
// actually carry liability risk.
const HEDGE_RE = /\bage\b/i;
function isHedgeSensitive(item, value) {
  return HEDGE_RE.test(item.label) && !Array.isArray(value) && /\d/.test(String(value));
}
function ageSentence(value) {
  const num = String(value).match(/[\d.]+/);
  const amount = num ? `${num[0]} years` : String(value);
  return `Estimated to be approximately ${amount} old at the time of the inspection, based on its visible condition.`;
}

// A bare "Condition: Defective" reads as a flat, unhedged verdict — exactly
// the kind of statement that's hard to defend later. Every condition-rated
// item (Acceptable/Marginal/Defective/...) always renders as an "appeared to
// be... at the time of the inspection" sentence instead, and Marginal/
// Defective additionally get a same-sentence referral to a licensed trade so
// the recommendation can't get separated from the finding. Used in all three
// report blocks that can show a condition item (Executive Summary, Findings,
// Full Inspection Detail) — never just the bare rating.
const TRADE_BY_SECTION = {
  Roof: 'a licensed roofing contractor', Roofing: 'a licensed roofing contractor',
  Electrical: 'a licensed electrician',
  Plumbing: 'a licensed plumber',
  HVAC: 'a licensed HVAC contractor',
  Structure: 'a qualified structural contractor',
  Exterior: 'a qualified contractor',
  Interior: 'a qualified contractor',
  Garage: 'a qualified contractor',
};
const NEEDS_SERVICE = new Set(['Marginal', 'Defective']);

function conditionSentence(section, value) {
  if (value === 'Not Inspected') return 'Not inspected.';
  if (value === 'Not Present') return 'Not present at the time of the inspection.';
  const base = `Appeared to be ${String(value).toLowerCase()} at the time of the inspection`;
  if (NEEDS_SERVICE.has(value)) {
    const trade = TRADE_BY_SECTION[section.title] || 'a licensed professional';
    return `${base}, evaluation by ${trade} recommended.`;
  }
  return `${base}.`;
}

/** Rating line shared by Executive Summary / Findings — hedged sentence for age & condition items, bare "Rating: X" for everything else (material picks, yes/no, counts). */
function ratingLine(item, section, r) {
  const hasValue = Array.isArray(r.value) ? r.value.length > 0 : !!r.value;
  if (!hasValue) return '';
  if (isHedgeSensitive(item, r.value)) return `<p class="rp-rating">${esc(ageSentence(r.value))}</p>`;
  if (item.type === 'condition' && !Array.isArray(r.value)) return `<p class="rp-rating">${esc(conditionSentence(section, r.value))}</p>`;
  return `<div class="rp-rating">Rating: ${esc(displayValue(r.value))}</div>`;
}

function sectionHtml(section, data, bySlot, urlFor, nav) {
  const rows = section.items.map((item) => {
    const r = data[item.id] || {};
    if (r.hidden) return '';
    const slot = slotKey('item', item.id);
    const hasValue = Array.isArray(r.value) ? r.value.length > 0 : !!r.value;
    if (!hasValue && !r.comment && !(bySlot[slot]?.length)) return '';
    const hedge = hasValue && isHedgeSensitive(item, r.value);
    const isCondition = hasValue && item.type === 'condition' && !Array.isArray(r.value);
    return `
      <div class="rp-item">
        <div class="rp-item-row">
          <span class="rp-item-label">${esc(item.label)}</span>
          ${hasValue && !hedge && !isCondition ? `<span class="rp-item-val">${esc(displayValue(r.value))}</span>` : ''}
        </div>
        ${hedge ? `<p class="rp-body rp-item-note">${esc(ageSentence(r.value))}</p>` : ''}
        ${isCondition ? `<p class="rp-body rp-item-note">${esc(conditionSentence(section, r.value))}</p>` : ''}
        ${r.comment ? `<p class="rp-body rp-item-note">${nl2br(esc(r.comment))}</p>` : ''}
        ${mediaGrid(bySlot[slot], urlFor)}
      </div>`;
  }).filter(Boolean).join('');
  if (!rows) return '';
  return `<div class="rp-section">
    ${heading('h3', 'rp-h3', section.title, nav, 3)}
    ${section.intro ? `<p class="rp-muted rp-section-intro">${esc(section.intro)}</p>` : ''}
    ${rows}
  </div>`;
}

function formsSummaryBlock(inspection, bySlot, urlFor, nav) {
  const active = Object.entries(inspection.forms || {}).filter(([, v]) => v && Object.keys(v).length);
  if (!active.length) return '';
  return `
  <section class="rp-block">
    ${heading('h2', 'rp-h2', 'Insurance Forms Completed', nav, 2)}
    ${active.map(([formId, values]) => {
      const form = getForm(formId);
      if (!form) return '';
      return `<div class="rp-section">
        <h3 class="rp-h3">${esc(form.title)} <span class="rp-muted">(${esc(form.code)})</span></h3>
        ${form.sections.map((s) => formSectionHtml(s, values, formId, bySlot, urlFor)).join('')}
      </div>`;
    }).join('')}
  </section>`;
}

function formSectionHtml(section, values, formId, bySlot, urlFor, nav) {
  const fields = section.fields.filter((f) => fieldVisible(f, values));
  if (!fields.length) return '';
  return `<div class="rp-formsection">
    ${heading('h4', 'rp-h4', section.title, nav, 3)}
    ${section.prompt ? `<p class="rp-muted rp-section-intro">${esc(section.prompt)}</p>` : ''}
    <table class="rp-formtable">
      ${fields.map((f) => formFieldRow(f, values, formId, bySlot, urlFor)).join('')}
    </table>
  </div>`;
}

function formFieldRow(field, values, formId, bySlot, urlFor) {
  const v = values[field.id];
  switch (field.type) {
    case 'photos': {
      const items = bySlot[slotKey(formId, field.id)];
      if (!items?.length) return '';
      return `<tr><th>${esc(field.label)}</th><td>${mediaGrid(items, urlFor)}</td></tr>`;
    }
    case 'signature':
      return v ? `<tr><th>${esc(field.label)}</th><td><img class="rp-sig" src="${v}" alt="signature"></td></tr>` : '';
    case 'checkgroup':
      return v?.length ? `<tr><th>${esc(field.label)}</th><td>${esc(v.join(', '))}</td></tr>` : '';
    case 'table': {
      if (!v) return '';
      const rows = field.rows.filter((r) => v[r] && Object.values(v[r]).some((c) => c !== '' && c != null && c !== false));
      if (!rows.length) return '';
      return `<tr><th>${esc(field.label)}</th><td>
        <table class="rp-subtable"><tr>${field.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr>
        ${rows.map((r) => `<tr>${field.columns.map((c) => `<td>${c.type === 'static' ? esc(r) : esc(fmtCell(v[r][c.id]))}</td>`).join('')}</tr>`).join('')}
        </table></td></tr>`;
    }
    case 'computed':
      return `<tr><th>${esc(field.label)}</th><td>${esc((field.compute?.(values)) || '—')}</td></tr>`;
    default:
      if (v === undefined || v === '' || v === null) return '';
      return `<tr><th>${esc(field.label)}</th><td>${field.type === 'textarea' ? nl2br(esc(v)) : esc(v)}</td></tr>`;
  }
}

function fmtCell(v) { return v === true ? 'Yes' : v === false ? '' : v; }

function mediaGrid(items, urlFor) {
  if (!items?.length) return '';
  return `<div class="rp-mediagrid">${items.map((m) => `
    <figure class="rp-media">
      ${videoOrImageTag(m, urlFor)}
      ${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}
    </figure>`).join('')}</div>`;
}

function videoOrImageTag(m, urlFor) {
  if (m.kind !== 'video') return `<img src="${urlFor(m, 'full')}" alt="${esc(m.caption || 'inspection photo')}">`;
  const src = urlFor(m, 'full');
  if (!src) {
    // Video too large to embed in this export — keep the poster frame and say so, rather than a dead player.
    return `<img src="${urlFor(m, 'thumb')}" alt="${esc(m.caption || 'inspection video (poster frame)')}">
      <div class="rp-video-note">Video too large to embed here — open in the app to view.</div>`;
  }
  return `<video src="${src}" controls playsinline poster="${urlFor(m, 'thumb')}"></video>`;
}

function signatureBlock(inspection, settings, nav) {
  // The inspector signs once in Settings, not per job — every report just stamps that saved signature.
  if (!settings.savedSignature) return '';
  return `
  <section class="rp-block rp-signoff">
    ${heading('h2', 'rp-h2', 'Inspector Certification', nav, 2)}
    <p class="rp-body">This report has been prepared by ${esc(inspection.inspectorName || settings.inspectorName || 'the inspector')}
      and reflects conditions observed at the time of a visual inspection only.</p>
    <img class="rp-sig" src="${settings.savedSignature}" alt="Inspector signature">
    <div class="rp-small">${esc(inspection.inspectorName || settings.inspectorName || '')} · ${esc(fmt(inspection.inspectedAt || inspection.scheduledAt))}</div>
  </section>`;
}

function footerBlock(settings) {
  return `<footer class="rp-footer">${esc(settings.reportFooter || '')}</footer>`;
}

// ---------------------------------------------------------------- utils

function groupBy(arr, fn) {
  const out = {};
  for (const item of arr) { const k = fn(item); (out[k] = out[k] || []).push(item); }
  return out;
}
function nl2br(s) { return String(s).replace(/\n/g, '<br>'); }
function fmt(d) {
  if (!d) return '—';
  try { return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}
function fmtFull(d) {
  if (!d) return '—';
  try { return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}
function initials(name) {
  return (name || 'HI').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}
