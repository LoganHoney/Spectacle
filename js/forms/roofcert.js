// Citizens-style Roof Inspection Form (Sample Form RCF-1 03/25)
// Rebuilt directly from a real blank copy supplied by the user. Its roof
// section is near-identical in content to the 4-Point form's Roof section
// (the 4-Point form itself says photos + that section "can take the place
// of a separate Roof Inspection Form") — field ids intentionally match
// fourpoint.js's roof_* ids exactly so the same checklist tags
// (js/report/template.js) and "Copy from Inspection" mappings
// (js/forms/crosspopulate.js) work for both forms without duplication.

const YN = ['Yes', 'No'];

export const ROOFCERT = {
  id: 'roofcert',
  code: 'Sample Form RCF-1 03/25',
  title: 'Roof Certification',
  revision: 'Citizens Property Insurance Corporation',
  pageSize: 'letter',
  intro: 'This sample Roof Inspection Form (or a similar form) must be completed and signed by a Florida-licensed professional. '
       + 'Photos of each roof slope showing the roof’s condition must be submitted with this form.',

  sections: [
    {
      id: 'general',
      title: 'General Information',
      fields: [
        { id: 'owner_name', label: 'Applicant / Insured Name', type: 'text', width: 'half' },
        { id: 'policy_no', label: 'Application / Policy #', type: 'text', width: 'half' },
        { id: 'address', label: 'Address Inspected', type: 'text' },
        { id: 'inspection_date', label: 'Date of Inspection', type: 'date', width: 'half' },
      ],
    },

    // ------------------------------------------------------------------ ROOF
    {
      id: 'roof',
      title: 'Roof',
      prompt: 'Photos of each roof slope showing the roof’s condition must be submitted with this form.',
      tabs: [{ key: 'predominant', label: 'Predominant' }, { key: 'secondary', label: 'Secondary' }],
      fields: [
        { id: 'roof_p_covering', label: 'Covering material', type: 'select', width: 'half', group: 'predominant',
          options: ['Asphalt / Fiberglass Shingle', 'Architectural Shingle', 'Concrete / Clay Tile', 'Metal', 'Built Up / Modified Bitumen', 'Membrane / Single Ply', 'Other'] },
        { id: 'roof_s_covering', label: 'Covering material (if any)', type: 'select', width: 'half', group: 'secondary',
          options: ['None', 'Asphalt / Fiberglass Shingle', 'Architectural Shingle', 'Concrete / Clay Tile', 'Metal', 'Built Up / Modified Bitumen', 'Membrane / Single Ply', 'Other'] },
        { id: 'roof_p_age', label: 'Age (years)', type: 'number', width: 'half', group: 'predominant' },
        { id: 'roof_s_age', label: 'Age (years)', type: 'number', width: 'half', group: 'secondary' },
        { id: 'roof_p_remaining', label: 'Remaining useful life', type: 'text', width: 'half', group: 'predominant', hint: 'e.g. 5+ years' },
        { id: 'roof_s_remaining', label: 'Remaining useful life', type: 'text', width: 'half', group: 'secondary', hint: 'e.g. 5+ years' },
        { id: 'roof_p_permit_date', label: 'Date of last roofing permit', type: 'date', width: 'half', group: 'predominant' },
        { id: 'roof_s_permit_date', label: 'Date of last roofing permit', type: 'date', width: 'half', group: 'secondary' },
        { id: 'roof_p_update_date', label: 'Date of last update', type: 'date', width: 'half', group: 'predominant' },
        { id: 'roof_s_update_date', label: 'Date of last update', type: 'date', width: 'half', group: 'secondary' },
        { id: 'roof_p_update_type', label: 'If updated', type: 'radio', width: 'half', group: 'predominant',
          options: [{ key: 'Full replacement', label: 'Full replacement' }, { key: 'Partial replacement', label: 'Partial replacement' }, { key: 'Not updated', label: 'Not updated' }] },
        { id: 'roof_p_update_pct', label: '% of replacement', type: 'number', width: 'half', group: 'predominant', showIf: ['roof_p_update_type', ['Partial replacement']] },
        { id: 'roof_s_update_type', label: 'If updated', type: 'radio', width: 'half', group: 'secondary',
          options: [{ key: 'Full replacement', label: 'Full replacement' }, { key: 'Partial replacement', label: 'Partial replacement' }, { key: 'Not updated', label: 'Not updated' }] },
        { id: 'roof_s_update_pct', label: '% of replacement', type: 'number', width: 'half', group: 'secondary', showIf: ['roof_s_update_type', ['Partial replacement']] },
        { id: 'roof_p_condition', label: 'Overall condition', type: 'radio', width: 'half', group: 'predominant',
          options: [{ key: 'Satisfactory', label: 'Satisfactory' }, { key: 'Unsatisfactory', label: 'Unsatisfactory' }] },
        { id: 'roof_s_condition', label: 'Overall condition', type: 'radio', width: 'half', group: 'secondary',
          options: [{ key: 'Satisfactory', label: 'Satisfactory' }, { key: 'Unsatisfactory', label: 'Unsatisfactory' }] },
        { id: 'roof_p_damage', label: 'Visible signs of damage/deterioration', type: 'checkgroup', group: 'predominant', options: [
          'Cracking', 'Cupping/curling', 'Excessive granule loss', 'Exposed asphalt', 'Exposed felt',
          'Missing/loose/cracked tabs or tiles', 'Soft spots in decking', 'Visible hail damage',
        ] },
        { id: 'roof_s_damage', label: 'Visible signs of damage/deterioration', type: 'checkgroup', group: 'secondary', options: [
          'Cracking', 'Cupping/curling', 'Excessive granule loss', 'Exposed asphalt', 'Exposed felt',
          'Missing/loose/cracked tabs or tiles', 'Soft spots in decking', 'Visible hail damage',
        ] },
        { id: 'roof_damage_explain', label: 'Explain any checked damage/deterioration above', type: 'textarea' },
        { id: 'roof_p_leaks', label: 'Visible signs of leaks?', type: 'radio', width: 'half', group: 'predominant',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'roof_s_leaks', label: 'Visible signs of leaks?', type: 'radio', width: 'half', group: 'secondary',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'roof_leaks_explain', label: 'If yes, explain', type: 'text', showIf: ['roof_p_leaks', ['Yes']] },
        { id: 'roof_p_attic_evidence', label: 'Attic/underside of decking shows evidence of leaks?', type: 'radio', width: 'half', group: 'predominant',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'roof_s_attic_evidence', label: 'Attic/underside of decking shows evidence of leaks?', type: 'radio', width: 'half', group: 'secondary',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'roof_p_ceiling_evidence', label: 'Interior ceilings show evidence of leaks?', type: 'radio', width: 'half', group: 'predominant',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'roof_s_ceiling_evidence', label: 'Interior ceilings show evidence of leaks?', type: 'radio', width: 'half', group: 'secondary',
          options: YN.map((k) => ({ key: k, label: k })) },
        { id: 'roof_photos', label: 'Roof photographs', type: 'photos', hint: 'Each roof slope, plus any deficiency.' },
      ],
    },

    {
      id: 'comments',
      title: 'Additional Comments / Observations',
      prompt: 'Complete with full details if any updates, hazards, deficiencies, or a roof not in good working order are noted above.',
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

/** Underwriters read the roof condition rating first. */
export function roofCertSummary(values = {}) {
  return {
    rows: [
      ['Predominant Roof', values.roof_p_condition],
      ['Secondary Roof', values.roof_s_condition],
    ],
  };
}
