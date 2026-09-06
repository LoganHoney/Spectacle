// Fills the REAL official OIR-B1-1802 (Rev. 04/26) Wind Mitigation form —
// js/vendor/forms/oir-b1-1802-fillable-v2.pdf — with the inspector's actual
// answers from inspection.forms.windmit.
//
// This master started as a real Acrobat-prepared fillable version the user
// supplied (replacing an earlier hand-measured build) — its 226 field
// names/positions came from Acrobat's own field detection, verified via
// tools/cdp_inspect_pdf_fields.py, then lightly patched by
// tools/build_windmit_fields.js (two bogus fields removed — see that file's
// header). The field NAMES below must match that build exactly; if the
// vendored PDF is ever regenerated, keep both in sync.
//
// Every "radio-style" question here (Q1's A/B/C/D, Q2's HVHZ/Region 1-3,
// etc.) turned out to be independent checkboxes on this master, not a true
// PDFRadioGroup with one shared field name — confirmed via
// tools/cdp_inspect_pdf_fields.py (zero multi-widget fields at all). So
// setOneOf() below just checks the single matching option's own field,
// rather than selecting from a group.
//
// Known gaps (fields on the real form with no corresponding data-model
// question — filling in required expanding the checklist beyond what's
// asked for, so left blank same as the printed form): the FORTIFIED Home
// certificate type (Roof/Silver/Gold) checkboxes near the top of page 1;
// Q6's descriptive sub-bullets under each lettered option (the option
// itself is captured, not which specific sub-condition applied); Q9's
// Plywood/OSB sub-choice under option C; the homeowner's printed name (the
// real form only has Signature + Date for the homeowner, no name blank).
// The big win this master enables that the old hand-measured one couldn't:
// Q9's full 9-row x 6-column opening-protection matrix is a real fillable
// grid here — every cell had no text glyph to anchor a field to on the flat
// master, so it was entirely unmapped before.

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
// and plain black by default. Force a fixed, readable navy-bold for
// everything this app fills in, so an answer always reads as obviously
// distinct from the form's own printed text.
const FONT_SIZE = 9;
const NAVY_BOLD = '0 0 0.5 rg';

function setCheck(form, name, checked = true) {
  if (!name || !checked) return;
  try { form.getCheckBox(name).check(); } catch { /* field not in this build — skip */ }
}

/** Checks the one field matching `key` out of a {key: pdfFieldName} map — this master's "radio" questions are independent checkboxes, not a PDFRadioGroup. */
function setOneOf(form, map, key) {
  if (!key) return;
  setCheck(form, map[key]);
}

/** yyyy-mm-dd (HTML date input format) -> { mm, dd, yyyy }, all '' if unparseable. */
function splitDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { yyyy: m[1], mm: m[2], dd: m[3] } : { yyyy: '', mm: '', dd: '' };
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

// windmit.js's q6_min_conditions / q8_methods checkgroup options, in the
// exact order their PDF checkboxes are listed below — matched by array
// index, not by string content (the option text is long/legal, the field
// names below are short and stable).
const WINDMIT_Q6_MIN_OPTIONS = [
  'Metal connectors secured to truss/rafter with ≥3 nails, attached to top plate or embedded in bond beam with <½" gap, free of visible severe corrosion',
  'Single-strap connector wraps over truss/rafter, secured with ≥3 nails each side, free of visible severe corrosion',
  'Purpose-made connector/fastener installed per manufacturer specifications to substantiated capacity',
];
const WINDMIT_Q8_METHOD_OPTIONS = [
  'Fully adhered polymer-modified bitumen underlayment (ASTM D1970)',
  'Tape over roof deck seams (≥3.75" self-adhering polymer-modified bitumen or AAMA 711 Level 3 tape)',
  'Double layer of felt or synthetic with no tape',
  'Spray foam products along rafter deck intersections and panel joints',
  'Entire roof deck underside covered',
];

// ---- option key -> PDF field name, one map per question ----

