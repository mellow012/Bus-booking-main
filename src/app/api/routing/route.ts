import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/routing?origin=lilongwe&destination=blantyre
 *   OR
 * GET /api/routing?olat=-13.9626&olng=33.7741&dlat=-15.7861&dlng=35.0058
 *
 * Returns { points: [lat, lng][] } — a road-following polyline, or
 *         { points: null, fallback: true } on any failure.
 *
 * GraphHopper API call format: point=lat,lng (confirmed: southern hemisphere
 * latitudes are negative, eastern hemisphere longitudes positive).
 *
 * Cache: in-memory Map keyed by "lat1,lng1|lat2,lng2" (4 d.p. precision).
 * Each unique city-pair is fetched at most once per server process lifetime.
 */

// ─── Malawi city coordinate database (must stay in sync with JourneyMap.tsx) ───
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

function normalizeCityInput(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s*(route|to|→|-|–)\s*.*/i, '')
    .replace(/[^a-z\s]/g, '')
    .trim();
}

function resolveCoords(cityName: string | null | undefined): [number, number] | null {
  if (!cityName || typeof cityName !== 'string') return null;
  const cleaned = normalizeCityInput(cityName);
  if (!cleaned) return null;
  if (CITY_COORDS[cleaned]) return CITY_COORDS[cleaned];
  const rawLower = cityName.toLowerCase();
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    const re = new RegExp(`\\b${k}\\b`);
    if (re.test(rawLower)) return v;
  }
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (rawLower.includes(k)) return v;
  }
  return null;
}

// ─── Polyline decoder ───
// GraphHopper uses standard Google encoded polyline with multiplier 100000 (1e5).
// The encoded string encodes [lat, lng] pairs.
function decodePolyline(encoded: string): [number, number][] {
  const factor = 1e5;
  const len = encoded.length;
  let index = 0;
  let lat = 0;
  let lng = 0;
  const result: [number, number][] = [];

  while (index < len) {
    let b: number;
    let shift = 0;
    let resultVal = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      resultVal |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = resultVal & 1 ? ~(resultVal >> 1) : resultVal >> 1;
    lat += dlat;

    shift = 0;
    resultVal = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      resultVal |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = resultVal & 1 ? ~(resultVal >> 1) : resultVal >> 1;
    lng += dlng;

    result.push([lat / factor, lng / factor]);
  }
  return result;
}

// ─── In-memory route cache ───
// Key: "lat1|lng1|lat2|lng2" (4 d.p.)
// Value: decoded [lat, lng][] | null (null = "no route found" / failure, to avoid re-fetching)
const routeCache = new Map<string, [number, number][] | null>();

function makeCacheKey(olat: number, olng: number, dlat: number, dlng: number): string {
  return `${olat.toFixed(4)}|${olng.toFixed(4)}|${dlat.toFixed(4)}|${dlng.toFixed(4)}`;
}

// ─── GraphHopper fetch (with 8 s timeout) ───
async function fetchGraphHopperRoute(
  olat: number, olng: number,
  dlat: number, dlng: number,
  apiKey: string
): Promise<[number, number][] | null> {
  const url = new URL('https://graphhopper.com/api/1/route');
  url.searchParams.set('point', `${olat},${olng}`);
  url.searchParams.append('point', `${dlat},${dlng}`);
  url.searchParams.set('vehicle', 'car');
  url.searchParams.set('locale', 'en');
  url.searchParams.set('points_encoded', 'true');
  url.searchParams.set('elevation', 'false');
  url.searchParams.set('key', apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[routing] GraphHopper returned ${res.status}`);
      return null;
    }

    const data = await res.json() as {
      paths?: Array<{ points: string; points_encoded: boolean }>;
    };

    const path = data.paths?.[0];
    if (!path || !path.points_encoded || !path.points) {
      console.error('[routing] GraphHopper response has no encoded path');
      return null;
    }

    const decoded = decodePolyline(path.points);
    if (decoded.length < 2) {
      console.error('[routing] Decoded polyline has fewer than 2 points');
      return null;
    }

    return decoded;
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[routing] GraphHopper request timed out');
    } else {
      console.error('[routing] GraphHopper fetch error:', err);
    }
    return null;
  }
}

// ─── Route handler ───
export async function GET(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.GRAPHHOPPER_API_KEY;
  if (!apiKey) {
    // No key configured — signal fallback immediately, don't error the client
    return NextResponse.json({ points: null, fallback: true, reason: 'no_key' });
  }

  const { searchParams } = new URL(req.url);

  let olat: number, olng: number, dlat: number, dlng: number;

  const originCity = searchParams.get('origin');
  const destCity = searchParams.get('destination');

  if (originCity && destCity) {
    // City-name mode
    const oCoords = resolveCoords(originCity);
    const dCoords = resolveCoords(destCity);
    if (!oCoords || !dCoords) {
      return NextResponse.json({
        points: null, fallback: true, reason: 'unknown_city',
      });
    }
    [olat, olng] = oCoords;
    [dlat, dlng] = dCoords;
  } else {
    // Raw coordinate mode
    const olatStr = searchParams.get('olat');
    const olngStr = searchParams.get('olng');
    const dlatStr = searchParams.get('dlat');
    const dlngStr = searchParams.get('dlng');
    olat = parseFloat(olatStr ?? '');
    olng = parseFloat(olngStr ?? '');
    dlat = parseFloat(dlatStr ?? '');
    dlng = parseFloat(dlngStr ?? '');
    if ([olat, olng, dlat, dlng].some(isNaN)) {
      return NextResponse.json({
        points: null, fallback: true, reason: 'invalid_coords',
      });
    }
  }

  const cacheKey = makeCacheKey(olat, olng, dlat, dlng);

  if (routeCache.has(cacheKey)) {
    const cached = routeCache.get(cacheKey)!;
    // Cache hit — cached null means "no route found last time", still return fallback
    return NextResponse.json(
      cached ? { points: cached, cached: true } : { points: null, fallback: true, reason: 'no_route_cached' },
      { headers: { 'X-Route-Cache': 'HIT' } }
    );
  }

  // Cache miss — call GraphHopper
  const points = await fetchGraphHopperRoute(olat, olng, dlat, dlng, apiKey);

  // Cache both successes and failures (null) to avoid re-fetching bad pairs
  routeCache.set(cacheKey, points);

  if (!points) {
    return NextResponse.json({ points: null, fallback: true, reason: 'api_failure' });
  }

  return NextResponse.json({ points }, { headers: { 'X-Route-Cache': 'MISS' } });
}
