import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert, ScrollView,
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
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor="#080F1E" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >

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
        <Text style={styles.heroShield}>🛡️</Text>
        <Text style={styles.appName}>Safe2Journey</Text>
        <Text style={styles.tagline}>Smart multi-modal journey planner</Text>
      </View>

      {/* Safety ON/OFF toggle */}
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

      {/* Plan cards — side by side */}
      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, styles.cardGps]}
          onPress={() => navigation.navigate('Plan', { mode: 'gps' })}
          activeOpacity={0.85}
        >
          <Text style={styles.cardIcon}>📍</Text>
          <Text style={styles.cardTitle}>Track My Location</Text>
          <Text style={styles.cardDesc}>Auto-detect your location & enter destination</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardManual]}
          onPress={() => navigation.navigate('Plan', { mode: 'manual' })}
          activeOpacity={0.85}
        >
          <Text style={styles.cardIcon}>✏️</Text>
          <Text style={styles.cardTitle}>Manual Entry</Text>
          <Text style={styles.cardDesc}>Enter start and destination manually</Text>
        </TouchableOpacity>
      </View>

      {/* History button */}
      <TouchableOpacity style={styles.historyBtn} onPress={() => navigation.navigate('History')}>
        <Text style={styles.historyIcon}>🗂</Text>
        <Text style={styles.historyText}>Journey History</Text>
        <Text style={styles.historyArrow}>›</Text>
      </TouchableOpacity>

      {/* AI Assistant button */}
      <TouchableOpacity style={styles.aiBtn} onPress={() => navigation.navigate('AI')}>
        <Text style={styles.historyIcon}>🤖</Text>
        <Text style={styles.historyText}>AI Journey Assistant</Text>
        <Text style={styles.historyArrow}>›</Text>
      </TouchableOpacity>

      {/* Transport modes */}
      <View style={styles.modesRow}>
        {['🚌', '🚇', '🚶', '🚕', '🛺', '🚗'].map((icon, i) => (
          <View key={i} style={styles.modePill}>
            <Text style={styles.modeIcon}>{icon}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.modesLabel}>Bus · Metro · Walk · Taxi · Auto · Car</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#080F1E' },
  container: { alignItems: 'center', paddingHorizontal: 20 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 8,
  },
  userBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  userIcon: { fontSize: 13 },
  userName: { fontSize: 13, color: '#8BAFD4', fontWeight: '600' },
  loginBtn: {
    backgroundColor: '#3A6BE8', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22,
  },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  logoutBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  logoutText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },

  hero: { alignItems: 'center', marginBottom: 20, marginTop: 44 },
  heroShield: { fontSize: 54, marginBottom: 10 },
  appName: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  tagline: { fontSize: 14, color: '#4A6284', marginTop: 8, letterSpacing: 0.5 },

  safetyToggle: {
    width: '100%', borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6, borderWidth: 1.5,
  },
  safetyToggleOn: {
    backgroundColor: 'rgba(0,214,143,0.1)',
    borderColor: 'rgba(0,214,143,0.45)',
  },
  safetyToggleOff: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  safetyLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  safetyIcon: { fontSize: 30 },
  safetyLabel: { fontSize: 17, fontWeight: '800', color: '#fff' },
  safetySubLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  safetyDot: { width: 18, height: 18, borderRadius: 9 },
  safetyDotOn: { backgroundColor: '#00D68F' },
  safetyDotOff: { backgroundColor: 'rgba(255,255,255,0.18)' },
  lastAlertRow: { alignSelf: 'flex-start', marginBottom: 4, paddingHorizontal: 4 },
  lastAlertText: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  safetySetupLink: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 18 },
  safetySetupText: { fontSize: 13, color: '#3A6BE8', textDecorationLine: 'underline' },

  cards: { width: '100%', flexDirection: 'row', gap: 12, marginBottom: 14 },
  card: { flex: 1, borderRadius: 20, padding: 18, borderWidth: 1 },
  cardGps: { backgroundColor: '#3A6BE8', borderColor: '#6B97F5' },
  cardManual: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' },
  cardIcon: { fontSize: 28, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 6 },
  cardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 17 },

  historyBtn: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  aiBtn: {
    width: '100%',
    backgroundColor: 'rgba(108,99,255,0.14)',
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 26,
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.28)',
  },
  historyIcon: { fontSize: 20 },
  historyText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 15 },
  historyArrow: { color: 'rgba(255,255,255,0.3)', fontSize: 22 },

  modesRow: { flexDirection: 'row', gap: 8 },
  modePill: {
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  modeIcon: { fontSize: 18 },
  modesLabel: { color: '#2E4060', fontSize: 12, marginTop: 10, letterSpacing: 0.6 },
});
