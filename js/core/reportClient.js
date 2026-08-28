// Thin client for hosting a finished report on the same backend used for
// remote agreement signing (see /backend) — gives a stable link a client can
// open, since the report otherwise only exists as a local file on this device.

function baseUrl(settings) {
  return (settings?.signingApiUrl || '').replace(/\/$/, '');
}

export function isConfigured(settings) {
  return !!baseUrl(settings);
}

/** Uploads a Blob (e.g. a PDF) and returns { token, viewUrl }. */
export async function uploadReport(settings, blob, filename) {
  const url = baseUrl(settings);
  if (!url) throw new Error('No signing server configured — set one in Setup.');
  const dataBase64 = await blobToBase64(blob);
  const res = await fetch(`${url}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataBase64, contentType: blob.type || 'application/pdf', filename }),
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json(); // { token, viewUrl }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(blob);
  });
}
