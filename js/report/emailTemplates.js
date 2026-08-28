// Subject/body pairs used when sharing a document via the native share sheet.
// Editable per-company in Setup; merge fields fill in from the job.

export const EMAIL_TEMPLATE_TYPES = [
  { key: 'preinspection', label: 'Pre-Inspection Agreement' },
  { key: 'full', label: 'Regular Inspection Report' },
  { key: 'fourpoint', label: '4-Point Report' },
  { key: 'windmit', label: 'Wind Mitigation Report' },
];

export const DEFAULT_EMAIL_TEMPLATES = {
  preinspection: {
    subject: 'Inspection Agreement — {InspectionAddressInline}',
    body: `Hi {Inspectee},

Attached is the inspection agreement for your upcoming inspection at {InspectionAddressInline}, scheduled for {InspectionDateWithTime}.

Please review and sign at your earliest convenience. Let me know if you have any questions before the inspection.

Thanks,
{Inspector}
{InspectorCompany}`,
  },
  full: {
    subject: 'Your Inspection Report — {InspectionAddressInline}',
    body: `Hi {Inspectee},

Attached is the completed inspection report for {InspectionAddressInline}, inspected on {InspectionDate}.

Please review the full report and let me know if you have any questions.

Thanks,
{Inspector}
{InspectorCompany}`,
  },
  fourpoint: {
    subject: '4-Point Inspection Report — {InspectionAddressInline}',
    body: `Hi {Inspectee},

Attached is the completed 4-Point Inspection Report for {InspectionAddressInline}, inspected on {InspectionDate}. This can be submitted directly to your insurance carrier or agent.

Let me know if you have any questions.

Thanks,
{Inspector}
{InspectorCompany}`,
  },
  windmit: {
    subject: 'Wind Mitigation Report — {InspectionAddressInline}',
    body: `Hi {Inspectee},

Attached is the completed Uniform Mitigation Verification Inspection (Wind Mitigation) Report for {InspectionAddressInline}, inspected on {InspectionDate}. This can be submitted directly to your insurance carrier or agent for premium credits.

Let me know if you have any questions.

Thanks,
{Inspector}
{InspectorCompany}`,
  },
};

export function getEmailTemplate(settings, key) {
  const custom = settings?.emailTemplates?.[key];
  const fallback = DEFAULT_EMAIL_TEMPLATES[key];
  return {
    subject: custom?.subject ?? fallback.subject,
    body: custom?.body ?? fallback.body,
  };
}
