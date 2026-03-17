const express = require('express');
const router = express.Router();
const { getNearbyBusStops, getNearbyMetroStations } = require('../services/routePlanner');
const { fetchNearbyTransit } = require('../services/overpass');
const db = require('../db/database');

// GET /api/transport/nearby — local DB first, then OSM worldwide fallback
router.get('/nearby', async (req, res) => {
  const { lat, lng, radius = 3 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const localBus   = getNearbyBusStops(parseFloat(lat), parseFloat(lng), parseFloat(radius));
  const localMetro = getNearbyMetroStations(parseFloat(lat), parseFloat(lng), parseFloat(radius) + 2);

  if (localBus.length > 0 || localMetro.length > 0) {
    return res.json({ busStops: localBus, metroStations: localMetro, source: 'local' });
  }

  // Fallback to worldwide OSM data
  try {
    const osm = await fetchNearbyTransit(parseFloat(lat), parseFloat(lng), parseFloat(radius), parseFloat(radius) + 2);
    res.json({ ...osm, source: 'osm' });
  } catch (e) {
    res.json({ busStops: [], metroStations: [], source: 'none', error: e.message });
  }
});

router.get('/bus-stops',       (req, res) => res.json(db.findAll('bus_stops')));
router.get('/metro-stations',  (req, res) => res.json(db.findAll('metro_stations')));

router.get('/schedule', (req, res) => {
  const { type, stopId } = req.query;
  if (type === 'bus')   return res.json(db.findAll('bus_schedules',   { stop_id:    parseInt(stopId) }));
  if (type === 'metro') return res.json(db.findAll('metro_schedules', { station_id: parseInt(stopId) }));
  res.status(400).json({ error: 'type must be bus or metro' });
});

module.exports = router;
