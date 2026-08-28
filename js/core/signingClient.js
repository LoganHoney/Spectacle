// Thin client for the optional remote-signing backend (see /backend). Every
// call is best-effort — if there's no signal, or no backend configured, the
// caller falls back to the in-person / share-and-return flow, which is the
// only path that has to work offline.

function baseUrl(settings) {
  return (settings?.signingApiUrl || '').replace(/\/$/, '');
}

export function isConfigured(settings) {
  return !!baseUrl(settings);
}

export async function createAgreement(settings, payload) {
  const url = baseUrl(settings);
  if (!url) throw new Error('No signing server configured — set one in Setup.');
  const res = await fetch(`${url}/api/agreements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json(); // { token, signUrl }
}

export async function checkStatus(settings, token) {
  const url = baseUrl(settings);
  if (!url) throw new Error('No signing server configured.');
  const res = await fetch(`${url}/api/agreements/${token}/status`);
  if (res.status === 404) return null; // expired, deleted, or never existed
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export async function deleteAgreement(settings, token) {
  const url = baseUrl(settings);
  if (!url) return;
  try { await fetch(`${url}/api/agreements/${token}`, { method: 'DELETE' }); }
  catch { /* best-effort cleanup — a 30-day TTL on the server catches anything missed */ }
}
