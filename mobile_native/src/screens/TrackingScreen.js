// Copyright (c) 2024-2026 Vipul Agrawal. All Rights Reserved.
// Proprietary and confidential. Unauthorized copying, distribution,
// or modification of this file is strictly prohibited.
// See LICENSE file in the project root for full terms.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Animated, Share, Platform, Linking,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { replanJourney, reportDisruption, completeJourney, pushTrackPosition, SERVER_ROOT } from '../services/api';
import { fetchNearbyParking, fetchDrivingRoute, formatParkingRate, formatDistance, formatETA } from '../services/parking';
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
  const { selectedRoute, journeyId, startLat, startLng, endLat, endLng, endName, currencySymbol = '₹' } = route.params;

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

  // 🅿️ Parking integration (Park As You Desire)
  const [isPActive, setIsPActive]             = useState(false);  // P button toggled on
  const [parkingSuggestion, setParkingSuggestion] = useState(null); // { parking, distText, etaText }
  const [loadingParking, setLoadingParking]   = useState(false);
  const parkingBannerAnim                     = useRef(new Animated.Value(0)).current;
  const parkingCooldownRef                    = useRef(false);    // 2-min cooldown between auto-triggers
  const parkingAutoTriggeredRef               = useRef(false);    // triggered once per approach

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
      Alert.alert('Journey Complete!', `You arrived in ~${totalMins} min.\nEstimated cost: ${currencySymbol}${selectedRoute.totalCost}`);
    }
  }

  // ── Parking suggestion (P button) ─────────────────────────────────────────

  async function triggerParkingSuggestion(lat, lng, manual = false) {
    if (!manual && parkingCooldownRef.current) return;
    if (!manual && parkingAutoTriggeredRef.current) return;
    parkingCooldownRef.current = true;
    if (!manual) parkingAutoTriggeredRef.current = true;
    setTimeout(() => { parkingCooldownRef.current = false; }, 120000); // 2-min cooldown

    setLoadingParking(true);
    try {
      const spots = await fetchNearbyParking(lat, lng, 1000);
      if (!spots.length) {
        if (manual) Alert.alert('No Parking Found', 'No parking spots found within 1 km. Try again closer to your destination.');
        setLoadingParking(false);
        return;
      }
      const nearest = spots[0];

      let routeInfo = null;
      try { routeInfo = await fetchDrivingRoute(lat, lng, nearest.lat, nearest.lng); } catch (_) {}

      setParkingSuggestion({
        parking: nearest,
        distText: formatDistance(nearest.distance),
        etaText: formatETA(routeInfo?.duration),
        rateText: formatParkingRate(nearest),
      });
      showParkingBanner();
    } catch (err) {
      if (manual) Alert.alert('Parking Search Failed', 'Could not fetch parking data. Check your connection.');
    } finally {
      setLoadingParking(false);
    }
  }

  function showParkingBanner() {
    Animated.spring(parkingBannerAnim, {
      toValue: 1, useNativeDriver: true, tension: 80, friction: 12,
    }).start();
  }

  function hideParkingBanner() {
    Animated.timing(parkingBannerAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      .start(() => setParkingSuggestion(null));
  }

  function navigateToParking() {
    if (!parkingSuggestion?.parking) return;
    const { lat, lng } = parkingSuggestion.parking;
    const url = Platform.OS === 'ios'
      ? `maps://app?daddr=${lat},${lng}`
      : `google.navigation:q=${lat},${lng}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?daddr=${lat},${lng}`));
  }

  function handlePButton() {
    setIsPActive(prev => {
      const next = !prev;
      if (next && currentPosition) {
        // Manual trigger — search immediately
        triggerParkingSuggestion(currentPosition.latitude, currentPosition.longitude, true);
      } else if (!next) {
        hideParkingBanner();
      }
      return next;
    });
  }

  // Auto-trigger: last leg, within 800m of destination, speed slowing down
  useEffect(() => {
    if (!isPActive) return;
    if (!isLastLeg) return;
    if (!currentPosition) return;
    if (distToEndKm === null || distToEndKm > 0.8) return;
    if (liveSpeedKmh > 30) return; // only trigger when not at highway speed
    triggerParkingSuggestion(currentPosition.latitude, currentPosition.longitude, false);
  }, [distToEndKm, liveSpeedKmh, isPActive, isLastLeg]);

  // Reset auto-triggered flag if user moves away from destination again
  useEffect(() => {
    if (distToEndKm !== null && distToEndKm > 1.5) {
      parkingAutoTriggeredRef.current = false;
    }
  }, [distToEndKm]);

  const parkingBannerTranslateY = parkingBannerAnim.interpolate({
    inputRange: [0, 1], outputRange: [260, 0],
  });

  // ── Derived values ─────────────────────────────────────────────────────────
  const elapsedMins    = Math.floor(elapsedSecs / 60);
  const elapsedSecsRem = elapsedSecs % 60;
  const legProgress    = Math.min(100, Math.round((elapsedSecs / ((currentLeg?.durationMins || 1) * 60)) * 100));
  const displayEta     = liveEtaMins !== null ? liveEtaMins : Math.max(0, (currentLeg?.durationMins || 0) - elapsedMins);

  return (
    <View style={{ flex: 1 }}>
      <AlertBanner alerts={alerts} onDismiss={dismissAlert} />

      {/* ── Floating P (Parking) button ── */}
      <TouchableOpacity
        style={[styles.pBtn, isPActive && styles.pBtnActive]}
        onPress={handlePButton}
        activeOpacity={0.85}
      >
        {loadingParking
          ? <ActivityIndicator size="small" color={isPActive ? '#fff' : '#1565C0'} />
          : <Text style={[styles.pBtnText, isPActive && styles.pBtnTextActive]}>P</Text>}
        {isPActive && <View style={styles.pBtnLiveDot} />}
      </TouchableOpacity>

      {/* ── Parking suggestion banner ── */}
      {parkingSuggestion && (
        <Animated.View style={[styles.parkingBanner, { transform: [{ translateY: parkingBannerTranslateY }] }]}>
          <View style={styles.parkingBannerHeader}>
            <Text style={styles.parkingBannerIcon}>🅿️</Text>
            <View style={styles.parkingBannerTitleWrap}>
              <Text style={styles.parkingBannerTitle}>Parking Near Destination</Text>
              <Text style={styles.parkingBannerSub} numberOfLines={1}>
                {parkingSuggestion.parking.name}
              </Text>
            </View>
            <TouchableOpacity onPress={hideParkingBanner} style={styles.parkingBannerClose}>
              <Text style={styles.parkingBannerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.parkingBannerGrid}>
            <View style={styles.parkingBannerCell}>
              <Text style={styles.parkingCellLabel}>💰 Rate</Text>
              <Text style={styles.parkingCellValue}>{parkingSuggestion.rateText}</Text>
            </View>
            <View style={styles.parkingBannerCell}>
              <Text style={styles.parkingCellLabel}>📏 Distance</Text>
              <Text style={styles.parkingCellValue}>{parkingSuggestion.distText}</Text>
            </View>
            <View style={styles.parkingBannerCell}>
              <Text style={styles.parkingCellLabel}>⏱ Drive time</Text>
              <Text style={styles.parkingCellValue}>{parkingSuggestion.etaText}</Text>
            </View>
            <View style={styles.parkingBannerCell}>
              <Text style={styles.parkingCellLabel}>🔓 Access</Text>
              <Text style={styles.parkingCellValue}>
                {parkingSuggestion.parking.isPrivate ? 'Private' : 'Public'}
              </Text>
            </View>
          </View>

          <View style={styles.parkingBannerActions}>
            <TouchableOpacity style={styles.parkingNavBtn} onPress={navigateToParking} activeOpacity={0.85}>
              <Text style={styles.parkingNavBtnText}>🗺 Navigate to Parking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.parkingMoreBtn}
              onPress={() => { hideParkingBanner(); triggerParkingSuggestion(currentPosition.latitude, currentPosition.longitude, true); }}
              activeOpacity={0.85}
            >
              <Text style={styles.parkingMoreBtnText}>🔄 Find Another</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

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
            <Text style={styles.stat}>{currencySymbol}{currentLeg?.cost}</Text>
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

        {/* 🅿️ Parking finder card */}
        <View style={[styles.shareCard, isPActive && styles.parkingCardActive]}>
          <View style={styles.shareTop}>
            <Text style={styles.shareTitle}>🅿️ Find Parking Near Destination</Text>
            {isPActive && (
              <View style={[styles.shareLiveChip, { backgroundColor: '#E3F2FD' }]}>
                <Text style={[styles.shareLiveDot, { color: '#1565C0' }]}>●</Text>
                <Text style={[styles.shareLiveText, { color: '#1565C0' }]}>Active</Text>
              </View>
            )}
          </View>
          <Text style={styles.shareDesc}>
            {isPActive
              ? 'Parking suggestions are on. Will auto-suggest when you are within 800 m of your destination.'
              : 'Tap P to activate parking suggestions as you approach your destination. Powered by OpenStreetMap.'}
          </Text>
          <View style={styles.shareBtns}>
            <TouchableOpacity
              style={[styles.shareStartBtn, isPActive && { backgroundColor: '#E65100' }]}
              onPress={handlePButton}
              disabled={loadingParking}
            >
              {loadingParking
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.shareStartBtnText}>
                    {isPActive ? '⏹ Turn Off Parking P' : '🅿 Turn On Parking P'}
                  </Text>}
            </TouchableOpacity>
            {isPActive && currentPosition && (
              <TouchableOpacity
                style={[styles.shareResendBtn]}
                onPress={() => triggerParkingSuggestion(currentPosition.latitude, currentPosition.longitude, true)}
                disabled={loadingParking}
              >
                <Text style={styles.shareResendText}>Search Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

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
          <View style={styles.summaryRow}><Text style={styles.summaryLbl}>Estimated cost</Text><Text style={styles.summaryVal}>{currencySymbol}{selectedRoute.totalCost}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLbl}>Legs remaining</Text><Text style={styles.summaryVal}>{selectedRoute.legs.length - currentLegIndex}</Text></View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080F1E', padding: 16 },

  alertBanner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  alertInfo: { backgroundColor: '#1A3A6E' },
  alertWarn: { backgroundColor: '#7A2E00' },
  alertSuccess: { backgroundColor: '#004D2E' },
  alertIcon: { fontSize: 18 },
  alertText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  alertClose: { padding: 4 },
  alertCloseText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '700' },

  progressBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14, paddingVertical: 14 },
  progressStep: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  progressStepDone: { backgroundColor: '#3A6BE8', borderColor: '#6B97F5' },
  progressStepCurrent: { backgroundColor: '#3A6BE8', borderWidth: 3, borderColor: '#6B97F5' },
  progressIcon: { fontSize: 20 },
  progressLine: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 4 },
  progressLineDone: { backgroundColor: '#3A6BE8' },

  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metricBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  metricCenter: { borderWidth: 2, borderColor: '#3A6BE8' },
  metricIcon: { fontSize: 16, marginBottom: 2 },
  metricVal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  metricEta: { color: '#6B97F5' },
  metricLbl: { fontSize: 10, color: '#4A6284', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  speedBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,214,143,0.1)', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,214,143,0.2)' },
  speedIcon: { fontSize: 16 },
  speedVal: { fontSize: 16, fontWeight: '800', color: '#00D68F' },
  speedLbl: { fontSize: 12, color: '#4A6284' },

  legProgressBg: { height: 24, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, marginBottom: 14, overflow: 'hidden', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  legProgressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#3A6BE8', borderRadius: 12 },
  legProgressText: { textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width:0, height:1 }, textShadowRadius: 3 },

  currentCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  currentLabel: { fontSize: 11, color: '#4A6284', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  currentMode: { fontSize: 24, fontWeight: '800', color: '#6B97F5', marginBottom: 12 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  legFrom: { flex: 1, fontSize: 14, fontWeight: '600', color: '#8BAFD4' },
  arrow: { fontSize: 18, color: '#3A6BE8' },
  legTo: { flex: 1, fontSize: 14, fontWeight: '600', color: '#8BAFD4', textAlign: 'right' },
  legStats: { flexDirection: 'row', gap: 16 },
  stat: { fontSize: 13, color: '#4A6284', fontWeight: '500' },
  legNote: { fontSize: 11, color: '#4A6284', marginTop: 10, fontStyle: 'italic' },

  countdownBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,183,77,0.1)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,183,77,0.25)' },
  countdownUrgent: { backgroundColor: 'rgba(255,107,107,0.1)', borderColor: 'rgba(255,107,107,0.3)' },
  countdownIcon: { fontSize: 20 },
  countdownTextCol: { flex: 1 },
  countdownLabel: { fontSize: 12, color: '#FFB74D', fontWeight: '600' },
  countdownLabelUrgent: { color: '#FF6B6B' },
  countdownTime: { fontSize: 22, fontWeight: '800', color: '#FFB74D' },
  countdownTimeUrgent: { color: '#FF6B6B' },
  countdownFreq: { fontSize: 11, color: '#4A6284' },

  statusBox: { backgroundColor: 'rgba(58,107,232,0.12)', borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(58,107,232,0.2)' },
  statusOk: { backgroundColor: 'rgba(0,214,143,0.1)', borderColor: 'rgba(0,214,143,0.2)' },
  statusWarn: { backgroundColor: 'rgba(255,183,77,0.1)', borderColor: 'rgba(255,183,77,0.2)' },
  statusText: { flex: 1, fontSize: 13, color: '#8BAFD4', fontWeight: '500' },
  statusSub: { fontSize: 11, color: '#4A6284', marginTop: 4 },

  replanSection: { marginBottom: 16 },
  replanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  replanTitle: { fontSize: 15, fontWeight: '700', color: '#FFB74D' },
  replanMapLink: { fontSize: 13, color: '#6B97F5', fontWeight: '700' },
  reportBtn: { backgroundColor: 'rgba(255,183,77,0.1)', borderWidth: 1.5, borderColor: 'rgba(255,183,77,0.3)', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 14 },
  reportBtnText: { color: '#FFB74D', fontWeight: '700', fontSize: 14 },

  completeBtn: { backgroundColor: '#00A86B', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#00D68F' },
  completeBtnFinal: { backgroundColor: '#3A6BE8', borderColor: '#6B97F5' },
  completeBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  shareCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  shareTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  shareTitle: { fontSize: 15, fontWeight: '700', color: '#6B97F5' },
  shareLiveChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,214,143,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  shareLiveDot: { color: '#00D68F', fontSize: 10 },
  shareLiveText: { fontSize: 12, fontWeight: '700', color: '#00D68F' },
  shareDesc: { fontSize: 13, color: '#4A6284', lineHeight: 19, marginBottom: 14 },
  shareBtns: { flexDirection: 'row', gap: 10 },
  shareStartBtn: { flex: 1, backgroundColor: '#3A6BE8', borderRadius: 12, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: '#6B97F5' },
  shareStartBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  shareResendBtn: { flex: 1, backgroundColor: 'rgba(58,107,232,0.15)', borderRadius: 12, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(58,107,232,0.3)' },
  shareResendText: { color: '#6B97F5', fontWeight: '700', fontSize: 13 },
  shareStopBtn: { flex: 1, backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 12, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,107,107,0.25)' },
  shareStopText: { color: '#FF6B6B', fontWeight: '700', fontSize: 13 },

  summaryCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#8BAFD4', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  summaryLbl: { fontSize: 13, color: '#4A6284' },
  summaryVal: { fontSize: 13, fontWeight: '700', color: '#fff' },

  pBtn: {
    position: 'absolute', bottom: 24, right: 16, zIndex: 200,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#080F1E', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#3A6BE8',
    elevation: 8,
    shadowColor: '#3A6BE8', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  pBtnActive: { backgroundColor: '#3A6BE8', borderColor: '#6B97F5' },
  pBtnText: { fontSize: 20, fontWeight: '900', color: '#3A6BE8', lineHeight: 24 },
  pBtnTextActive: { color: '#fff' },
  pBtnLiveDot: {
    position: 'absolute', top: 5, right: 5,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#00D68F', borderWidth: 1.5, borderColor: '#080F1E',
  },

  parkingBanner: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 150,
    backgroundColor: '#0E1A2E',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
    elevation: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.4, shadowRadius: 12,
    borderTopWidth: 2, borderTopColor: '#3A6BE8',
  },
  parkingBannerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  parkingBannerIcon: { fontSize: 28 },
  parkingBannerTitleWrap: { flex: 1 },
  parkingBannerTitle: { fontSize: 14, fontWeight: '800', color: '#6B97F5' },
  parkingBannerSub: { fontSize: 12, color: '#4A6284', marginTop: 2 },
  parkingBannerClose: { padding: 6 },
  parkingBannerCloseText: { fontSize: 18, color: '#4A6284', fontWeight: '700' },
  parkingBannerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  parkingBannerCell: {
    flex: 1, minWidth: '44%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  parkingCellLabel: { fontSize: 10, color: '#4A6284', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  parkingCellValue: { fontSize: 15, fontWeight: '800', color: '#fff' },
  parkingBannerActions: { flexDirection: 'row', gap: 10 },
  parkingNavBtn: {
    flex: 2, backgroundColor: '#3A6BE8', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#6B97F5',
  },
  parkingNavBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  parkingMoreBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  parkingMoreBtnText: { color: '#8BAFD4', fontWeight: '700', fontSize: 13 },

  parkingCardActive: { borderWidth: 2, borderColor: '#3A6BE8' },
});
