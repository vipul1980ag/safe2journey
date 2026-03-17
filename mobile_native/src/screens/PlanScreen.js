import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform, PermissionsAndroid,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { planJourney, geocodeSearch, reverseGeocode as reverseGeocodeApi } from '../services/api';

const MAX_MODES_OPTIONS = [1, 2, 3, 4, 5, 6];

const PREF_MODES = [
  { key: 'walking', label: 'Walk',        icon: '🚶' },
  { key: 'taxi',    label: 'Taxi',        icon: '🚕' },
  { key: 'auto',    label: 'Auto',        icon: '🛺' },
  { key: 'metro',   label: 'Metro/Tram',  icon: '🚇' },
  { key: 'train',   label: 'Train',       icon: '🚆' },
  { key: 'ferry',   label: 'Ferry/Ship',  icon: '⛴' },
  { key: 'air',     label: 'Air',         icon: '✈' },
];

// Detect region from coordinates
function detectRegion(lat, lng) {
  if (lat >= 34 && lat <= 72 && lng >= -25 && lng <= 45)   return 'europe';
  if (lat >= 15 && lat <= 84 && lng >= -168 && lng <= -50) return 'americas';
  if (lat >= -56 && lat <= 15 && lng >= -82 && lng <= -34) return 'americas';
  if (lat >= -50 && lat <= -10 && lng >= 110 && lng <= 180) return 'oceania';
  if (lat >= 5  && lat <= 38  && lng >= 60  && lng <= 100) return 'south_asia';
  if (lat >= -10 && lat <= 28 && lng >= 95  && lng <= 145) return 'southeast_asia';
  if (lat >= 18 && lat <= 55  && lng >= 100 && lng <= 145) return 'east_asia';
  if (lat >= 12 && lat <= 42  && lng >= 25  && lng <= 65)  return 'middle_east';
  return 'other';
}
function hasAutoMode(region) { return ['south_asia','southeast_asia','africa','middle_east','other'].includes(region); }
function autoLabel(region) {
  if (region === 'southeast_asia') return 'Tuk-tuk / Grab';
  if (region === 'africa')         return 'Matatu / Tuk-tuk';
  return 'Auto / Rickshaw';
}

// Client-side fallback route planner — works without a server
function buildOfflineRoutes(sLat, sLng, sName, eLat, eLng, eName, maxModes) {
  const R = 6371;
  const dLat = (eLat - sLat) * Math.PI / 180;
  const dLng = (eLng - sLng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(sLat*Math.PI/180)*Math.cos(eLat*Math.PI/180)*Math.sin(dLng/2)**2;
  const distKm = +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2);
  const region = detectRegion(sLat, sLng);
  const showAuto = hasAutoMode(region);
  const autoName = autoLabel(region);

  function dur(speed) { return Math.ceil((distKm / speed) * 60); }
  function fare(mode) {
    if (mode === 'auto')     return Math.round(25 + distKm * 11);
    if (mode === 'taxi')     return Math.round(50 + distKm * 14);
    if (mode === 'car_bike') return Math.round(distKm * 7);
    if (mode === 'bus')      return Math.max(10, Math.round(10 + distKm * 2));
    if (mode === 'metro') {
      if (distKm <= 2)  return 10;
      if (distKm <= 5)  return 20;
      if (distKm <= 12) return 30;
      if (distKm <= 21) return 40;
      return 50;
    }
    return 0;
  }

  const routes = [
    { case:0, label:'Taxi / Cab',  legs:[{mode:'taxi',    from:sName,to:eName,distanceKm:distKm,cost:fare('taxi'),    durationMins:dur(30)}], totalCost:fare('taxi'),     totalDurationMins:dur(30), totalDistanceKm:distKm },
    { case:0, label:'Car / Bike',  legs:[{mode:'car_bike',from:sName,to:eName,distanceKm:distKm,cost:fare('car_bike'),durationMins:dur(35)}], totalCost:fare('car_bike'), totalDurationMins:dur(35), totalDistanceKm:distKm },
  ];
  if (showAuto) {
    routes.push({ case:0, label:`Direct ${autoName}`, legs:[{mode:'auto',from:sName,to:eName,distanceKm:distKm,cost:fare('auto'),durationMins:dur(25)}], totalCost:fare('auto'), totalDurationMins:dur(25), totalDistanceKm:distKm });
  }
  if (maxModes >= 1) {
    routes.push({ case:1, label:'Direct Bus',   legs:[{mode:'bus',  from:sName,to:eName,distanceKm:distKm,cost:fare('bus'),  durationMins:dur(20),nextScheduled:null,waitMinutes:8,frequency:15}], totalCost:fare('bus'),  totalDurationMins:dur(20)+8, totalDistanceKm:distKm });
    routes.push({ case:1, label:'Direct Metro', legs:[{mode:'metro',from:sName,to:eName,distanceKm:distKm,cost:fare('metro'),durationMins:dur(40),nextScheduled:null,waitMinutes:3,frequency:5}],  totalCost:fare('metro'), totalDurationMins:dur(40)+3, totalDistanceKm:distKm });
  }
  if (distKm <= 2) {
    routes.push({ case:0, label:'Walk', legs:[{mode:'walking',from:sName,to:eName,distanceKm:distKm,cost:0,durationMins:dur(5)}], totalCost:0, totalDurationMins:dur(5), totalDistanceKm:distKm });
  }
  routes.sort((a,b) => a.totalDurationMins - b.totalDurationMins);
  return { startName:sName, endName:eName, totalDistanceKm:distKm, nearbyTransport:{busStops:[],metroStations:[]}, routes, journeyId:null, offline:true };
}

