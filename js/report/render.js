// Builds the printable report DOM (both the on-screen preview and the basis
// for the standalone HTML export). Kept framework-free so the same markup
// can be serialized verbatim into a self-contained file.

import { esc } from '../core/ui.js';
import * as store from '../core/store.js';
import * as media from '../core/media.js';
import { slotKey, getForm, visible as fieldVisible } from '../forms/engine.js';

const SEV_LABEL = { 0: 'Info', 1: 'Maintenance', 2: 'Minor', 3: 'Major', 4: 'Safety' };
const SEV_COLOR = { 0: '#64748b', 1: '#0284c7', 2: '#b45309', 3: '#dc2626', 4: '#7c2d12' };

const displayValue = (v) => (Array.isArray(v) ? v.join(', ') : v);

/**
 * Renders the full inspection report as an HTML string. Media is embedded as
 * <img>/<video> tags whose `src` is provided by `urlFor(mediaRecord)` — the
 * caller controls whether that's an object URL (preview) or a data URL (export).
 *
 * Page order (Cover → Executive Summary → Letter → Table of Contents →
 * Introduction, then the rest) and the Introduction's wording are matched
 * page-for-page against a real Spectora-generated sample report at the
 * inspector's explicit request — clients and agents who've seen that report
 * shape expect it, and the Introduction's liability language is copied
 * verbatim rather than paraphrased.
 */
export async function renderFullReport({ inspection, client, property, settings, jobContacts }, urlFor) {
  const allMedia = await media.mediaFor(inspection.id);
  const bySlot = groupBy(allMedia, (m) => m.slot);

  const inSummary = [];
  for (const section of inspection.template.sections) {
    for (const item of section.items) {
      const r = inspection.data[item.id];
      if (!r || r.hidden) continue; // "Hide" keeps the answer recorded but off the client-facing report
      if (r.inSummary) inSummary.push({ section, item, r });
    }
  }

  // Rendered in document order so `nav` is filled in correctly by the time
  // tocBlock (called last) reads back through it — string concatenation
  // order below is independent of this call order, so the actual page
  // sequence is set entirely by the returned template at the bottom.
  const nav = [];
  const executiveSummaryHtml = executiveSummaryBlock(inSummary, bySlot, urlFor, nav);
  const letterHtml = letterBlock(inspection, client, property, settings);
  const introHtml = introBlock(nav);
  const inspectionReportHtml = inspectionReportBlock(inspection, property, nav);
  const sectionsHtml = sectionsBlock(inspection, bySlot, urlFor, nav);
  const formsHtml = formsSummaryBlock(inspection, bySlot, urlFor, nav);
  const conclusionHtml = conclusionBlock(inspection, nav);
  const emergencyHtml = emergencyControlsBlock(inspection, bySlot, urlFor, nav);
  const environmentalHtml = environmentalConcernsBlock(nav);
  const signatureHtml = signatureBlock(inspection, settings, nav);
  const tocHtml = tocBlock(nav);

  return `
    ${coverBlock(inspection, client, property, settings, jobContacts, bySlot, urlFor)}
    ${executiveSummaryHtml}
    ${letterHtml}
    ${tocHtml}
    ${introHtml}
    ${inspectionReportHtml}
    ${sectionsHtml}
    ${formsHtml}
    ${conclusionHtml}
    ${emergencyHtml}
    ${environmentalHtml}
    ${signatureHtml}
    ${footerBlock(settings)}
  `;
}

