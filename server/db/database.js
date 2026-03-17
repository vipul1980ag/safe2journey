const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.json');

const DEFAULT_DB = {
  users: [],
  bus_stops: [],
  metro_stations: [],
  bus_schedules: [],
  metro_schedules: [],
  journeys: [],
  safety_profiles: [],
  transport_rates: [],
  _counters: { users: 0, bus_stops: 0, metro_stations: 0, bus_schedules: 0, metro_schedules: 0, journeys: 0, safety_profiles: 0, transport_rates: 0 },
};

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  // Migrate: add any tables that exist in DEFAULT_DB but not in the stored file
  let dirty = false;
  for (const [key, val] of Object.entries(DEFAULT_DB)) {
    if (data[key] === undefined) {
      data[key] = JSON.parse(JSON.stringify(val));
      dirty = true;
    }
  }
  if (dirty) fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  return data;
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nextId(data, table) {
  data._counters[table] = (data._counters[table] || 0) + 1;
  return data._counters[table];
}

const db = {
  insert(table, record) {
    const data = load();
    const id = nextId(data, table);
    const row = { id, ...record };
    data[table].push(row);
    save(data);
    return row;
  },
  findAll(table, where = {}) {
    const data = load();
    const rows = data[table] || [];
    return rows.filter(r => Object.entries(where).every(([k, v]) => r[k] === v));
  },
  findOne(table, where = {}) {
    return this.findAll(table, where)[0] || null;
  },
  update(table, id, fields) {
    const data = load();
    const idx = (data[table] || []).findIndex(r => r.id === id);
    if (idx === -1) return null;
    data[table][idx] = { ...data[table][idx], ...fields };
    save(data);
    return data[table][idx];
  },
  delete(table, id) {
    const data = load();
    const idx = (data[table] || []).findIndex(r => r.id === id);
    if (idx === -1) return false;
    data[table].splice(idx, 1);
    save(data);
    return true;
  },
  deleteWhere(table, where = {}) {
    const data = load();
    data[table] = (data[table] || []).filter(
      r => !Object.entries(where).every(([k, v]) => r[k] === v)
    );
    save(data);
  },
  clear(table) {
    const data = load();
    data[table] = [];
    data._counters[table] = 0;
    save(data);
  },
  raw() {
    return load();
  },
};

module.exports = db;
