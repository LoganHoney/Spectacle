// Shared {MergeField} substitution used by the pre-inspection agreement and
// the email/share templates — one field set, one place that knows how to fill it.

export const MERGE_FIELDS = [
  'InspectionAddressInline', 'Inspectee', 'InspecteeEmail', 'InspecteePhone',
  'InspectionDateWithTime', 'InspectionDate', 'InspectorCompany', 'Inspector', 'TotalAmount',
];

export function buildMergeContext({ inspection, client, property, settings }) {
  const addr = property
    ? [property.address, [property.city, property.state, property.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : '';
  const date = inspection.inspectedAt || inspection.scheduledAt || '';
  const dateWithTime = [fmtDate(date), inspection.scheduledTime].filter(Boolean).join(' at ');
  return {
    InspectionAddressInline: addr,
    Inspectee: client?.name || '',
    InspecteeEmail: client?.email || '',
    InspecteePhone: client?.phone || '',
    InspectionDateWithTime: dateWithTime,
    InspectionDate: fmtDate(date),
    InspectorCompany: settings?.companyName || '',
    Inspector: inspection.inspectorName || settings?.inspectorName || '',
    TotalAmount: inspection.fee ? `$${inspection.fee}` : '',
  };
}

export function mergeText(template, fields) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) => (key in fields ? fields[key] : match));
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}