export async function renderFormReport({ inspection, client, property, settings, jobContacts }, formId, urlFor) {
  const form = getForm(formId);
  const allMedia = await media.mediaFor(inspection.id);
  const bySlot = groupBy(allMedia, (m) => m.slot);
  const values = inspection.forms[formId] || {};
  const nav = [];

  const body = `
    <section class="rp-block wf">
      <div class="wf-code">${esc(form.code)}${form.revision ? ` — ${esc(form.revision)}` : ''}</div>
      ${form.intro ? `<p class="rp-note">${esc(form.intro)}</p>` : ''}
      ${officialFormSectionsHtml(form, values, formId, bySlot, urlFor, nav)}
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

// The cover letter. Deliberately un-headed and left out of `nav` — the
// sample report it's matched against has no Table of Contents entry for it,
// just a single unlabeled page between the Executive Summary and the TOC.
function letterBlock(inspection, client, property, settings) {
  const addrLine1 = property?.address || '';
  const addrLine2 = property ? [property.city, [property.state, property.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
  const clientName = client?.name || 'Client';
  const dateLong = fmtFull(inspection.inspectedAt || inspection.scheduledAt);
  const inspectorName = inspection.inspectorName || settings.inspectorName || '';
  const title = settings.inspectorTitle || 'Owner';

  return `
  <section class="rp-block rp-letter">
    <p class="rp-body">Dear ${esc(clientName)},</p>
    <p class="rp-body">We have enclosed the report for the property inspection we conducted for you on ${esc(dateLong)} at:</p>
    <p class="rp-body rp-letter-addr">${esc(addrLine1)}${addrLine2 ? `<br>${esc(addrLine2)}` : ''}</p>
    <p class="rp-body">Our report is designed to be clear, easy to understand, and helpful. Please take the time to review it carefully. If there is anything you would like us to explain, or if there is other information you would like, please feel free to call us. We would be happy to answer any questions you may have.</p>
    <p class="rp-body">Thank you for the opportunity to be of service to you.</p>
    <p class="rp-body">Sincerely,</p>
    ${settings.savedSignature ? `<img class="rp-sig" src="${settings.savedSignature}" alt="Inspector signature">` : ''}
    ${inspectorName ? `<p class="rp-body rp-letter-sign">${esc(inspectorName)}</p>` : ''}
    <p class="rp-body rp-letter-sign">${esc(title)}${settings.companyName ? `, ${esc(settings.companyName)}` : ''}</p>
  </section>`;
}

// Table of Contents. Lists every level-2 heading collected while rendering
// everything else (see renderFullReport) — called last so `nav` is complete.
// Page numbers are left blank here (there's no such thing as a "page" in an
// on-screen/HTML export); js/report/pdf.js fills the `data-toc-for` spans in
// with real page numbers after layout, once it knows where each heading
// actually landed.
function tocBlock(nav) {
  const entries = nav.filter((n) => n.level === 2);
  if (!entries.length) return '';
  return `
  <section class="rp-block rp-toc-section">
    <h2 class="rp-h2">Table of Contents</h2>
    <div class="rp-toc">
      ${entries.map((n) => `
        <div class="rp-toc-row">
          <a class="rp-toc-label" href="#${n.id}">${esc(n.label)}</a>
          <span class="rp-toc-dots"></span>
          <span class="rp-toc-num" data-toc-for="${n.id}"></span>
        </div>`).join('')}
    </div>
  </section>`;
}

// Simple in-page "jump to section" nav — still used by the (much shorter)
// single-form 4-Point / Wind Mitigation reports, where a full paginated
// Table of Contents would be overkill.
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
    <p class="rp-body">This is a summary review of the inspectors' findings during this inspection. However, it does not contain every detailed observation. This is provided as an additional service to our client, and is presented in the form of a listing of the items which, in the opinion of your inspector, merit further attention, investigation, or improvement. Some of these conditions are of such a nature as to require repair or modification by a skilled craftsman, technician, or specialist. Others can be easily handled by a homeowner such as yourself.</p>
    <p class="rp-body">Often, following the inspector's advice will result in improved performance and/or extended life of the component(s) in question. In listing these items, your inspector is not offering any opinion as to who, among the parties to this transaction, should take responsibility for addressing any of these concerns. As with most of the facets of your transaction, we recommend consultation with your Real Estate Professional${items.length ? ' for further advice with regards to the following items:' : ' for further advice regarding your transaction.'}</p>
    ${items.length ? items.map(({ section, item, r }) => `
      <div class="rp-finding" style="${r.severity ? `border-left-color:${SEV_COLOR[r.severity] || SEV_COLOR[2]}` : 'border-left-color:#94a3b8'}">
        <div class="rp-finding-h">
          ${r.severity !== undefined ? `<span class="rp-sevtag" style="background:${SEV_COLOR[r.severity] || SEV_COLOR[2]}">${esc(SEV_LABEL[r.severity] ?? '')}</span>` : ''}
          <strong>${esc(item.label)}</strong>
          <span class="rp-muted"> — ${esc(section.title)}</span>
        </div>
        ${ratingLine(item, section, r)}
        ${r.comment ? `<p class="rp-body">${nl2br(esc(r.comment))}</p>` : ''}
        ${mediaGrid(bySlot[slotKey('item', item.id)], urlFor)}
      </div>`).join('') : '<p class="rp-muted">No items were flagged for this summary during the inspection.</p>'}
  </section>`;
}

