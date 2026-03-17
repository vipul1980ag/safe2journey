const { distanceKm } = require('./routePlanner');

/**
 * Checks if a user is on track for their current journey leg.
 * Per the document: at start_time + x/2, if y/2 distance is not covered → re-plan.
 *
 * @param {Object} params
 * @param {number} params.startLat - Journey leg start latitude
 * @param {number} params.startLng - Journey leg start longitude
 * @param {number} params.currentLat - User's current latitude
 * @param {number} params.currentLng - User's current longitude
 * @param {number} params.expectedDistKm - Full expected distance of this leg (y)
 * @param {number} params.startTime - Unix ms when leg started
 * @param {number} params.expectedDurationMins - Full expected duration of this leg (x)
 */
function checkOnTrack({ startLat, startLng, currentLat, currentLng, expectedDistKm, startTime, expectedDurationMins }) {
  const now = Date.now();
  const elapsedMs = now - startTime;
  const halfDurationMs = (expectedDurationMins / 2) * 60 * 1000;

  if (elapsedMs < halfDurationMs) {
    return { onTrack: true, message: 'Journey in progress — not yet at halfway checkpoint.' };
  }

  const coveredDist = distanceKm(startLat, startLng, currentLat, currentLng);
  const halfExpectedDist = expectedDistKm / 2;

  if (coveredDist >= halfExpectedDist) {
    return { onTrack: true, message: 'On track.', coveredKm: coveredDist.toFixed(2), expectedHalfKm: halfExpectedDist.toFixed(2) };
  }

  const shortfallKm = halfExpectedDist - coveredDist;
  return {
    onTrack: false,
    replanNeeded: true,
    message: `User is behind schedule. Expected to cover ${halfExpectedDist.toFixed(2)} km but only covered ${coveredDist.toFixed(2)} km. Re-planning route.`,
    coveredKm: coveredDist.toFixed(2),
    expectedHalfKm: halfExpectedDist.toFixed(2),
    shortfallKm: shortfallKm.toFixed(2),
  };
}

module.exports = { checkOnTrack };
