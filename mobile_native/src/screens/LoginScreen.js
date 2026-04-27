// Copyright (c) 2024-2026 Vipul Agrawal. All Rights Reserved.
// Proprietary and confidential. Unauthorized copying, distribution,
// or modification of this file is strictly prohibited.
// See LICENSE file in the project root for full terms.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { login, register, setAuthToken } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login: authLogin } = useAuth();
  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) { Alert.alert('Missing Fields', 'Please enter email and password.'); return; }
    if (tab === 'register' && !name) { Alert.alert('Missing Fields', 'Please enter your name.'); return; }
    setLoading(true);
    try {
      const result = tab === 'login'
        ? await login(email.trim(), password)
        : await register(name.trim(), email.trim(), password);
      setAuthToken(result.token);
      authLogin(result.token, result.user);
      navigation.replace('Home');
    } catch (e) {
      let msg = e.message;
      try { msg = JSON.parse(e.message).error || msg; } catch {}
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#080F1E' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.shield}>🛡️</Text>
        <Text style={styles.brand}>Safe2Journey</Text>
        <Text style={styles.subtitle}>Smart multi-modal journey planner</Text>

        <View style={styles.formCard}>
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tabBtn, tab === 'login' && styles.tabActive]} onPress={() => setTab('login')}>
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, tab === 'register' && styles.tabActive]} onPress={() => setTab('register')}>
              <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {tab === 'register' && (
              <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName}
                placeholderTextColor="#3D5A7A" autoCapitalize="words" />
            )}
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail}
              placeholderTextColor="#3D5A7A" keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword}
              placeholderTextColor="#3D5A7A" secureTextEntry />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.submitText}>{tab === 'login' ? 'Login' : 'Create Account'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.guestBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.guestText}>Continue as Guest</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080F1E' },
  content: { padding: 28, paddingTop: 80, minHeight: '100%', alignItems: 'center' },
  shield: { fontSize: 52, marginBottom: 12 },
  brand: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 14, color: '#4A6284', marginTop: 8, marginBottom: 36, letterSpacing: 0.4 },

  formCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 4, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#3A6BE8' },
  tabText: { fontWeight: '700', color: 'rgba(255,255,255,0.4)', fontSize: 15 },
  tabTextActive: { color: '#fff' },
  form: { gap: 12 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, padding: 16,
    fontSize: 15, color: '#fff',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 4,
  },
  submitBtn: {
    backgroundColor: '#3A6BE8', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8,
    borderWidth: 1, borderColor: '#6B97F5',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  guestBtn: { marginTop: 28, padding: 12 },
  guestText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, textDecorationLine: 'underline' },
});
