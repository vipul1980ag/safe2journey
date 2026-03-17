import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getJourneyHistory, getJourneyHistoryAll } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MODE_ICONS = { bus: '🚌', metro: '🚇', walking: '🚶', taxi: '🚕', auto: '🛺', car_bike: '🚗' };

function ModeTag({ mode }) {
  const colors = {
    bus: '#E3F2FD', metro: '#F3E5F5', walking: '#E8F5E9',
    taxi: '#FFF3E0', auto: '#E0F2F1', car_bike: '#ECEFF1',
  };
  const textColors = {
    bus: '#1565C0', metro: '#7B1FA2', walking: '#2E7D32',
    taxi: '#E65100', auto: '#00695C', car_bike: '#455A64',
  };
  return (
    <View style={[styles.modeTag, { backgroundColor: colors[mode] || '#EEE' }]}>
      <Text style={[styles.modeTagText, { color: textColors[mode] || '#333' }]}>
        {MODE_ICONS[mode]} {mode}
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { isLoggedIn } = useAuth();
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  async function fetchHistory(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = isLoggedIn ? await getJourneyHistory() : await getJourneyHistoryAll();
      setJourneys(data);
    } catch (e) {
      setError('Could not load journey history. Is the server running?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { fetchHistory(); }, [isLoggedIn]));

  function onRefresh() { setRefreshing(true); fetchHistory(true); }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1565C0" /></View>;
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchHistory}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (journeys.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>🗺</Text>
        <Text style={styles.emptyTitle}>No journeys yet</Text>
        <Text style={styles.emptyDesc}>Plan your first journey and it will appear here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={journeys}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1565C0']} />}
      renderItem={({ item }) => {
        const modes = JSON.parse(item.modes || '[]');
        const date = item.created_at ? new Date(item.created_at) : null;
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.route}>
                <Text style={styles.routeFrom} numberOfLines={1}>{item.start_name || 'Unknown'}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={styles.routeTo} numberOfLines={1}>{item.end_name || 'Unknown'}</Text>
              </View>
              {date && <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>}
            </View>

            <View style={styles.modeTags}>
              {modes.map((m, i) => <ModeTag key={i} mode={m} />)}
            </View>

            <View style={styles.stats}>
              <View style={styles.statChip}>
                <Text style={styles.statVal}>₹{item.total_cost}</Text>
                <Text style={styles.statLbl}>Cost</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statVal}>{item.total_duration} min</Text>
                <Text style={styles.statLbl}>Duration</Text>
              </View>
              <View style={[styles.statChip, styles.statusChip]}>
                <Text style={styles.statusText}>{item.status || 'planned'}</Text>
              </View>
            </View>
          </View>
        );
      }}
      ListHeaderComponent={
        <Text style={styles.header}>
          {isLoggedIn ? 'Your Journey History' : 'Recent Journeys (Guest)'} — {journeys.length} trip{journeys.length !== 1 ? 's' : ''}
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#F5F7FA', padding: 16 },
  centered: { flex: 1, backgroundColor: '#F5F7FA', alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  route: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeFrom: { flex: 1, fontSize: 14, fontWeight: '700', color: '#222' },
  arrow: { fontSize: 14, color: '#1565C0' },
  routeTo: { flex: 1, fontSize: 14, fontWeight: '700', color: '#222', textAlign: 'right' },
  dateText: { fontSize: 11, color: '#999', marginLeft: 8 },
  modeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  modeTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  modeTagText: { fontSize: 11, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 8 },
  statChip: { backgroundColor: '#F5F7FA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statVal: { fontSize: 14, fontWeight: '800', color: '#222' },
  statLbl: { fontSize: 10, color: '#888' },
  statusChip: { backgroundColor: '#E8F5E9' },
  statusText: { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  errorText: { color: '#D32F2F', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#1565C0', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#888', textAlign: 'center' },
});
