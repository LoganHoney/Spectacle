// Patches tools/masters/windmit-fillable.pdf — the real Acrobat-prepared
// fillable version of OIR-B1-1802 the user supplied — into
// js/vendor/forms/oir-b1-1802-fillable-v2.pdf.
//
// This master needed far less surgery than the 4-Point one
// (build_4point_fields.js): every one of its 226 fields has exactly one
// widget (verified via tools/cdp_inspect_pdf_fields.py — no merged Yes/No
// pairs to split), and every "radio-style" question (Q1's A/B/C/D, Q2's
// HVHZ/Region 1-3, etc.) turned out to be independent checkboxes rather
// than a true PDFRadioGroup, one per option — js/report/windmitPdfFill.js
// just checks the one matching option directly rather than selecting from
// a group. Only two fields needed removing: a section-header box Acrobat
// mistakenly turned into a fillable field, and a stray duplicate detection
// of a row label in the Q9 opening-protection grid.
//
// Exposed as window.buildWindMitFieldsV2(pdfBytes) -> Promise<Uint8Array>

const BOGUS_FIELDS = [
  'Owner Information', // section header, not a blank
  'X', // stray duplicate of the Q9 grid's "X" row label — the 6 real per-column cells for that row are separate fields
];

function removeIfPresent(form, name) {
  try {
    const field = form.getField(name);
    form.removeField(field);
  } catch { /* not present, or pdf-lib can't clean up this one's appearance — harmless either way */ }
}

window.buildWindMitFieldsV2 = async function (pdfBytes) {
  const { PDFDocument } = window.PDFLib;
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = doc.getForm();

  for (const name of BOGUS_FIELDS) removeIfPresent(form, name);

  return doc.save({ updateFieldAppearances: false });
};
