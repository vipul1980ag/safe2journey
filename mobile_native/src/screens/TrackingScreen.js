import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Animated, Share, Platform,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { replanJourney, reportDisruption, completeJourney, pushTrackPosition, SERVER_ROOT } from '../services/api';
import RouteCard from '../components/RouteCard';

const MODE_LABELS = {
  bus: 'Bus', metro: 'Metro', tram: 'Tram', walking: 'Walk',
  taxi: 'Taxi', auto: 'Auto', car_bike: 'Car/Bike',
  train: 'Train', ferry: 'Ferry', air: 'Flight',
};
const MODE_ICONS = {
  bus: '🚌', metro: '🚇', tram: '🚋', walking: '🚶',
  taxi: '🚕', auto: '🛺', car_bike: '🚗',
  train: '🚆', ferry: '⛴', air: '✈',
};

// Haversine distance in km
function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function randomToken() {
  return Math.random().toString(36).slice(2, 11);
}

// ── Alert banner ─────────────────────────────────────────────────────────────
function AlertBanner({ alerts, onDismiss }) {
  const slideAnim = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: alerts.length > 0 ? 0 : -80,
      useNativeDriver: true, speed: 14,
    }).start();
  }, [alerts.length]);
  if (alerts.length === 0) return null;
  const a = alerts[0];
  return (
    <Animated.View style={[
      styles.alertBanner, { transform: [{ translateY: slideAnim }] },
      a.type === 'warn' ? styles.alertWarn : a.type === 'success' ? styles.alertSuccess : styles.alertInfo,
    ]}>
      <Text style={styles.alertIcon}>{a.type === 'warn' ? '⚠️' : a.type === 'success' ? '✅' : 'ℹ️'}</Text>
      <Text style={styles.alertText} numberOfLines={3}>{a.message}</Text>
      <TouchableOpacity onPress={onDismiss} style={styles.alertClose}>
        <Text style={styles.alertCloseText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Schedule countdown ────────────────────────────────────────────────────────
function ScheduleCountdown({ nextScheduled, frequency, modeName }) {
  const [countdown, setCountdown] = useState('');
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    if (!nextScheduled || nextScheduled === 'N/A') return;
    const tick = () => {
      const now = new Date();
      const [h, m] = nextScheduled.split(':').map(Number);
      const target = new Date();
      target.setHours(h, m, 0, 0);
      if (target < now) target.setDate(target.getDate() + 1);
      const diff = Math.max(0, Math.round((target - now) / 1000));
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setCountdown(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
      setWaiting(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextScheduled]);
  if (!nextScheduled || nextScheduled === 'N/A') return null;
  const urgent = waiting <= 120;
  return (
    <View style={[styles.countdownBox, urgent && styles.countdownUrgent]}>
      <Text style={styles.countdownIcon}>{urgent ? '🔴' : '🟡'}</Text>
      <View style={styles.countdownTextCol}>
        <Text style={[styles.countdownLabel, urgent && styles.countdownLabelUrgent]}>
          {urgent ? `Hurry! ${modeName} in` : `Next ${modeName} in`}
        </Text>
        <Text style={[styles.countdownTime, urgent && styles.countdownTimeUrgent]}>{countdown}</Text>
      </View>
      <Text style={styles.countdownFreq}>Every {frequency} min</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function TrackingScreen({ route, navigation }) {
  const { selectedRoute, journeyId, startLat, startLng, endLat, endLng, endName } = route.params;

  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [trackStatus, setTrackStatus]         = useState(null);
  const [newPlan, setNewPlan]                 = useState(null);
  const [checking, setChecking]               = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [alerts, setAlerts]                   = useState([]);
  const [elapsedSecs, setElapsedSecs]         = useState(0);
  const [liveEtaMins, setLiveEtaMins]         = useState(null);  // GPS-based ETA
  const [liveSpeedKmh, setLiveSpeedKmh]       = useState(0);
  const [distToEndKm, setDistToEndKm]         = useState(null);
  const [shareToken, setShareToken]           = useState(null);   // null = not sharing
  const [shareLoading, setShareLoading]       = useState(false);
  const [autoAdvanced, setAutoAdvanced]       = useState(false); // prevent repeat prompts
  const [disruptionChecking, setDisruptionChecking] = useState(false);
  const [disruptionPlan, setDisruptionPlan]   = useState(null); // alternative routes after disruption

  const journeyStartTime      = useRef(Date.now());
  const watchId               = useRef(null);
  const lastCheckRef          = useRef(0);
  const prevPosRef            = useRef(null);       // { lat, lng, time }
  const bestDistRef           = useRef(null);       // minimum dist to destination seen
  const offRouteCountRef      = useRef(0);          // consecutive readings showing increasing distance
  const shareIntervalRef      = useRef(null);
  const shareTokenRef         = useRef(null);       // stays in sync with shareToken state
  const missedTransitAlerted  = useRef(false);      // prevent duplicate missed-transit prompts
  const lowSpeedSecsRef       = useRef(0);          // seconds spent near-stationary after scheduled time

  const currentLeg = selectedRoute.legs[currentLegIndex];
  const isLastLeg  = currentLegIndex === selectedRoute.legs.length - 1;

  function pushAlert(message, type = 'info') {
    setAlerts(prev => [{ message, type, id: Date.now() }, ...prev].slice(0, 3));
  }
  function dismissAlert() { setAlerts(prev => prev.slice(1)); }

  // ── GPS handler (called on every position update) ──────────────────────────
  const handlePosition = useCallback((coords) => {
    const { latitude, longitude } = coords;
    // GPS-native speed (m/s → km/h), or calculate from consecutive fixes
    let speedKmh = 0;
    if (coords.speed != null && coords.speed >= 0) {
      speedKmh = coords.speed * 3.6;
    } else if (prevPosRef.current) {
      const dt = (Date.now() - prevPosRef.current.time) / 3600000; // hours
      if (dt > 0) {
        const d = distKm(prevPosRef.current.lat, prevPosRef.current.lng, latitude, longitude);
        speedKmh = d / dt;
      }
    }
    prevPosRef.current = { lat: latitude, lng: longitude, time: Date.now() };
    if (speedKmh > 0 && speedKmh < 900) setLiveSpeedKmh(Math.round(speedKmh));

    // Distance to destination
    const dEnd = distKm(latitude, longitude, parseFloat(endLat), parseFloat(endLng));
    setDistToEndKm(dEnd);

    // Live ETA: remaining distance / current speed
    if (speedKmh > 1) {
      setLiveEtaMins(Math.round((dEnd / speedKmh) * 60));
    }

    // Off-route detection: if distance to destination keeps increasing
    if (bestDistRef.current === null || dEnd < bestDistRef.current) {
      bestDistRef.current = dEnd;
      offRouteCountRef.current = 0;
    } else if (dEnd > bestDistRef.current + 0.3) { // 300 m worse than best
      offRouteCountRef.current += 1;
      if (offRouteCountRef.current >= 3) {          // 3 consecutive readings = off-route
        offRouteCountRef.current = 0;
        bestDistRef.current = dEnd;                 // reset so we don't spam
        pushAlert('You may be off-route — checking for a better path…', 'warn');
        triggerReplan(latitude, longitude);
      }
    }

    setCurrentPosition({ latitude, longitude });

    // Push to live-share server if sharing
    if (shareTokenRef.current) {
      pushLivePosition(latitude, longitude, speedKmh).catch(() => {});
    }
  }, [endLat, endLng, currentLeg]);

  async function pushLivePosition(lat, lng, spd) {
    await pushTrackPosition({
      token: shareTokenRef.current,
      lat, lng,
      speedKmh: Math.round(spd),
      bearing: 0,
      routeLabel: selectedRoute.label,
      destination: endName,
      legMode: currentLeg?.mode || null,
      legTo: currentLeg?.to || null,
    });
  }

  // ── Start GPS watch ────────────────────────────────────────────────────────
  function startTracking() {
    watchId.current = Geolocation.watchPosition(
      pos => handlePosition(pos.coords),
      () => {},
      { enableHighAccuracy: true, distanceFilter: 30 },
    );
  }

  useEffect(() => {
    startTracking();
    const timer = setInterval(() => setElapsedSecs(s => s + 1), 1000);
    return () => {
      if (watchId.current !== null) Geolocation.clearWatch(watchId.current);
      clearInterval(timer);
      stopSharing();
    };
  }, []);

  // Re-attach handler when leg changes so it uses latest currentLeg
  useEffect(() => {
    if (watchId.current !== null) Geolocation.clearWatch(watchId.current);
    startTracking();
    bestDistRef.current = null;
    offRouteCountRef.current = 0;
  }, [currentLegIndex]);

  // Periodic replan check every 30 s (only after half duration elapsed)
  useEffect(() => {
    if (!currentPosition) return;
    const now = Date.now();
    if (now - lastCheckRef.current < 30000) return;
    const elapsedMs = Date.now() - journeyStartTime.current;
    const halfMs = (currentLeg?.durationMins / 2) * 60 * 1000;
    if (elapsedMs < halfMs) return;
    lastCheckRef.current = now;
    scheduledReplanCheck();
  }, [currentPosition]);

  async function triggerReplan(lat, lng) {
    if (!lat || !lng) return;
    try {
      const result = await replanJourney({
        startLat, startLng,
        currentLat: lat, currentLng: lng,
        expectedDistKm: currentLeg?.distanceKm,
        startTime: journeyStartTime.current,
        expectedDurationMins: currentLeg?.durationMins,
        endLat, endLng, endName,
      });
      setTrackStatus(result.status);
      if (result.replanNeeded && result.newPlan) {
        setNewPlan(result.newPlan);
        pushAlert('Off-route! A faster path has been found below.', 'warn');
      }
    } catch {}
  }

  async function scheduledReplanCheck() {
    if (!currentPosition) return;
    setChecking(true);
    try {
      const result = await replanJourney({
        startLat, startLng,
        currentLat: currentPosition.latitude,
        currentLng: currentPosition.longitude,
        expectedDistKm: currentLeg?.distanceKm,
        startTime: journeyStartTime.current,
        expectedDurationMins: currentLeg?.durationMins,
        endLat, endLng, endName,
      });
      setTrackStatus(result.status);
      if (result.replanNeeded && result.newPlan) {
        setNewPlan(result.newPlan);
        pushAlert('You are behind schedule. A faster route has been found.', 'warn');
      } else if (!result.replanNeeded) {
        pushAlert('On track! Keep going.', 'success');
      }
    } catch {} finally { setChecking(false); }
  }

  // ── Disruption reporting ───────────────────────────────────────────────────
  // Called when user taps "Report Issue" or when auto-detection fires.
  async function handleDisruption(disruption) {
    if (!currentPosition) return;
    setDisruptionChecking(true);
    setDisruptionPlan(null);
    try {
      const result = await reportDisruption({
        currentLat:   currentPosition.latitude,
        currentLng:   currentPosition.longitude,
        endLat, endLng, endName,
        disruption,
        affectedMode: currentLeg?.mode || null,
      });
      setDisruptionPlan(result.plan);
      pushAlert(result.message, 'warn');
    } catch {
      pushAlert('Could not fetch alternative routes. Check connection.', 'warn');
    } finally {
      setDisruptionChecking(false);
    }
  }

  function showDisruptionMenu() {
    const modeName = MODE_LABELS[currentLeg?.mode] || 'service';
    Alert.alert(
      'Report Issue',
      `What happened with your ${modeName}?`,
      [
        { text: `${modeName} is delayed`,   onPress: () => handleDisruption('delayed') },
        { text: `${modeName} was cancelled`,onPress: () => handleDisruption('cancelled') },
        { text: `I missed the ${modeName}`, onPress: () => handleDisruption('missed') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  // ── Auto-detect missed transit ─────────────────────────────────────────────
  // If a scheduled departure time passes and the user is still stationary
  // for 2 consecutive minutes, ask if they missed it.
  useEffect(() => {
    // Only relevant for legs with a scheduled time and transit modes
    const transitModes = ['bus', 'metro', 'tram', 'train', 'ferry'];
    if (!currentLeg?.nextScheduled || !transitModes.includes(currentLeg?.mode)) return;
    if (missedTransitAlerted.current) return;

    const [h, m] = currentLeg.nextScheduled.split(':').map(Number);
    const scheduled = new Date(); scheduled.setHours(h, m, 0, 0);
    const minsAfterScheduled = (Date.now() - scheduled.getTime()) / 60000;

    // Scheduled time has passed
    if (minsAfterScheduled < 0) return;

    if (liveSpeedKmh < 2) {
      lowSpeedSecsRef.current += 1;
    } else {
      lowSpeedSecsRef.current = 0; // moving → not missed
    }

    // 2 minutes stationary after scheduled departure = likely missed
    if (minsAfterScheduled >= 2 && lowSpeedSecsRef.current >= 120) {
      missedTransitAlerted.current = true;
      const modeName = MODE_LABELS[currentLeg.mode] || 'transit';
      Alert.alert(
        `Did you miss the ${modeName}?`,
        `The scheduled ${modeName} was at ${currentLeg.nextScheduled} and you appear to still be waiting. What happened?`,
        [
          { text: `It's delayed`,    onPress: () => handleDisruption('delayed') },
          { text: 'It was cancelled',onPress: () => handleDisruption('cancelled') },
          { text: `I missed it`,     onPress: () => handleDisruption('missed') },
          { text: 'Still waiting',   style: 'cancel' },
        ],
      );
    }
  }, [elapsedSecs, liveSpeedKmh, currentLeg]);

  // Reset missed-transit tracking when leg changes
  useEffect(() => {
    missedTransitAlerted.current = false;
    lowSpeedSecsRef.current = 0;
  }, [currentLegIndex]);

  // ── Auto-advance: time-based leg completion ────────────────────────────────
  // When elapsed time exceeds the leg's estimated duration by > 20%, prompt user to advance
  useEffect(() => {
    if (autoAdvanced) return;
    const legDurationSecs = (currentLeg?.durationMins || 0) * 60;
    if (legDurationSecs === 0) return;
    if (elapsedSecs < legDurationSecs * 1.2) return; // allow 20% buffer
    setAutoAdvanced(true);
    if (isLastLeg) {
      Alert.alert(
        'Arrived?',
        `You have been travelling for ${Math.round(elapsedSecs / 60)} min (est. ${currentLeg.durationMins} min). Have you reached ${endName}?`,
        [
          { text: 'Not yet', style: 'cancel' },
          { text: 'Yes, arrived!', onPress: completeCurrentLeg },
        ],
      );
    } else {
      const nextLeg = selectedRoute.legs[currentLegIndex + 1];
      Alert.alert(
        'Next Leg?',
        `Estimated time for this leg has elapsed. Ready for the next step?\n${MODE_ICONS[nextLeg?.mode] || ''} ${MODE_LABELS[nextLeg?.mode] || ''}`,
        [
          { text: 'Not yet', style: 'cancel' },
          { text: 'Yes, advance', onPress: completeCurrentLeg },
        ],
      );
    }
  }, [elapsedSecs, autoAdvanced]);

  // Reset auto-advance flag when leg changes
  useEffect(() => { setAutoAdvanced(false); }, [currentLegIndex]);

  // ── Auto-advance: proximity-based arrival detection (last leg only) ────────
  useEffect(() => {
    if (!isLastLeg || autoAdvanced) return;
    if (distToEndKm === null || distToEndKm > 0.2) return; // within 200 m
    setAutoAdvanced(true);
    Alert.alert(
      'You have arrived!',
      `You are within 200 m of ${endName}. Mark journey as complete?`,
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Complete', onPress: completeCurrentLeg },
      ],
    );
  }, [distToEndKm, isLastLeg, autoAdvanced]);

  // ── Alert when approaching scheduled departure time
  useEffect(() => {
    if (!currentLeg?.nextScheduled || currentLeg.nextScheduled === 'N/A') return;
    const [h, m] = currentLeg.nextScheduled.split(':').map(Number);
    const target = new Date(); target.setHours(h, m, 0, 0);
    const diff = (target - Date.now()) / 1000;
    if (diff > 0 && diff <= 120) {
      pushAlert(
        `${MODE_ICONS[currentLeg.mode]} ${MODE_LABELS[currentLeg.mode]} in ${Math.ceil(diff / 60)} min at ${currentLeg.stop || currentLeg.station || 'your stop'}!`,
        'warn',
      );
    }
  }, [currentLeg?.nextScheduled]);

  // ── Share location ─────────────────────────────────────────────────────────
  async function startSharing() {
    setShareLoading(true);
    const token = randomToken();
    shareTokenRef.current = token;
    setShareToken(token);

    // Send initial position immediately
    if (currentPosition) {
      await pushLivePosition(currentPosition.latitude, currentPosition.longitude, liveSpeedKmh).catch(() => {});
    }

    // Send updates every 30 s
    shareIntervalRef.current = setInterval(async () => {
      if (!currentPosition || !shareTokenRef.current) return;
      await pushLivePosition(currentPosition.latitude, currentPosition.longitude, liveSpeedKmh).catch(() => {});
    }, 30000);

    setShareLoading(false);
    const url = `${SERVER_ROOT}/live-track.html?token=${token}`;
    try {
      await Share.share({ message: `Track my journey live: ${url}`, url });
    } catch {
      Alert.alert('Share Link', url, [{ text: 'OK' }]);
    }
  }

  function stopSharing() {
    if (shareIntervalRef.current) clearInterval(shareIntervalRef.current);
    shareIntervalRef.current = null;
    shareTokenRef.current = null;
    setShareToken(null);
  }

  // ── Complete leg ───────────────────────────────────────────────────────────
  async function completeCurrentLeg() {
    if (!isLastLeg) {
      const nextLeg = selectedRoute.legs[currentLegIndex + 1];
      setCurrentLegIndex(i => i + 1);
      setTrackStatus(null); setNewPlan(null); setAlerts([]);
      setLiveEtaMins(null); setLiveSpeedKmh(0);
      pushAlert(`Leg complete! Now: ${MODE_ICONS[nextLeg?.mode]} ${MODE_LABELS[nextLeg?.mode]}`, 'success');
    } else {
      const totalMins = Math.round(elapsedSecs / 60);
      stopSharing();
      if (journeyId) { try { await completeJourney(journeyId, totalMins); } catch {} }
      Alert.alert('Journey Complete!', `You arrived in ~${totalMins} min.\nEstimated cost: ₹${selectedRoute.totalCost}`);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const elapsedMins    = Math.floor(elapsedSecs / 60);
  const elapsedSecsRem = elapsedSecs % 60;
  const legProgress    = Math.min(100, Math.round((elapsedSecs / ((currentLeg?.durationMins || 1) * 60)) * 100));
  const displayEta     = liveEtaMins !== null ? liveEtaMins : Math.max(0, (currentLeg?.durationMins || 0) - elapsedMins);

  return (
    <View style={{ flex: 1 }}>
      <AlertBanner alerts={alerts} onDismiss={dismissAlert} />

      <ScrollView style={styles.container}>

        {/* Progress stepper */}
        <View style={styles.progressBar}>
          {selectedRoute.legs.map((leg, i) => (
            <React.Fragment key={i}>
              <View style={[styles.progressStep, i <= currentLegIndex && styles.progressStepDone, i === currentLegIndex && styles.progressStepCurrent]}>
                <Text style={styles.progressIcon}>{MODE_ICONS[leg.mode] || '•'}</Text>
              </View>
              {i < selectedRoute.legs.length - 1 && (
                <View style={[styles.progressLine, i < currentLegIndex && styles.progressLineDone]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Live metrics row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricIcon}>⏱</Text>
            <Text style={styles.metricVal}>{String(elapsedMins).padStart(2,'0')}:{String(elapsedSecsRem).padStart(2,'0')}</Text>
            <Text style={styles.metricLbl}>Elapsed</Text>
          </View>
          <View style={[styles.metricBox, styles.metricCenter]}>
            <Text style={styles.metricIcon}>🏁</Text>
            <Text style={[styles.metricVal, styles.metricEta]}>{displayEta} min</Text>
            <Text style={styles.metricLbl}>{liveEtaMins !== null ? 'Live ETA' : 'Est. ETA'}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricIcon}>📍</Text>
            <Text style={styles.metricVal}>{distToEndKm !== null ? distToEndKm.toFixed(1) : '—'}</Text>
            <Text style={styles.metricLbl}>km to dest</Text>
          </View>
        </View>

        {/* Speed indicator */}
        {liveSpeedKmh > 0 && (
          <View style={styles.speedBar}>
            <Text style={styles.speedIcon}>⚡</Text>
            <Text style={styles.speedVal}>{liveSpeedKmh} km/h</Text>
            <Text style={styles.speedLbl}>current speed · GPS-based ETA active</Text>
          </View>
        )}

        {/* Leg progress bar */}
        <View style={styles.legProgressBg}>
          <View style={[styles.legProgressFill, { width: `${legProgress}%` }]} />
          <Text style={styles.legProgressText}>{legProgress}% of this leg</Text>
        </View>

        {/* Current leg card */}
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>Leg {currentLegIndex + 1} of {selectedRoute.legs.length}</Text>
          <Text style={styles.currentMode}>{MODE_ICONS[currentLeg?.mode] || '•'} {MODE_LABELS[currentLeg?.mode] || currentLeg?.mode}</Text>
          <View style={styles.legRow}>
            <Text style={styles.legFrom} numberOfLines={1}>{currentLeg?.from}</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.legTo} numberOfLines={1}>{currentLeg?.to}</Text>
          </View>
          <View style={styles.legStats}>
            <Text style={styles.stat}>{currentLeg?.distanceKm} km</Text>
            <Text style={styles.stat}>~{currentLeg?.durationMins} min</Text>
            <Text style={styles.stat}>₹{currentLeg?.cost}</Text>
          </View>
          {currentLeg?.note && (
            <Text style={styles.legNote}>ℹ️ {currentLeg.note}</Text>
          )}
        </View>

        {/* Schedule countdown */}
        {currentLeg?.nextScheduled && (
          <ScheduleCountdown
            nextScheduled={currentLeg.nextScheduled}
            frequency={currentLeg.frequency}
            modeName={MODE_LABELS[currentLeg.mode] || currentLeg.mode}
          />
        )}

        {/* Track status */}
        {checking && (
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color="#1565C0" />
            <Text style={styles.statusText}>Checking your progress…</Text>
          </View>
        )}
        {trackStatus && !checking && (
          <View style={[styles.statusBox, trackStatus.replanNeeded ? styles.statusWarn : styles.statusOk]}>
            <Text style={styles.statusText}>{trackStatus.message}</Text>
            {trackStatus.coveredKm && (
              <Text style={styles.statusSub}>Covered: {trackStatus.coveredKm} km / Expected: {trackStatus.expectedHalfKm} km</Text>
            )}
          </View>
        )}

        {/* Re-planned route (behind schedule / off-route) */}
        {newPlan && newPlan.routes?.length > 0 && (
          <View style={styles.replanSection}>
            <View style={styles.replanHeader}>
              <Text style={styles.replanTitle}>⚡ Suggested Faster Route</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Map', { selectedRoute: newPlan.routes[0], startName: 'Current Location', endName })}>
                <Text style={styles.replanMapLink}>View Map</Text>
              </TouchableOpacity>
            </View>
            <RouteCard route={newPlan.routes[0]} />
          </View>
        )}

        {/* Report Issue button — shown for schedulable transit legs */}
        {['bus','metro','tram','train','ferry','air'].includes(currentLeg?.mode) && (
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={showDisruptionMenu}
            disabled={disruptionChecking}
          >
            {disruptionChecking
              ? <ActivityIndicator color="#E65100" size="small" />
              : <Text style={styles.reportBtnText}>⚠️ Report Delay / Cancellation</Text>}
          </TouchableOpacity>
        )}

        {/* Disruption alternative routes */}
        {disruptionPlan && disruptionPlan.routes?.length > 0 && (
          <View style={styles.replanSection}>
            <View style={styles.replanHeader}>
              <Text style={styles.replanTitle}>🔄 Alternative Routes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Map', { selectedRoute: disruptionPlan.routes[0], startName: 'Current Location', endName })}>
                <Text style={styles.replanMapLink}>View Map</Text>
              </TouchableOpacity>
            </View>
            {disruptionPlan.routes.slice(0, 2).map((r, i) => (
              <RouteCard key={i} route={r} />
            ))}
          </View>
        )}

        {/* Complete leg */}
        <TouchableOpacity style={[styles.completeBtn, isLastLeg && styles.completeBtnFinal]} onPress={completeCurrentLeg}>
          <Text style={styles.completeBtnText}>
            {isLastLeg
              ? '🏁 Arrive at Destination'
              : `Complete Leg · Next: ${MODE_ICONS[selectedRoute.legs[currentLegIndex + 1]?.mode] || ''} ${MODE_LABELS[selectedRoute.legs[currentLegIndex + 1]?.mode] || ''}`}
          </Text>
        </TouchableOpacity>

        {/* Share live location */}
        <View style={styles.shareCard}>
          <View style={styles.shareTop}>
            <Text style={styles.shareTitle}>📡 Share Live Location</Text>
            {shareToken && (
              <View style={styles.shareLiveChip}>
                <Text style={styles.shareLiveDot}>●</Text>
                <Text style={styles.shareLiveText}>Live</Text>
              </View>
            )}
          </View>
          <Text style={styles.shareDesc}>
            {shareToken
              ? 'Your location is being shared in real time. Anyone with the link can see where you are.'
              : 'Share a live tracking link so contacts can follow your journey on a map.'}
          </Text>
          <View style={styles.shareBtns}>
            {!shareToken ? (
              <TouchableOpacity
                style={styles.shareStartBtn}
                onPress={startSharing}
                disabled={shareLoading}
              >
                {shareLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.shareStartBtnText}>Start Sharing</Text>}
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.shareResendBtn}
                  onPress={async () => {
                    const url = `${SERVER_ROOT}/live-track.html?token=${shareToken}`;
                    try { await Share.share({ message: `Track my journey: ${url}`, url }); }
                    catch { Alert.alert('Share Link', url); }
                  }}
                >
                  <Text style={styles.shareResendText}>Resend Link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareStopBtn} onPress={stopSharing}>
                  <Text style={styles.shareStopText}>Stop Sharing</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Journey summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Journey Summary</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLbl}>Total distance</Text><Text style={styles.summaryVal}>{selectedRoute.totalDistanceKm} km</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLbl}>Estimated time</Text><Text style={styles.summaryVal}>{selectedRoute.totalDurationMins} min</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLbl}>Estimated cost</Text><Text style={styles.summaryVal}>₹{selectedRoute.totalCost}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLbl}>Legs remaining</Text><Text style={styles.summaryVal}>{selectedRoute.legs.length - currentLegIndex}</Text></View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 16 },

  alertBanner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  alertInfo: { backgroundColor: '#1565C0' },
  alertWarn: { backgroundColor: '#E65100' },
  alertSuccess: { backgroundColor: '#2E7D32' },
  alertIcon: { fontSize: 18 },
  alertText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  alertClose: { padding: 4 },
  alertCloseText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '700' },

  progressBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14, paddingVertical: 14 },
  progressStep: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  progressStepDone: { backgroundColor: '#1565C0' },
  progressStepCurrent: { backgroundColor: '#1565C0', borderWidth: 3, borderColor: '#90CAF9' },
  progressIcon: { fontSize: 20 },
  progressLine: { flex: 1, height: 3, backgroundColor: '#E0E0E0', marginHorizontal: 4 },
  progressLineDone: { backgroundColor: '#1565C0' },

  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metricBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOffset: { width:0, height:1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  metricCenter: { borderWidth: 2, borderColor: '#1565C0' },
  metricIcon: { fontSize: 16, marginBottom: 2 },
  metricVal: { fontSize: 18, fontWeight: '800', color: '#222' },
  metricEta: { color: '#1565C0' },
  metricLbl: { fontSize: 10, color: '#888', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  speedBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10, marginBottom: 10 },
  speedIcon: { fontSize: 16 },
  speedVal: { fontSize: 16, fontWeight: '800', color: '#2E7D32' },
  speedLbl: { fontSize: 12, color: '#555' },

  legProgressBg: { height: 24, backgroundColor: '#E0E0E0', borderRadius: 12, marginBottom: 14, overflow: 'hidden', justifyContent: 'center' },
  legProgressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#1565C0', borderRadius: 12 },
  legProgressText: { textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width:0, height:1 }, textShadowRadius: 2 },

  currentCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, elevation: 3, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  currentLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  currentMode: { fontSize: 24, fontWeight: '800', color: '#1565C0', marginBottom: 12 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  legFrom: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
  arrow: { fontSize: 18, color: '#1565C0' },
  legTo: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'right' },
  legStats: { flexDirection: 'row', gap: 16 },
  stat: { fontSize: 13, color: '#555', fontWeight: '500' },
  legNote: { fontSize: 11, color: '#888', marginTop: 10, fontStyle: 'italic' },

  countdownBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FFD54F' },
  countdownUrgent: { backgroundColor: '#FFF3E0', borderColor: '#FF6D00' },
  countdownIcon: { fontSize: 20 },
  countdownTextCol: { flex: 1 },
  countdownLabel: { fontSize: 12, color: '#E65100', fontWeight: '600' },
  countdownLabelUrgent: { color: '#BF360C' },
  countdownTime: { fontSize: 22, fontWeight: '800', color: '#E65100' },
  countdownTimeUrgent: { color: '#BF360C' },
  countdownFreq: { fontSize: 11, color: '#888' },

  statusBox: { backgroundColor: '#E3F2FD', borderRadius: 10, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusOk: { backgroundColor: '#E8F5E9' },
  statusWarn: { backgroundColor: '#FFF3E0' },
  statusText: { flex: 1, fontSize: 13, color: '#333', fontWeight: '500' },
  statusSub: { fontSize: 11, color: '#777', marginTop: 4 },

  replanSection: { marginBottom: 16 },
  replanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  replanTitle: { fontSize: 15, fontWeight: '700', color: '#E65100' },
  replanMapLink: { fontSize: 13, color: '#1565C0', fontWeight: '700' },
  reportBtn: { backgroundColor: '#FFF3E0', borderWidth: 1.5, borderColor: '#E65100', borderRadius: 10, padding: 13, alignItems: 'center', marginBottom: 14 },
  reportBtnText: { color: '#E65100', fontWeight: '700', fontSize: 14 },

  completeBtn: { backgroundColor: '#2E7D32', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 16 },
  completeBtnFinal: { backgroundColor: '#1565C0' },
  completeBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  shareCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width:0, height:1 }, shadowOpacity: 0.07, shadowRadius: 4 },
  shareTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  shareTitle: { fontSize: 15, fontWeight: '700', color: '#1565C0' },
  shareLiveChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  shareLiveDot: { color: '#2E7D32', fontSize: 10 },
  shareLiveText: { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  shareDesc: { fontSize: 13, color: '#666', lineHeight: 19, marginBottom: 14 },
  shareBtns: { flexDirection: 'row', gap: 10 },
  shareStartBtn: { flex: 1, backgroundColor: '#1565C0', borderRadius: 10, padding: 13, alignItems: 'center' },
  shareStartBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  shareResendBtn: { flex: 1, backgroundColor: '#E3F2FD', borderRadius: 10, padding: 13, alignItems: 'center' },
  shareResendText: { color: '#1565C0', fontWeight: '700', fontSize: 13 },
  shareStopBtn: { flex: 1, backgroundColor: '#FFF3E0', borderRadius: 10, padding: 13, alignItems: 'center' },
  shareStopText: { color: '#E65100', fontWeight: '700', fontSize: 13 },

  summaryCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  summaryLbl: { fontSize: 13, color: '#888' },
  summaryVal: { fontSize: 13, fontWeight: '700', color: '#222' },
});
