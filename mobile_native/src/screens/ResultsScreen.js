import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import RouteCard from '../components/RouteCard';

export default function ResultsScreen({ route, navigation }) {
  const { plan, startLat, startLng, startName, endLat, endLng, endName } = route.params;
  const [sortBy, setSortBy] = useState('time'); // 'time' | 'cost'

  const sortedRoutes = useMemo(() => {
    if (!plan?.routes) return [];
    const copy = [...plan.routes];
    return sortBy === 'cost'
      ? copy.sort((a, b) => a.totalCost - b.totalCost)
      : copy.sort((a, b) => a.totalDurationMins - b.totalDurationMins);
  }, [plan, sortBy]);

  function handleSelectRoute(r) {
    navigation.navigate('Tracking', {
      selectedRoute: r,
      journeyId: plan.journeyId || null,
      startLat,
      startLng,
      endLat,
      endLng,
      endName,
    });
  }

  function handleViewMap(r) {
    navigation.navigate('Map', {
      selectedRoute: r,
      startName: plan.startName,
      endName: plan.endName,
    });
  }

  if (!plan || !plan.routes) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No routes found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Offline notice */}
      {plan.offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline mode — routes estimated without live transit data. Connect to the server for real-time schedules.</Text>
        </View>
      )}

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>From</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>{plan.startName}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>To</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>{plan.endName}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Distance</Text>
          <Text style={styles.summaryValue}>{plan.totalDistanceKm} km</Text>
        </View>
      </View>

      {/* Nearby transport */}
      {plan.nearbyTransport.busStops?.length > 0 && (
        <View style={styles.nearbySection}>
          <Text style={styles.nearbyTitle}>Nearby Bus Stops</Text>
          {plan.nearbyTransport.busStops.slice(0, 3).map(s => (
            <Text key={s.id} style={styles.nearbyItem}>
              🚌 {s.name} (Route {s.route_id}) — {s.distance?.toFixed(2)} km
            </Text>
          ))}
        </View>
      )}
      {plan.nearbyTransport.metroStations?.length > 0 && (
        <View style={styles.nearbySection}>
          <Text style={styles.nearbyTitle}>Nearby Metro / Tram Stations</Text>
          {plan.nearbyTransport.metroStations.slice(0, 3).map(s => (
            <Text key={s.id} style={styles.nearbyItem}>
              🚇 {s.name} ({s.line}) — {s.distance?.toFixed(2)} km
            </Text>
          ))}
        </View>
      )}
      {plan.nearbyTransport.trainStations?.length > 0 && (
        <View style={styles.nearbySection}>
          <Text style={styles.nearbyTitle}>Nearby Train Stations</Text>
          {plan.nearbyTransport.trainStations.slice(0, 3).map(s => (
            <Text key={s.id} style={styles.nearbyItem}>
              🚆 {s.name} ({s.line}) — {s.distance?.toFixed(2)} km
            </Text>
          ))}
        </View>
      )}
      {plan.nearbyTransport.ferryTerminals?.length > 0 && (
        <View style={styles.nearbySection}>
          <Text style={styles.nearbyTitle}>Nearby Ferry Terminals</Text>
          {plan.nearbyTransport.ferryTerminals.slice(0, 2).map(s => (
            <Text key={s.id} style={styles.nearbyItem}>
              ⛴ {s.name}{s.operator ? ` (${s.operator})` : ''} — {s.distance?.toFixed(2)} km
            </Text>
          ))}
        </View>
      )}
      {plan.nearbyTransport.airports?.length > 0 && (
        <View style={styles.nearbySection}>
          <Text style={styles.nearbyTitle}>Nearby Airports</Text>
          {plan.nearbyTransport.airports.slice(0, 2).map(s => (
            <Text key={s.id} style={styles.nearbyItem}>
              ✈ {s.name}{s.iata ? ` (${s.iata})` : ''} — {s.distance?.toFixed(2)} km
            </Text>
          ))}
        </View>
      )}

      {/* Sort controls */}
      <View style={styles.sortRow}>
        <Text style={styles.routesTitle}>{plan.routes.length} Route{plan.routes.length !== 1 ? 's' : ''}</Text>
        <View style={styles.sortBtns}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'time' && styles.sortBtnActive]}
            onPress={() => setSortBy('time')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'time' && styles.sortBtnTextActive]}>Fastest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'cost' && styles.sortBtnActive]}
            onPress={() => setSortBy('cost')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'cost' && styles.sortBtnTextActive]}>Cheapest</Text>
          </TouchableOpacity>
        </View>
      </View>

      {sortedRoutes.map((r, i) => (
        <View key={i}>
          <RouteCard route={r} onSelect={handleSelectRoute} />
          <TouchableOpacity style={styles.mapBtn} onPress={() => handleViewMap(r)}>
            <Text style={styles.mapBtnText}>🗺 View Route Diagram</Text>
          </TouchableOpacity>
        </View>
      ))}

      {sortedRoutes.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No routes found. Try increasing the max modes of transport.</Text>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 16 },
  summary: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  summaryValue: { fontSize: 13, color: '#222', fontWeight: '600', maxWidth: '65%', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#F0F0F0' },
  nearbySection: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1 },
  nearbyTitle: { fontSize: 13, fontWeight: '700', color: '#1565C0', marginBottom: 8 },
  nearbyItem: { fontSize: 13, color: '#444', marginBottom: 4 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  routesTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  sortBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortLabel: { fontSize: 12, color: '#888' },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDD' },
  sortBtnActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  sortBtnText: { fontSize: 12, fontWeight: '700', color: '#555' },
  sortBtnTextActive: { color: '#fff' },
  mapBtn: {
    marginTop: -8, marginBottom: 14, marginHorizontal: 2,
    backgroundColor: '#E3F2FD', borderRadius: 10, padding: 10, alignItems: 'center',
  },
  mapBtnText: { fontSize: 13, fontWeight: '700', color: '#1565C0' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center' },
  offlineBanner: { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#F9A825' },
  offlineText: { fontSize: 12, color: '#795548', lineHeight: 17 },
});
