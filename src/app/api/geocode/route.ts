import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/geocode?lat=-14.34&lng=34.22
 *
 * Reverse geocodes a lat/lng position to a human-readable area name using
 * Nominatim's public API, with:
 *   - Coordinate rounding to 0.05° before lookup (≈5.5 km cells) so
 *     frequent position updates share one cached result
 *   - In-memory cache keyed by rounded coordinates — same pattern as
 *     src/app/api/routing/route.ts (no DB, no Redis)
 *   - Server-side rate limiter: enforces ≥1000 ms between outbound
 *     Nominatim calls (their policy: max 1 req/second)
 *   - 8-second AbortController timeout on the Nominatim fetch
 *   - Graceful fallback to nearest known city from CITY_COORDS on any
 *     failure — never returns an error to the client, always returns a name
 *
 * Returns: { name: string, source: "nominatim" | "fallback" }
 *
 * Nominatim usage policy compliance:
 *   - User-Agent: TibhukeBus/1.0 (identifying header required by policy)
 *   - Rate: ≤1 req/s enforced by lastNominatimCallMs gate
 *   - Attribution: satisfied by existing OSM tile layer in JourneyMap.tsx
 */

// ─── NOMINATIM CONFIG ────────────────────────────────────────────────────────
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_USER_AGENT = 'TibhukeBus/1.0 (https://tibhukebus.com; support@tibhukebus.com)';
const NOMINATIM_TIMEOUT_MS = 8_000;
const MIN_NOMINATIM_INTERVAL_MS = 1_050; // 50 ms headroom over 1 s policy

// ─── COORDINATE ROUNDING ─────────────────────────────────────────────────────
// 0.05° ≈ 5.5 km. Rounds to nearest 0.05° grid cell.
const ROUND_STEP = 0.05;
function roundCoord(v: number): number {
  return Math.round(v / ROUND_STEP) * ROUND_STEP;
}

// ─── IN-MEMORY CACHE ─────────────────────────────────────────────────────────
// Key: "rlat|rlng" (rounded to 0.05°)
// Value: resolved area name string | null (null = no result, use fallback)
// Null values are cached to avoid hammering Nominatim with repeated bad lookups.
const geocodeCache = new Map<string, string | null>();

function makeCacheKey(rlat: number, rlng: number): string {
  return `${rlat.toFixed(2)}|${rlng.toFixed(2)}`;
}

// ─── RATE LIMITER ────────────────────────────────────────────────────────────
// Sequential lock: records when the last outbound Nominatim call was made.
// Before each call we wait for the remainder of the 1050 ms window.
// This is a module-level singleton that persists for the server process lifetime.
let lastNominatimCallMs = 0;

async function waitForRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastNominatimCallMs;
  if (elapsed < MIN_NOMINATIM_INTERVAL_MS) {
    await new Promise<void>((r) =>
      setTimeout(r, MIN_NOMINATIM_INTERVAL_MS - elapsed)
    );
  }
  lastNominatimCallMs = Date.now();
}

// ─── CITY COORDS FALLBACK ────────────────────────────────────────────────────
// Must stay in sync with JourneyMap.tsx and src/app/api/routing/route.ts
const CITY_COORDS: Record<string, [number, number]> = {
  lilongwe: [-13.9626, 33.7741],
  blantyre: [-15.7861, 35.0058],
  mzuzu: [-11.4656, 34.0207],
  zomba: [-15.3854, 35.3188],
  kasungu: [-13.0344, 33.4845],
  salima: [-13.7804, 34.4587],
  mangochi: [-14.4784, 35.2645],
  karonga: [-9.9325, 33.9400],
  nkhotakota: [-12.9264, 34.2990],
  dedza: [-14.3789, 34.3334],
  ntcheu: [-14.8198, 34.6357],
  balaka: [-14.9789, 34.9559],
  machinga: [-15.1667, 35.3000],
  thyolo: [-16.0667, 35.1333],
  mulanje: [-15.9333, 35.5000],
  chiradzulu: [-15.6833, 35.1500],
  phalombe: [-15.8000, 35.6500],
  nsanje: [-16.9167, 35.2500],
  chikwawa: [-16.0333, 34.8000],
  neno: [-15.4000, 34.6500],
  mwanza: [-15.6000, 34.5167],
  dowa: [-13.6554, 33.9373],
  mchinji: [-13.7958, 32.8888],
  ntchisi: [-13.5283, 33.9178],
  nkhatabay: [-11.6000, 34.3000],
  rumphi: [-10.8500, 33.8500],
  chitipa: [-9.7000, 33.2667],
  likoma: [-12.0600, 34.7300],
};

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlam = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestCity(lat: number, lng: number): string {
  let bestName = 'Unknown';
  let bestDist = Infinity;
  for (const [city, [clat, clng]] of Object.entries(CITY_COORDS)) {
    const d = haversineM(lat, lng, clat, clng);
    if (d < bestDist) {
      bestDist = d;
      bestName = city.charAt(0).toUpperCase() + city.slice(1);
    }
  }
  return bestName;
}

