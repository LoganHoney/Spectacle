// Fills the REAL official OIR-B1-1802 (Rev. 04/26) Wind Mitigation form —
// js/vendor/forms/oir-b1-1802-fillable.pdf — with the inspector's actual
// answers from inspection.forms.windmit, producing a PDF that is the genuine
// state form, not a look-alike reproduction.
//
// js/vendor/forms/oir-b1-1802-fillable.pdf was built once, offline, by
// tools/build_fields.js + tools/cdp_build_wind_mit_pdf.py: those scripts
// took the flat official master (floir.gov) and added real AcroForm fields
// at coordinates measured directly from the PDF's own text layer (pdf.js
// getTextContent(), not guessed) — see js/report/render.js's introBlock
// comment for the parallel "verbatim, not paraphrased" precedent this
// follows. The field NAMES below must match that build exactly; if the
// vendored PDF is ever regenerated, keep both in sync.
//
// Known gap: the Q9 Opening Protection matrix (the 6-column x 9-row grid)
// is not field-mapped — its cells are blank vector-drawn boxes with no text
// glyph to anchor a field to, a harder extraction problem than the rest of
// this form. Everything else questions 1-9 answer on is covered.

import { WINDMIT } from '../forms/windmit.js';

// This module's fetches tend to land after a long chain of other requests
// (the app's own module graph loading, IndexedDB work, etc.) — a dropped
// connection this late has been observed directly, not just suspected,
// including the request itself succeeding (HTTP 200) and the body read
// afterward throwing — so the retry has to cover the whole fetch-and-read,
// not just the initial connection. This matches exactly the kind of
// transient failure a field inspector's phone hits on real cell service;
// a couple of quick retries costs nothing when it isn't needed and saves
// the whole PDF build when it is.
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
  if (!vendorPromise) {
    vendorPromise = loadScript('js/vendor/pdf-lib.min.js');
  }
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

// windmit.js's q6_min_conditions / q8_methods checkgroup options, in the
// exact order their PDF checkboxes were created — matched by array index,
// not by string content (the option text is long/legal, the field names are
// short and stable).
const Q6_MIN_FIELDS = ['q6_min_1', 'q6_min_2', 'q6_min_3'];
const Q8_METHOD_FIELDS = ['q8_method_fully_adhered', 'q8_method_tape', 'q8_method_double_layer', 'q8_method_spray_foam', 'q8_method_full_coverage'];

const QUALIFICATION_LICENSE_TYPE = {
  home_inspector: 'Home Inspector',
  building_code: 'Building Code Inspector',
  contractor: 'Contractor',
  engineer: 'Professional Engineer',
  architect: 'Professional Architect',
  other: 'Other',
};

function setText(form, name, value) {
  if (value === undefined || value === null || value === '') return;
  try { form.getTextField(name).setText(String(value)); } catch { /* field not in this build — skip, not fatal */ }
}