const Q1_ANSWER_FIELDS = {
  A: 'A Code in force at time of permit application was the FBC 2001  2004 Year Built',
  B: 'B Code in force at time of permit application was the FBC 2007 and later Year Built',
  C: 'C For the HVHZ Only Code in force at time of permit application was the SFBC94 Year Built',
  D: 'D Unknown or does not meet the requirements of Answer A or B or C',
};
// Each of A/B/C has its own Year Built + Permit Date blanks (different code
// eras) — only the selected option's set gets filled, matching the printed
// form (the other two stay blank, same as on paper).
const Q1_YEAR_BUILT_FIELDS = { A: 'For homes built in 20022003', B: 'For homes built in 20072008', C: 'For homes built in 1994' };
const Q1_PERMIT_DATE_SPLIT_FIELDS = {
  A: { mm: 'provide a permit application with a date after 312002 Building Permit Application Date MMDDYYYY', dd: 'undefined', yyyy: 'undefined_2' },
  B: { mm: 'provide a permit application with a date after 1282006 Building Permit Application Date MMDDYYYY', dd: 'undefined_3', yyyy: 'undefined_4' },
};
// Option C's permit date is one combined blank on this master, not split MM/DD/YYYY.
const Q1_PERMIT_DATE_C_FIELD = 'undefined_5';

const Q2_ANSWER_FIELDS = {
  'HVHZ': 'HVHZ',
  'Region 1': 'toggle_9',
  'Region 2': 'Region 2 130 mph  139 mph',
  'Region 3': 'Region 3  130 mph',
};

const Q3_ANSWER_FIELDS = { '≥ 6:12': 'toggle_12', '< 6:12': 'Less than  612' };

// Q4.1 table: one row per roof covering type, each with an in-use checkbox,
// a permit date split into MM/DD/YYYY, an approval-number blank and a
// year-installed blank. "Other" additionally has its own describe-text
// field. No "No Info Provided" column was detected on this master (the
// same gap this app's old hand-measured build also had for that column).
const Q4_ROW_FIELDS = {
  'Asphalt/Fiberglass Shingle': { inuse: 'AsphaltFiberglass', mm: 'Application Date', dd: 'undefined_6', yyyy: 'undefined_7', approval: 'Approval 1', year: 'Replacement 1' },
  'Concrete/Clay Tile': { inuse: 'ConcreteClay Tile', mm: '1', dd: 'undefined_8', yyyy: 'undefined_9', approval: 'Approval 2', year: 'Replacement 2' },
  'Synthetic/Composite Tile': { inuse: 'SyntheticComposite Tile', mm: '2', dd: 'undefined_10', yyyy: 'undefined_11', approval: '1_2', year: '1_3' },
  'Metal': { inuse: 'Metal', mm: '3', dd: 'undefined_12', yyyy: 'undefined_13', approval: '2_2', year: '2_3' },
  'Built Up': { inuse: 'Built Up', mm: '4', dd: 'undefined_14', yyyy: 'undefined_15', approval: '3_2', year: '3_3' },
  'Membrane': { inuse: 'Membrane', mm: '5', dd: 'undefined_16', yyyy: 'undefined_17', approval: '4_2', year: '4_3' },
  'Other': { inuse: 'Other', mm: 'undefined_19', dd: 'undefined_20', yyyy: 'undefined_21', approval: 'undefined_22', year: 'undefined_23' },
};
const Q4_OTHER_DESC_FIELD = 'undefined_18';

const Q4_2_ANSWER_FIELDS = {
  A: 'A All roof coverings listed above meet the FBC with a FBC or MiamiDade Product Approval listing current at the time of installation',
  B: 'B All roof coverings have a MiamiDade Product Approval listing current at time of installation OR for the HVHZ only a roofing',
  C: 'C One or more roof coverings do not meet the requirements of Answer A or B',
  D: 'D No roof coverings meet the requirements of Answer A or B',
};

