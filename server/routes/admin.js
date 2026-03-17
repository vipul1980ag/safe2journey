const express = require('express');
const router = express.Router();
const db = require('../db/database');

const ADMIN_KEY = process.env.ADMIN_KEY || 'admin_safe2journey_2024';

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Invalid admin key.' });
  next();
}

// --- Journey stats ---
router.get('/stats', requireAdmin, (req, res) => {
  const journeys = db.findAll('journeys');
  const modeCounts = {};
  let totalCost = 0;
  let totalDuration = 0;
  journeys.forEach(j => {
    totalCost += j.total_cost || 0;
    totalDuration += j.total_duration || 0;
    const modes = JSON.parse(j.modes || '[]');
    modes.forEach(m => { modeCounts[m] = (modeCounts[m] || 0) + 1; });
  });
  res.json({
    totalJourneys: journeys.length,
    avgCost: journeys.length ? Math.round(totalCost / journeys.length) : 0,
    avgDurationMins: journeys.length ? Math.round(totalDuration / journeys.length) : 0,
    modeCounts,
    recentJourneys: journeys.reverse().slice(0, 10),
  });
});

// --- Bus stops CRUD ---
router.get('/bus-stops', requireAdmin, (req, res) => res.json(db.findAll('bus_stops')));

router.post('/bus-stops', requireAdmin, (req, res) => {
  const { name, route_id, lat, lng } = req.body;
  if (!name || !route_id || !lat || !lng) return res.status(400).json({ error: 'name, route_id, lat, lng required.' });
  const stop = db.insert('bus_stops', { name, route_id, lat: parseFloat(lat), lng: parseFloat(lng) });
  db.insert('bus_schedules', { stop_id: stop.id, route_id, departure_time: '06:00', frequency_minutes: 15 });
  res.json(stop);
});

router.put('/bus-stops/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, route_id, lat, lng } = req.body;
  const updated = db.update('bus_stops', id, { name, route_id, lat: parseFloat(lat), lng: parseFloat(lng) });
  if (!updated) return res.status(404).json({ error: 'Bus stop not found.' });
  res.json(updated);
});

router.delete('/bus-stops/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const ok = db.delete('bus_stops', id);
  if (!ok) return res.status(404).json({ error: 'Bus stop not found.' });
  db.deleteWhere('bus_schedules', { stop_id: id });
  res.json({ success: true });
});

// --- Metro stations CRUD ---
router.get('/metro-stations', requireAdmin, (req, res) => res.json(db.findAll('metro_stations')));

router.post('/metro-stations', requireAdmin, (req, res) => {
  const { name, line, lat, lng } = req.body;
  if (!name || !line || !lat || !lng) return res.status(400).json({ error: 'name, line, lat, lng required.' });
  const station = db.insert('metro_stations', { name, line, lat: parseFloat(lat), lng: parseFloat(lng) });
  db.insert('metro_schedules', { station_id: station.id, line, first_train: '05:30', last_train: '23:30', frequency_minutes: 5 });
  res.json(station);
});

router.put('/metro-stations/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, line, lat, lng } = req.body;
  const updated = db.update('metro_stations', id, { name, line, lat: parseFloat(lat), lng: parseFloat(lng) });
  if (!updated) return res.status(404).json({ error: 'Metro station not found.' });
  res.json(updated);
});

router.delete('/metro-stations/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const ok = db.delete('metro_stations', id);
  if (!ok) return res.status(404).json({ error: 'Metro station not found.' });
  db.deleteWhere('metro_schedules', { station_id: id });
  res.json({ success: true });
});

// --- Transport Rates CRUD ---
router.get('/rates', requireAdmin, (req, res) => res.json(db.findAll('transport_rates')));

router.post('/rates', requireAdmin, (req, res) => {
  const { city, carrier, truck_type, charge_per_km, currency, notes } = req.body;
  if (!carrier || !truck_type || charge_per_km === undefined) {
    return res.status(400).json({ error: 'carrier, truck_type, and charge_per_km are required.' });
  }
  const rate = db.insert('transport_rates', {
    city: city || '',
    carrier,
    truck_type,
    charge_per_km: parseFloat(charge_per_km),
    currency: currency || 'INR',
    notes: notes || '',
    created_at: new Date().toISOString(),
  });
  res.json(rate);
});

router.post('/rates/bulk', requireAdmin, (req, res) => {
  const { rates } = req.body;
  if (!Array.isArray(rates) || rates.length === 0) {
    return res.status(400).json({ error: 'rates array required.' });
  }
  const inserted = [];
  for (const r of rates) {
    if (!r.carrier || !r.truck_type || r.charge_per_km === undefined) continue;
    inserted.push(db.insert('transport_rates', {
      city: r.city || '',
      carrier: r.carrier,
      truck_type: r.truck_type,
      charge_per_km: parseFloat(r.charge_per_km),
      currency: r.currency || 'INR',
      notes: r.notes || '',
      created_at: new Date().toISOString(),
    }));
  }
  res.json({ inserted: inserted.length, rates: inserted });
});

router.put('/rates/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { city, carrier, truck_type, charge_per_km, currency, notes } = req.body;
  const updated = db.update('transport_rates', id, {
    city: city || '',
    carrier,
    truck_type,
    charge_per_km: parseFloat(charge_per_km),
    currency: currency || 'INR',
    notes: notes || '',
  });
  if (!updated) return res.status(404).json({ error: 'Rate not found.' });
  res.json(updated);
});

router.delete('/rates/:id', requireAdmin, (req, res) => {
  const ok = db.delete('transport_rates', parseInt(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Rate not found.' });
  res.json({ success: true });
});

// --- Users list ---
router.get('/users', requireAdmin, (req, res) => {
  const users = db.findAll('users').map(u => ({ id: u.id, name: u.name, email: u.email, created_at: u.created_at }));
  res.json(users);
});

module.exports = router;