function selectRadio(form, name, value) {
  if (!value) return;
  try {
    const rg = form.getRadioGroup(name);
    if (rg.getOptions().includes(value)) rg.select(value);
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

/** Fills the real Wind Mit PDF from `values` (inspection.forms.windmit) and returns a Blob. */
export async function buildWindMitOfficialPdf(values = {}) {
  await loadVendor();
  const { PDFDocument } = window.PDFLib;

  const templateBytes = await fetchWithRetry('js/vendor/forms/oir-b1-1802-fillable.pdf', 'arraybuffer');
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // ---- Owner Information ----
  setText(form, 'owner_inspection_date', values.inspection_date);
  setText(form, 'owner_name', values.owner_name);
  setText(form, 'owner_contact_person', values.contact_person);
  setText(form, 'owner_address', values.address);
  setText(form, 'owner_home_phone', values.home_phone);
  setText(form, 'owner_city', values.city);
  setText(form, 'owner_zip', values.zip);
  setText(form, 'owner_work_phone', values.work_phone);
  setText(form, 'owner_county', values.county);
  setText(form, 'owner_cell_phone', values.cell_phone);
  setText(form, 'owner_insurance_co', values.insurance_co);
  setText(form, 'owner_policy_no', values.policy_no);
  setText(form, 'owner_year_of_home', values.year_of_home);
  setText(form, 'owner_stories', values.stories);
  setText(form, 'owner_email', values.email);

  // ---- Q1-Q3 ----
  selectRadio(form, 'q1_answer', values.q1_answer);
  selectRadio(form, 'q2_answer', values.q2_answer);
  selectRadio(form, 'q3_answer', values.q3_answer);

  // ---- Q4 Roof Covering ----
  const q4 = values.q4_table || {};
  for (const [row, cell] of Object.entries(q4)) {
    if (cell?.inuse) setCheck(form, `q4_inuse_${row}`, true);
    if (cell?.noinfo) setCheck(form, `q4_noinfo_${row}`, true);
  }
  selectRadio(form, 'q4_2_answer', values.q4_2_answer);

  // ---- Q5-Q6 ----
  selectRadio(form, 'q5_answer', values.q5_answer);
  selectRadio(form, 'q6_answer', values.q6_answer);
  // windmit.js stores the selected option *strings*, not indices — map each
  // one back to its position in the field's own option list, since the PDF
  // checkboxes are matched by array index, not by the (long, legal) text.
  if (Array.isArray(values.q6_min_conditions)) {
    const opts = WINDMIT.sections.find((s) => s.id === 'q6').fields.find((f) => f.id === 'q6_min_conditions').options;
    values.q6_min_conditions.forEach((label) => {
      const idx = opts.indexOf(label);
      if (idx >= 0 && Q6_MIN_FIELDS[idx]) setCheck(form, Q6_MIN_FIELDS[idx], true);
    });
  }

  // ---- Q7-Q8 ----
  selectRadio(form, 'q7_answer', values.q7_answer);
  setText(form, 'q7_nonhip_len', values.q7_nonhip_len);
  setText(form, 'q7_perimeter', values.q7_perimeter);
  setText(form, 'q7_flat_area', values.q7_flat_area);
  setText(form, 'q7_total_area', values.q7_total_area);
  selectRadio(form, 'q8_answer', values.q8_answer);
  if (Array.isArray(values.q8_methods)) {
    const opts = WINDMIT.sections.find((s) => s.id === 'q8').fields.find((f) => f.id === 'q8_methods').options;
    values.q8_methods.forEach((label) => {
      const idx = opts.indexOf(label);
      if (idx >= 0 && Q8_METHOD_FIELDS[idx]) setCheck(form, Q8_METHOD_FIELDS[idx], true);
    });
  }

  // ---- Q9 Opening Protection ----
  selectRadio(form, 'q9_answer', values.q9_answer);
  if (values.q9_answer && values.q9_sub) {
    selectRadio(form, `q9_sub_${values.q9_answer}`, values.q9_sub);
  }

  // ---- Qualified Inspector ----
  setText(form, 'insp_name', values.insp_name);
  setText(form, 'insp_print_name', values.insp_name);
  setText(form, 'insp_license_no', values.insp_license_no);
  setText(form, 'insp_company', values.insp_company);
  setText(form, 'insp_phone', values.insp_phone);
  setText(form, 'insp_employee_name', values.insp_employee_name);
  setText(form, 'insp_date', values.insp_date);
  selectRadio(form, 'insp_qualification', values.insp_qualification);
  if (values.insp_qualification) {
    setText(form, 'insp_license_type', QUALIFICATION_LICENSE_TYPE[values.insp_qualification] || '');
  }

  // ---- Homeowner attestation ----
  setText(form, 'owner_sign_date', values.owner_sign_date);

  form.updateFieldAppearances();

  // Signatures are drawn as images over their (blank) placeholder fields —
  // an AcroForm text field can't hold a drawn signature, only typed text.
  const pages = pdfDoc.getPages();
  await drawSignature(pdfDoc, pages[5], values.insp_signature, 200, 592, 180, 26);
  await drawSignature(pdfDoc, pages[5], values.owner_signature, 88, 448, 180, 26);

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
