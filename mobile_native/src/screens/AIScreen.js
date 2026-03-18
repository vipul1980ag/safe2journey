import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { aiChat } from '../services/api';

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
    messages.filter(m => m.role !== 'thinking').map(m => ({ role: m.role, content: m.text }));

  async function send(text) {
    const msgText = text || input.trim();
    if (!msgText || loading) return;
    setInput('');

    const userMsg = { id: Date.now().toString(), role: 'user', text: msgText };
    const thinkingMsg = { id: 'thinking', role: 'thinking', text: '✦ Thinking…' };

    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setLoading(true);

    try {
      const history = [...apiHistory(), { role: 'user', content: msgText }];
      const data = await aiChat(history, null);
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'thinking'),
        { id: Date.now().toString() + 'r', role: 'assistant', text: data.reply },
      ]);
    } catch (e) {
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'thinking'),
        { id: Date.now().toString() + 'e', role: 'assistant', text: '⚠️ Could not reach AI service. Is the server running?' },
      ]);
    } finally {
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
  msgList: { padding: 14, gap: 10, paddingBottom: 20 },
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
  thinkingBubble: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  aiText: { color: '#222', fontSize: 14, lineHeight: 22 },
  thinkingText: { color: '#888', fontStyle: 'italic' },
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
