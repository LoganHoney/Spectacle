// Uniform Mitigation Verification Inspection Form — OIR-B1-1802 (Rev. 04/26)
// Adopted by Rule 69O-170.0155, F.A.C.
//
// Rebuilt directly from a real blank copy supplied by the user (the app's
// earlier draft used the wrong form number and a stale question set — this
// replaces it). Field ids mirror the printed question numbering (q1..q9) so
// mapping onto the official PDF's AcroForm fields later is a lookup, not a
// data migration.

export const WINDMIT = {
  id: 'windmit',
  code: 'OIR-B1-1802',
  title: 'Uniform Mitigation Verification Inspection Form',
  revision: 'Rev. 04/26 — Adopted by Rule 69O-170.0155, F.A.C.',
  pageSize: 'letter',
  intro: 'Maintain a copy of this form and any documentation provided with the insurance policy. At least one photograph or '
       + 'document providing proof must accompany this form to validate each attribute marked in questions 2 through 9. '
       + 'This verification form is valid for up to five (5) years provided no material changes have been made to the '
       + 'structure or inaccuracies found on the form.',

  sections: [
    {
      id: 'owner',
      title: 'Owner Information',
      fields: [
        { id: 'inspection_date', label: 'Inspection Date', type: 'date', width: 'third' },
        { id: 'owner_name', label: 'Owner Name', type: 'text', width: 'third' },
        { id: 'contact_person', label: 'Contact Person', type: 'text', width: 'third' },
        { id: 'address', label: 'Address', type: 'text' },
        { id: 'city', label: 'City', type: 'text', width: 'third' },
        { id: 'zip', label: 'Zip', type: 'text', width: 'third' },
        { id: 'county', label: 'County', type: 'text', width: 'third' },
        { id: 'home_phone', label: 'Home Phone', type: 'text', width: 'third' },
        { id: 'work_phone', label: 'Work Phone', type: 'text', width: 'third' },
        { id: 'cell_phone', label: 'Cell Phone', type: 'text', width: 'third' },
        { id: 'insurance_co', label: 'Insurance Company', type: 'text', width: 'third' },
        { id: 'policy_no', label: 'Policy #', type: 'text', width: 'third' },
        { id: 'email', label: 'Email', type: 'text', width: 'third' },
        { id: 'year_of_home', label: 'Year of Home', type: 'number', width: 'half' },
        { id: 'stories', label: '# of Stories', type: 'number', width: 'half' },
      ],
    },

    {
      id: 'q1',
      title: '1. Building Code',
      prompt: 'What version of the Florida Building Code ("FBC") (FBC 2001 & 2004 OR FBC 2007 or later) OR for homes located in '
            + 'the High-Velocity Hurricane Zone ("HVHZ") (Miami-Dade or Broward counties), South Florida Building Code (SFBC-94) '
            + 'was in force at the time of original permit application?',
      fields: [
        { id: 'q1_answer', label: 'Answer', type: 'radio', options: [
          { key: 'A', label: 'Code in force was the FBC 2001 & 2004.', sub: 'For homes built in 2002/2003, provide a permit application dated after 3/1/2002.' },
          { key: 'B', label: 'Code in force was the FBC 2007 and later.', sub: 'For homes built in 2007/2008, provide a permit application dated after 12/8/2006.' },
          { key: 'C', label: 'HVHZ only: Code in force was the SFBC-94.', sub: 'For homes built in 1994–1996, provide a permit application dated after 9/1/1994.' },
          { key: 'D', label: 'Unknown, or does not meet the requirements of Answer "A", "B" or "C".' },
        ] },
        { id: 'q1_year_built', label: 'Year Built', type: 'number', width: 'half', showIf: ['q1_answer', ['A', 'B', 'C']] },
        { id: 'q1_permit_date', label: 'Building Permit Application Date', type: 'date', width: 'half', showIf: ['q1_answer', ['A', 'B', 'C']] },
      ],
    },

    {
      id: 'q2',
      title: '2. Region',
      prompt: 'Location based on design windspeed. See ASCE 7-22 (700-year MRI) Risk Category 2 (www.ascehazardtool.org).',
      fields: [
        { id: 'q2_answer', label: 'Answer', type: 'radio', options: [
          { key: 'HVHZ', label: 'HVHZ' },
          { key: 'Region 1', label: 'Region 1 (≥ 140 mph)' },
          { key: 'Region 2', label: 'Region 2 (130–139 mph)' },
          { key: 'Region 3', label: 'Region 3 (< 130 mph)' },
        ] },
      ],
    },

    {
      id: 'q3',
      title: '3. Roof Slope',
      prompt: 'For homes with multiple slopes, indicate the slope that is at least two thirds of the main roof area.',
      fields: [
        { id: 'q3_answer', label: 'Answer', type: 'radio', options: [
          { key: '≥ 6:12', label: 'Greater than or equal to (≥ 6:12)' },
          { key: '< 6:12', label: 'Less than (< 6:12)' },
        ] },
      ],
    },

    {
      id: 'q4',
      title: '4. Roof Covering',
      prompt: 'Select all roof covering types in use. Provide the permit application date OR FBC/MDC Product Approval number '
            + 'AND year of original installation/replacement, OR indicate that no information was available.',
      fields: [
        { id: 'q4_table', type: 'table', label: '4.1 Roof Covering Type',
          columns: [
            { id: 'inuse', label: 'In Use', type: 'check' },
            { id: 'permit', label: 'Permit Application Date', type: 'date' },
            { id: 'approval', label: 'FBC or MDC Product Approval #', type: 'text' },
            { id: 'year', label: 'Year Installed / Replaced', type: 'text' },
            { id: 'noinfo', label: 'No Info Provided', type: 'check' },
          ],
          rows: ['Asphalt/Fiberglass Shingle', 'Concrete/Clay Tile', 'Synthetic/Composite Tile', 'Metal', 'Built Up', 'Membrane', 'Other'] },
        { id: 'q4_other_desc', label: 'If "Other", describe', type: 'text' },
        { id: 'q4_2_answer', label: '4.2 Product Approval Listing', type: 'radio', options: [
          { key: 'A', label: 'All roof coverings meet the FBC.', sub: 'Current FBC/Miami-Dade Product Approval at installation, OR a roofing permit application on/after 3/1/02, OR the roof is original and built in 2004 or later.' },
          { key: 'B', label: 'All roof coverings have a Miami-Dade Product Approval.', sub: 'Current at installation, OR (HVHZ only) a permit application after 9/1/1994 and before 3/1/2002, OR the roof is original and built in 1997 or later.' },
          { key: 'C', label: 'One or more roof coverings do not meet the requirements of Answer "A" or "B".' },
          { key: 'D', label: 'No roof coverings meet the requirements of Answer "A" or "B".' },
        ] },
      ],
    },

    {
      id: 'q5',
      title: '5. Roof Deck Attachment',
      prompt: 'What is the WEAKEST form of roof deck attachment?',
      fields: [
        { id: 'q5_answer', label: 'Answer', type: 'radio', options: [
          { key: 'A', label: 'Plywood/OSB, min. 7/16", staples or 6d nails at 6" edge / 12" field (max 24" truss spacing).', sub: 'Or batten decking supporting wood shakes/shingles, or any system with equivalent mean ultimate uplift resistance of at least 55 psf but less than Option B or C.' },
          { key: 'B', label: 'Plywood/OSB, min. 7/16", 8d common nails spaced max. 12" in the field (max 24" truss spacing).', sub: 'Or any system shown to have equivalent or greater resistance, or a mean ultimate uplift resistance of at least 103 psf.' },
          { key: 'C', label: 'Plywood/OSB, min. 7/16", 8d common nails spaced max. 6" in the field (max 24" truss spacing).', sub: 'Or dimensional lumber/tongue & groove decking (2 nails per board, or 1 if ≤6" wide), or a mean ultimate uplift resistance of at least 182 psf.' },
          { key: 'D', label: 'Reinforced concrete roof deck.' },
          { key: 'E', label: 'Spray foam products with an uplift resistance of 110 psf (FOS 1.5).', sub: 'Must be installed along rafter deck intersections, all panel joints, etc.' },
          { key: 'F', label: 'Other.' },
          { key: 'G', label: 'Unknown or unidentified.' },
          { key: 'H', label: 'No attic access.' },
        ] },
        { id: 'q5_other_desc', label: 'If "Other", describe', type: 'text', showIf: ['q5_answer', ['F']] },
        { id: 'q5_notes', label: 'Measurements / observations', type: 'textarea',
          hint: 'Deck thickness, nail size and spacing, truss spacing as measured.' },
      ],
    },

    {
      id: 'q6',
      title: '6. Roof to Wall Attachment',
      prompt: 'What is the WEAKEST roof-to-wall connection? (Do not include hip/valley jack attachment within 5 feet of a roof corner in this determination.)',
      fields: [
        { id: 'q6_answer', label: 'Answer', type: 'radio', options: [
          { key: 'A', label: 'Toenails.', sub: 'Truss/rafter anchored to top plate with angled nails, or connectors not meeting the minimal conditions of B/C/D, or a documented substantiated capacity of 185 lbs. or greater.' },
          { key: 'B', label: 'Clips.', sub: 'Connectors that do not wrap over the truss/rafter, or a single strap not meeting the nail position requirements of C/D but secured with ≥3 nails, or a substantiated capacity of 386 lbs. or greater.' },
          { key: 'C', label: 'Single Wraps.', sub: 'A single strap wrapping over the truss/rafter secured with ≥2 nails one side and ≥1 nail the opposing side, or a substantiated capacity of 535 lbs. or greater.' },
          { key: 'D', label: 'Double Wraps.', sub: 'Two straps each wrapping over the truss/rafter (≥2 nails one side, ≥1 opposing), or a single strap secured with ≥3 nails each side, or a substantiated capacity of 891 lbs. or greater.' },
          { key: 'E', label: 'Structural.', sub: 'Anchor bolts structurally connected, or reinforced concrete roof.' },
          { key: 'F', label: 'Other.' },
          { key: 'G', label: 'Unknown or unidentified.' },
          { key: 'H', label: 'No attic access.' },
          { key: 'I', label: 'Connection(s) not installed as intended.' },
        ] },
        { id: 'q6_other_desc', label: 'If "Other", describe', type: 'text', showIf: ['q6_answer', ['F']] },
        { id: 'q6_min_conditions', label: 'Minimum conditions verified (for B, C or D)', type: 'checkgroup', options: [
          'Metal connectors secured to truss/rafter with ≥3 nails, attached to top plate or embedded in bond beam with <½" gap, free of visible severe corrosion',
          'Single-strap connector wraps over truss/rafter, secured with ≥3 nails each side, free of visible severe corrosion',
          'Purpose-made connector/fastener installed per manufacturer specifications to substantiated capacity',
        ] },
        { id: 'q6_notes', label: 'Observations', type: 'textarea' },
      ],
    },

    {
      id: 'q7',
      title: '7. Roof Geometry',
      prompt: 'What is the roof shape? (Do not count porch/carport roofs attached only to the fascia or wall over unenclosed space.)',
      fields: [
        { id: 'q7_answer', label: 'Answer', type: 'radio', options: [
          { key: 'A', label: 'Hip Roof.', sub: 'No other roof shapes greater than 10% of the total roof system perimeter.' },
          { key: 'B', label: 'Flat Roof.', sub: 'Building with 5+ units where at least 90% of the main roof area has a slope less than 2:12.' },
          { key: 'C', label: 'Other Roof.', sub: 'Any roof that does not qualify as (A) or (B).' },
        ] },
        { id: 'q7_nonhip_len', label: 'Total length of non-hip features (feet)', type: 'number', width: 'half', showIf: ['q7_answer', ['A']] },
        { id: 'q7_perimeter', label: 'Total roof system perimeter (feet)', type: 'number', width: 'half', showIf: ['q7_answer', ['A']] },
        { id: 'q7_calc', type: 'computed', label: 'Non-hip percentage', showIf: ['q7_answer', ['A']],
          compute: (v) => {
            const n = Number(v.q7_nonhip_len), p = Number(v.q7_perimeter);
            if (!p) return '';
            const pct = (n / p) * 100;
            return `${pct.toFixed(1)}% — ${pct <= 10 ? 'qualifies as Hip (A)' : 'exceeds 10%, does not qualify as Hip'}`;
          } },
        { id: 'q7_flat_area', label: 'Roof area with slope < 2:12 (sq ft)', type: 'number', width: 'half', showIf: ['q7_answer', ['B']] },
        { id: 'q7_total_area', label: 'Total roof area (sq ft)', type: 'number', width: 'half', showIf: ['q7_answer', ['B']] },
      ],
    },

    {
      id: 'q8',
      title: '8. Sealed Roof Deck / Secondary Water Resistance (SWR)',
      prompt: 'Applied as a supplemental means to protect the dwelling from water intrusion if the roof covering is lost. '
            + 'Standard underlayment or hot-mopped felts do not qualify.',
      fields: [
        { id: 'q8_answer', label: 'Answer', type: 'radio', options: [
          { key: 'A', label: 'Sealed Roof Deck (SWR) present.' },
          { key: 'B', label: 'No Sealed Roof Deck.' },
          { key: 'C', label: 'Unknown or undetermined.' },
        ] },
        { id: 'q8_methods', label: 'Method (if A)', type: 'checkgroup', showIf: ['q8_answer', ['A']], options: [
          'Fully adhered polymer-modified bitumen underlayment (ASTM D1970)',
          'Tape over roof deck seams (≥3.75" self-adhering polymer-modified bitumen or AAMA 711 Level 3 tape)',
          'Double layer of felt or synthetic with no tape',
          'Spray foam products along rafter deck intersections and panel joints',
          'Entire roof deck underside covered',
        ] },
        { id: 'q8_notes', label: 'Basis for determination', type: 'textarea',
          hint: 'Permit records, product approval, roofer documentation, or direct observation at the deck.' },
      ],
    },

    {
      id: 'q9',
      title: '9. Opening Protection',
      prompt: 'What is the WEAKEST form of wind-borne debris protection installed? Includes all wall and roof openings — windows, '
            + 'doors, sliding glass doors, skylights, garage doors (gable/roof vents excluded). All openings must be in good condition.',
      fields: [
        { id: 'q9_table', type: 'table', label: 'Opening Protection Level Chart — mark all forms of protection in use',
          columns: [
            { id: 'win_entry', label: 'Windows / Entry Doors', type: 'check' },
            { id: 'garage_glazed', label: 'Garage Doors (glazed)', type: 'check' },
            { id: 'skylights', label: 'Skylights', type: 'check' },
            { id: 'glass_block', label: 'Glass Block', type: 'check' },
            { id: 'entry_nonglazed', label: 'Entry Doors (non-glazed)', type: 'check' },
            { id: 'garage_nonglazed', label: 'Garage Doors (non-glazed)', type: 'check' },
          ],
          rows: [
            'N/A — no openings of this type',
            'A — Cyclic pressure & 9 lb. large missile (4.5 lb. skylights)',
            'B — Cyclic pressure & 4-8 lb. large missile (2 lb. skylights)',
            'C — Plywood/OSB meeting Table 1609.1.2 FBC 2007',
            'D — Non-glazed doors meeting ASTM E330 / ANSI-DASMA 108 / PA-TAS 202',
            'N — Appears to be A or B but not verified',
            'Other protective coverings not identified as A, B or C',
            'X — No windborne debris protection',
            'Z — Damaged, needs repair/replacement',
          ] },
        { id: 'q9_answer', label: 'Answer — weakest form of glazed opening protection', type: 'radio', options: [
          { key: 'A', label: 'A. Exterior Openings — Cyclic Pressure and 9-lb. Large Missile (4.5 lb. skylights).', sub: 'All glazed openings protected per Miami-Dade PA 201/202/203, FBC TAS 201/202/203, ASTM E1886 & E1996, SSTD 12, or (garage doors) ANSI/DASMA 115.' },
          { key: 'B', label: 'B. Exterior Openings — Cyclic Pressure and 4–8-lb. Large Missile (2–4.5 lb. skylights).', sub: 'ASTM E1886 & E1996 (4.5 lb.), SSTD 12 (4–8 lb.), or skylights ASTM E1886 & E1996 (2–4.5 lb.).' },
          { key: 'C', label: 'C. Exterior Openings — Wood Structural Panels meeting FBC 2007.', sub: 'All glazed openings covered with plywood or OSB meeting Table 1609.1.2.' },
          { key: 'N', label: 'N. Unverified shutter systems with no documentation.' },
          { key: 'X', label: 'X. None or some glazed openings protected.' },
          { key: 'Z', label: 'Z. Damaged openings — needs repair or replacement.' },
        ] },
        { id: 'q9_sub', label: 'Non-glazed opening qualifier', type: 'radio', showIf: ['q9_answer', ['A', 'B', 'C', 'N']], options: [
          { key: '1', label: '.1 — All non-glazed openings classified at this level or better, or none exist.' },
          { key: '2', label: '.2 — One or more non-glazed openings classified one level down, none lower.' },
          { key: '3', label: '.3 — One or more non-glazed openings classified further down (or damaged).' },
        ] },
        { id: 'q9_notes', label: 'Observations', type: 'textarea' },
      ],
    },

    {
      id: 'inspector',
      title: 'Qualified Inspector',
      prompt: 'Mitigation inspections must be certified by a qualified inspector. Individuals other than licensed contractors '
            + '(s.489.111) or professional engineers (s.471.015) must inspect the structure personally.',
      fields: [
        { id: 'insp_name', label: 'Qualified Inspector Name', type: 'text', width: 'half' },
        { id: 'insp_license_no', label: 'License or Certificate #', type: 'text', width: 'half' },
        { id: 'insp_company', label: 'Inspection Company', type: 'text', width: 'half' },
        { id: 'insp_phone', label: 'Phone', type: 'text', width: 'half' },
        { id: 'insp_qualification', label: 'I hold an active license as a', type: 'radio', options: [
          { key: 'home_inspector', label: 'Home inspector (s. 468.8314, F.S.)', sub: 'Completed statutory hurricane mitigation training and proficiency exam.' },
          { key: 'building_code', label: 'Building code inspector (s. 468.607, F.S.)' },
          { key: 'contractor', label: 'General, building, or residential contractor (s. 489.111, F.S.)' },
          { key: 'engineer', label: 'Professional engineer (s. 471.015, F.S.)' },
          { key: 'architect', label: 'Professional architect (s. 481.213, F.S.)' },
          { key: 'other', label: 'Other individual/entity recognized by the insurer (s. 627.711(2), F.S.)' },
        ] },
        { id: 'insp_employee_name', label: 'If a licensed contractor/engineer\'s employee performed the inspection, employee name', type: 'text' },
        { id: 'insp_date', label: 'Date Signed', type: 'date', width: 'half' },
        { id: 'insp_signature', label: 'Qualified Inspector Signature', type: 'signature' },
      ],
    },

    {
      id: 'attest',
      title: 'Homeowner Attestation',
      prompt: 'I certify that the named Qualified Inspector, or his/her employee, performed an inspection of the residence '
            + 'identified on this form and that proof of identification was provided to me or my Authorized Representative.',
      fields: [
        { id: 'owner_sign_name', label: 'Homeowner Name (print)', type: 'text', width: 'half' },
        { id: 'owner_sign_date', label: 'Date', type: 'date', width: 'half' },
        { id: 'owner_signature', label: 'Homeowner Signature', type: 'signature' },
      ],
    },

    {
      id: 'photos',
      title: 'Required Photographs',
      prompt: 'Every attribute marked in questions 2 through 9 must be supported by a photograph or document.',
      fields: [
        { id: 'ph_front', label: 'Front elevation of the structure', type: 'photos' },
        { id: 'ph_address', label: 'Address verification (house number / mailbox)', type: 'photos' },
        { id: 'ph_roof_cover', label: 'Q4 — Each roof covering type', type: 'photos' },
        { id: 'ph_deck', label: 'Q5 — Roof deck attachment (nail penetrations, spacing measurement)', type: 'photos' },
        { id: 'ph_r2w', label: 'Q6 — Roof-to-wall connection (multiple, with tape measure)', type: 'photos' },
        { id: 'ph_geometry', label: 'Q7 — All roof elevations showing geometry', type: 'photos' },
        { id: 'ph_swr', label: 'Q8 — Secondary water resistance evidence', type: 'photos' },
        { id: 'ph_openings', label: 'Q9 — Each opening and its protection / labels', type: 'photos' },
      ],
    },
  ],
};

/** Insurers care about the credit-bearing answers — surface them at a glance. */
export function windmitSummary(values = {}) {
  const rows = [
    ['Building Code', values.q1_answer],
    ['Region', values.q2_answer],
    ['Roof Slope', values.q3_answer],
    ['Roof Covering', values.q4_2_answer],
    ['Roof Deck Attachment', values.q5_answer],
    ['Roof to Wall Attachment', values.q6_answer],
    ['Roof Geometry', values.q7_answer],
    ['Secondary Water Resistance', values.q8_answer],
    ['Opening Protection', values.q9_answer],
  ];
  const answered = rows.filter(([, v]) => v).length;
  return { rows, answered, total: rows.length };
}