// ─── NOMINATIM FETCH ─────────────────────────────────────────────────────────
/**
 * Field priority chain (verified against live Malawi Nominatim responses):
 *   city       → urban centres (e.g. "Mzuzu")
 *   town       → larger towns
 *   village    → rural villages
 *   municipality → some admin areas
 *   state_district → sub-district name (e.g. "Phalula")
 *   county     → rarely populated in Malawi
 *   state      → district-level name (e.g. "Dedza", "Ntcheu") — most
 *                common for inter-city positions in Malawi
 *
 * zoom=10 gives district-level granularity (not street-level, not country-level).
 */
function extractName(address: Record<string, string | undefined>): string | null {
  const name =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.state_district ??
    address.county ??
    address.state ??
    null;

  // Reject if country-level only or empty
  if (!name || name === address.country) return null;
  return name;
}

async function fetchNominatim(lat: number, lng: number): Promise<string | null> {
  await waitForRateLimit();

  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set('lat', lat.toFixed(5));
  url.searchParams.set('lon', lng.toFixed(5));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '10');
  url.searchParams.set('addressdetails', '1');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[geocode] Nominatim returned HTTP ${res.status} for (${lat}, ${lng})`);
      return null;
    }

    const data = await res.json() as {
      address?: Record<string, string | undefined>;
      display_name?: string;
    };

    const name = extractName(data.address ?? {});
    if (!name) {
      console.warn(`[geocode] No usable address field from Nominatim for (${lat}, ${lng}). display_name: ${data.display_name}`);
    }
    return name;
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn(`[geocode] Nominatim request timed out for (${lat}, ${lng})`);
    } else {
      console.warn('[geocode] Nominatim fetch error:', err);
    }
    return null;
  }
}

// ─── ROUTE HANDLER ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);

  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ name: 'Unknown', source: 'fallback', reason: 'invalid_coords' });
  }

  // Round to 0.05° grid for cache key
  const rlat = roundCoord(lat);
  const rlng = roundCoord(lng);
  const cacheKey = makeCacheKey(rlat, rlng);

  // ── Cache hit ──
  if (geocodeCache.has(cacheKey)) {
    const cached = geocodeCache.get(cacheKey)!;
    const name = cached ?? nearestCity(lat, lng);
    const source = cached ? 'nominatim' : 'fallback';
    console.info(`[geocode] Cache HIT (${rlat}, ${rlng}) → "${name}" [${source}]`);
    return NextResponse.json({ name, source, cached: true });
  }

  // ── Cache miss: call Nominatim ──
  const nominatimName = await fetchNominatim(rlat, rlng);

  if (nominatimName) {
    // Success — cache the Nominatim name
    geocodeCache.set(cacheKey, nominatimName);
    console.info(`[geocode] Nominatim resolved (${rlat}, ${rlng}) → "${nominatimName}"`);
    return NextResponse.json({ name: nominatimName, source: 'nominatim' });
  }

  // Failure — cache null to avoid re-querying, use fallback
  geocodeCache.set(cacheKey, null);
  const fallbackName = nearestCity(lat, lng);
  console.info(`[geocode] Fallback for (${rlat}, ${rlng}) → "${fallbackName}"`);
  return NextResponse.json({ name: fallbackName, source: 'fallback' });
}
