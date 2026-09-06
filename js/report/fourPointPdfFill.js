// Fills the REAL official Citizens 4-Point Inspection Form (Insp4pt 03/25) —
// js/vendor/forms/insp4pt-fillable.pdf — with the inspector's actual answers
// from inspection.forms.fourpoint, producing a PDF that is the genuine
// underwriter-recognized form, not a look-alike reproduction.
//
// Unlike windmitPdfFill.js's master (hand-measured from a flat PDF),
// insp4pt-fillable.pdf started as a real Acrobat-prepared fillable version
// the user supplied — its ~180 field names/positions came from Acrobat's own
// field detection, verified via tools/cdp_inspect_pdf_fields.py, then patched
// by tools/build_4point_fields.js (see that file's header for the handful of
// fields it had to split/remove). The field NAMES below must match that
// build exactly; if the vendored PDF is ever regenerated, keep both in sync.
//
// Known gaps in the master (Acrobat's row-detection didn't create a field
// for these at all): "Is there any indication of an active/prior leak?"
// (plumb_active_leak/plumb_prior_leak) and the "explain" follow-ups that
// have no dedicated blank on the printed form (elec_main_sufficient_explain,
// elec_hazards_other, elec_condition_explain, hvac_good_order_explain,
// plumb_pipe_other, plumb_renovation_note, roof_leaks_explain,
// roof_damage_explain) — rather than silently dropping what the inspector
// typed, those get appended to the Additional Comments field at fill time.

// Same retry-hardened fetch/script-load pattern as windmitPdfFill.js (not
// exported there, so duplicated here) — this dev environment has seen
// genuine transient fetch failures this late in a long request chain.
async function fetchWithRetry(url, mode, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return mode === 'text' ? await res.text() : await res.arrayBuffer();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw new Error(`Could not load ${url}: ${lastErr.message}`);
}

let vendorPromise = null;
function loadVendor() {
  if (!vendorPromise) vendorPromise = loadScript('js/vendor/pdf-lib.min.js');
  return vendorPromise;
}

const loadedScripts = new Set();
async function loadScript(src) {
  if (loadedScripts.has(src)) return;
  const code = await fetchWithRetry(src, 'text');
  const s = document.createElement('script');
  s.textContent = code;
  document.head.appendChild(s);
  loadedScripts.add(src);
}

// Every text field on this master has its font size set to 0 (auto-shrink)
// and plain black by default. Every value this app fills in should read as
// obviously "the inspector's answer" versus the form's own printed text, so
// it's forced to a fixed, readable navy-bold — except fields whose value can
// run long relative to their box (e.g. a full roof-covering label into a
// ~44pt-wide blank), which keep auto-size (0) so long text shrinks to fit
// instead of clipping, and the ~6x6pt plumbing-grid cells, where even the
// 8pt floor would overflow a fixed size less aggressively than 9pt would.
const FONT_SIZE = 9;
const NAVY_BOLD = '0 0 0.5 rg';

function selectRadio(form, name, value) {
  if (!value) return;
  try {
    const rg = form.getRadioGroup(name);
    // The radio groups this app creates itself (build_4point_fields.js's
    // split fields) use clean 'Yes'/'No' option values, but Acrobat's own
    // field detection suffixed every duplicate-named option on this master
    // ('Yes_11', 'No_8', ...) to keep them unique — match either.
    const options = rg.getOptions();
    const match = options.find((o) => o === value || o.startsWith(`${value}_`));
    if (match) rg.select(match);
  } catch { /* field not in this build — skip */ }
}

function setCheck(form, name, checked) {
  if (!checked) return;
  try { form.getCheckBox(name).check(); } catch { /* field not in this build — skip */ }
}

async function drawSignature(pdfDoc, page, dataUrl, x, y, maxWidth, maxHeight) {
  if (!dataUrl) return;
  const isPng = dataUrl.startsWith('data:image/png');
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
  const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
  const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x, y, width: w, height: h });
}

// ---- checkgroup option label -> PDF field name ----
// Acrobat named these checkboxes off the printed label text, stripping
// punctuation — so most match by removing punctuation, but a few (marked
// below) don't follow that pattern cleanly and are spelled out explicitly.

