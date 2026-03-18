/**
 * parking.js — OSM Overpass + OSRM helpers shared with Park As You Desire integration
 * No API keys required. All free open-source APIs.
 */

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchWithTimeout(url, options = {}, timeout = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function convertOSMToParking(el, refLat, refLng) {
  const tags = el.tags || {};
  const elLat = el.lat || (el.center && el.center.lat);
  const elLng = el.lon || (el.center && el.center.lon);
  if (!elLat || !elLng) return null;

  const parkingType = tags.parking || 'surface';
  const isPrivate = tags.access === 'private' || tags.access === 'customers';
  const fee = tags.fee === 'yes' || !!tags.charge;
  const capacity = parseInt(tags.capacity) || (isPrivate ? 10 : 30);

  let costPerHour = 0;
  if (fee) {
    const rates = { 'multi-storey': 3.0, underground: 3.5, street_side: 1.0, surface: 1.5 };
    costPerHour = rates[parkingType] || 1.5;
  }

  const name = tags.name || 'Car Park';
  const address =
    [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') ||
    `${elLat.toFixed(4)}, ${elLng.toFixed(4)}`;

  return {
    id: `osm-${el.id}`,
    name,
    address,
    lat: elLat,
    lng: elLng,
    type: parkingType,
    costPerHour,
    costPerDay: costPerHour * 10,
    isPrivate,
    distance: haversineKm(refLat, refLng, elLat, elLng),
  };
}

/**
 * Fetch real parking spots from OpenStreetMap Overpass API.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusMeters - default 800m
 * @returns {Array} parking objects sorted by distance
 */
export async function fetchNearbyParking(lat, lng, radiusMeters = 800) {
  const url = `https://park-as-you-desire.onrender.com/api/parkings/nearby?lat=${lat}&lng=${lng}&radius=${radiusMeters}`;
  const res = await fetchWithTimeout(url, {}, 14000);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'PAYD API error');
  return json.data || [];
}

/**
 * Fetch driving route from OSRM (free, no API key).
 * @returns {{ coords: [[lat,lng]], distance: number, duration: number } | null}
 */
export async function fetchDrivingRoute(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  const res = await fetchWithTimeout(url, {}, 8000);
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.[0]) return null;
  const r = json.routes[0];
  return {
    coords: r.geometry.coordinates.map((c) => [c[1], c[0]]),
    distance: r.distance,   // metres
    duration: r.duration,   // seconds
  };
}

/**
 * Format the best rate string for a parking spot.
 * Shows per-minute if < £0.10/min, otherwise per-hour.
 */
export function formatParkingRate(parking) {
  if (!parking || parking.costPerHour === 0) return 'Free / Unknown';
  const perMin = parking.costPerHour / 60;
  if (perMin < 0.10) return `£${perMin.toFixed(2)}/min`;
  return `£${parking.costPerHour.toFixed(2)}/hr`;
}

/**
 * Format a distance in metres to a human-readable string.
 */
export function formatDistance(km) {
  const m = km * 1000;
  return m < 1000 ? `${Math.round(m)} m` : `${km.toFixed(1)} km`;
}

/**
 * Format route duration in seconds to a human-readable string.
 */
export function formatETA(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return '< 1 min';
  return `${Math.round(seconds / 60)} min`;
}
