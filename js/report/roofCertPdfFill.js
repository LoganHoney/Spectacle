// Fills the real Roof Certification form (Sample Form RCF-1 03/25) —
// js/vendor/forms/roofcert-fillable.pdf — with the inspector's actual
// answers from inspection.forms.roofcert.
//
// This master started as a real Acrobat-prepared fillable version the user
// supplied — field names/positions came from Acrobat's own field detection,
// verified via tools/cdp_inspect_pdf_fields.py. Its roof section is
// near-identical to the 4-Point form's (see js/forms/roofcert.js's header),
// so this fill logic mirrors fourPointPdfFill.js's roof-section handling —
// same shape, different (and in this master, unclashed/simpler-numbered)
// field names, since this form has no electrical/HVAC/plumbing sections
// ahead of the roof section competing for "Satisfactory"-style names.

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

function selectRadio(form, name, value) {
  if (!value) return;
  try {
    const rg = form.getRadioGroup(name);
    // Acrobat suffixed every duplicate-named option on this master to keep
    // them unique ('Yes_3', 'No_3', ...) — match either the plain value or
    // its suffixed form, same reasoning as fourPointPdfFill.js.
    const options = rg.getOptions();
    const match = options.find((o) => o === value || o.startsWith(`${value}_`));
    if (match) rg.select(match);
  } catch { /* field not in this build — skip */ }
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

/** Fills the real Roof Certification PDF from `values` (inspection.forms.roofcert) and returns a Blob. */
export async function buildRoofCertOfficialPdf(values = {}) {
  await loadVendor();
  const { PDFDocument, StandardFonts } = window.PDFLib;

  const templateBytes = await fetchWithRetry('js/vendor/forms/roofcert-fillable.pdf', 'arraybuffer');
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Closure (not top-level) so it can reach boldFont without threading it
  // through every call site — same navy-bold approach as fourPointPdfFill.js
  // and windmitPdfFill.js, verified there via a canvas pixel-level render
  // check, not just reading the DA string back.
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
    for (const label of cur) setCheck(form, labelToPdfName[label]);
  }

  // ---- General Information ----
  setText('ApplicantInsured Name', values.owner_name);
  setText('ApplicationPolicy', values.policy_no);
  setText('Address Inspected', values.address);
  setText('Date of Inspection', values.inspection_date);

  // ---- Roof ----
  // Covering material's box is only ~44pt wide — a full option label like
  // "Asphalt / Fiberglass Shingle" clips at a fixed 9pt, so these two use
  // auto-size (0) instead, same fix as fourPointPdfFill.js.
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
  setCheck(form, values.roof_p_update_type === 'Full replacement' ? 'Full replacement' : null);
  setCheck(form, values.roof_p_update_type === 'Partial replacement' ? 'Partial replacement' : null);
  setText('of replacement', values.roof_p_update_pct);
  setCheck(form, values.roof_s_update_type === 'Full replacement' ? 'Full replacement_2' : null);
  setCheck(form, values.roof_s_update_type === 'Partial replacement' ? 'Partial replacement_2' : null);
  setText('of replacement_2', values.roof_s_update_pct);
  setCheck(form, values.roof_p_condition === 'Satisfactory' ? 'Satisfactory' : null);
  setCheck(form, values.roof_p_condition === 'Unsatisfactory' ? 'Unsatisfactory explain below' : null);
  setCheck(form, values.roof_s_condition === 'Satisfactory' ? 'Satisfactory_2' : null);
  setCheck(form, values.roof_s_condition === 'Unsatisfactory' ? 'Unsatisfactory explain below_2' : null);
  setCheckGroup('roof_p_damage', ROOF_DAMAGE_FIELDS_P);
  setCheckGroup('roof_s_damage', ROOF_DAMAGE_FIELDS_S);
  selectRadio(form, 'Any visible signs of leaks', values.roof_p_leaks);
  selectRadio(form, 'Any visible signs of leaks_2', values.roof_s_leaks);
  selectRadio(form, 'Atticunderside of decking', values.roof_p_attic_evidence);
  selectRadio(form, 'Atticunderside of decking_2', values.roof_s_attic_evidence);
  selectRadio(form, 'Interior ceilings', values.roof_p_ceiling_evidence);
  selectRadio(form, 'Interior ceilings_2', values.roof_s_ceiling_evidence);

  // ---- Additional Comments (+ overflow notes with no dedicated blank) ----
  const overflow = [];
  if (values.roof_p_leaks === 'Yes' && values.roof_leaks_explain) overflow.push(`Roof leak note: ${values.roof_leaks_explain}`);
  if (values.roof_damage_explain) overflow.push(`Roof damage note: ${values.roof_damage_explain}`);
  const commentsText = [values.additional_comments, ...overflow].filter(Boolean).join('\n');
  setText('Additional CommentsObservations use additional pages as needed', commentsText);

  // ---- Certification ----
  setText('Title', values.insp_title);
  setText('License Number', values.insp_license_no);
  setText('Date', values.insp_date);
  setText('Company Name', values.insp_company);
  setText('License Type', values.insp_license_type);
  setText('Work Phone', values.insp_phone);

  // "Inspector Signature" is a real named field on this master, but an
  // AcroForm text field can't hold a drawn signature, only typed text — draw
  // the image directly over it, same as every other signature on this app's PDFs.
  const pages = pdfDoc.getPages();
  await drawSignature(pdfDoc, pages[1], values.insp_signature, 41.2, 527.3, 139, 26.5);

  // Every text field's appearance was already generated per-field above
  // (setText calls updateAppearances(boldFont) itself) — without this flag,
  // save() would redundantly re-run its own blanket appearance pass and
  // undo the navy-bold styling with default black.
  const bytes = await pdfDoc.save({ updateFieldAppearances: false });
  return new Blob([bytes], { type: 'application/pdf' });
}