// Introduction — page 5 of the sample report this was matched against. The
// inspector asked for this exact wording specifically for the legal/liability
// coverage it provides, so this is copied verbatim, not paraphrased. Do not
// edit this text without the inspector's sign-off.
function introBlock(nav) {
  const paragraphs = [
    `We have inspected the major structural components and mechanical systems for signs of significant non-performance, excessive or unusual wear, and general state of repair. For the purposes of this report, a system or component is considered to have a major visual defect only if it is currently unsafe or not functioning and cannot be replaced or rendered safe or functional for less than $1,000. The following report provides an overview of the conditions observed at the time of the inspection; however, there may be specific references to areas and items that were inaccessible. We can make no representations regarding conditions that may be present but were concealed or inaccessible for review.`,
    `With access and an opportunity for inspection, reportable conditions may be discovered, and inspection of these areas will be performed only upon arrangement and at additional cost after access is provided. We do not review plans, permits, recall lists, or government and local municipality documents. Information regarding recalled appliances, fixtures, and any other items in this property can be found on the Consumer Product Safety website; these items may be present but are not reviewed as part of this service.`,
    `Our recommendations are professional opinions regarding conditions present and are not intended as criticisms of the building. As a courtesy, the inspector may list items they feel have priority in the Inspection Summary portion of the report. Although these items may be of higher priority in the opinion of the inspector, it is ultimately the client's responsibility to review the entire report. If the client has questions regarding any listed items, please contact the inspector for further consultation. Lower priority conditions contained in the body of the report that are neglected may become higher priority conditions over time. Do not equate low cost with low priority, as cost should not be the primary motivation for performing repairs; all repair and upgrade recommendations are important and require attention.`,
    `This report is a "snapshot" of the property on the date of the inspection. The structure and all related components will continue to deteriorate or wear out with time and may not be in the same condition at the close of escrow.`,
    `There are several factors that influence why a specific condition may not have been observed during the inspection. First, environmental factors such as weather conditions play a significant role; for example, it may have been clear and sunny on the day of the inspection with no rain for several days prior. Second, a home inspector is a generalist and not a specialist in every trade; an HVAC or plumbing contractor will have considerably more specialized training and expertise in diagnosing specific system issues. Finally, the duration of the inspection and the fact that it is a non-invasive visual walk-through must be considered. While we diligently cover everything possible, the scope of a home inspection is limited and not designed to be an exhaustive or invasive look behind finished surfaces. A home inspection is intended to give the buyer a better understanding of what they are purchasing, not to eliminate all risks.`,
    `This report is not intended for use by anyone other than the client named herein, and no other persons should rely upon this information. Client agrees to indemnify, defend, and hold the inspector harmless from any third-party claims arising out of the client's unauthorized distribution of the inspection report.`,
    `By accepting this report, you acknowledge that you have reviewed and are in agreement with all terms contained in the inspection agreement provided by the inspector who prepared this report.`,
  ];
  return `
  <section class="rp-block rp-intro-page">
    ${heading('h2', 'rp-h2', 'Introduction', nav, 2)}
    ${paragraphs.map((p) => `<p class="rp-body">${esc(p)}</p>`).join('')}
  </section>`;
}

