const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Point DB at a temp file so tests don't pollute real data
const TEST_DB = path.join(os.tmpdir(), `safe2journey-test-${Date.now()}.json`);
process.env.DB_PATH = TEST_DB;

const app = require('../server');
const db = require('../db/database');

// Seed minimal Delhi transit stops so /plan tests don't need live Overpass
beforeAll(() => {
  db.insert('bus_stops', { name: 'Connaught Place Bus Stop', route_id: '574', lat: 28.6315, lng: 77.2167 });
  db.insert('bus_stops', { name: 'Noida Sector 62 Bus Stop', route_id: '701', lat: 28.6273, lng: 77.3727 });
  db.insert('metro_stations', { name: 'Rajiv Chowk', line: 'Yellow Line', lat: 28.6328, lng: 77.2197 });
  db.insert('metro_stations', { name: 'Noida Electronic City', line: 'Blue Line', lat: 28.5672, lng: 77.3613 });
});

afterAll(() => {
  try { fs.unlinkSync(TEST_DB); } catch {}
});

const ADMIN_KEY = 'admin_safe2journey_2024';
let authToken = '';
let testUserId = null;
const TEST_EMAIL = `jest_${Date.now()}@test.com`;

// ─── AUTH ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Jest User', email: TEST_EMAIL, password: 'testpass123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
    authToken = res.body.token;
    testUserId = res.body.user.id;
  });

  it('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Jest User', email: TEST_EMAIL, password: 'testpass123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'x', email: 'short@test.com', password: '12' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'noname@test.com', password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'testpass123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('rejects unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'anything' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user info with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_EMAIL);
    expect(res.body.password_hash).toBeUndefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
  });
});

// ─── JOURNEY ─────────────────────────────────────────────────────────────────

let journeyId = null;

describe('POST /api/journey/plan', () => {
  it('returns routes for valid Delhi coords', async () => {
    const res = await request(app)
      .post('/api/journey/plan')
      .send({
        startLat: 28.6139, startLng: 77.209, startName: 'Connaught Place',
        endLat: 28.5355, endLng: 77.391, endName: 'Noida Sector 62',
        maxModes: 3,
      });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.routes)).toBe(true);
    expect(res.body.routes.length).toBeGreaterThan(0);
    expect(res.body.totalDistanceKm).toBeDefined();
    const first = res.body.routes[0];
    expect(first.legs).toBeDefined();
    expect(first.totalCost).toBeGreaterThanOrEqual(0);
    expect(first.totalDurationMins).toBeGreaterThan(0);
    journeyId = res.body.journeyId;
  }, 60000);

  it('returns 400 when coords missing', async () => {
    const res = await request(app)
      .post('/api/journey/plan')
      .send({ startLat: 28.6139 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/coordinates/i);
  });

  it.skip('handles intercontinental routes (skipped: depends on live Overpass API)', async () => {
    const res = await request(app)
      .post('/api/journey/plan')
      .send({
        startLat: 51.5074, startLng: -0.1278, startName: 'London',
        endLat: 48.8566, endLng: 2.3522, endName: 'Paris',
        maxModes: 3,
      });
    expect(res.status).toBe(200);
    expect(res.body.routes.length).toBeGreaterThan(0);
    const hasFlight = res.body.routes.some(r => r.legs.some(l => l.mode === 'air'));
    expect(hasFlight).toBe(true);
  }, 30000);
});

describe('GET /api/journey/history', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/journey/history');
    expect(res.status).toBe(401);
  });

  it('returns user journeys with valid token', async () => {
    const res = await request(app)
      .get('/api/journey/history')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/journey/history/all', () => {
  it('returns public journeys without auth', async () => {
    const res = await request(app).get('/api/journey/history/all');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(20);
  });
});

describe('PUT /api/journey/:id/complete', () => {
  it('marks a journey complete', async () => {
    if (!journeyId) return;
    const res = await request(app)
      .put(`/api/journey/${journeyId}/complete`)
      .send({ actualDuration: 28 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.actual_duration).toBe(28);
    expect(res.body.completed_at).toBeDefined();
  });

  it('returns 404 for unknown journey', async () => {
    const res = await request(app)
      .put('/api/journey/999999/complete')
      .send({});
    expect(res.status).toBe(404);
  });
});

// ─── TRANSPORT ───────────────────────────────────────────────────────────────

describe('GET /api/transport/nearby', () => {
  it('returns categorised stops for Delhi coords', async () => {
    const res = await request(app)
      .get('/api/transport/nearby?lat=28.6139&lng=77.209');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.busStops)).toBe(true);
    expect(Array.isArray(res.body.metroStations)).toBe(true);
    // trainStations only present in OSM-sourced responses
    if (res.body.trainStations !== undefined) {
      expect(Array.isArray(res.body.trainStations)).toBe(true);
    }
  }, 20000);

  it('requires lat and lng', async () => {
    const res = await request(app).get('/api/transport/nearby');
    expect(res.status).toBe(400);
  });
});

