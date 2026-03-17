import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useSafety } from '../context/SafetyContext';
import { clearAuthToken } from '../services/api';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn, logout } = useAuth();
  const { safetyOn, profile, enableSafety, disableSafety, lastAlert } = useSafety();

  function handleLogout() {
    clearAuthToken();
    logout();
  }

  function handleSafetyToggle() {
    if (!isLoggedIn) {
      Alert.alert('Login Required', 'Please login to use the Safety feature.');
      return;
    }
    if (safetyOn) {
      Alert.alert('Turn Off Safety?', 'Safety monitoring will stop.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn Off', style: 'destructive', onPress: disableSafety },
      ]);
    } else {
      if (!profile) {
        Alert.alert(
          'Setup Required',
          'Please set up your safety profile first (safe locations, emergency contact and safety code).',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Setup Now', onPress: () => navigation.navigate('SafetySetup') },
          ],
        );
        return;
      }
      const ok = enableSafety();
      if (!ok) {
        Alert.alert('Setup Incomplete', 'Please complete your safety profile before enabling.');
      } else {
        Alert.alert('Safety On ✅', 'You will be prompted every 5 minutes to confirm your safety. Stay safe!');
      }
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />

      {/* Top bar */}
      <View style={styles.topBar}>
        {isLoggedIn ? (
          <View style={styles.userBadge}>
            <Text style={styles.userIcon}>👤</Text>
            <Text style={styles.userName}>{user?.name}</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn}>
            <Text style={styles.loginBtnText}>Login / Register</Text>
          </TouchableOpacity>
        )}
        {isLoggedIn && (
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.appName}>Safe2Journey</Text>
        <Text style={styles.tagline}>Smart multi-modal journey planner</Text>
      </View>

      {/* Safety ON/OFF toggle — the flagship feature */}
      <TouchableOpacity
        style={[styles.safetyToggle, safetyOn ? styles.safetyToggleOn : styles.safetyToggleOff]}
        onPress={handleSafetyToggle}
        activeOpacity={0.85}
      >
        <View style={styles.safetyLeft}>
          <Text style={styles.safetyIcon}>{safetyOn ? '🛡' : '🔓'}</Text>
          <View>
            <Text style={styles.safetyLabel}>Safety {safetyOn ? 'ON' : 'OFF'}</Text>
            <Text style={styles.safetySubLabel}>
              {safetyOn
                ? 'Monitoring active — tap to turn off'
                : 'Tap to enable safety monitoring'}
            </Text>
          </View>
        </View>
        <View style={[styles.safetyDot, safetyOn ? styles.safetyDotOn : styles.safetyDotOff]} />
      </TouchableOpacity>

      {/* Last alert status */}
      {lastAlert && safetyOn && (
        <View style={styles.lastAlertRow}>
          <Text style={styles.lastAlertText}>
            {lastAlert.type === 'safe' ? '✅ Last check: Safe' :
             lastAlert.type === 'miss' ? `⚠️ ${lastAlert.count} missed check${lastAlert.count > 1 ? 's' : ''}` :
             '🚨 Emergency triggered'}
          </Text>
        </View>
      )}

      {/* Safety setup link */}
      {isLoggedIn && (
        <TouchableOpacity style={styles.safetySetupLink} onPress={() => navigation.navigate('SafetySetup')}>
          <Text style={styles.safetySetupText}>⚙ Setup safe locations & emergency contact</Text>
        </TouchableOpacity>
      )}

      {/* Plan cards */}
      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, styles.cardGps]}
          onPress={() => navigation.navigate('Plan', { mode: 'gps' })}
          activeOpacity={0.85}
        >
          <Text style={styles.cardIcon}>📍</Text>
          <Text style={styles.cardTitle}>Track My Location & Plan</Text>
          <Text style={styles.cardDesc}>Auto-detect your location and enter only the destination</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardManual]}
          onPress={() => navigation.navigate('Plan', { mode: 'manual' })}
          activeOpacity={0.85}
        >
          <Text style={styles.cardIcon}>✏️</Text>
          <Text style={styles.cardTitle}>Manual Entry</Text>
          <Text style={styles.cardDesc}>Enter both start and destination manually</Text>
        </TouchableOpacity>
      </View>

      {/* History button */}
      <TouchableOpacity style={styles.historyBtn} onPress={() => navigation.navigate('History')}>
        <Text style={styles.historyIcon}>🗂</Text>
        <Text style={styles.historyText}>Journey History</Text>
        <Text style={styles.historyArrow}>›</Text>
      </TouchableOpacity>

      {/* Transport modes */}
      <View style={styles.modesRow}>
        {['🚌', '🚇', '🚶', '🚕', '🛺', '🚗'].map((icon, i) => (
          <Text key={i} style={styles.modeIcon}>{icon}</Text>
        ))}
      </View>
      <Text style={styles.modesLabel}>Bus · Metro · Walk · Taxi · Auto · Car</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#1565C0',
    alignItems: 'center', padding: 24,
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 8,
  },
  userBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userIcon: { fontSize: 14 },
  userName: { fontSize: 13, color: '#BBDEFB', fontWeight: '600' },
  loginBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  logoutBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  logoutText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  hero: { alignItems: 'center', marginBottom: 16, marginTop: 40 },
  appName: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  tagline: { fontSize: 14, color: '#BBDEFB', marginTop: 4 },

  // Safety toggle
  safetyToggle: {
    width: '100%', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  safetyToggleOn:  { backgroundColor: '#1B5E20' },
  safetyToggleOff: { backgroundColor: 'rgba(255,255,255,0.12)' },
  safetyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  safetyIcon: { fontSize: 28 },
  safetyLabel: { fontSize: 16, fontWeight: '800', color: '#fff' },
  safetySubLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  safetyDot: { width: 16, height: 16, borderRadius: 8 },
  safetyDotOn:  { backgroundColor: '#69F0AE' },
  safetyDotOff: { backgroundColor: 'rgba(255,255,255,0.3)' },
  lastAlertRow: { alignSelf: 'flex-start', marginBottom: 2, paddingHorizontal: 4 },
  lastAlertText: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  safetySetupLink: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 10 },
  safetySetupText: { fontSize: 12, color: '#90CAF9', textDecorationLine: 'underline' },

  // Plan cards
  cards: { width: '100%', gap: 12, marginBottom: 12 },
  card: { borderRadius: 16, padding: 18, alignItems: 'flex-start' },
  cardGps: { backgroundColor: '#fff' },
  cardManual: { backgroundColor: '#E3F2FD' },
  cardIcon: { fontSize: 28, marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1565C0', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#555', lineHeight: 18 },

  historyBtn: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18,
  },
  historyIcon: { fontSize: 18 },
  historyText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 },
  historyArrow: { color: 'rgba(255,255,255,0.5)', fontSize: 22 },
  modesRow: { flexDirection: 'row', gap: 12 },
  modeIcon: { fontSize: 20 },
  modesLabel: { color: '#90CAF9', fontSize: 12, marginTop: 6, letterSpacing: 0.5 },
});