function computeAge(property, inspection) {
  const yb = Number(property?.yearBuilt);
  if (!yb) return null;
  const d = inspection.inspectedAt || inspection.scheduledAt;
  const insYear = d ? new Date(`${d}T12:00:00`).getFullYear() : new Date().getFullYear();
  const age = insYear - yb;
  return age >= 0 ? age : null;
}

function inspectionReportBlock(inspection, property, nav) {
  const age = computeAge(property, inspection);
  const hasWeather = inspection.weather || inspection.tempF;
  return `
  <section class="rp-block">
    ${heading('h2', 'rp-h2', 'Inspection Report', nav, 2)}
    <p class="rp-body">Throughout the following report the terms "right" and "left" are used to describe the home as viewed from the street.</p>

    <div class="rp-mh">Orientation</div>
    <p class="rp-body">For purposes of identification and reporting, the front of this building faces the street providing access.</p>

    ${age !== null ? `
    <div class="rp-mh">Age</div>
    <p class="rp-body">The house was estimated to be approximately ${age} year${age === 1 ? '' : 's'} old.</p>` : ''}

    ${hasWeather ? `
    <div class="rp-mh">Weather</div>
    ${inspection.tempF ? `<p class="rp-body">Temperature: Approximately ${esc(inspection.tempF)} degrees.</p>` : ''}
    ${inspection.weather ? `<p class="rp-body">The weather was ${esc(String(inspection.weather).toLowerCase())} at the time of our inspection.</p>` : ''}` : ''}

    <div class="rp-mh">General Comments</div>
    <p class="rp-body">Photographs are included in this report to illustrate specific deficiencies identified during the inspection. These photos should be considered representative examples and are not intended to depict every instance of a particular issue. Some conditions may exist in other locations, not specifically pictured.</p>
  </section>`;
}

function sectionsBlock(inspection, bySlot, urlFor, nav) {
  return `
  <section class="rp-block">
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
// the recommendation can't get separated from the finding. Used in both
// report blocks that can show a condition item (Executive Summary and Full
// Inspection Detail) — never just the bare rating.
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

/** Rating line shared by Executive Summary / Full Inspection Detail — hedged sentence for age & condition items, bare "Rating: X" for everything else (material picks, yes/no, counts). */
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
    ${heading('h3', 'rp-h3', section.title, nav, 2)}
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
      return `<div class="wf">
        <h3 class="rp-h3">${esc(form.title)} <span class="rp-muted">(${esc(form.code)})</span></h3>
        ${officialFormSectionsHtml(form, values, formId, bySlot, urlFor)}
      </div>`;
    }).join('')}
  </section>`;
}

// Renders a form (4-Point / Wind Mitigation) laid out like the actual
// insurer/state form it represents — boxed, gray-headed sections; real
// checkbox marks next to the exact option wording; the same side-by-side
// grid tables the paper form uses — rather than a generic label/value dump.
// Driven entirely by each form's existing section/field definitions
// (js/forms/fourpoint.js, windmit.js), which were already rebuilt
// field-for-field from real blank copies of both forms, so no per-form
// bespoke markup is needed here: one renderer covers both.
function officialFormSectionsHtml(form, values, formId, bySlot, urlFor, nav) {
  return form.sections.map((s) => wfSectionHtml(s, values, formId, bySlot, urlFor, nav)).join('');
}

function wfSectionHtml(section, values, formId, bySlot, urlFor, nav) {
  const fields = section.fields.filter((f) => fieldVisible(f, values));
  if (!fields.length) return '';
  return `<div class="wf-section">
    ${heading('h4', 'wf-section-title', section.title, nav, 3)}
    ${section.prompt ? `<p class="wf-prompt">${esc(section.prompt)}</p>` : ''}
    <div class="wf-fields">
      ${fields.map((f) => wfFieldHtml(f, values, formId, bySlot, urlFor)).join('')}
    </div>
  </div>`;
}

