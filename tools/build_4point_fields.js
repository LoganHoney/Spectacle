// Patches tools/masters/4p-fillable.pdf — the real Acrobat-prepared fillable
// version of Citizens' 4-Point Inspection Form (Insp4pt 03/25) the user
// supplied — into js/vendor/forms/insp4pt-fillable.pdf.
//
// Unlike the Wind Mit build (which hand-measures every field position from
// scratch off a flat master), this master ALREADY has ~186 real AcroForm
// fields with correct names/positions from Acrobat's own field detection —
// verified via tools/cdp_inspect_pdf_fields.py. Almost all of them are used
// as-is by name in js/report/fourPointPdfFill.js. This script only patches
// the handful of problems Acrobat's row-based auto-detection introduced:
//
// 1. Two pairs of checkboxes that are logically independent questions but
//    got merged into shared radio groups by Acrobat (because they sit on
//    the same visual row): "Central heat" (holds both Central AC's and
//    Central Heat's Yes widgets) + "undefined_4" (both their No widgets),
//    and "Is a woodburning stove..." (holds both the woodstove-present and
//    professionally-installed Yes/No pairs). Selecting one option in the
//    merged group would silently deselect the other — a real homeowner can
//    have Central AC AND Central Heat both "Yes" at once, so this has to be
//    split into 4 independent 2-option radio groups at the exact same
//    widget positions (verified via tools/cdp_inspect_pdf_widgets.py).
//
// 2. Bogus fields: Acrobat's field detection over-triggered on large boxed
//    text regions that are just section headers/instructional text in the
//    original form (e.g. "Documenting the Condition of Each System"), not
//    actual blanks — left as real AcroForm fields they'd show as fillable
//    (and highlight, in viewers with "highlight fields" on) over plain
//    static text. Removed entirely so the form reads as a normal printed
//    page.
//
// One field is deliberately left alone: "Signature1_es_:signer:signature",
// an Acrobat Sign artifact sitting at the real Inspector Signature position.
// pdf-lib's removeField() throws on it (it has no /AP normal-appearance
// entry, a signature-field quirk pdf-lib doesn't handle) — removeIfPresent
// swallows that and leaves it in place, which is harmless: fourPointPdfFill.js
// never calls setText on it, it just draws the signature image at its rect,
// same as every other signature on this app's PDFs.
//
// Exposed as window.build4PointFields(pdfBytes) -> Promise<Uint8Array>

const BOGUS_FIELDS = [
  // page 0 (visual page 1)
  'Hazards Present Blowing fuses Tripping breakers Empty sockets Loose wiring Improper grounding Corrosion Over fusing',
  'Double taps Exposed wiring Unsafe wiring Improper breaker size Scorching Other explain',
  'General condition of the electrical system Satisfactory Unsatisfactory explain',
  'Supplemental information', 'Main Panel', 'Second Panel',
  'undefined', 'undefined_2', 'undefined_3',
  // page 1 (visual page 2)
  '4Point Inspection Form', 'Supplemental Information',
  'Age of system Year last updated Please attach photos of HVAC equipment including dated manufacturers plate',
  'Plumbing System', 'Supplemental Information_2', 'Sample Form Insp4pt 03 25',
  // page 3 (visual page 4) — entirely instructional text, no real fields
  'Photo Requirements', 'Inspector Requirements', 'Documenting the Condition of Each System',
  'Additional Comments or Observations', 'Note to All Agents',
];

function removeIfPresent(form, name) {
  try {
    const field = form.getField(name);
    form.removeField(field);
  } catch { /* not present — fine, list is defensive */ }
}

function splitIntoRadios(form, doc, mergedNames, splits) {
  // mergedNames: the shared field(s) to remove first. splits: [{ name, options: [{value, page, x, y}] }]
  for (const n of mergedNames) removeIfPresent(form, n);
  for (const split of splits) {
    const rg = form.createRadioGroup(split.name);
    for (const o of split.options) {
      rg.addOptionToPage(o.value, doc.getPages()[o.page], { x: o.x, y: o.y, width: 7.7, height: 7.7 });
    }
  }
}

window.build4PointFields = async function (pdfBytes) {
  const { PDFDocument } = window.PDFLib;
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = doc.getForm();

  for (const name of BOGUS_FIELDS) removeIfPresent(form, name);
  removeIfPresent(form, 'Signature1_es_:signer:signature');

  // Central AC vs Central Heat — both were merged into "Central heat" (Yes
  // widgets) + "undefined_4" (No widgets), one question per row.
  splitIntoRadios(form, doc, ['Central heat', 'undefined_4'], [
    { name: 'hvac_central_ac_radio', options: [
      { value: 'Yes', page: 1, x: 97.1, y: 675.7 },
      { value: 'No', page: 1, x: 133.1, y: 675.7 },
    ] },
    { name: 'hvac_central_heat_radio', options: [
      { value: 'Yes', page: 1, x: 97.1, y: 660.5 },
      { value: 'No', page: 1, x: 133.1, y: 660.5 },
    ] },
  ]);

  // Woodstove present vs professionally installed — both were merged into
  // one 4-widget radio group.
  splitIntoRadios(form, doc, ['Is a woodburning stove or central gas fireplace present'], [
    { name: 'hvac_woodstove_radio', options: [
      { value: 'Yes', page: 1, x: 246.8, y: 575.8 },
      { value: 'No', page: 1, x: 277.4, y: 576 },
    ] },
    { name: 'hvac_woodstove_pro_radio', options: [
      { value: 'Yes', page: 1, x: 427.2, y: 575.5 },
      { value: 'No', page: 1, x: 458.5, y: 576.1 },
    ] },
  ]);

  // This step only restructures fields (remove/split), never sets values —
  // appearance regeneration happens later at fill time. Without this flag,
  // pdf-lib's save() tries to regenerate appearances for the ~180 untouched
  // fields too and throws on one with no default appearance stream yet.
  return doc.save({ updateFieldAppearances: false });
};