const PHOTO_REQS_FIELDS = {
  'Dwelling: each side': 'Dwelling Each side',
  'Roof: each slope': 'Roof Each slope',
  'Plumbing: water heater (incl. TPRV), under cabinet plumbing/drains, exposed valves':
    'Plumbing Water heater incl TPRV under cabinet plumbingdrains exposed valves',
  'Main electrical service panel with interior door label': 'Main electrical service panel with interior door label',
  'Electrical box with panel off': 'Electrical box with panel off',
  'All hazards or deficiencies noted in this report': 'All hazards or deficiencies noted in this report',
};

const ELEC_PRESENCE_FIELDS = {
  'Cloth wiring': 'Cloth wiring',
  'Active knob and tube': 'Active knob and tube',
  'Branch circuit aluminum wiring': 'Branch circuit aluminum wiring If present describe the usage of all aluminum wiring',
  'Connections repaired via COPALUM crimp': 'Connections repaired via COPALUM crimp',
  'Connections repaired via AlumiConn': 'Connections repaired via AlumiConn',
};

const ELEC_HAZARDS_FIELDS = {
  'Blowing fuses': 'Blowing fuses',
  'Tripping breakers': 'Tripping breakers',
  'Empty sockets': 'Empty sockets',
  'Loose wiring': 'Loose wiring',
  'Improper grounding': 'Improper grounding',
  'Corrosion': 'Corrosion',
  'Over fusing': 'Over fusing',
  'Double taps': 'Double taps',
  'Exposed wiring': 'Exposed wiring',
  'Unsafe wiring': 'Unsafe wiring',
  'Improper breaker size': 'Improper breaker size',
  'Scorching': 'Scorching',
  'Other': 'Other explain',
};

const ELEC_WIRING_TYPES_FIELDS = {
  'Copper': 'Copper',
  'Single Strand AL': 'Single Strand AL',
  'Multistrand AL': 'Multistrand AL',
  'Copper Clad AL': 'Copper Clad AL',
  'Cloth (Knob & Tube)': 'Cloth Knob  Tube',
  'Cloth Jacket Rubber Insulated': 'Cloth Jacket Rubber Insulated',
  'NM, BX or Conduit': 'NM BX or Conduit',
  'Other': 'Other',
};

const PLUMB_PIPE_TYPES_FIELDS = {
  'Copper': 'Copper_2',
  'PVC/CPVC': 'PVCCPVC',
  'Galvanized': 'Galvanized',
  'Cast Iron': 'Cast Iron',
  'Polybutylene': 'Polybutylene',
  'PEX': 'PEX',
  'ABS': 'ABS',
  'Other': 'Other specify',
};

const ROOF_DAMAGE_FIELDS_P = {
  'Cracking': 'Cracking',
  'Cupping/curling': 'Cuppingcurling',
  'Excessive granule loss': 'Excessive granule loss',
  'Exposed asphalt': 'Exposed asphalt',
  'Exposed felt': 'Exposed felt',
  'Missing/loose/cracked tabs or tiles': 'Missingloosecracked tabs or tiles',
  'Soft spots in decking': 'Soft spots in decking',
  'Visible hail damage': 'Visible hail damage',
};
const ROOF_DAMAGE_FIELDS_S = Object.fromEntries(
  Object.entries(ROOF_DAMAGE_FIELDS_P).map(([label, name]) => [label, `${name}_2`]),
);

// The plumbing fixture table (10 rows x Satisfactory/Unsatisfactory/N-A) is
// laid out as two 5-row columns on the printed form; most cells got a
// meaningless "undefined_N" name from Acrobat since nothing distinguishes
// them by label alone — mapped here by their verified grid position
// (tools/cdp_inspect_pdf_fields.py, sorted by y).
const PLUMB_FIXTURES_FIELDS = {
  'Dishwasher': { sat: 'Satisfactory_2', unsat: 'Unsatisfactory', na: 'NA' },
  'Refrigerator': { sat: 'undefined_5', unsat: 'undefined_6', na: 'undefined_7' },
  'Washing machine': { sat: 'Washing machine', unsat: 'undefined_11', na: 'undefined_12' },
  'Water heater': { sat: 'undefined_16', unsat: 'undefined_17', na: 'undefined_18' },
  'Showers/Tubs': { sat: 'undefined_21', unsat: 'undefined_22', na: 'undefined_23' },
  'Toilets': { sat: 'Satisfactory_3', unsat: 'Unsatisfactory_2', na: 'NA_2' },
  'Sinks': { sat: 'undefined_8', unsat: 'undefined_9', na: 'undefined_10' },
  'Sump pump': { sat: 'undefined_13', unsat: 'undefined_14', na: 'undefined_15' },
  'Main shut off valve': { sat: 'Main shut off valve', unsat: 'undefined_19', na: 'undefined_20' },
  'All other visible': { sat: 'undefined_24', unsat: 'undefined_25', na: 'undefined_26' },
};