function wfFieldHtml(field, values, formId, bySlot, urlFor) {
  const v = values[field.id];
  const widthCls = ` wf-w-${field.width || 'full'}`;
  switch (field.type) {
    case 'photos': {
      const items = bySlot[slotKey(formId, field.id)];
      if (!items?.length) return '';
      return `<div class="wf-field wf-w-full"><div class="wf-label">${esc(field.label)}</div>${mediaGrid(items, urlFor)}</div>`;
    }
    case 'signature':
      return `<div class="wf-field${widthCls}"><div class="wf-label">${esc(field.label)}</div>
        ${v ? `<img class="rp-sig" src="${v}" alt="signature">` : '<div class="wf-blank-sig"></div>'}</div>`;
    case 'radio':
      return `<div class="wf-field wf-w-full"><div class="wf-label">${esc(field.label)}</div><div class="wf-options">
        ${field.options.map((o) => wfOption(o.key === v, o.label, o.sub)).join('')}
      </div></div>`;
    case 'checkgroup':
      return `<div class="wf-field wf-w-full"><div class="wf-label">${esc(field.label)}</div><div class="wf-options wf-options-grid">
        ${field.options.map((o) => wfOption(Array.isArray(v) && v.includes(typeof o === 'string' ? o : o.key), typeof o === 'string' ? o : o.label)).join('')}
      </div></div>`;
    case 'table':
      return wfTable(field, v);
    case 'computed':
      return `<div class="wf-field${widthCls}"><div class="wf-label">${esc(field.label)}</div><div class="wf-value">${esc(field.compute?.(values) || '—')}</div></div>`;
    case 'textarea':
      if (v === undefined || v === '' || v === null) return '';
      return `<div class="wf-field wf-w-full"><div class="wf-label">${esc(field.label)}</div><p class="wf-value wf-multiline">${nl2br(esc(v))}</p></div>`;
    default: // text, number, date
      return `<div class="wf-field${widthCls}"><div class="wf-label">${esc(field.label)}</div>
        <div class="wf-value${v !== undefined && v !== '' && v !== null ? '' : ' wf-blank'}">${v !== undefined && v !== '' && v !== null ? esc(String(v)) : ''}</div></div>`;
  }
}

function wfOption(checked, label, sub) {
  return `<div class="wf-opt"><span class="wf-cb${checked ? ' on' : ''}"></span><span class="wf-opt-label">${esc(label)}${sub ? `<span class="wf-opt-sub">${esc(sub)}</span>` : ''}</span></div>`;
}

// Row labels always render as their own leading column, regardless of
// whether the field declares a 'static' column for it — a table with no
// visible row labels isn't useful, so this doesn't rely on that being set.
function wfTable(field, v) {
  v = v || {};
  const dataCols = field.columns.filter((c) => c.type !== 'static');
  return `<div class="wf-field wf-w-full">
    <div class="wf-label">${esc(field.label)}</div>
    <table class="wf-table">
      <tr><th></th>${dataCols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr>
      ${field.rows.map((r) => `<tr><td class="wf-table-row-label">${esc(r)}</td>${dataCols.map((c) => wfTableCell(c, v[r]?.[c.id])).join('')}</tr>`).join('')}
    </table>
  </div>`;
}

function wfTableCell(col, val) {
  if (col.type === 'check') return `<td class="wf-table-check"><span class="wf-cb${val ? ' on' : ''}"></span></td>`;
  return `<td>${val !== undefined && val !== '' && val !== null ? esc(String(val)) : ''}</td>`;
}

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