// ─── SAFETY ──────────────────────────────────────────────────────────────────

describe('Safety endpoints', () => {
  it('GET /profile returns 401 without auth', async () => {
    const res = await request(app).get('/api/safety/profile');
    expect(res.status).toBe(401);
  });

  it('GET /profile returns null when no profile exists', async () => {
    const res = await request(app)
      .get('/api/safety/profile')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('POST /profile saves safety profile', async () => {
    const res = await request(app)
      .post('/api/safety/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        home: 'Test Home, Delhi',
        office: 'Test Office, Noida',
        emergency_contact: '9876543210',
        safety_code: 'secret42',
      });
    expect(res.status).toBe(200);
    expect(res.body.emergency_contact).toBe('9876543210');
    expect(res.body.code_hash).toBeUndefined(); // must not leak hash
  });

  it('POST /profile requires emergency_contact and safety_code', async () => {
    const res = await request(app)
      .post('/api/safety/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ home: 'somewhere' });
    expect(res.status).toBe(400);
  });

  it('POST /verify-code accepts correct code', async () => {
    const res = await request(app)
      .post('/api/safety/verify-code')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ code: 'secret42' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('POST /verify-code rejects wrong code', async () => {
    const res = await request(app)
      .post('/api/safety/verify-code')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ code: 'wrongcode' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('POST /emergency logs and returns contact', async () => {
    const res = await request(app)
      .post('/api/safety/emergency')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.logged).toBe(true);
    expect(res.body.contact).toBe('9876543210');
  });
});

// ─── LIVE TRACKING ───────────────────────────────────────────────────────────

describe('Live tracking endpoints', () => {
  const TOKEN = `jest-track-${Date.now()}`;

  it('POST /track requires token, lat, lng', async () => {
    const res = await request(app)
      .post('/api/track')
      .send({ lat: 28.6, lng: 77.2 });
    expect(res.status).toBe(400);
  });

  it('POST /track creates session', async () => {
    const res = await request(app)
      .post('/api/track')
      .send({ token: TOKEN, lat: 28.6139, lng: 77.209, speedKmh: 30, routeLabel: 'Test Route', destination: 'Noida' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /track/:token returns session', async () => {
    const res = await request(app).get(`/api/track/${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.lat).toBeCloseTo(28.6139);
    expect(res.body.routeLabel).toBe('Test Route');
    expect(res.body.destination).toBe('Noida');
  });

  it('POST /track update preserves routeLabel when omitted', async () => {
    await request(app)
      .post('/api/track')
      .send({ token: TOKEN, lat: 28.62, lng: 77.22, speedKmh: 50 });
    const res = await request(app).get(`/api/track/${TOKEN}`);
    expect(res.body.routeLabel).toBe('Test Route');   // preserved
    expect(res.body.destination).toBe('Noida');        // preserved
    expect(res.body.lat).toBeCloseTo(28.62);           // updated
  });

  it('GET /track/:token returns 404 for unknown token', async () => {
    const res = await request(app).get('/api/track/nonexistent-abc');
    expect(res.status).toBe(404);
  });
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────

describe('Admin endpoints', () => {
  it('GET /admin/stats returns 403 without key', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(403);
  });

  it('GET /admin/stats returns 403 with wrong key', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('x-admin-key', 'wrongkey');
    expect(res.status).toBe(403);
  });

  it('GET /admin/stats returns stats with correct key', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('x-admin-key', ADMIN_KEY);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalJourneys).toBe('number');
    expect(typeof res.body.modeCounts).toBe('object');
  });

  it('GET /admin/users returns user list', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('x-admin-key', ADMIN_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const user = res.body.find(u => u.email === TEST_EMAIL);
    expect(user).toBeDefined();
    expect(user.password_hash).toBeUndefined(); // must not leak hash
  });

  it('GET /admin/bus-stops returns bus stops', async () => {
    const res = await request(app)
      .get('/api/admin/bus-stops')
      .set('x-admin-key', ADMIN_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /admin/rates returns rates', async () => {
    const res = await request(app)
      .get('/api/admin/rates')
      .set('x-admin-key', ADMIN_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── HEALTH ──────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