// Age-of-piping rows: the printed form has one blank per category (Original
// to home / Completely re-piped / Partially re-piped) rather than a
// checkbox + separate years field — the years value goes into whichever
// blank matches the selected type.
const SUPPLY_AGE_FIELDS = {
  'Original to home': 'Original to home',
  'Completely re-piped': 'Completely repiped',
  'Partially re-piped': 'Partially repiped',
};
const DRAIN_AGE_FIELDS = {
  'Original to home': 'Original to home_2',
  'Completely re-piped': 'Completely repiped_2',
  'Partially re-piped': 'Partially repiped_2',
};

/** Fields with no dedicated blank on the printed form — folded into Additional Comments instead of silently dropped. */
function collectOverflowNotes(values) {
  const notes = [];
  const add = (label, text) => { if (text) notes.push(`${label}: ${text}`); };
  add('Main panel amperage note', values.elec_main_sufficient === 'No' ? values.elec_main_sufficient_explain : '');
  add('Other electrical hazard', values.elec_hazards_other);
  add('Electrical condition note', values.elec_condition === 'Unsatisfactory' ? values.elec_condition_explain : '');
  add('HVAC condition note', values.hvac_good_order === 'No' ? values.hvac_good_order_explain : '');
  add('Other pipe type', values.plumb_pipe_other);
  add('Re-pipe/renovation', values.plumb_renovation_note);
  add('Roof leak note', values.roof_p_leaks === 'Yes' ? values.roof_leaks_explain : '');
  add('Roof damage note', values.roof_damage_explain);
  return notes;
}

