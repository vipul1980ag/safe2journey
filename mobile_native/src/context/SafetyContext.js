import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import {
  Alert, Linking, Modal, View, Text, TextInput,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import { useAuth } from './AuthContext';
import * as api from '../services/api';

const SafetyContext = createContext(null);

const NORMAL_INTERVAL_MS = 5 * 60 * 1000;
const RETRY1_DELAY_MS    = 3 * 60 * 1000;
const RETRY2_DELAY_MS    = 2 * 60 * 1000;

export function SafetyProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [safetyOn, setSafetyOn]     = useState(false);
  const [profile, setProfile]       = useState(null);
  const [missCount, setMissCount]   = useState(0);
  const [lastAlert, setLastAlert]   = useState(null);

  // Safety prompt modal state
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptCode, setPromptCode]       = useState('');
  const [promptAttempt, setPromptAttempt] = useState(0);

  const timerRef        = useRef(null);
  const promptActiveRef = useRef(false);
  const missRef         = useRef(0);

  useEffect(() => { missRef.current = missCount; }, [missCount]);

  useEffect(() => {
    if (isLoggedIn) {
      api.getSafetyProfile().then(p => { if (p) setProfile(p); }).catch(() => {});
    } else {
      setProfile(null);
      disableSafety();
    }
  }, [isLoggedIn]);

  function scheduleNextPrompt(delayMs) {
    clearTimer();
    timerRef.current = setTimeout(() => showSafetyPrompt(), delayMs);
  }

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  function enableSafety() {
    if (!profile) return false;
    setSafetyOn(true);
    setMissCount(0);
    missRef.current = 0;
    scheduleNextPrompt(NORMAL_INTERVAL_MS);
    return true;
  }

  function disableSafety() {
    setSafetyOn(false);
    setMissCount(0);
    missRef.current = 0;
    clearTimer();
  }

  function showSafetyPrompt() {
    if (promptActiveRef.current) return;
    promptActiveRef.current = true;
    setPromptCode('');
    setPromptAttempt(missRef.current);
    setPromptVisible(true);
  }

  async function handleCodeSubmit() {
    const code = promptCode.trim();
    setPromptVisible(false);
    promptActiveRef.current = false;

    if (!code) { handleMiss(); return; }

    try {
      const res = await api.verifySafetyCode(code);
      if (res.valid) {
        setMissCount(0);
        missRef.current = 0;
        setLastAlert({ type: 'safe', time: new Date() });
        scheduleNextPrompt(NORMAL_INTERVAL_MS);
      } else {
        Alert.alert('Wrong Code', 'Incorrect safety code. Please try again.');
        handleMiss();
      }
    } catch {
      scheduleNextPrompt(NORMAL_INTERVAL_MS);
    }
  }

  function handleDismiss() {
    setPromptVisible(false);
    promptActiveRef.current = false;
    handleMiss();
  }

  function handleMiss() {
    const newMiss = missRef.current + 1;
    setMissCount(newMiss);
    missRef.current = newMiss;
    setLastAlert({ type: 'miss', count: newMiss, time: new Date() });

    if (newMiss >= 3) {
      triggerEmergency();
    } else if (newMiss === 1) {
      scheduleNextPrompt(RETRY1_DELAY_MS);
    } else {
      scheduleNextPrompt(RETRY2_DELAY_MS);
    }
  }

  async function triggerEmergency() {
    clearTimer();
    setSafetyOn(false);
    const contact = profile?.emergency_contact;
    const msg = encodeURIComponent('ALERT: Safe2Journey safety check failed 3 times. User may need help. Please contact them immediately.');
    try { await api.logEmergency(); } catch {}
    setLastAlert({ type: 'emergency', time: new Date(), contact });
    Alert.alert(
      'Emergency Alert Triggered',
      `Safety code was not entered 3 times.\n\nSending emergency message to: ${contact || 'your emergency contact'}`,
      [
        { text: 'Send SMS Now', onPress: () => { if (contact) Linking.openURL(`sms:${contact}?body=${msg}`); } },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  const attemptLabel = promptAttempt === 0 ? '' : promptAttempt === 1 ? ' (2nd attempt)' : ' (FINAL attempt)';

  return (
    <SafetyContext.Provider value={{
      safetyOn, profile, setProfile, missCount, lastAlert,
      enableSafety, disableSafety,
    }}>
      {children}

      {/* Cross-platform safety check modal (replaces Alert.prompt which is iOS-only) */}
      <Modal
        visible={promptVisible}
        transparent
        animationType="fade"
        onRequestClose={handleDismiss}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Safety Check{attemptLabel}</Text>

            {promptAttempt > 0 && (
              <View style={styles.warnBanner}>
                <Text style={styles.warnText}>
                  {promptAttempt} missed check{promptAttempt > 1 ? 's' : ''}
                </Text>
              </View>
            )}

            <Text style={styles.modalDesc}>
              Are you safe? Enter your safety code to confirm.
            </Text>

            <TextInput
              style={styles.codeInput}
              placeholder="Enter safety code"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={promptCode}
              onChangeText={setPromptCode}
              autoFocus
              onSubmitEditing={handleCodeSubmit}
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={handleCodeSubmit}>
              <Text style={styles.confirmBtnText}>I'm Safe — Confirm</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
              <Text style={styles.dismissBtnText}>
                {promptAttempt >= 2 ? 'Dismiss (will trigger emergency)' : 'Dismiss'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafetyContext.Provider>
  );
}

export function useSafety() { return useContext(SafetyContext); }

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1565C0',
    marginBottom: 12,
    textAlign: 'center',
  },
  warnBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  warnText: { fontSize: 13, fontWeight: '700', color: '#E65100' },
  modalDesc: {
    fontSize: 14,
    color: '#444',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  codeInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#222',
    borderWidth: 1.5,
    borderColor: '#1565C0',
    marginBottom: 14,
    textAlign: 'center',
    letterSpacing: 4,
  },
  confirmBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  dismissBtn: {
    padding: 10,
    alignItems: 'center',
  },
  dismissBtnText: { fontSize: 13, color: '#999' },
});
