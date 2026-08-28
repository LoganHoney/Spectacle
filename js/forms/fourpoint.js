// Citizens Property Insurance — 4-Point Inspection Form (Form Insp4pt 03/25)
// Rebuilt directly from a real blank copy supplied by the user. Field grouping,
// order and hazard checklists mirror that document exactly so the printed
// output reads as a drop-in equivalent an underwriter already recognizes.

const YN = ['Yes', 'No'];

export const FOURPOINT = {
  id: 'fourpoint',
  code: 'Form Insp4pt 03/25',
  title: '4-Point Inspection Report',
  revision: 'Citizens Property Insurance Corporation',
  pageSize: 'letter',
  intro: 'Be advised that Underwriting will rely on the information in this form to determine insurability. This is not '
       + 'a warranty or assurance of the suitability, fitness or longevity of any system inspected. A Florida-licensed '
       + 'inspector must complete, sign and date this form.',

  sections: [
    {
      id: 'general',
      title: 'General Information',
      fields: [
        { id: 'owner_name', label: 'Insured / Applicant Name', type: 'text', width: 'half' },
        { id: 'policy_no', label: 'Application / Policy #', type: 'text', width: 'half' },
        { id: 'address', label: 'Address Inspected', type: 'text' },
        { id: 'year_built', label: 'Actual Year Built', type: 'number', width: 'half' },
        { id: 'inspection_date', label: 'Date Inspected', type: 'date', width: 'half' },
        { id: 'photo_reqs', label: 'Minimum photo requirements captured', type: 'checkgroup', options: [
          'Dwelling: each side',
          'Roof: each slope',
          'Plumbing: water heater (incl. TPRV), under cabinet plumbing/drains, exposed valves',
          'Main electrical service panel with interior door label',
          'Electrical box with panel off',
          'All hazards or deficiencies noted in this report',
        ] },
      ],
    },

    // ------------------------------------------------------------ ELECTRICAL
    {
      id: 'electrical',
      title: 'Electrical System',
      prompt: 'Separate documentation of any single-strand aluminum wiring remediation must be provided and certified by a licensed electrician.',
      fields: [
        { id: 'elec_main_type', label: 'Main Panel — Type', type: 'radio', width: 'half',
          options: [{ key: 'Circuit breaker', label: 'Circuit breaker' }, { key: 'Fuse', label: 'Fuse' }] },
        { id: 'elec_main_amps', label: 'Main Panel — Total Amps', type: 'number', width: 'half' },
        { id: 'elec_main_sufficient', label: 'Main Panel — Is amperage sufficient for current usage?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'elec_main_sufficient_explain', label: 'If no, explain', type: 'text', width: 'half', showIf: ['elec_main_sufficient', ['No']] },
        { id: 'elec_second_type', label: 'Second Panel — Type', type: 'radio', width: 'half',
          options: [{ key: 'Circuit breaker', label: 'Circuit breaker' }, { key: 'Fuse', label: 'Fuse' }, { key: 'N/A', label: 'N/A — no second panel' }] },
        { id: 'elec_second_amps', label: 'Second Panel — Total Amps', type: 'number', width: 'half' },
        { id: 'elec_second_sufficient', label: 'Second Panel — Is amperage sufficient?', type: 'radio', width: 'half',
          options: [...YN, 'N/A'].map((k) => ({ key: k, label: k })) },
        { id: 'elec_presence', label: 'Indicate presence of any of the following', type: 'checkgroup', options: [
          'Cloth wiring',
          'Active knob and tube',
          'Branch circuit aluminum wiring',
          'Connections repaired via COPALUM crimp',
          'Connections repaired via AlumiConn',
        ] },
        { id: 'elec_aluminum_desc', label: 'If branch circuit aluminum wiring present, describe usage / remediation', type: 'textarea',
          hint: 'Separate documentation of all remediation work must be provided.' },
        { id: 'elec_hazards', label: 'Hazards Present', type: 'checkgroup', options: [
          'Blowing fuses', 'Tripping breakers', 'Empty sockets', 'Loose wiring', 'Improper grounding', 'Corrosion', 'Over fusing',
          'Double taps', 'Exposed wiring', 'Unsafe wiring', 'Improper breaker size', 'Scorching', 'Other',
        ] },
        { id: 'elec_hazards_other', label: 'If "Other" hazard, explain', type: 'text' },
        { id: 'elec_condition', label: 'General condition of the electrical system', type: 'radio', width: 'half',
          options: [{ key: 'Satisfactory', label: 'Satisfactory' }, { key: 'Unsatisfactory', label: 'Unsatisfactory' }] },
        { id: 'elec_condition_explain', label: 'If unsatisfactory, explain', type: 'textarea', showIf: ['elec_condition', ['Unsatisfactory']] },
        { id: 'elec_main_age', label: 'Main Panel age (years)', type: 'number', width: 'third' },
        { id: 'elec_main_updated', label: 'Main Panel — year last updated', type: 'number', width: 'third' },
        { id: 'elec_main_brand', label: 'Main Panel brand/model', type: 'text', width: 'third' },
        { id: 'elec_second_age', label: 'Second Panel age (years)', type: 'number', width: 'third' },
        { id: 'elec_second_updated', label: 'Second Panel — year last updated', type: 'number', width: 'third' },
        { id: 'elec_second_brand', label: 'Second Panel brand/model', type: 'text', width: 'third' },
        { id: 'elec_wiring_types', label: 'Wiring Type(s)', type: 'checkgroup', options: [
          'Copper', 'Single Strand AL', 'Multistrand AL', 'Copper Clad AL',
          'Cloth (Knob & Tube)', 'Cloth Jacket Rubber Insulated', 'NM, BX or Conduit', 'Other',
        ] },
        { id: 'elec_photos', label: 'Electrical photographs', type: 'photos',
          hint: 'Main service panel with interior door label, panel with dead front removed, any deficiency.' },
      ],
    },

    // ----------------------------------------------------------------- HVAC
    {
      id: 'hvac',
      title: 'HVAC System',
      fields: [
        { id: 'hvac_central_ac', label: 'Central AC', type: 'radio', width: 'half', options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'hvac_central_heat', label: 'Central heat', type: 'radio', width: 'half', options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'hvac_primary_source', label: 'If not central heat, primary heat source and fuel type', type: 'text', showIf: ['hvac_central_heat', ['No']] },
        { id: 'hvac_good_order', label: 'Are the HVAC systems in good working order?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'hvac_good_order_explain', label: 'If no, explain', type: 'text', width: 'half', showIf: ['hvac_good_order', ['No']] },
        { id: 'hvac_last_service', label: 'Date of last HVAC servicing/inspection', type: 'date', width: 'half' },
        { id: 'hvac_woodstove', label: 'Wood-burning stove or central gas fireplace present?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'hvac_woodstove_pro', label: 'If present, was it professionally installed?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })), showIf: ['hvac_woodstove', ['Yes']] },
        { id: 'hvac_spaceheater', label: 'Space heater used as primary heat source?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'hvac_spaceheater_portable', label: 'If used, is the source portable?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })), showIf: ['hvac_spaceheater', ['Yes']] },
        { id: 'hvac_condensate_issue', label: 'Does the air handler/condensate line or drain pan show blockage, leakage, or water damage to the surrounding area?', type: 'radio',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'hvac_age', label: 'Age of system (years)', type: 'number', width: 'half' },
        { id: 'hvac_updated', label: 'Year last updated', type: 'number', width: 'half' },
        { id: 'hvac_photos', label: 'HVAC photographs', type: 'photos',
          hint: 'Include the dated manufacturer’s plate.' },
      ],
    },

    // ------------------------------------------------------------- PLUMBING
    {
      id: 'plumbing',
      title: 'Plumbing System',
      fields: [
        { id: 'plumb_tprv', label: 'Is there a temperature pressure relief valve on the water heater?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'plumb_active_leak', label: 'Is there any indication of an active leak?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'plumb_prior_leak', label: 'Is there any indication of a prior leak?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'plumb_wh_location', label: 'Water heater location', type: 'text', width: 'half' },
        { id: 'plumb_fixtures', type: 'table', label: 'General condition of plumbing fixtures and connections to appliances',
          columns: [
            { id: 'item', label: 'Item', type: 'static' },
            { id: 'sat', label: 'Satisfactory', type: 'check' },
            { id: 'unsat', label: 'Unsatisfactory', type: 'check' },
            { id: 'na', label: 'N/A', type: 'check' },
          ],
          rows: ['Dishwasher', 'Refrigerator', 'Washing machine', 'Water heater', 'Showers/Tubs',
            'Toilets', 'Sinks', 'Sump pump', 'Main shut off valve', 'All other visible'] },
        { id: 'plumb_unsat_comments', label: 'If unsatisfactory, comments/details (leaks, wet/soft spots, mold, corrosion, grout/caulk, etc.)', type: 'textarea' },
        { id: 'plumb_supply_age_type', label: 'Age of Piping Supply System', type: 'radio', width: 'half',
          options: [
            { key: 'Original to home', label: 'Original to home' },
            { key: 'Completely re-piped', label: 'Completely re-piped' },
            { key: 'Partially re-piped', label: 'Partially re-piped' },
          ] },
        { id: 'plumb_supply_age_years', label: 'Age of supply system (years)', type: 'number', width: 'half' },
        { id: 'plumb_drain_age_type', label: 'Age of Piping Drain System', type: 'radio', width: 'half',
          options: [
            { key: 'Original to home', label: 'Original to home' },
            { key: 'Completely re-piped', label: 'Completely re-piped' },
            { key: 'Partially re-piped', label: 'Partially re-piped' },
          ] },
        { id: 'plumb_drain_age_years', label: 'Age of drain system (years)', type: 'number', width: 'half' },
        { id: 'plumb_wh_age', label: 'Age of water heater (years)', type: 'number', width: 'half' },
        { id: 'plumb_pipe_types', label: 'Type of pipes (check all that apply)', type: 'checkgroup', options: [
          'Copper', 'PVC/CPVC', 'Galvanized', 'Cast Iron', 'Polybutylene', 'PEX', 'ABS', 'Other',
        ] },
        { id: 'plumb_pex_year', label: 'If PEX, year installed', type: 'number', width: 'half' },
        { id: 'plumb_pipe_other', label: 'If "Other" pipe type, specify', type: 'text', width: 'half' },
        { id: 'plumb_renovation_note', label: 'Provide year and extent of any re-pipe/renovation', type: 'textarea' },
        { id: 'plumb_photos', label: 'Plumbing photographs', type: 'photos',
          hint: 'Water heater (incl. TPRV), under-cabinet plumbing/drains, exposed valves.' },
      ],
    },

    // ------------------------------------------------------------------ ROOF
    {
      id: 'roof',
      title: 'Roof',
      prompt: 'With photos of each roof slope, this section can take the place of a separate Roof Inspection Form.',
      fields: [
        { id: 'roof_p_covering', label: 'Predominant Roof — Covering material', type: 'select', width: 'half',
          options: ['Asphalt / Fiberglass Shingle', 'Architectural Shingle', 'Concrete / Clay Tile', 'Metal', 'Built Up / Modified Bitumen', 'Membrane / Single Ply', 'Other'] },
        { id: 'roof_s_covering', label: 'Secondary Roof — Covering material (if any)', type: 'select', width: 'half',
          options: ['None', 'Asphalt / Fiberglass Shingle', 'Architectural Shingle', 'Concrete / Clay Tile', 'Metal', 'Built Up / Modified Bitumen', 'Membrane / Single Ply', 'Other'] },
        { id: 'roof_p_age', label: 'Predominant Roof — Age (years)', type: 'number', width: 'half' },
        { id: 'roof_s_age', label: 'Secondary Roof — Age (years)', type: 'number', width: 'half' },
        { id: 'roof_p_remaining', label: 'Predominant Roof — Remaining useful life (years)', type: 'number', width: 'half' },
        { id: 'roof_s_remaining', label: 'Secondary Roof — Remaining useful life (years)', type: 'number', width: 'half' },
        { id: 'roof_p_permit_date', label: 'Predominant Roof — Date of last roofing permit', type: 'date', width: 'half' },
        { id: 'roof_s_permit_date', label: 'Secondary Roof — Date of last roofing permit', type: 'date', width: 'half' },
        { id: 'roof_p_update_date', label: 'Predominant Roof — Date of last update', type: 'date', width: 'half' },
        { id: 'roof_s_update_date', label: 'Secondary Roof — Date of last update', type: 'date', width: 'half' },
        { id: 'roof_p_update_type', label: 'Predominant Roof — If updated', type: 'radio', width: 'half',
          options: [{ key: 'Full replacement', label: 'Full replacement' }, { key: 'Partial replacement', label: 'Partial replacement' }, { key: 'Not updated', label: 'Not updated' }] },
        { id: 'roof_p_update_pct', label: 'Predominant Roof — % of replacement', type: 'number', width: 'half', showIf: ['roof_p_update_type', ['Partial replacement']] },
        { id: 'roof_s_update_type', label: 'Secondary Roof — If updated', type: 'radio', width: 'half',
          options: [{ key: 'Full replacement', label: 'Full replacement' }, { key: 'Partial replacement', label: 'Partial replacement' }, { key: 'Not updated', label: 'Not updated' }] },
        { id: 'roof_s_update_pct', label: 'Secondary Roof — % of replacement', type: 'number', width: 'half', showIf: ['roof_s_update_type', ['Partial replacement']] },
        { id: 'roof_p_condition', label: 'Predominant Roof — Overall condition', type: 'radio', width: 'half',
          options: [{ key: 'Satisfactory', label: 'Satisfactory' }, { key: 'Unsatisfactory', label: 'Unsatisfactory' }] },
        { id: 'roof_s_condition', label: 'Secondary Roof — Overall condition', type: 'radio', width: 'half',
          options: [{ key: 'Satisfactory', label: 'Satisfactory' }, { key: 'Unsatisfactory', label: 'Unsatisfactory' }] },
        { id: 'roof_p_damage', label: 'Predominant Roof — Visible signs of damage/deterioration', type: 'checkgroup', options: [
          'Cracking', 'Cupping/curling', 'Excessive granule loss', 'Exposed asphalt', 'Exposed felt',
          'Missing/loose/cracked tabs or tiles', 'Soft spots in decking', 'Visible hail damage',
        ] },
        { id: 'roof_s_damage', label: 'Secondary Roof — Visible signs of damage/deterioration', type: 'checkgroup', options: [
          'Cracking', 'Cupping/curling', 'Excessive granule loss', 'Exposed asphalt', 'Exposed felt',
          'Missing/loose/cracked tabs or tiles', 'Soft spots in decking', 'Visible hail damage',
        ] },
        { id: 'roof_damage_explain', label: 'Explain any checked damage/deterioration above', type: 'textarea' },
        { id: 'roof_p_leaks', label: 'Predominant Roof — Visible signs of leaks?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'roof_s_leaks', label: 'Secondary Roof — Visible signs of leaks?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'roof_leaks_explain', label: 'If yes, explain', type: 'text', showIf: ['roof_p_leaks', ['Yes']] },
        { id: 'roof_attic_evidence', label: 'Attic/underside of decking shows evidence of leaks?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'roof_ceiling_evidence', label: 'Interior ceilings show evidence of leaks?', type: 'radio', width: 'half',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'roof_photos', label: 'Roof photographs', type: 'photos', hint: 'Each roof slope, plus any deficiency.' },
      ],
    },

    {
      id: 'comments',
      title: 'Additional Comments / Observations',
      prompt: 'Required if any updates, hazards, deficiencies, or systems not in good working order are noted above — identify the type of update, date completed, and by whom.',
      fields: [
        { id: 'additional_comments', label: 'Comments', type: 'textarea' },
      ],
    },

    {
      id: 'certify',
      title: 'Inspector Certification',
      prompt: 'I certify that the above statements are true and correct.',
      fields: [
        { id: 'insp_signature', label: 'Inspector Signature', type: 'signature' },
        { id: 'insp_title', label: 'Title', type: 'text', width: 'half' },
        { id: 'insp_license_no', label: 'License Number', type: 'text', width: 'half' },
        { id: 'insp_date', label: 'Date', type: 'date', width: 'half' },
        { id: 'insp_company', label: 'Company Name', type: 'text', width: 'half' },
        { id: 'insp_license_type', label: 'License Type', type: 'text', width: 'half' },
        { id: 'insp_phone', label: 'Work Phone', type: 'text', width: 'half' },
      ],
    },
  ],
};

/** Underwriters read the four condition ratings first. */
export function fourPointSummary(values = {}) {
  return {
    rows: [
      ['Roof', values.roof_p_condition],
      ['Electrical', values.elec_condition],
      ['Plumbing', values.plumb_unsat_comments ? 'See comments' : 'Satisfactory'],
      ['HVAC', values.hvac_good_order],
    ],
  };
}
