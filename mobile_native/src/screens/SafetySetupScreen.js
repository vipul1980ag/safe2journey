// Copyright (c) 2024-2026 Vipul Agrawal. All Rights Reserved.
// Proprietary and confidential. Unauthorized copying, distribution,
// or modification of this file is strictly prohibited.
// See LICENSE file in the project root for full terms.

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { saveSafetyProfile, getSafetyProfile } from '../services/api';
import { useSafety } from '../context/SafetyContext';

const LOCATIONS = [
  { key: 'home',   label: 'Home Address',      icon: '🏠', placeholder: 'e.g. 12 Main Street, Sector 21' },
  { key: 'office', label: 'Office / College',   icon: '🏢', placeholder: 'e.g. Connaught Place, New Delhi' },
  { key: 'safe1',  label: 'Safe Location 1',    icon: '📍', placeholder: 'e.g. Friend\'s house address' },
  { key: 'safe2',  label: 'Safe Location 2',    icon: '📍', placeholder: 'e.g. Relative\'s address' },
];

export default function SafetySetupScreen({ navigation }) {
  const { setProfile } = useSafety();
  const [locations, setLocations] = useState({ home: '', office: '', safe1: '', safe2: '' });
  const [emergencyContact, setEmergencyContact] = useState('');
  const [safetyCode, setSafetyCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    getSafetyProfile()
      .then(p => {
        if (p) {
          setLocations({ home: p.home || '', office: p.office || '', safe1: p.safe1 || '', safe2: p.safe2 || '' });
          setEmergencyContact(p.emergency_contact || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  async function handleSave() {
    if (!emergencyContact.trim()) {
      Alert.alert('Required', 'Please enter an emergency contact number.'); return;
    }
    if (!safetyCode.trim()) {
      Alert.alert('Required', 'Please set a safety code.'); return;
    }
    if (safetyCode !== confirmCode) {
      Alert.alert('Mismatch', 'Safety codes do not match.'); return;
    }
    if (safetyCode.length < 4) {
      Alert.alert('Too Short', 'Safety code must be at least 4 characters.'); return;
    }

    setLoading(true);
    try {
      const saved = await saveSafetyProfile({
        ...locations,
        emergency_contact: emergencyContact.trim(),
        safety_code: safetyCode,
      });
      setProfile(saved);
      Alert.alert('Saved!', 'Your safety profile has been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      let msg = e.message;
      try { msg = JSON.parse(e.message).error || msg; } catch {}
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  if (loadingProfile) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1565C0" /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>🛡</Text>
          <Text style={styles.infoText}>
            Safety On monitors your wellbeing. You'll be prompted regularly to confirm you're safe with your secret code.
            After 3 missed checks, your emergency contact is notified automatically.
          </Text>
        </View>

        {/* Safe locations */}
        <Text style={styles.sectionTitle}>Safe Locations</Text>
        <Text style={styles.sectionDesc}>Locations you visit regularly and consider safe.</Text>

        {LOCATIONS.map(loc => (
          <View key={loc.key} style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationIcon}>{loc.icon}</Text>
              <Text style={styles.locationLabel}>{loc.label}</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder={loc.placeholder}
              value={locations[loc.key]}
              onChangeText={v => setLocations(prev => ({ ...prev, [loc.key]: v }))}
              placeholderTextColor="#aaa"
            />
          </View>
        ))}

        {/* Emergency contact */}
        <Text style={styles.sectionTitle}>Emergency Contact</Text>
        <Text style={styles.sectionDesc}>This number will receive an SMS if you miss 3 safety checks.</Text>
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Text style={styles.locationIcon}>📞</Text>
            <Text style={styles.locationLabel}>Emergency Contact Number</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="+91 98765 43210"
            value={emergencyContact}
            onChangeText={setEmergencyContact}
            keyboardType="phone-pad"
            placeholderTextColor="#aaa"
          />
        </View>

        {/* Safety code */}
        <Text style={styles.sectionTitle}>Safety Code</Text>
        <Text style={styles.sectionDesc}>A secret code you enter to confirm you are safe. Min 4 characters.</Text>
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Text style={styles.locationIcon}>🔐</Text>
            <Text style={styles.locationLabel}>Set Safety Code</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Enter secret code"
            value={safetyCode}
            onChangeText={setSafetyCode}
            secureTextEntry
            placeholderTextColor="#aaa"
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder="Confirm safety code"
            value={confirmCode}
            onChangeText={setConfirmCode}
            secureTextEntry
            placeholderTextColor="#aaa"
          />
        </View>

        {/* Save button */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Safety Profile</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#E3F2FD', borderRadius: 12, padding: 14, marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: '#1565C0',
  },
  infoIcon: { fontSize: 24 },
  infoText: { flex: 1, fontSize: 13, color: '#1565C0', lineHeight: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: '#999', marginBottom: 10 },
  locationCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  locationIcon: { fontSize: 20 },
  locationLabel: { fontSize: 14, fontWeight: '700', color: '#333' },
  input: {
    backgroundColor: '#F5F7FA', borderRadius: 8, padding: 12, fontSize: 14, color: '#222',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  saveBtn: {
    backgroundColor: '#1565C0', borderRadius: 14, padding: 18,
    alignItems: 'center', marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
