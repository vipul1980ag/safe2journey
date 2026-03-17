/**
 * Overpass API client — queries OpenStreetMap for worldwide transit data.
 * Bus stops, metro/subway/railway stations near any lat/lng on earth.
 */
const https = require('https');

const cache = new Map(); // key → { data, expires }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { 'User-Agent': 'Safe2Journey/1.0 (open-source transit planner)' },
      timeout: 20000,
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error(`Overpass invalid JSON from ${parsed.hostname}: ${raw.slice(0, 120)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Overpass request timed out')); });
  });
}

async function httpsGetWithFallback(query) {
  const encoded = encodeURIComponent(query);
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const json = await httpsGet(`${endpoint}?data=${encoded}`);
      return json;
    } catch (e) {
      console.warn(`[overpass] ${endpoint} failed: ${e.message}`);
    }
  }
  throw new Error('All Overpass endpoints failed');
}

/**
 * Fetch nearby bus stops and transit stations from OpenStreetMap via Overpass API.
 * Works for any location worldwide.
 */
async function fetchNearbyTransit(lat, lng, busRadiusKm = 3, transitRadiusKm = 5) {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)},${busRadiusKm},${transitRadiusKm}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const busR   = busRadiusKm * 1000;
  const transR = transitRadiusKm * 1000;
  const ferryR = 15000;   // 15 km for ferry terminals / seaports
  const airR   = 80000;   // 80 km for airports

  // Split into two parallel queries:
  // 1) Local transit (bus/metro/tram/ferry) — small radii, fast
  // 2) Airports — large radius, needs own timeout budget
  const localQuery = `[out:json][timeout:16];
(
  node["highway"="bus_stop"](around:${busR},${lat},${lng});
  node["public_transport"="stop_position"]["bus"="yes"](around:${busR},${lat},${lng});
  node["amenity"="bus_station"](around:${busR},${lat},${lng});
  node["railway"="station"](around:${transR},${lat},${lng});
  node["railway"="halt"](around:${transR},${lat},${lng});
  node["railway"="subway_entrance"](around:${transR},${lat},${lng});
  node["station"="subway"](around:${transR},${lat},${lng});
  node["metro"="yes"](around:${transR},${lat},${lng});
  node["railway"="tram_stop"](around:${transR},${lat},${lng});
  node["amenity"="ferry_terminal"](around:${ferryR},${lat},${lng});
  node["amenity"="seaport"](around:${ferryR},${lat},${lng});
);
out body center;`;

  const airportQuery = `[out:json][timeout:25];
(
  node["aeroway"="terminal"](around:${airR},${lat},${lng});
  node["aeroway"="aerodrome"](around:${airR},${lat},${lng});
  way["aeroway"="aerodrome"](around:${airR},${lat},${lng});
);
out body center;`;

  // Run both in parallel — if either fails, we still get partial results
  const [localResult, airResult] = await Promise.allSettled([
    httpsGetWithFallback(localQuery),
    httpsGetWithFallback(airportQuery),
  ]);

  const elements = [
    ...(localResult.status === 'fulfilled' ? localResult.value.elements || [] : []),
    ...(airResult.status === 'fulfilled' ? airResult.value.elements || [] : []),
  ];
  if (localResult.status === 'rejected') console.warn('[overpass] local query failed:', localResult.reason?.message);
  if (airResult.status === 'rejected')   console.warn('[overpass] airport query failed:', airResult.reason?.message);

  const busStops      = [];
  const metroStations = [];
  const trainStations = [];
  const ferryTerminals = [];
  const airports      = [];

  for (const el of elements) {
    // Ways (aerodrome) have center coords; nodes have direct lat/lon
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (!elLat || !elLon) continue;

    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || tags.description || 'Unnamed Stop';
    const dist = distanceKm(lat, lng, elLat, elLon);

    const isAirport  = tags.aeroway === 'terminal' || tags.aeroway === 'aerodrome';
    const isFerry    = tags.amenity === 'ferry_terminal' || tags.amenity === 'seaport';
    const isSubway   = tags.station === 'subway' || tags.metro === 'yes' || tags.railway === 'subway_entrance';
    const isTram     = tags.railway === 'tram_stop';
    const isMainRail = (tags.railway === 'station' || tags.railway === 'halt') && !isSubway;

    if (isAirport) {
      const iata = tags.iata || tags['iata:code'] || null;
      // Score airports so major international hubs rank above small airfields.
      // Higher = better. IATA code is the strongest signal; "International" in name is next.
      let score = 0;
      if (iata) score += 100;
      const nameLower = name.toLowerCase();
      if (nameLower.includes('international')) score += 50;
      if (nameLower.includes('airport') || nameLower.includes('flughafen') ||
          nameLower.includes('aeropuerto') || nameLower.includes('aéroport') ||
          nameLower.includes('flygplats') || nameLower.includes('aeroporto') ||
          nameLower.includes('havalimanı')) score += 20;
      airports.push({
        id: el.id,
        name,
        iata,
        score,
        lat: elLat,
        lng: elLon,
        distance: dist,
        source: 'osm',
      });
    } else if (isFerry) {
      ferryTerminals.push({
        id: el.id,
        name,
        operator: tags.operator || tags.network || null,
        lat: elLat,
        lng: elLon,
        distance: dist,
        source: 'osm',
      });
    } else if (isMainRail) {
      trainStations.push({
        id: el.id,
        name,
        line: tags.line || tags.network || tags.operator || tags['railway:line'] || 'Rail',
        lat: elLat,
        lng: elLon,
        distance: dist,
        source: 'osm',
      });
    } else if (isSubway || isTram) {
      metroStations.push({
        id: el.id,
        name,
        line: tags.line || tags.network || tags.operator || tags['railway:line'] || (isTram ? 'Tram' : 'Metro'),
        lat: elLat,
        lng: elLon,
        distance: dist,
        source: 'osm',
      });
    } else {
      busStops.push({
        id: el.id,
        name,
        route_id: tags.ref || tags.route_ref || tags.local_ref || '—',
        lat: elLat,
        lng: elLon,
        distance: dist,
        source: 'osm',
      });
    }
  }

  busStops.sort((a, b) => a.distance - b.distance);
  metroStations.sort((a, b) => a.distance - b.distance);
  trainStations.sort((a, b) => a.distance - b.distance);
  ferryTerminals.sort((a, b) => a.distance - b.distance);
  // Sort airports: highest score first (major hubs), then by distance within same score tier
  airports.sort((a, b) => (b.score - a.score) || (a.distance - b.distance));

  const data = {
    busStops:      busStops.slice(0, 6),
    metroStations: metroStations.slice(0, 4),
    trainStations: trainStations.slice(0, 4),
    ferryTerminals: ferryTerminals.slice(0, 3),
    airports:      airports.slice(0, 3),
  };

  cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

/** Clear stale cache entries */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expires < now) cache.delete(k);
  }
}, 10 * 60 * 1000);

module.exports = { fetchNearbyTransit };