const Q5_ANSWER_FIELDS = {
  A: 'A PlywoodOriented strand board OSB roof sheathing with minimum thickness of 716 attached to the roof trussrafter spaced a',
  B: 'B PlywoodOSB roof sheathing with a minimum thickness of 716 attached to the roof trussrafter spaced a maximum of 24 oc',
  C: 'C PlywoodOSB roof sheathing with a minimum thickness of 716 attached to the roof trussrafter spaced a maximum of 24 oc',
  D: 'D Reinforced Concrete Roof Deck',
  E: 'E Spray foam products with an uplift resistance of 110 PSF FOS 15 Spray foam must be installed along rafter deck intersections',
  F: 'F Other',
  G: 'G Unknown or unidentified',
  H: 'H No attic access',
};
const Q5_OTHER_DESC_FIELD = 'all panel joints etc';

const Q6_ANSWER_FIELDS = {
  A: 'A Toenails',
  B: 'B Clips',
  C: 'C Single Wraps',
  D: 'D Double Wraps',
  E: 'E Structural Anchor bolts structurally connected or reinforced concrete roof',
  F: 'F Other_2',
  G: 'G Unknown or unidentified_2',
  H: 'H No attic access_2',
  I: 'I Connections not installed as intended',
};
const Q6_OTHER_DESC_FIELD = 'undefined_24';
// windmit.js stores the selected option *strings*, not indices — these match
// by array index against WINDMIT's own q6_min_conditions option list.
const Q6_MIN_CONDITION_FIELDS = [
  '1 Metal connectors secured to trussrafter with a minimum of three 3 nails and attached to the side andor bottom of the',
  '2 Metal connectors consisting of a single strap that wraps over the trussrafter are secured to the side of the wall andor',
  '3 Purposemade metal connectors or structural fasteners installed per the manufacturers installation specifications to',
];

const Q7_ANSWER_FIELDS = {
  A: 'A Hip Roof',
  B: 'B Flat Roof',
  C: 'C Other Roof Any roof that does not qualify as either A or B above',
};

const Q8_ANSWER_FIELDS = {
  A: 'A Sealed Roof Deck also called SWR',
  B: 'B No Sealed Roof Deck',
  C: 'C Unknown or undetermined',
};
const Q8_METHOD_FIELDS = [
  'Fully adhered polymermodified bitumen roofing underlayment complying with ASTM D1970',
  'Tape over roof deck seams with felt or synthetic A minimum 375inchwide 95 mm strip of selfadhering polymer',
  'Double layer of felt or synthetic with no tape Two layers of ASTM D226 Type II ASTM D4869 Type III or Type IV or',
  'Spray foam products Spray foam must be installed along rafter deck intersections all panel joints etc',
  'check here if entire roof deck underside covered',
];