// Geocoding via server proxy (avoids Nominatim blocking direct mobile requests)
async function searchNominatim(query) {
  try {
    return await geocodeSearch(query);
  } catch {
    return [];
  }
}

export default function PlanScreen({ route, navigation }) {
  const inputMode = route.params?.mode || 'manual';

  const [startName, setStartName] = useState('');
  const [startLat, setStartLat]   = useState('');
  const [startLng, setStartLng]   = useState('');
  const [endName, setEndName]     = useState('');
  const [endLat, setEndLat]       = useState('');
  const [endLng, setEndLng]       = useState('');
  const [maxModes, setMaxModes]       = useState(2);
  const [preferredModes, setPreferredModes] = useState(PREF_MODES.map(m => m.key)); // all on
  const [loading, setLoading]     = useState(false);
  const [locating, setLocating]   = useState(false);

  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions]     = useState([]);
  const [startSearching, setStartSearching]     = useState(false);
  const [endSearching, setEndSearching]         = useState(false);

  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduleDate, setScheduleDate]         = useState('');
  const [scheduleTime, setScheduleTimeStr]      = useState('');

  const startTimer = useRef(null);
  const endTimer   = useRef(null);

  useEffect(() => {
    if (inputMode === 'gps') detectLocation();
  }, []);

  async function detectLocation() {
    setLocating(true);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Safe2Journey needs your location to detect your current position.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setLocating(false);
          Alert.alert('Permission Denied', 'Location permission is required. Please enable it in Settings and try again.');
          return;
        }
      }
      Geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          setStartLat(String(latitude));
          setStartLng(String(longitude));
          reverseGeocode(latitude, longitude).then(name => setStartName(name));
          setLocating(false);
        },
        () => {
          setLocating(false);
          Alert.alert('Location Error', 'Could not get your GPS location. Please type your start location manually.');
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } catch {
      setLocating(false);
      Alert.alert('Location Error', 'Could not request location permission.');
    }
  }

  async function reverseGeocode(lat, lng) {
    try {
      const result = await reverseGeocodeApi(lat, lng);
      return result.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  function onStartChange(v) {
    setStartName(v);
    setStartLat('');
    setStartLng('');
    clearTimeout(startTimer.current);
    if (v.length < 3) { setStartSuggestions([]); return; }
    setStartSearching(true);
    startTimer.current = setTimeout(async () => {
      const results = await searchNominatim(v);
      setStartSuggestions(results);
      setStartSearching(false);
    }, 400);
  }

  function onEndChange(v) {
    setEndName(v);
    setEndLat('');
    setEndLng('');
    clearTimeout(endTimer.current);
    if (v.length < 3) { setEndSuggestions([]); return; }
    setEndSearching(true);
    endTimer.current = setTimeout(async () => {
      const results = await searchNominatim(v);
      setEndSuggestions(results);
      setEndSearching(false);
    }, 400);
  }

  function selectStart(loc) {
    setStartName(loc.name);
    setStartLat(String(loc.lat));
    setStartLng(String(loc.lng));
    setStartSuggestions([]);
  }

  function selectEnd(loc) {
    setEndName(loc.name);
    setEndLat(String(loc.lat));
    setEndLng(String(loc.lng));
    setEndSuggestions([]);
  }

  async function handlePlan() {
    setLoading(true);

    // Auto-geocode if user typed but didn't pick from suggestions
    let sLat = startLat, sLng = startLng, sName = startName;
    let eLat = endLat,   eLng = endLng,   eName = endName;

    if ((!sLat || !sLng) && sName.trim().length >= 2) {
      const r = await searchNominatim(sName.trim());
      if (r.length) { sLat = String(r[0].lat); sLng = String(r[0].lng); sName = r[0].name; }
    }
    if ((!eLat || !eLng) && eName.trim().length >= 2) {
      const r = await searchNominatim(eName.trim());
      if (r.length) { eLat = String(r[0].lat); eLng = String(r[0].lng); eName = r[0].name; }
    }

    if (!sLat || !sLng) {
      setLoading(false);
      Alert.alert('Start Not Found', 'Could not locate the start. Please type more specifically or pick from suggestions.');
      return;
    }
    if (!eLat || !eLng) {
      setLoading(false);
      Alert.alert('Destination Not Found', 'Could not locate the destination. Please type more specifically or pick from suggestions.');
      return;
    }

    let scheduleISO = null;
    if (scheduleForLater) {
      if (!scheduleDate.match(/^\d{4}-\d{2}-\d{2}$/) || !scheduleTime.match(/^\d{2}:\d{2}$/)) {
        Alert.alert('Invalid Date/Time', 'Enter date as YYYY-MM-DD and time as HH:MM.');
        return;
      }
      scheduleISO = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      if (isNaN(new Date(scheduleISO))) {
        Alert.alert('Invalid Date', 'Please enter a valid date and time.'); return;
      }
    }

    try {
      let result;
      try {
        result = await planJourney({
          startLat: sLat, startLng: sLng, startName: sName,
          endLat: eLat, endLng: eLng, endName: eName,
          maxModes, scheduleTime: scheduleISO,
          preferredModes,
        });
      } catch {
        // Server unreachable — use client-side fallback so user always gets routes
        result = buildOfflineRoutes(
          parseFloat(sLat), parseFloat(sLng), sName,
          parseFloat(eLat), parseFloat(eLng), eName,
          maxModes,
        );
      }
      navigation.navigate('Results', {
        plan: result,
        startLat: sLat, startLng: sLng, startName: sName,
        endLat: eLat, endLng: eLng, endName: eName,
      });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

      {/* ── Start location ── */}
      <Text style={styles.section}>Start Location</Text>
      {inputMode === 'gps' ? (
        <View style={styles.gpsBox}>
          <Text style={styles.gpsText}>
            {locating ? 'Detecting location…' : startName || 'Location not detected'}
          </Text>
          <TouchableOpacity onPress={detectLocation} style={styles.retryBtn}>
            <Text style={styles.retryText}>Refresh GPS</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, startLat ? styles.inputSet : null]}
              placeholder="Search anywhere in the world…"
              value={startName}
              onChangeText={onStartChange}
              placeholderTextColor="#aaa"
            />
            {startSearching && <ActivityIndicator style={styles.inputSpinner} color="#1565C0" />}
          </View>
          {startLat ? <Text style={styles.coordHint}>📍 {parseFloat(startLat).toFixed(5)}, {parseFloat(startLng).toFixed(5)}</Text> : null}
          {startSuggestions.map((loc, i) => (
            <TouchableOpacity key={i} style={styles.suggestion} onPress={() => selectStart(loc)}>
              <Text style={styles.suggestionText}>📍 {loc.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Destination ── */}
      <Text style={styles.section}>Destination</Text>
      <View>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, endLat ? styles.inputSet : null]}
            placeholder="Search anywhere in the world…"
            value={endName}
            onChangeText={onEndChange}
            placeholderTextColor="#aaa"
          />
          {endSearching && <ActivityIndicator style={styles.inputSpinner} color="#1565C0" />}
        </View>
        {endLat ? <Text style={styles.coordHint}>🏁 {parseFloat(endLat).toFixed(5)}, {parseFloat(endLng).toFixed(5)}</Text> : null}
        {endSuggestions.map((loc, i) => (
          <TouchableOpacity key={i} style={styles.suggestion} onPress={() => selectEnd(loc)}>
            <Text style={styles.suggestionText}>📍 {loc.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Max modes ── */}
      <Text style={styles.section}>Max Modes of Transport</Text>
      <View style={styles.modesRow}>
        {MAX_MODES_OPTIONS.map(n => (
          <TouchableOpacity
            key={n}
            style={[styles.modeChip, maxModes === n && styles.modeChipActive]}
            onPress={() => setMaxModes(n)}
          >
            <Text style={[styles.modeChipText, maxModes === n && styles.modeChipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.modeHint}>
        {maxModes === 1 ? 'Direct route only' : `Up to ${maxModes} transport modes`}
      </Text>
      <Text style={styles.modeDesc}>
        {maxModes === 1 && 'Single mode: Bus, Metro, Auto or Taxi alone'}
        {maxModes === 2 && 'Two modes: e.g. Walk + Metro, Auto + Bus'}
        {maxModes === 3 && 'Three modes: e.g. Auto → Metro → Auto'}
        {maxModes >= 4 && 'Complex multi-leg journey combinations'}
      </Text>

      {/* ── Preferred modes ── */}
      <Text style={styles.section}>Preferred Mode of Transport</Text>
      <View style={styles.prefModesGrid}>
        {PREF_MODES.map(m => {
          const active = preferredModes.includes(m.key);
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.prefChip, active && styles.prefChipActive]}
              onPress={() => {
                setPreferredModes(prev =>
                  prev.includes(m.key) ? prev.filter(k => k !== m.key) : [...prev, m.key]
                );
              }}
            >
              <Text style={styles.prefChipIcon}>{m.icon}</Text>
              <Text style={[styles.prefChipLabel, active && styles.prefChipLabelActive]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.modeDesc}>
        {preferredModes.length === 0
          ? 'No mode selected — all routes shown'
          : preferredModes.length === PREF_MODES.length
          ? 'All modes — routes sorted by speed'
          : 'Preferred routes appear first'}
      </Text>

      {/* ── Schedule ── */}
      <Text style={styles.section}>When to Travel</Text>
      <View style={styles.scheduleRow}>
        <TouchableOpacity
          style={[styles.scheduleToggle, !scheduleForLater && styles.scheduleToggleActive]}
          onPress={() => setScheduleForLater(false)}
        >
          <Text style={[styles.scheduleToggleText, !scheduleForLater && styles.scheduleToggleTextActive]}>Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scheduleToggle, scheduleForLater && styles.scheduleToggleActive]}
          onPress={() => {
            setScheduleForLater(true);
            if (!scheduleDate) setScheduleDate(new Date().toISOString().slice(0, 10));
            if (!scheduleTime) setScheduleTimeStr('09:00');
          }}
        >
          <Text style={[styles.scheduleToggleText, scheduleForLater && styles.scheduleToggleTextActive]}>Schedule</Text>
        </TouchableOpacity>
      </View>

      {scheduleForLater && (
        <View style={styles.scheduleInputs}>
          <View style={{ flex: 1 }}>
            <Text style={styles.scheduleInputLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2024-12-31" value={scheduleDate}
              onChangeText={setScheduleDate} placeholderTextColor="#aaa" keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scheduleInputLabel}>Time (HH:MM)</Text>
            <TextInput style={styles.input} placeholder="09:00" value={scheduleTime}
              onChangeText={setScheduleTimeStr} placeholderTextColor="#aaa" keyboardType="numbers-and-punctuation" />
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.planBtn} onPress={handlePlan} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.planBtnText}>Find Routes</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  section: { fontSize: 13, fontWeight: '700', color: '#888', marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 14,
    fontSize: 15, color: '#222', borderWidth: 1, borderColor: '#E0E0E0',
  },
  inputSet: { borderColor: '#2E7D32', backgroundColor: '#F1F8E9' },
  inputSpinner: { marginLeft: 8 },
  coordHint: { fontSize: 11, color: '#2E7D32', marginTop: 4, marginLeft: 4 },
  suggestion: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  suggestionText: { fontSize: 14, color: '#333' },
  gpsBox: { backgroundColor: '#E3F2FD', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gpsText: { flex: 1, fontSize: 14, color: '#1565C0', fontWeight: '500' },
  retryBtn: { marginLeft: 10 },
  retryText: { color: '#1565C0', fontWeight: '700', fontSize: 13 },
  modesRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modeChip: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E0E0E0' },
  modeChipActive: { borderColor: '#1565C0', backgroundColor: '#1565C0' },
  modeChipText: { fontSize: 16, fontWeight: '700', color: '#555' },
  modeChipTextActive: { color: '#fff' },
  modeHint: { fontSize: 12, color: '#888', marginTop: 8 },
  modeDesc: { fontSize: 11, color: '#aaa', marginTop: 3 },
  prefModesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  prefChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 2, borderColor: '#E0E0E0' },
  prefChipActive: { borderColor: '#1565C0', backgroundColor: '#E3F2FD' },
  prefChipIcon: { fontSize: 16 },
  prefChipLabel: { fontSize: 12, fontWeight: '700', color: '#888' },
  prefChipLabelActive: { color: '#1565C0' },
  scheduleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  scheduleToggle: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#fff', borderWidth: 2, borderColor: '#E0E0E0', alignItems: 'center' },
  scheduleToggleActive: { borderColor: '#1565C0', backgroundColor: '#E3F2FD' },
  scheduleToggleText: { fontSize: 14, fontWeight: '700', color: '#888' },
  scheduleToggleTextActive: { color: '#1565C0' },
  scheduleInputs: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  scheduleInputLabel: { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 4 },
  planBtn: { backgroundColor: '#1565C0', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 32, marginBottom: 40 },
  planBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
