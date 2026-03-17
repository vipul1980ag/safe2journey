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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.brand}>Safe2Journey</Text>
        <Text style={styles.subtitle}>Smart multi-modal journey planner</Text>

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
              placeholderTextColor="#aaa" autoCapitalize="words" />
          )}
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail}
            placeholderTextColor="#aaa" keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword}
            placeholderTextColor="#aaa" secureTextEntry />

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.submitText}>{tab === 'login' ? 'Login' : 'Create Account'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.guestBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.guestText}>Continue as Guest</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1565C0' },
  content: { padding: 28, paddingTop: 80, minHeight: '100%', alignItems: 'center' },
  brand: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 14, color: '#BBDEFB', marginTop: 6, marginBottom: 40 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 4, marginBottom: 24, width: '100%' },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontWeight: '700', color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  tabTextActive: { color: '#1565C0' },
  form: { width: '100%', gap: 12 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 15, color: '#222',
    marginBottom: 4,
  },
  submitBtn: {
    backgroundColor: '#0D47A1', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8,
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  guestBtn: { marginTop: 28, padding: 12 },
  guestText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textDecorationLine: 'underline' },
});
