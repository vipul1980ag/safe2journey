import BASE_URL, { SERVER_ROOT } from '../config';
export { SERVER_ROOT };

let _authToken = null;

export function setAuthToken(token) { _authToken = token; }
export function clearAuthToken() { _authToken = null; }

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Request failed');
  }
  return res.json();
}

// Auth
export function register(name, email, password) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
}
export function login(email, password) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}
export function getMe() {
  return request('/auth/me');
}

// Journey
export function planJourney(payload) {
  return request('/journey/plan', { method: 'POST', body: JSON.stringify(payload) });
}
export function replanJourney(payload) {
  return request('/journey/replan', { method: 'POST', body: JSON.stringify(payload) });
}
export function reportDisruption(payload) {
  return request('/journey/disruption', { method: 'POST', body: JSON.stringify(payload) });
}
export function getJourneyHistory() {
  return request('/journey/history');
}
export function getJourneyHistoryAll() {
  return request('/journey/history/all');
}

// Transport
export function getNearby(lat, lng, radius = 3) {
  return request(`/transport/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
}

// Safety
export function getSafetyProfile() {
  return request('/safety/profile');
}
export function saveSafetyProfile(payload) {
  return request('/safety/profile', { method: 'POST', body: JSON.stringify(payload) });
}
export function verifySafetyCode(code) {
  return request('/safety/verify-code', { method: 'POST', body: JSON.stringify({ code }) });
}
export function logEmergency() {
  return request('/safety/emergency', { method: 'POST', body: JSON.stringify({}) });
}

export function completeJourney(id, actualDuration) {
  return request(`/journey/${id}/complete`, { method: 'PUT', body: JSON.stringify({ actualDuration }) });
}

// Live location sharing
export function pushTrackPosition(payload) {
  return request('/track', { method: 'POST', body: JSON.stringify(payload) });
}

// AI Assistant
export function aiChat(messages, context) {
  return request('/ai/chat', { method: 'POST', body: JSON.stringify({ messages, context }) });
}
export function aiAnalyzeRoute(route, startName, endName, timeOfDay) {
  return request('/ai/analyze-route', { method: 'POST', body: JSON.stringify({ route, startName, endName, timeOfDay }) });
}
export function aiSafetyAdvice(situation, location, timeOfDay) {
  return request('/ai/safety-advice', { method: 'POST', body: JSON.stringify({ situation, location, timeOfDay }) });
}

// Geocoding (proxied through server to avoid Nominatim blocking mobile clients)
export function geocodeSearch(query) {
  return request(`/journey/geocode?q=${encodeURIComponent(query)}`);
}
export function reverseGeocode(lat, lng) {
  return request(`/journey/reverse?lat=${lat}&lng=${lng}`);
}
