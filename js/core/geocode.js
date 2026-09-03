// Address autocomplete via OpenStreetMap Nominatim — free, no account, no
// API key. Usage policy (operations.osmfoundation.org/policies/nominatim)
// caps this at ~1 request/second and expects a reasonable, non-bulk volume —
// trivially satisfied by a solo inspector typing a handful of addresses a
// day, but callers MUST debounce keystrokes rather than search on every one.

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
let lastCallAt = 0;
const MIN_INTERVAL_MS = 1100; // stay just under the 1 req/sec policy ceiling

/**
 * Searches for US address matches. Returns [] on any failure (offline, rate
 * limited, no results) rather than throwing — this is a convenience, never a
 * requirement, and a failed lookup should just leave manual entry available.
 */
export async function searchAddress(query) {
  const q = query.trim();
  if (q.length < 5) return [];

  const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  const url = `${ENDPOINT}?format=jsonv2&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map(toCandidate).filter((c) => c.address);
  } catch {
    return [];
  }
}

function toCandidate(row) {
  const a = row.address || {};
  const streetNum = a.house_number || '';
  const street = a.road || '';
  const address = [streetNum, street].filter(Boolean).join(' ');
  const city = a.city || a.town || a.village || a.hamlet || '';
  return {
    label: row.display_name,
    address,
    city,
    state: a.state || '',
    zip: a.postcode || '',
    county: (a.county || '').replace(/ County$/i, ''),
    // Nominatim returns these as strings — cast now so every caller gets a
    // real number (or null) instead of re-parsing at each use site. Feeds
    // routing.js's round-trip mileage calculation.
    lat: row.lat != null ? Number(row.lat) : null,
    lon: row.lon != null ? Number(row.lon) : null,
  };
}
