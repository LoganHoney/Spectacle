// Adds real AcroForm fields to the flat official OIR-B1-1802 (Rev. 04/26)
// master, positioned from pdf.js-extracted glyph coordinates (see
// tools/cdp_extract_positions.py). Checkbox/radio positions are exact
// (measured at the actual □ glyph); text field positions are placed
// immediately after their label. The opening-protection matrix table
// (Q9, page 4) is intentionally NOT covered here — its cells are blank
// vector-drawn boxes with no text glyph to anchor to, a different and
// harder extraction problem than the rest of this form.
//
// Exposed as window.buildWindMitFields(pdfBytes) -> Promise<Uint8Array>

// The □ glyph on this form measures ~6pt wide x ~10pt tall (measured
// directly off every occurrence via pdf.js text-layer extraction, not
// guessed) — narrower and taller than a square. A 9x9 box was visibly
// oversized/squarish next to the real glyph; this matches it precisely.
const CB_W = 6.5;
const CB_H = 10;

// Filled-in answers read as navy, bold — the printed form's own text stays
// plain black, so it's obvious at a glance which text is the inspector's
// answer versus the form's own wording.
const { rgb } = window.PDFLib;
const NAVY = rgb(0, 0, 0.5);

function addRadioGroup(form, doc, name, options) {
  const rg = form.createRadioGroup(name);
  for (const o of options) {
    const page = doc.getPages()[o.page];
    rg.addOptionToPage(o.value, page, { x: o.x, y: o.y - 1, width: CB_W, height: CB_H });
  }
  return rg;
}

function addCheckBox(form, doc, name, page, x, y) {
  const cb = form.createCheckBox(name);
  cb.addToPage(doc.getPages()[page], { x, y: y - 1, width: CB_W, height: CB_H });
  return cb;
}

function addText(form, doc, name, page, x, y, width, height = 11) {
  const tf = form.createTextField(name);
  // No border/background — this sits directly on the printed form's own
  // blank line, so a box around it would look like a UI widget pasted onto
  // a government form rather than typed text filling in the blank.
  tf.addToPage(doc.getPages()[page], { x, y, width, height, borderWidth: 0, textColor: NAVY });
  tf.setFontSize(9);
  return tf;
}

