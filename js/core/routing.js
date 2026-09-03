// Round-trip driving mileage via OSRM's public demo router — free, no
// account, no API key, same "keyless free service" tier as geocode.js's
// Nominatim usage. That demo server is explicitly meant for light,
// non-bulk use (project-osrm.org's own docs), which a solo inspector
// looking up mileage a few times a day comfortably sits under — but unlike
// Nominatim there's no published rate limit to mirror, so this only
// debounces obviously-accidental rapid repeats, not a strict interval.
//
// Always returns a number or null — a failed/offline lookup should never
// block saving a job; the mileage field stays editable either way.

const ROUTE_ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';
const METERS_PER_MILE = 1609.344;

/**
 * One-way route distance in miles between two {lat, lon} points, doubled
 * for the round trip. Returns null (not a rejected promise) on any
 * failure — offline, rate-limited, no route found — so callers can just
 * fall back to leaving the field for manual entry.
 */
export async function roundTripMiles(from, to) {
  if (!from?.lat || !from?.lon || !to?.lat || !to?.lon) return null;
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url = `${ROUTE_ENDPOINT}/${coords}?overview=false`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const meters = data?.routes?.[0]?.distance;
    if (!Number.isFinite(meters)) return null;
    const oneWayMiles = meters / METERS_PER_MILE;
    return Math.round(oneWayMiles * 2 * 10) / 10; // round trip, one decimal place
  } catch {
    return null;
  }
}
