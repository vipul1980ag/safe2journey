// Copyright (c) 2024-2026 Vipul Agrawal. All Rights Reserved.
// Proprietary and confidential. Unauthorized copying, distribution,
// or modification of this file is strictly prohibited.
// See LICENSE file in the project root for full terms.

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { aiChatStream } from '../services/api';

const QUICK_PROMPTS = [
  { label: '🚌 Transport near me?', text: 'What transport modes are typically available for city travel?' },
  { label: '🌙 Night travel safety', text: 'Give me safety tips for solo night travel on public transport.' },
  { label: '🛡 How check-ins work', text: 'How does the safety check-in feature work in Safe2Journey?' },
  { label: '💰 Cheapest routes', text: 'How do I find the cheapest route on Safe2Journey?' },
  { label: '🚌 Bus cancelled', text: 'My bus was cancelled. What are my options?' },
];

export default function AIScreen() {
  const [messages, setMessages] = useState([
    { id: '0', role: 'assistant', text: "👋 Hi! I'm your Safe2Journey AI assistant.\n\nAsk me to help plan your journey, get safety tips, or understand your route options." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const apiHistory = () =>
    messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.text }));

  async function send(text) {
    const msgText = text || input.trim();
    if (!msgText || loading) return;
    setInput('');
    setLoading(true);

    const userMsg = { id: Date.now().toString(), role: 'user', text: msgText };
    const thinkingId = 'thinking';
    const streamId = Date.now().toString() + 'r';

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: thinkingId, role: 'thinking', text: '✦ Reasoning about your journey…' },
    ]);

    const history = [...apiHistory(), { role: 'user', content: msgText }];
    let streamStarted = false;

    try {
      await aiChatStream(history, null, (event) => {
        if (event.type === 'thinking_start') {
          // Already showing the thinking bubble — no extra action needed
        } else if (event.type === 'text_start') {
          // Replace thinking bubble with live streaming bubble
          streamStarted = true;
          setMessages(prev => [
            ...prev.filter(m => m.id !== thinkingId),
            { id: streamId, role: 'assistant', text: '' },
          ]);
        } else if (event.type === 'text') {
          setMessages(prev => prev.map(m =>
            m.id === streamId ? { ...m, text: m.text + event.text } : m
          ));
        } else if (event.type === 'error') {
          setMessages(prev => [
            ...prev.filter(m => m.id !== thinkingId),
            { id: streamId, role: 'assistant', text: `⚠️ ${event.message}` },
          ]);
        }
      });
    } catch {
      setMessages(prev => [
        ...prev.filter(m => m.id !== thinkingId),
        { id: streamId, role: 'assistant', text: '⚠️ Could not reach AI service. Is the server running?' },
      ]);
    } finally {
      // Safety cleanup — ensure thinking bubble is always removed
      setMessages(prev => prev.filter(m => m.id !== thinkingId));
      setLoading(false);
    }
  }

  function renderMessage({ item }) {
    if (item.role === 'user') {
      return (
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{item.text}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.aiBubble, item.role === 'thinking' && styles.thinkingBubble]}>
        {item.role === 'thinking' && <ActivityIndicator size="small" color="#1565C0" style={styles.thinkingSpinner} />}
        <Text style={[styles.aiText, item.role === 'thinking' && styles.thinkingText]}>{item.text}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Quick prompts */}
      <View style={styles.quickRow}>
        <FlatList
          horizontal
          data={QUICK_PROMPTS}
          keyExtractor={i => i.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 8, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.quickBtn} onPress={() => send(item.text)}>
              <Text style={styles.quickText}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Message list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.msgList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Model badge */}
      <View style={styles.modelBadge}>
        <Text style={styles.modelBadgeText}>claude-opus-4-6 · extended thinking</Text>
      </View>

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your journey…"
          placeholderTextColor="#aaa"
          returnKeyType="send"
          onSubmitEditing={() => send()}
          editable={!loading}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
          onPress={() => send()}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.sendIcon}>➤</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  quickRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  quickBtn: {
    backgroundColor: '#E3F2FD', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#BBDEFB',
  },
  quickText: { fontSize: 12, fontWeight: '600', color: '#1565C0' },
  msgList: { padding: 14, gap: 10, paddingBottom: 4 },
  userBubble: {
    alignSelf: 'flex-end', backgroundColor: '#1565C0',
    borderRadius: 14, borderBottomRightRadius: 4,
    padding: 12, maxWidth: '82%',
  },
  userText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  aiBubble: {
    alignSelf: 'flex-start', backgroundColor: '#fff',
    borderRadius: 14, borderBottomLeftRadius: 4,
    padding: 12, maxWidth: '82%',
    borderWidth: 1.5, borderColor: '#E0E0E0',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  thinkingBubble: { backgroundColor: '#EFF8FF', borderColor: '#BBDEFB', flexDirection: 'row', alignItems: 'center', gap: 8 },
  thinkingSpinner: { marginRight: 4 },
  aiText: { color: '#222', fontSize: 14, lineHeight: 22, flex: 1 },
  thinkingText: { color: '#1565C0', fontStyle: 'italic', fontSize: 13 },
  modelBadge: {
    alignItems: 'center', paddingVertical: 4,
    backgroundColor: '#F0F4FF', borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  modelBadgeText: { fontSize: 10, color: '#90A4AE', letterSpacing: 0.3 },
  inputRow: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1, backgroundColor: '#F0F4FF', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#222',
    borderWidth: 1.5, borderColor: '#BBDEFB', maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#90CAF9' },
  sendIcon: { color: '#fff', fontSize: 18 },
});