// Q9's opening-protection matrix — 9 rows x 6 columns, all real checkboxes
// on this master (the one thing the old hand-measured build couldn't do at
// all). Row order and column ids match WINDMIT.sections' q9_table exactly.
const Q9_TABLE_FIELDS = {
  'N/A — no openings of this type': {
    win_entry: 'Windows or Entry DoorsNot applicable  there are no openings of this type on the structure',
    garage_glazed: 'Garage DoorsNot applicable  there are no openings of this type on the structure',
    skylights: 'SkylightsNot applicable  there are no openings of this type on the structure',
    glass_block: 'Glass BlockNot applicable  there are no openings of this type on the structure',
    entry_nonglazed: 'Entry DoorsRow1', garage_nonglazed: 'Garage DoorsRow1',
  },
  'A — Cyclic pressure & 9 lb. large missile (4.5 lb. skylights)': {
    win_entry: 'Windows or Entry DoorsVerified cyclic pressure  large missile 9 lb for windows doors45 lb for skylights',
    garage_glazed: 'Garage DoorsVerified cyclic pressure  large missile 9 lb for windows doors45 lb for skylights',
    skylights: 'SkylightsVerified cyclic pressure  large missile 9 lb for windows doors45 lb for skylights',
    glass_block: 'Glass BlockVerified cyclic pressure  large missile 9 lb for windows doors45 lb for skylights',
    entry_nonglazed: 'Entry DoorsRow2', garage_nonglazed: 'Garage DoorsRow2',
  },
  'B — Cyclic pressure & 4-8 lb. large missile (2 lb. skylights)': {
    win_entry: 'Windows or Entry DoorsVerified cyclic pressure  large missile 48 lb for windows doors2 lb for skylights',
    garage_glazed: 'Garage DoorsVerified cyclic pressure  large missile 48 lb for windows doors2 lb for skylights',
    skylights: 'SkylightsVerified cyclic pressure  large missile 48 lb for windows doors2 lb for skylights',
    glass_block: 'Glass BlockVerified cyclic pressure  large missile 48 lb for windows doors2 lb for skylights',
    entry_nonglazed: 'Entry DoorsRow3', garage_nonglazed: 'Garage DoorsRow3',
  },
  'C — Plywood/OSB meeting Table 1609.1.2 FBC 2007': {
    win_entry: 'Windows or Entry DoorsVerified plywoodOSB meeting Table 160912 of the FBC 2007',
    garage_glazed: 'Garage DoorsVerified plywoodOSB meeting Table 160912 of the FBC 2007',
    skylights: 'SkylightsVerified plywoodOSB meeting Table 160912 of the FBC 2007',
    glass_block: 'Glass BlockVerified plywoodOSB meeting Table 160912 of the FBC 2007',
    entry_nonglazed: 'Entry DoorsRow4', garage_nonglazed: 'Garage DoorsRow4',
  },
  'D — Non-glazed doors meeting ASTM E330 / ANSI-DASMA 108 / PA-TAS 202': {
    win_entry: 'Windows or Entry DoorsVerified NonGlazed Entry or Garage Doors indicating compliance with ASTM E 330 ANSIDASMA 108 or PATAS 202 for wind pressure resistance',
    garage_glazed: 'Garage DoorsVerified NonGlazed Entry or Garage Doors indicating compliance with ASTM E 330 ANSIDASMA 108 or PATAS 202 for wind pressure resistance',
    skylights: 'SkylightsVerified NonGlazed Entry or Garage Doors indicating compliance with ASTM E 330 ANSIDASMA 108 or PATAS 202 for wind pressure resistance',
    glass_block: 'Glass BlockVerified NonGlazed Entry or Garage Doors indicating compliance with ASTM E 330 ANSIDASMA 108 or PATAS 202 for wind pressure resistance',
    entry_nonglazed: 'Entry DoorsRow5', garage_nonglazed: 'Garage DoorsRow5',
  },
  'N — Appears to be A or B but not verified': {
    win_entry: 'Windows or Entry DoorsOpening Protection products that appear to be A or B but are not verified',
    garage_glazed: 'Garage DoorsOpening Protection products that appear to be A or B but are not verified',
    skylights: 'SkylightsOpening Protection products that appear to be A or B but are not verified',
    glass_block: 'Glass BlockOpening Protection products that appear to be A or B but are not verified',
    entry_nonglazed: 'Entry DoorsRow6', garage_nonglazed: 'Garage DoorsRow6',
  },
  'Other protective coverings not identified as A, B or C': {
    win_entry: 'Windows or Entry DoorsOther protective coverings that cannot be identified as A B or C',
    garage_glazed: 'Garage DoorsOther protective coverings that cannot be identified as A B or C',
    skylights: 'SkylightsOther protective coverings that cannot be identified as A B or C',
    glass_block: 'Glass BlockOther protective coverings that cannot be identified as A B or C',
    entry_nonglazed: 'Entry DoorsRow7', garage_nonglazed: 'Garage DoorsRow7',
  },
  'X — No windborne debris protection': {
    win_entry: 'Windows or Entry DoorsNo Windborne Debris Protection',
    garage_glazed: 'Garage DoorsNo Windborne Debris Protection',
    skylights: 'SkylightsNo Windborne Debris Protection',
    glass_block: 'Glass BlockNo Windborne Debris Protection',
    entry_nonglazed: 'Entry DoorsRow8', garage_nonglazed: 'Garage DoorsRow8',
  },
  'Z — Damaged, needs repair/replacement': {
    win_entry: 'Windows or Entry DoorsDamaged openings in need of repairreplacement',
    garage_glazed: 'Garage DoorsDamaged openings in need of repairreplacement',
    skylights: 'SkylightsDamaged openings in need of repairreplacement',
    glass_block: 'Glass BlockDamaged openings in need of repairreplacement',
    entry_nonglazed: 'Entry DoorsRow9', garage_nonglazed: 'Garage DoorsRow9',
  },
};