/** Fills the real 4-Point PDF from `values` (inspection.forms.fourpoint) and returns a Blob. */
export async function buildFourPointOfficialPdf(values = {}) {
  await loadVendor();
  const { PDFDocument, StandardFonts } = window.PDFLib;

  const templateBytes = await fetchWithRetry('js/vendor/forms/insp4pt-fillable.pdf', 'arraybuffer');
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Closures (not top-level) so they can reach boldFont without threading it
  // through every call site. Order matters here — confirmed via a canvas
  // pixel-level render check, not just reading the DA string back: setText,
  // then updateAppearances(font) to bake the glyphs, then setDefaultAppearance
  // so the DA reflects navy-bold for any later re-render (e.g. a viewer with
  // NeedAppearances set) too.
  function setText(name, value, fontSize = FONT_SIZE) {
    if (value === undefined || value === null || value === '') return;
    try {
      const tf = form.getTextField(name);
      tf.setText(String(value));
      tf.updateAppearances(boldFont);
      tf.acroField.setDefaultAppearance(`${NAVY_BOLD} /${boldFont.name} ${fontSize} Tf`);
    } catch { /* field not in this build — skip, not fatal */ }
  }

  function setCheckGroup(fieldId, labelToPdfName) {
    const cur = Array.isArray(values[fieldId]) ? values[fieldId] : [];
    for (const label of cur) {
      const pdfName = labelToPdfName[label];
      if (pdfName) setCheck(form, pdfName, true);
    }
  }

  // ---- General Information ----
  setText('InsuredApplicant Name', values.owner_name);
  setText('Application  Policy', values.policy_no);
  setText('Address Inspected', values.address);
  setText('Actual Year Built', values.year_built);
  setText('Date Inspected', values.inspection_date);
  setCheckGroup('photo_reqs', PHOTO_REQS_FIELDS);

  // ---- Electrical ----
  setCheck(form, values.elec_main_type === 'Circuit breaker' ? 'Circuit breaker' : null, true);
  setCheck(form, values.elec_main_type === 'Fuse' ? 'Fuse' : null, true);
  setCheck(form, values.elec_second_type === 'Circuit breaker' ? 'Circuit breaker_2' : null, true);
  setCheck(form, values.elec_second_type === 'Fuse' ? 'Fuse_2' : null, true);
  setText('Total Amps', values.elec_main_amps);
  setText('Total Amps_2', values.elec_second_amps);
  setCheck(form, values.elec_main_sufficient === 'Yes' ? 'Yes' : null, true);
  setCheck(form, values.elec_main_sufficient === 'No' ? 'No explain' : null, true);
  setCheck(form, values.elec_second_sufficient === 'Yes' ? 'Yes_2' : null, true);
  setCheck(form, values.elec_second_sufficient === 'No' ? 'No explain_2' : null, true);
  setCheckGroup('elec_presence', ELEC_PRESENCE_FIELDS);
  setCheckGroup('elec_hazards', ELEC_HAZARDS_FIELDS);
  setCheck(form, values.elec_condition === 'Satisfactory' ? 'Satisfactory' : null, true);
  setCheck(form, values.elec_condition === 'Unsatisfactory' ? 'Unsatisfactory explain' : null, true);
  setText('Panel age', values.elec_main_age);
  setText('Year last updated', values.elec_main_updated);
  setText('BrandModel', values.elec_main_brand);
  setText('Panel age_2', values.elec_second_age);
  setText('Year last updated_2', values.elec_second_updated);
  setText('BrandModel_2', values.elec_second_brand);
  setCheckGroup('elec_wiring_types', ELEC_WIRING_TYPES_FIELDS);

  // ---- HVAC ----
  selectRadio(form, 'hvac_central_ac_radio', values.hvac_central_ac);
  selectRadio(form, 'hvac_central_heat_radio', values.hvac_central_heat);
  setText('If not central heat indicate primary heat source and fuel type', values.hvac_primary_source);
  setCheck(form, values.hvac_good_order === 'Yes' ? 'Yes_5' : null, true);
  setCheck(form, values.hvac_good_order === 'No' ? 'No explain_3' : null, true);
  setText('Date of last HVAC servicinginspection', values.hvac_last_service);
  selectRadio(form, 'hvac_woodstove_radio', values.hvac_woodstove);
  selectRadio(form, 'hvac_woodstove_pro_radio', values.hvac_woodstove_pro);
  selectRadio(form, 'Space heater used as primary heat source', values.hvac_spaceheater);
  selectRadio(form, 'Is the source portable', values.hvac_spaceheater_portable);
  selectRadio(
    form,
    'Does the air handlercondensate line or drain pan show any signs of blockage or leakage including water damage to the surrounding area',
    values.hvac_condensate_issue,
  );
  setText('Age of system', values.hvac_age);
  setText('Year last updated_3', values.hvac_updated);

  // ---- Plumbing ----
  selectRadio(form, 'Is there a temperature pressure relief valve on the water heater', values.plumb_tprv);
  setText('Water heater location', values.plumb_wh_location);
  // These cells are tiny (6x6pt) text fields on this master, not checkboxes
  // — confirmed via tools/cdp_verify_fourpoint_pdf.py (setCheck threw
  // "expected type e, got type r" for every one of them). An "X" reads the
  // same as a checkmark at that size.
  const fixtures = values.plumb_fixtures || {};
  for (const [row, cols] of Object.entries(PLUMB_FIXTURES_FIELDS)) {
    const cell = fixtures[row] || {};
    // These cells are ~6x6pt boxes (Acrobat's own checkbox-sized footprint on
    // the original form) — 9pt would visibly overflow, so this is the
    // smallest size still meeting the 8pt floor asked for everywhere else.
    setText(cell.sat ? cols.sat : null, 'X', 8);
    setText(cell.unsat ? cols.unsat : null, 'X', 8);
    setText(cell.na ? cols.na : null, 'X', 8);
  }
  if (values.plumb_supply_age_type) setText(SUPPLY_AGE_FIELDS[values.plumb_supply_age_type], values.plumb_supply_age_years);
  if (values.plumb_drain_age_type) setText(DRAIN_AGE_FIELDS[values.plumb_drain_age_type], values.plumb_drain_age_years);
  setCheckGroup('plumb_pipe_types', PLUMB_PIPE_TYPES_FIELDS);
  setText('Year Installed', values.plumb_pex_year);
  setText('Age of water heater', values.plumb_wh_age);

  // ---- Roof ----
  // Covering material's box is only ~44pt wide — a full option label like
  // "Asphalt / Fiberglass Shingle" clips at a fixed 9pt, so these two use
  // auto-size (0) instead, same as every field defaulted to before this
  // file forced a fixed size.
  setText('Covering material', values.roof_p_covering, 0);
  setText('Covering material_2', values.roof_s_covering, 0);
  setText('Roof age years', values.roof_p_age);
  setText('Roof age years_2', values.roof_s_age);
  setText('Remaining useful life years', values.roof_p_remaining);
  setText('Remaining useful life years_2', values.roof_s_remaining);
  setText('Date of last roofing permit', values.roof_p_permit_date);
  setText('Date of last roofing permit_2', values.roof_s_permit_date);
  setText('Date of last update', values.roof_p_update_date);
  setText('Date of last update_2', values.roof_s_update_date);
  setCheck(form, values.roof_p_update_type === 'Full replacement' ? 'Full replacement' : null, true);
  setCheck(form, values.roof_p_update_type === 'Partial replacement' ? 'Partial replacement' : null, true);
  setText('of replacement', values.roof_p_update_pct);
  setCheck(form, values.roof_s_update_type === 'Full replacement' ? 'Full replacement_2' : null, true);
  setCheck(form, values.roof_s_update_type === 'Partial replacement' ? 'Partial replacement_2' : null, true);
  setText('of replacement_2', values.roof_s_update_pct);
  setCheck(form, values.roof_p_condition === 'Satisfactory' ? 'Satisfactory_4' : null, true);
  setCheck(form, values.roof_p_condition === 'Unsatisfactory' ? 'Unsatisfactory explain below' : null, true);
  setCheck(form, values.roof_s_condition === 'Satisfactory' ? 'Satisfactory_5' : null, true);
  setCheck(form, values.roof_s_condition === 'Unsatisfactory' ? 'Unsatisfactory explain below_2' : null, true);
  setCheckGroup('roof_p_damage', ROOF_DAMAGE_FIELDS_P);
  setCheckGroup('roof_s_damage', ROOF_DAMAGE_FIELDS_S);
  selectRadio(form, 'Any visible signs of leaks', values.roof_p_leaks);
  selectRadio(form, 'Any visible signs of leaks_2', values.roof_s_leaks);
  selectRadio(form, 'Atticunderside of decking', values.roof_p_attic_evidence);
  selectRadio(form, 'Atticunderside of decking_2', values.roof_s_attic_evidence);
  selectRadio(form, 'Interior ceilings', values.roof_p_ceiling_evidence);
  selectRadio(form, 'Interior ceilings_2', values.roof_s_ceiling_evidence);

  // ---- Additional Comments (+ overflow notes with no dedicated blank) ----
  const overflow = collectOverflowNotes(values);
  const commentsText = [values.additional_comments, ...overflow].filter(Boolean).join('\n');
  setText('Additional CommentsObservations use additional pages if needed', commentsText);

  // ---- Certification ----
  setText('Title', values.insp_title);
  setText('License Number', values.insp_license_no);
  setText('Date', values.insp_date);
  setText('Company Name', values.insp_company);
  setText('License Type', values.insp_license_type);
  setText('Work Phone', values.insp_phone);

  // The Inspector Signature blank has no usable AcroForm text field (Acrobat
  // tagged it as a signature-request artifact instead) — same approach as
  // every other signature on this app's PDFs: draw the image directly at its
  // measured position (page index 2, i.e. visual page 3).
  const pages = pdfDoc.getPages();
  await drawSignature(pdfDoc, pages[2], values.insp_signature, 41.2, 140.3, 139, 14.5);

  // Every text field's appearance was already generated per-field above
  // (setText calls updateAppearances(boldFont) itself) — without this flag,
  // save() would redundantly re-run its own blanket appearance pass, which
  // both undoes the navy-bold styling with default black and throws on the
  // leftover "Signature1_es_:signer:signature" artifact (see
  // build_4point_fields.js's header comment) along the way.
  const bytes = await pdfDoc.save({ updateFieldAppearances: false });
  return new Blob([bytes], { type: 'application/pdf' });
}
