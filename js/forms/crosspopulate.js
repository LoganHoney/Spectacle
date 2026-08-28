// "Copy from Inspection" — pulls the overlapping facts you already gathered
// on the main checklist (roof, electrical, HVAC, plumbing) onto the 4-Point
// and Wind Mitigation forms, so a full inspection never means re-typing the
// same answers twice.
//
// Matching is by a stable `tag` on the master template's items (see
// report/template.js), not by item id — ids are re-randomized per job, tags
// survive cloning. Every suggestion is reviewed and opt-in before it touches
// the form; nothing here writes to the form silently.

const MAPPINGS = [
  // ---- 4-Point ----
  { tag: 'roof_covering', formId: 'fourpoint', field: 'roof_p_covering', label: 'Predominant Roof — Covering material', kind: 'copy' },
  { tag: 'roof_age', formId: 'fourpoint', field: 'roof_p_age', label: 'Predominant Roof — Age (years)', kind: 'copy' },
  { tag: 'roof_remaining_life', formId: 'fourpoint', field: 'roof_p_remaining', label: 'Predominant Roof — Remaining useful life (years)', kind: 'copy' },
  { tag: 'roof_condition', formId: 'fourpoint', field: 'roof_p_condition', label: 'Predominant Roof — Overall condition', kind: 'conditionToSatisfactory' },
  { tag: 'roof_leaks', formId: 'fourpoint', field: 'roof_p_leaks', label: 'Predominant Roof — Visible signs of leaks?', kind: 'copy' },

  { tag: 'elec_amps', formId: 'fourpoint', field: 'elec_main_amps', label: 'Main Panel — Total Amps', kind: 'extractNumber' },
  { tag: 'elec_panel_brand', formId: 'fourpoint', field: 'elec_main_brand', label: 'Main Panel brand/model', kind: 'copy' },
  { tag: 'elec_panel_condition', formId: 'fourpoint', field: 'elec_condition', label: 'General condition of the electrical system', kind: 'conditionToSatisfactory' },
  { tag: 'elec_wiring_types', formId: 'fourpoint', field: 'elec_wiring_types', label: 'Wiring Type(s)', kind: 'copy' },
  { tag: 'elec_double_taps', formId: 'fourpoint', field: 'elec_hazards', label: 'Hazards Present', kind: 'yesAddsToGroup', addValue: 'Double taps' },
  { tag: 'elec_open_junction', formId: 'fourpoint', field: 'elec_hazards', label: 'Hazards Present', kind: 'yesAddsToGroup', addValue: 'Exposed wiring' },

  { tag: 'hvac_age', formId: 'fourpoint', field: 'hvac_age', label: 'Age of system (years)', kind: 'copy' },
  { tag: 'hvac_condition', formId: 'fourpoint', field: 'hvac_good_order', label: 'Are the HVAC systems in good working order?', kind: 'conditionToYesNo' },

  { tag: 'plumb_pipe_types', formId: 'fourpoint', field: 'plumb_pipe_types', label: 'Type of pipes', kind: 'copy' },
  { tag: 'plumb_wh_age', formId: 'fourpoint', field: 'plumb_wh_age', label: 'Age of water heater (years)', kind: 'copy' },

  // ---- Wind Mitigation ---- (deliberately narrower — the roof-covering table and
  // most Q3/Q5/Q6 answers require documentation/measurement the checklist doesn't
  // capture the same way, so a wrong auto-fill there is worse than a blank field.)
  { tag: 'roof_covering', formId: 'windmit', field: 'q4_table', label: '4.1 Roof Covering Type — marks it "in use"', kind: 'setTableCheck', col: 'inuse',
    rowMap: {
      'Asphalt / Fiberglass Shingle': 'Asphalt/Fiberglass Shingle',
      'Architectural Shingle': 'Asphalt/Fiberglass Shingle',
      'Concrete / Clay Tile': 'Concrete/Clay Tile',
      'Metal': 'Metal',
      'Built Up / Modified Bitumen': 'Built Up',
      'Membrane / Single Ply': 'Membrane',
      'Other': 'Other',
    } },
  { tag: 'roof_geometry', formId: 'windmit', field: 'q7_answer', label: '7. Roof Geometry', kind: 'mapValue',
    valueMap: { Hip: 'A', Flat: 'B' }, fallback: 'C' },
];