const Q9_ANSWER_FIELDS = {
  A: 'A Exterior Openings Cyclic Pressure and 9lb Large Missile 45 lb for skylights only All glazed openings are protected at a',
  B: 'B Exterior Opening ProtectionCyclic Pressure and 4 to 8lb Large Missile 245 lb for skylights only All glazed openings',
  C: 'C Exterior Opening Protection  Wood Structural Panels meeting FBC 2007 All glazed openings are covered with',
  N: 'N Exterior Opening Protection unverified shutter systems with no documentation All glazed openings are protected with',
  X: 'X None or Some Glazed Openings One or more glazed openings classified Level X or Z in the table above and None in the factor',
  Z: 'Z Damaged Openings One or more openings are damaged and in need of repair or replacement Any openings meeting Level Z',
};
// Each answer needing a non-glazed qualifier (A/B/C/N) has its own 3-option
// sub-choice on the printed form — resolved against whichever one matches
// the selected q9_answer.
const Q9_SUB_FIELDS = {
  A: { 1: 'A1 All nonglazed openings classified as A in the table above or no nonglazed openings exist', 2: 'A2 One or more nonglazed openings classified as Level D in the table above and no nonglazed openings classified as Level B C N or X', 3: 'A3 One or more nonglazed openings is classified as Level B C N X or Z in the table above' },
  B: { 1: 'B1 All nonglazed openings classified as A or B in the table above or no nonglazed openings exist', 2: 'B2 One or more nonglazed openings classified as Level D in the table above and no nonglazed openings classified as Level C N or X in', 3: 'B3 One or more nonglazed openings is classified as Level C N X or Z in the table above' },
  C: { 1: 'C1 All nonglazed openings classified as A B or C in the table above or no nonglazed openings exist', 2: 'C2 One or more nonglazed openings classified as Level D in the table above and no nonglazed openings classified as Level N or X', 3: 'C3 One or more nonglazed openings is classified as Level N X or Z in the table above' },
  N: { 1: 'N1 All nonglazed openings classified as Level A B C or N in the table above or no nonglazed openings exist', 2: 'N2 One or more nonglazed openings classified as Level D in the table above and no nonglazed openings classified as Level X in the', 3: 'N3 One or more nonglazed openings is classified as Level X or Z in the table above' },
};

const INSP_QUALIFICATION_FIELDS = {
  home_inspector: 'Home inspector licensed under Section 4688314 Florida Statutes who has completed the statutory number of hours of hurricane mitigation training',
  building_code: 'Building code inspector certified under Section 468607 Florida Statutes',
  contractor: 'General building or residential contractor licensed under Section 489111 Florida Statutes',
  engineer: 'Professional engineer licensed under Section 471015 Florida Statutes',
  architect: 'Professional architect licensed under Section 481213 Florida Statutes',
  other: 'Any other individual or entity recognized by the insurer as possessing the necessary qualifications to properly complete a uniform mitigation',
};
const QUALIFICATION_LICENSE_TYPE = {
  home_inspector: 'Home Inspector',
  building_code: 'Building Code Inspector',
  contractor: 'Contractor',
  engineer: 'Professional Engineer',
  architect: 'Professional Architect',
  other: 'Other',
};

