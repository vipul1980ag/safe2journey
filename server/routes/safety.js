// Copyright (c) 2024-2026 Vipul Agrawal. All Rights Reserved.
// Proprietary and confidential. Unauthorized copying, distribution,
// or modification of this file is strictly prohibited.
// See LICENSE file in the project root for full terms.

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/safety/profile  — get user's safety profile
router.get('/profile', requireAuth, (req, res) => {
  const profile = db.findOne('safety_profiles', { user_id: req.user.id });
  if (!profile) return res.json(null);
  const { code_hash, ...safe } = profile;
  res.json(safe);
});

// POST /api/safety/profile  — create or update safety profile
router.post('/profile', requireAuth, async (req, res) => {
  const { home, office, safe1, safe2, emergency_contact, safety_code } = req.body;
  if (!emergency_contact || !safety_code) {
    return res.status(400).json({ error: 'emergency_contact and safety_code are required.' });
  }
  const code_hash = await bcrypt.hash(String(safety_code), 10);
  const existing = db.findOne('safety_profiles', { user_id: req.user.id });

  if (existing) {
    const updated = db.update('safety_profiles', existing.id, {
      home: home || null, office: office || null, safe1: safe1 || null, safe2: safe2 || null,
      emergency_contact, code_hash, updated_at: new Date().toISOString(),
    });
    const { code_hash: _, ...safe } = updated;
    return res.json(safe);
  }

  const profile = db.insert('safety_profiles', {
    user_id: req.user.id,
    home: home || null, office: office || null, safe1: safe1 || null, safe2: safe2 || null,
    emergency_contact, code_hash, created_at: new Date().toISOString(),
  });
  const { code_hash: _, ...safe } = profile;
  res.json(safe);
});

// POST /api/safety/verify-code  — verify safety code
router.post('/verify-code', requireAuth, async (req, res) => {
  const { code } = req.body;
  const profile = db.findOne('safety_profiles', { user_id: req.user.id });
  if (!profile) return res.status(404).json({ error: 'No safety profile found.' });
  const valid = await bcrypt.compare(String(code), profile.code_hash);
  res.json({ valid });
});

// POST /api/safety/emergency  — log an emergency event
router.post('/emergency', requireAuth, (req, res) => {
  const { user_id, timestamp } = { user_id: req.user.id, timestamp: new Date().toISOString() };
  const profile = db.findOne('safety_profiles', { user_id });
  if (!profile) return res.status(404).json({ error: 'No safety profile found.' });
  // Mark in journey history / log — in production this would trigger SMS via Twilio
  console.log(`[EMERGENCY] User ${req.user.name} (${req.user.email}) triggered safety alert at ${timestamp}. Contact: ${profile.emergency_contact}`);
  res.json({ logged: true, contact: profile.emergency_contact, timestamp });
});

module.exports = router;