// Closing narrative — reuses the same "Overall condition, highlights, closing
// notes" text an inspector already types into the job's Summary field, just
// repositioned to match where the sample report places it (its last real
// content section, right before the emergency-controls/environmental tail).
function conclusionBlock(inspection, nav) {
  return `
  <section class="rp-block">
    ${heading('h2', 'rp-h2', 'Conclusion', nav, 2)}
    <div class="rp-mh">Comments</div>
    <p class="rp-body">${nl2br(esc(inspection.summaryNote || 'No significant concerns were identified beyond those detailed throughout this report.'))}</p>
  </section>`;
}

// tag -> { item, section, r } for every answered, non-hidden item on the
// checklist that carries a stable `tag` (see report/template.js) — same
// lookup pattern forms/crosspopulate.js uses for the 4-Point/Wind Mit
// "Copy from Inspection" button.
function byTag(inspection) {
  const map = new Map();
  for (const section of inspection.template.sections) {
    for (const item of section.items) {
      if (!item.tag) continue;
      const r = inspection.data[item.id];
      if (r && !r.hidden) map.set(item.tag, { item, section, r });
    }
  }
  return map;
}

function ecRow(title, category, sentence, mediaItems, urlFor) {
  return `
  <div class="rp-ecrow">
    <div class="rp-mh">${esc(title)}</div>
    <div class="rp-ec-cat">${esc(category)}</div>
    <p class="rp-body">${esc(sentence)}</p>
    ${mediaItems?.length ? mediaGrid(mediaItems, urlFor) : ''}
  </div>`;
}

// The report's final page: repeats — never re-collects — whatever the
// inspector already recorded elsewhere on the checklist (electric meter,
// main panel, water shutoff) via each item's stable `tag`. There is
// deliberately no separate data-entry UI for this section.
function emergencyControlsBlock(inspection, bySlot, urlFor, nav) {
  const tagged = byTag(inspection);
  const meter = tagged.get('elec_meter_location');
  const panel = tagged.get('elec_panel_location');
  const water = tagged.get('water_shutoff_location');

  const rows = [];
  if (meter?.r.value) {
    rows.push(ecRow('Electric Meter', 'Electrical System',
      `The electric meter is located at: ${meter.r.value}.`,
      bySlot[slotKey('item', meter.item.id)], urlFor));
  }
  if (panel?.r.value) {
    rows.push(ecRow('Main Service', 'Electrical System',
      `The main electrical service panel is located at: ${panel.r.value}.`,
      bySlot[slotKey('item', panel.item.id)], urlFor));
    rows.push(ecRow('Main Disconnect', 'Electrical System',
      'The main disconnect is incorporated into the electrical service panel.', null, urlFor));
  }
  if (water?.r.value) {
    rows.push(ecRow('Water Shutoff Location', 'Plumbing',
      `The domestic water supply main shut-off is located at: ${water.r.value}.`,
      bySlot[slotKey('item', water.item.id)], urlFor));
  }

  return `
  <section class="rp-block">
    ${heading('h2', 'rp-h2', 'Locations of Emergency Controls', nav, 2)}
    <p class="rp-body">In an emergency, you may need to know where to shut off the gas, the water and/or the electrical system. We have listed below these controls and their location for your convenience. We urge that you familiarize yourself with their location and operation.</p>
    ${rows.length ? rows.join('') : '<p class="rp-muted">Not recorded during this inspection.</p>'}
  </section>`;
}

function environmentalConcernsBlock(nav) {
  return `
  <section class="rp-block">
    ${heading('h2', 'rp-h2', 'Environmental Concerns', nav, 2)}
    <p class="rp-body">Environmental issues include but are not limited to radon, fungi/mold, asbestos, lead paint, lead contamination, toxic waste, formaldehyde, electromagnetic radiation, buried fuel oil tanks, ground water contamination and soil contamination. We are not trained or licensed to recognize or discuss any of these materials. We may make reference to one or more of these materials in this report when we recognize one of the common forms of these substances. If further study or analysis seems prudent, the advice and services of the appropriate specialists are advised.</p>
  </section>`;
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