/** Fills the real Wind Mit PDF from `values` (inspection.forms.windmit) and returns a Blob. */
export async function buildWindMitOfficialPdf(values = {}) {
  await loadVendor();
  const { PDFDocument, StandardFonts } = window.PDFLib;

  const templateBytes = await fetchWithRetry('js/vendor/forms/oir-b1-1802-fillable-v2.pdf', 'arraybuffer');
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Closure (not top-level) so it can reach boldFont without threading it
  // through every call site. Order matters here — confirmed via a canvas
  // pixel-level render check on the 4-Point build, not just reading the DA
  // string back: setText, then updateAppearances(font) to bake the glyphs,
  // then setDefaultAppearance so the DA reflects navy-bold for any later
  // re-render (e.g. a viewer with NeedAppearances set) too.
  function setText(name, value, fontSize = FONT_SIZE) {
    if (value === undefined || value === null || value === '') return;
    try {
      const tf = form.getTextField(name);
      tf.setText(String(value));
      tf.updateAppearances(boldFont);
      tf.acroField.setDefaultAppearance(`${NAVY_BOLD} /${boldFont.name} ${fontSize} Tf`);
    } catch { /* field not in this build — skip, not fatal */ }
  }

  // ---- Owner Information ----
  setText('Inspection Date', values.inspection_date);
  setText('Owner Name', values.owner_name);
  setText('Contact Person', values.contact_person);
  setText('Address', values.address);
  setText('Home Phone', values.home_phone);
  setText('City', values.city);
  setText('Zip', values.zip);
  setText('Work Phone', values.work_phone);
  setText('County', values.county);
  setText('Cell Phone', values.cell_phone);
  setText('Insurance Company', values.insurance_co);
  setText('Policy', values.policy_no);
  setText('Year of Home', values.year_of_home);
  setText(' of Stories', values.stories);
  setText('Email', values.email);

  // ---- Q1 Building Code ----
  setOneOf(form, Q1_ANSWER_FIELDS, values.q1_answer);
  if (['A', 'B', 'C'].includes(values.q1_answer)) {
    setText(Q1_YEAR_BUILT_FIELDS[values.q1_answer], values.q1_year_built);
    if (values.q1_answer === 'C') {
      setText(Q1_PERMIT_DATE_C_FIELD, values.q1_permit_date);
    } else {
      const { mm, dd, yyyy } = splitDate(values.q1_permit_date);
      const f = Q1_PERMIT_DATE_SPLIT_FIELDS[values.q1_answer];
      setText(f.mm, mm);
      setText(f.dd, dd);
      setText(f.yyyy, yyyy);
    }
  }

  // ---- Q2-Q3 ----
  setOneOf(form, Q2_ANSWER_FIELDS, values.q2_answer);
  setOneOf(form, Q3_ANSWER_FIELDS, values.q3_answer);

  // ---- Q4 Roof Covering ----
  const q4 = values.q4_table || {};
  for (const [row, cell] of Object.entries(q4)) {
    const fields = Q4_ROW_FIELDS[row];
    if (!fields || !cell) continue;
    if (cell.inuse) setCheck(form, fields.inuse);
    const { mm, dd, yyyy } = splitDate(cell.permit);
    setText(fields.mm, mm);
    setText(fields.dd, dd);
    setText(fields.yyyy, yyyy);
    setText(fields.approval, cell.approval);
    setText(fields.year, cell.year);
  }
  setText(Q4_OTHER_DESC_FIELD, values.q4_other_desc);
  setOneOf(form, Q4_2_ANSWER_FIELDS, values.q4_2_answer);

  // ---- Q5-Q6 ----
  setOneOf(form, Q5_ANSWER_FIELDS, values.q5_answer);
  setText(Q5_OTHER_DESC_FIELD, values.q5_other_desc);
  setOneOf(form, Q6_ANSWER_FIELDS, values.q6_answer);
  setText(Q6_OTHER_DESC_FIELD, values.q6_other_desc);
  if (Array.isArray(values.q6_min_conditions)) {
    values.q6_min_conditions.forEach((label) => {
      const idx = WINDMIT_Q6_MIN_OPTIONS.indexOf(label);
      if (idx >= 0 && Q6_MIN_CONDITION_FIELDS[idx]) setCheck(form, Q6_MIN_CONDITION_FIELDS[idx]);
    });
  }

  // ---- Q7-Q8 ----
  setOneOf(form, Q7_ANSWER_FIELDS, values.q7_answer);
  setText('Total length of nonhip features', values.q7_nonhip_len);
  setText('feet Total roof system perimeter', values.q7_perimeter);
  setText('212 Roof area with slope less than 212', values.q7_flat_area);
  setText('sq ft Total roof area', values.q7_total_area);
  setOneOf(form, Q8_ANSWER_FIELDS, values.q8_answer);
  if (Array.isArray(values.q8_methods)) {
    values.q8_methods.forEach((label) => {
      const idx = WINDMIT_Q8_METHOD_OPTIONS.indexOf(label);
      if (idx >= 0 && Q8_METHOD_FIELDS[idx]) setCheck(form, Q8_METHOD_FIELDS[idx]);
    });
  }

  // ---- Q9 Opening Protection ----
  // The grid cells are tiny text fields on this master, not checkboxes
  // (confirmed via tools/cdp_verify_windmit_v2_pdf.py — setCheck threw
  // "expected type e, got type r" for every one of them). An "X" reads the
  // same as a checkmark at that size, same fix as the 4-Point plumbing grid.
  const q9 = values.q9_table || {};
  for (const [row, cols] of Object.entries(q9)) {
    const fields = Q9_TABLE_FIELDS[row];
    if (!fields || !cols) continue;
    for (const [colId, name] of Object.entries(fields)) {
      if (cols[colId]) setText(name, 'X');
    }
  }
  setOneOf(form, Q9_ANSWER_FIELDS, values.q9_answer);
  if (values.q9_answer && values.q9_sub && Q9_SUB_FIELDS[values.q9_answer]) {
    setCheck(form, Q9_SUB_FIELDS[values.q9_answer][values.q9_sub]);
  }

  // ---- Qualified Inspector ----
  setText('Qualified Inspector Name', values.insp_name);
  setText('License or Certificate', values.insp_license_no);
  setText('Inspection Company', values.insp_company);
  setText('Phone', values.insp_phone);
  setOneOf(form, INSP_QUALIFICATION_FIELDS, values.insp_qualification);
  if (values.insp_qualification) setText('License Type', QUALIFICATION_LICENSE_TYPE[values.insp_qualification] || '');

  // ---- Certification / signatures (page index 5) ----
  setText('I', values.insp_name); // "I, ___(print name)___, am a qualified inspector..."
  setText('contractors and professional engineers only I had my employee', values.insp_employee_name);
  setText('Date', values.insp_date);
  setText('Date_2', values.owner_sign_date);

  // Signatures are drawn as images over their (blank) placeholder fields —
  // an AcroForm text field can't hold a drawn signature, only typed text.
  const pages = pdfDoc.getPages();
  await drawSignature(pdfDoc, pages[5], values.insp_signature, 169.9, 591, 175.1, 16.4);
  await drawSignature(pdfDoc, pages[5], values.owner_signature, 89.2, 446.5, 208.9, 11.9);

  // Every text field's appearance was already generated per-field above
  // (setText calls updateAppearances(boldFont) itself) — without this flag,
  // save() would redundantly re-run its own blanket appearance pass and
  // undo the navy-bold styling with default black.
  const bytes = await pdfDoc.save({ updateFieldAppearances: false });
  return new Blob([bytes], { type: 'application/pdf' });
}