/** Which forms currently offer the "Copy from Inspection" button. */
export const CROSSPOPULATE_FORMS = new Set(['fourpoint', 'windmit']);

/** tag -> Set of form ids it feeds, for the checklist's "also on 4pt/wind mit" badges. */
export const TAGGED_FOR_FORMS = MAPPINGS.reduce((map, m) => {
  if (!map.has(m.tag)) map.set(m.tag, new Set());
  map.get(m.tag).add(m.formId);
  return map;
}, new Map());

function conditionToSatisfactory(v) {
  if (v === 'Acceptable') return 'Satisfactory';
  if (v === 'Marginal' || v === 'Defective') return 'Unsatisfactory';
  return null;
}
function conditionToYesNo(v) {
  if (v === 'Acceptable') return 'Yes';
  if (v === 'Marginal' || v === 'Defective') return 'No';
  return null;
}
function extractNumber(v) {
  const m = String(v ?? '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

function findTaggedItems(inspection) {
  const found = new Map(); // tag -> { item, section, response }
  for (const section of inspection.template.sections) {
    for (const item of section.items) {
      if (!item.tag) continue;
      const r = inspection.data[item.id];
      if (!r) continue;
      found.set(item.tag, { item, section, response: r });
    }
  }
  return found;
}

/**
 * Returns review-ready candidates for one form: what the checklist has, what
 * the form currently has, and the suggested value — nothing is applied yet.
 */
export function gatherCandidates(inspection, formId, formValues) {
  const tagged = findTaggedItems(inspection);
  const candidates = [];

  for (const m of MAPPINGS) {
    if (m.formId !== formId) continue;
    const found = tagged.get(m.tag);
    if (!found) continue;
    const raw = found.response.value;
    if (raw === undefined || raw === '' || raw === null) continue;

    let suggested = null;
    if (m.kind === 'copy') suggested = raw;
    else if (m.kind === 'conditionToSatisfactory') suggested = conditionToSatisfactory(raw);
    else if (m.kind === 'conditionToYesNo') suggested = conditionToYesNo(raw);
    else if (m.kind === 'extractNumber') suggested = extractNumber(raw);
    else if (m.kind === 'yesAddsToGroup') suggested = raw === 'Yes' ? m.addValue : null;
    else if (m.kind === 'mapValue') suggested = m.valueMap[raw] ?? m.fallback ?? null;
    else if (m.kind === 'setTableCheck') suggested = m.rowMap[raw] ?? null; // resolves to the target row label
    if (suggested === null || suggested === undefined || suggested === '') continue;

    let currentValue;
    let alreadyHasIt;
    if (m.kind === 'setTableCheck') {
      currentValue = formValues[m.field]?.[suggested]?.[m.col];
      alreadyHasIt = currentValue === true;
    } else {
      currentValue = formValues[m.field];
      alreadyHasIt = m.kind === 'yesAddsToGroup'
        ? Array.isArray(currentValue) && currentValue.includes(suggested)
        : currentValue === suggested;
    }
    if (alreadyHasIt) continue;

    candidates.push({
      tag: m.tag, field: m.field, kind: m.kind, col: m.col, fieldLabel: m.label,
      sourceLabel: found.item.label, sourceSection: found.section.title,
      currentValue, suggested,
      checkedByDefault: currentValue === undefined || currentValue === '' || currentValue === false
        || (Array.isArray(currentValue) && currentValue.length === 0),
    });
  }
  return candidates;
}

/** Applies the caller-selected subset of candidates onto `formValues`, mutating it in place. */
export function applyCandidates(formValues, candidates) {
  for (const c of candidates) {
    if (c.kind === 'yesAddsToGroup') {
      const set = new Set(Array.isArray(formValues[c.field]) ? formValues[c.field] : []);
      set.add(c.suggested);
      formValues[c.field] = [...set];
    } else if (c.kind === 'setTableCheck') {
      formValues[c.field] = formValues[c.field] || {};
      formValues[c.field][c.suggested] = { ...(formValues[c.field][c.suggested] || {}), [c.col]: true };
    } else {
      formValues[c.field] = c.suggested;
    }
  }
}
