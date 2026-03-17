const express = require('express');
const router = express.Router();

// In-memory live tracking sessions — token → session data
// Sessions expire after 24 hours of no updates
const sessions = new Map();

setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [k, v] of sessions) {
    if (v.updatedAt < cutoff) sessions.delete(k);
  }
}, 30 * 60 * 1000);

// POST /api/track — create or update a live tracking session
router.post('/', (req, res) => {
  const { token, lat, lng, bearing, speedKmh, routeLabel, destination, legMode, legTo } = req.body;
  if (!token || lat == null || lng == null) {
    return res.status(400).json({ error: 'token, lat, lng required' });
  }
  const existing = sessions.get(token) || {};
  sessions.set(token, {
    ...existing,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    bearing: parseFloat(bearing) ?? existing.bearing ?? 0,
    speedKmh: parseFloat(speedKmh) ?? existing.speedKmh ?? 0,
    routeLabel: routeLabel ?? existing.routeLabel ?? 'Journey',
    destination: destination ?? existing.destination ?? 'Destination',
    legMode: legMode ?? existing.legMode ?? null,
    legTo: legTo ?? existing.legTo ?? null,
    updatedAt: Date.now(),
  });
  res.json({ ok: true });
});

// GET /api/track/:token — fetch latest position for a shared session
router.get('/:token', (req, res) => {
  const s = sessions.get(req.params.token);
  if (!s) return res.status(404).json({ error: 'Tracking session not found or expired.' });
  const staleSecs = Math.round((Date.now() - s.updatedAt) / 1000);
  res.json({ ...s, staleSecs });
});

module.exports = router;
