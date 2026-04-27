// Copyright (c) 2024-2026 Vipul Agrawal. All Rights Reserved.
// Proprietary and confidential. Unauthorized copying, distribution,
// or modification of this file is strictly prohibited.
// See LICENSE file in the project root for full terms.

const express = require('express');
const router = express.Router();
const https = require('https');
const { planJourney } = require('../services/routePlanner');
const { checkOnTrack } = require('../services/rePlanner');
const db = require('../db/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// GET /api/journey/geocode?q=... — proxy Nominatim search through server
router.get('/geocode', async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) return res.json([]);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`;
  https.get(url, { headers: { 'User-Agent': 'Safe2Journey/1.0 (safe2journey-app)', 'Accept-Language': 'en' } }, (upstream) => {
    let data = '';
    upstream.on('data', chunk => data += chunk);
    upstream.on('end', () => {
      try {
        const results = JSON.parse(data).map(r => ({
          name: r.display_name.split(',').slice(0, 2).join(', '),
          fullName: r.display_name,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        }));
        res.json(results);
      } catch { res.json([]); }
    });
  }).on('error', () => res.json([]));
});

// GET /api/journey/reverse?lat=...&lng=... — proxy Nominatim reverse geocoding
router.get('/reverse', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.json({ name: '' });
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  https.get(url, { headers: { 'User-Agent': 'Safe2Journey/1.0 (safe2journey-app)', 'Accept-Language': 'en' } }, (upstream) => {
    let data = '';
    upstream.on('data', chunk => data += chunk);
    upstream.on('end', () => {
      try {
        const d = JSON.parse(data);
        const name = d.address?.suburb || d.address?.neighbourhood || d.address?.road ||
                     (d.display_name ? d.display_name.split(',')[0] : `${lat}, ${lng}`);
        res.json({ name });
      } catch { res.json({ name: `${lat}, ${lng}` }); }
    });
  }).on('error', () => res.json({ name: `${lat}, ${lng}` }));
});

// POST /api/journey/plan
router.post('/plan', optionalAuth, async (req, res) => {
  const { startLat, startLng, startName, endLat, endLng, endName, maxModes, scheduleTime, preferredModes } = req.body;
  if (!startLat || !startLng || !endLat || !endLng) {
    return res.status(400).json({ error: 'Start and end coordinates are required.' });
  }

  try {
    const result = await planJourney({
      startLat: parseFloat(startLat), startLng: parseFloat(startLng), startName: startName || 'Start',
      endLat: parseFloat(endLat), endLng: parseFloat(endLng), endName: endName || 'Destination',
      maxModes: parseInt(maxModes) || 3,
      scheduleTime: scheduleTime || null,
      preferredModes: Array.isArray(preferredModes) ? preferredModes : [],
    });

    let journeyId = null;
    if (result.routes.length > 0) {
      const best = result.routes[0];
      const saved = db.insert('journeys', {
        user_id: req.user?.id || null,
        start_lat: startLat, start_lng: startLng, start_name: startName,
        end_lat: endLat, end_lng: endLng, end_name: endName,
        modes: JSON.stringify(best.legs.map(l => l.mode)),
        total_cost: best.totalCost, total_duration: best.totalDurationMins,
        status: 'planned', created_at: new Date().toISOString(),
      });
      journeyId = saved.id;
    }

    res.json({ ...result, journeyId });
  } catch (e) {
    console.error('[journey/plan]', e);
    res.status(500).json({ error: 'Failed to plan journey. Please try again.' });
  }
});

// POST /api/journey/replan
router.post('/replan', async (req, res) => {
  const { startLat, startLng, currentLat, currentLng, expectedDistKm, startTime, expectedDurationMins, endLat, endLng, endName } = req.body;

  const trackStatus = checkOnTrack({
    startLat: parseFloat(startLat), startLng: parseFloat(startLng),
    currentLat: parseFloat(currentLat), currentLng: parseFloat(currentLng),
    expectedDistKm: parseFloat(expectedDistKm),
    startTime: parseInt(startTime), expectedDurationMins: parseFloat(expectedDurationMins),
  });

  if (!trackStatus.replanNeeded) {
    return res.json({ replanNeeded: false, status: trackStatus });
  }

  try {
    const newPlan = await planJourney({
      startLat: parseFloat(currentLat), startLng: parseFloat(currentLng), startName: 'Current Location',
      endLat: parseFloat(endLat), endLng: parseFloat(endLng), endName: endName || 'Destination',
      maxModes: 3,
    });
    res.json({ replanNeeded: true, status: trackStatus, newPlan });
  } catch (e) {
    res.json({ replanNeeded: true, status: trackStatus, newPlan: null });
  }
});

// POST /api/journey/disruption — replan when a transit service is delayed / cancelled / missed
// Body: { currentLat, currentLng, endLat, endLng, endName, disruption, affectedMode }
//   disruption: 'delayed' | 'cancelled' | 'missed'
//   affectedMode: 'tram' | 'train' | 'bus' | 'metro' | 'air' | etc.
router.post('/disruption', async (req, res) => {
  const { currentLat, currentLng, endLat, endLng, endName, disruption, affectedMode } = req.body;
  if (!currentLat || !currentLng || !endLat || !endLng) {
    return res.status(400).json({ error: 'Missing coordinates' });
  }

  const messages = {
    delayed:   `${affectedMode || 'Service'} is delayed — finding alternative routes from your current position.`,
    cancelled: `${affectedMode || 'Service'} was cancelled — finding alternatives that avoid it.`,
    missed:    `You missed the ${affectedMode || 'service'} — here's how to still reach your destination.`,
  };

  try {
    const plan = await planJourney({
      startLat:  parseFloat(currentLat),
      startLng:  parseFloat(currentLng),
      startName: 'Current Location',
      endLat:    parseFloat(endLat),
      endLng:    parseFloat(endLng),
      endName:   endName || 'Destination',
      maxModes:  3,
    });
    // For cancellations: move routes that still use the affected mode to the bottom
    if (disruption === 'cancelled' && affectedMode && plan.routes) {
      plan.routes.sort((a, b) => {
        const aHas = a.legs.some(l => l.mode === affectedMode) ? 1 : 0;
        const bHas = b.legs.some(l => l.mode === affectedMode) ? 1 : 0;
        return aHas - bHas;
      });
    }
    res.json({
      disruption,
      affectedMode,
      message: messages[disruption] || 'Route updated from current position.',
      plan,
    });
  } catch (e) {
    res.status(500).json({ error: 'Could not replan: ' + e.message });
  }
});

// PUT /api/journey/:id/complete — mark journey as completed
router.put('/:id/complete', optionalAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const journey = db.findOne('journeys', { id });
  if (!journey) return res.status(404).json({ error: 'Journey not found.' });
  const updated = db.update('journeys', id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    actual_duration: req.body.actualDuration || null,
  });
  res.json(updated);
});

// GET /api/journey/history — requires auth, returns only user's journeys
router.get('/history', requireAuth, (req, res) => {
  const journeys = db.findAll('journeys', { user_id: req.user.id }).reverse().slice(0, 30);
  res.json(journeys);
});

// GET /api/journey/history/all — no auth, last 20 (used in demo/guest mode)
router.get('/history/all', (req, res) => {
  const journeys = db.findAll('journeys').reverse().slice(0, 20);
  res.json(journeys);
});

module.exports = router;