window.buildWindMitFields = async function (pdfBytes) {
  const { PDFDocument } = window.PDFLib;
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = doc.getForm();

  // ---- Owner Information (page 0) ----
  addText(form, doc, 'owner_inspection_date', 0, 100, 723, 140);
  addText(form, doc, 'owner_name', 0, 92, 679, 250);
  addText(form, doc, 'owner_contact_person', 0, 420, 679, 150);
  addText(form, doc, 'owner_address', 0, 72, 657, 270);
  addText(form, doc, 'owner_home_phone', 0, 415, 657, 155);
  addText(form, doc, 'owner_city', 0, 60, 635, 130);
  addText(form, doc, 'owner_zip', 0, 220, 635, 90);
  addText(form, doc, 'owner_work_phone', 0, 415, 635, 155);
  addText(form, doc, 'owner_county', 0, 68, 613, 130);
  addText(form, doc, 'owner_cell_phone', 0, 415, 613, 155);
  addText(form, doc, 'owner_insurance_co', 0, 130, 591, 200);
  addText(form, doc, 'owner_policy_no', 0, 400, 591, 170);
  addText(form, doc, 'owner_year_of_home', 0, 100, 568.6, 90);
  addText(form, doc, 'owner_stories', 0, 250, 568.6, 90);
  addText(form, doc, 'owner_email', 0, 395, 568.6, 175);

  // ---- Q1 Building Code (page 0) ----
  addRadioGroup(form, doc, 'q1_answer', [
    { value: 'A', page: 0, x: 36, y: 450.4 },
    { value: 'B', page: 0, x: 36, y: 427.3 },
    { value: 'C', page: 0, x: 36, y: 404.4 },
    { value: 'D', page: 0, x: 36, y: 369.8 },
  ]);

  // ---- Q2 Region (page 0) ----
  addRadioGroup(form, doc, 'q2_answer', [
    { value: 'HVHZ', page: 0, x: 36, y: 335.4 },
    { value: 'Region 1', page: 0, x: 79.8, y: 335.4 },
    { value: 'Region 2', page: 0, x: 180.4, y: 335.4 },
    { value: 'Region 3', page: 0, x: 318, y: 335.4 },
  ]);

  // ---- Q3 Roof Slope (page 0) ----
  // The "< 6:12" checkbox's □ glyph is embedded at the tail of the merged
  // text run "(≥ 6:12) □" (x=142.1, width=40.8) rather than as its own
  // standalone glyph — x corrected to the glyph's actual position within
  // that run, not the run's start.
  addRadioGroup(form, doc, 'q3_answer', [
    { value: '≥ 6:12', page: 0, x: 36, y: 289.4 },
    { value: '< 6:12', page: 0, x: 176.9, y: 289.4 },
  ]);

  // ---- Q4.1 Roof Covering Type — independent per-row checkboxes ----
  const q4Rows = [
    ['Asphalt/Fiberglass Shingle', 205.2],
    ['Concrete/Clay Tile', 184.4],
    ['Synthetic/Composite Tile', 174.1],
    ['Metal', 163.8],
    ['Built Up', 153.5],
    ['Membrane', 143],
    ['Other', 127.6],
  ];
  for (const [rowName, y] of q4Rows) {
    addCheckBox(form, doc, `q4_inuse_${rowName}`, 0, 41.4, y);
  }
  // "No Information Provided for Compliance" column — first 6 rows only (Other has none per the form).
  const q4NoInfoY = [200, 184.4, 174.1, 163.8, 153.5, 143];
  q4Rows.slice(0, 6).forEach(([rowName], i) => {
    addCheckBox(form, doc, `q4_noinfo_${rowName}`, 0, 466.3, q4NoInfoY[i]);
  });

  // ---- Q4.2 Product Approval Listing (page 1) ----
  addRadioGroup(form, doc, 'q4_2_answer', [
    { value: 'A', page: 1, x: 36, y: 708.1 },
    { value: 'B', page: 1, x: 36, y: 685.2 },
    { value: 'C', page: 1, x: 36, y: 662.2 },
    { value: 'D', page: 1, x: 36, y: 650.6 },
  ]);

  // ---- Q5 Roof Deck Attachment (page 1) ----
  addRadioGroup(form, doc, 'q5_answer', [
    { value: 'A', page: 1, x: 36, y: 616.2 },
    { value: 'B', page: 1, x: 36, y: 547.2 },
    { value: 'C', page: 1, x: 36, y: 501.2 },
    { value: 'D', page: 1, x: 36, y: 443.6 },
    { value: 'E', page: 1, x: 36, y: 432.2 },
    { value: 'F', page: 1, x: 36, y: 409.2 },
    { value: 'G', page: 1, x: 36, y: 397.7 },
    { value: 'H', page: 1, x: 36, y: 386.2 },
  ]);

  // ---- Q6 Roof to Wall Attachment (pages 1-2) ----
  addRadioGroup(form, doc, 'q6_answer', [
    { value: 'A', page: 1, x: 36, y: 317.2 },
    { value: 'B', page: 2, x: 36, y: 719.6 },
    { value: 'C', page: 2, x: 36, y: 627.7 },
    { value: 'D', page: 2, x: 35.9, y: 558.7 },
    { value: 'E', page: 2, x: 35.9, y: 466.6 },
    { value: 'F', page: 2, x: 35.9, y: 455.1 },
    { value: 'G', page: 2, x: 35.9, y: 443.5 },
    { value: 'H', page: 2, x: 35.9, y: 432.1 },
    { value: 'I', page: 2, x: 35.9, y: 420.6 },
  ]);
  // "Minimal conditions to qualify for B, C, or D" sub-checkboxes — independent checkgroup.
  addCheckBox(form, doc, 'q6_min_1', 1, 72, 202.2);
  addCheckBox(form, doc, 'q6_min_2', 1, 72, 167.7);
  addCheckBox(form, doc, 'q6_min_3', 1, 72, 144.7);

  // ---- Q7 Roof Geometry (page 2) ----
  addRadioGroup(form, doc, 'q7_answer', [
    { value: 'A', page: 2, x: 36, y: 363.2 },
    { value: 'B', page: 2, x: 36, y: 340.2 },
    { value: 'C', page: 2, x: 36, y: 317.2 },
  ]);
  addText(form, doc, 'q7_nonhip_len', 2, 275, 349.7, 40);
  addText(form, doc, 'q7_perimeter', 2, 402, 349.7, 40);
  addText(form, doc, 'q7_flat_area', 2, 268, 326.7, 40);
  addText(form, doc, 'q7_total_area', 2, 400, 326.7, 40);

  // ---- Q8 Sealed Roof Deck / SWR (page 2) ----
  addRadioGroup(form, doc, 'q8_answer', [
    { value: 'A', page: 2, x: 36, y: 259.7 },
    { value: 'B', page: 2, x: 35.9, y: 156.2 },
    { value: 'C', page: 2, x: 36, y: 144.7 },
  ]);
  addCheckBox(form, doc, 'q8_method_fully_adhered', 2, 72, 248.2);
  addCheckBox(form, doc, 'q8_method_tape', 2, 72, 236.8);
  addCheckBox(form, doc, 'q8_method_double_layer', 2, 72, 202.2);
  addCheckBox(form, doc, 'q8_method_spray_foam', 2, 71.9, 179.1);
  addCheckBox(form, doc, 'q8_method_full_coverage', 2, 107.9, 167.7);

  // ---- Q9 Opening Protection — top-level answer (pages 3-4) ----
  addRadioGroup(form, doc, 'q9_answer', [
    { value: 'A', page: 3, x: 36, y: 378.1 },
    { value: 'B', page: 3, x: 36, y: 189.1 },
    { value: 'C', page: 4, x: 36, y: 687.5 },
    { value: 'N', page: 4, x: 36, y: 597.7 },
    { value: 'X', page: 4, x: 36, y: 508.1 },
    { value: 'Z', page: 4, x: 36, y: 473.6 },
  ]);
  // C's Plywood/OSB sub-choice — not in the app's data model yet, field created but left unmapped for now.
  addCheckBox(form, doc, 'q9_c_plywood', 4, 72, 676);
  addCheckBox(form, doc, 'q9_c_osb', 4, 135.7, 676);
  // Non-glazed qualifier sub-checkboxes, one radio group per top-level answer
  // (the app's single q9_sub field is resolved against whichever of these
  // matches q9_answer at fill time).
  addRadioGroup(form, doc, 'q9_sub_A', [
    { value: '1', page: 3, x: 66, y: 244.3 },
    { value: '2', page: 3, x: 66, y: 232.9 },
    { value: '3', page: 3, x: 66, y: 211 },
  ]);
  addRadioGroup(form, doc, 'q9_sub_B', [
    { value: '1', page: 3, x: 66, y: 88.3 },
    { value: '2', page: 4, x: 66, y: 731.2 },
    { value: '3', page: 4, x: 66, y: 709.3 },
  ]);
  addRadioGroup(form, doc, 'q9_sub_C', [
    { value: '1', page: 4, x: 84, y: 652.9 },
    { value: '2', page: 4, x: 84, y: 641.5 },
    { value: '3', page: 4, x: 84, y: 619.7 },
  ]);
  addRadioGroup(form, doc, 'q9_sub_N', [
    { value: '1', page: 4, x: 84, y: 563.3 },
    { value: '2', page: 4, x: 84, y: 551.8 },
    { value: '3', page: 4, x: 84, y: 529.9 },
  ]);

  // ---- Qualified Inspector (page 4) ----
  addText(form, doc, 'insp_name', 4, 145, 401, 220);
  addText(form, doc, 'insp_license_type', 4, 275, 401, 115);
  addText(form, doc, 'insp_license_no', 4, 480, 401, 85);
  addText(form, doc, 'insp_company', 4, 105, 382, 285);
  addText(form, doc, 'insp_phone', 4, 425, 382, 145);
  addRadioGroup(form, doc, 'insp_qualification', [
    { value: 'home_inspector', page: 4, x: 36, y: 335.9 },
    { value: 'building_code', page: 4, x: 36, y: 314 },
    { value: 'contractor', page: 4, x: 36, y: 302.5 },
    { value: 'engineer', page: 4, x: 36, y: 291 },
    { value: 'architect', page: 4, x: 36, y: 279.6 },
    { value: 'other', page: 4, x: 36, y: 268.1 },
  ]);

  // ---- Running footer: "Inspectors Initials ___ Property Address ___" ----
  // This line repeats identically on every page (pdf.js text-layer extraction
  // confirmed the exact same merged run — same x=36, y=69.7, width=532.8 — on
  // all 6 pages). It's one text object with no per-character position data,
  // so the split between the two blanks was derived from Times-Roman and
  // Helvetica standard AFM widths calibrated against that measured total
  // width; both fonts agreed on the split points within ~2pt, so the exact
  // font wasn't needed to place these confidently.
  for (let p = 0; p < 6; p++) {
    addText(form, doc, `footer_initials_p${p}`, p, 112, 69.7, 58);
    addText(form, doc, `footer_property_address_p${p}`, p, 242, 69.7, 325);
  }

  // ---- Certification / signatures (page 5) ----
  addText(form, doc, 'insp_print_name', 5, 84, 641.5, 220);
  addText(form, doc, 'insp_employee_name', 5, 240, 630, 220);
  addText(form, doc, 'insp_signature', 5, 200, 590.2, 250);
  addText(form, doc, 'insp_date', 5, 500, 590.2, 100);
  addText(form, doc, 'owner_sign_name', 5, 90, 446, 260);
  addText(form, doc, 'owner_sign_date', 5, 400, 446, 130);

  return doc.save();
};
