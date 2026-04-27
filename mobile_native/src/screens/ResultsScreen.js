// Copyright (c) 2024-2026 Vipul Agrawal. All Rights Reserved.
// Proprietary and confidential. Unauthorized copying, distribution,
// or modification of this file is strictly prohibited.
// See LICENSE file in the project root for full terms.

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import RouteCard from '../components/RouteCard';

export default function ResultsScreen({ route, navigation }) {
  const { plan, startLat, startLng, startName, endLat, endLng, endName } = route.params;
  const currencySymbol = plan?.currencySymbol || '₹';
  const [sortBy, setSortBy] = useState('time');

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
      startLat, startLng, endLat, endLng, endName, currencySymbol,
    });
  }

  function handleViewMap(r) {
    navigation.navigate('Map', {
      selectedRoute: r,
      startName: plan.startName,
      endName: plan.endName,
      currencySymbol,
    });
  }

  if (!plan || !plan.routes) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🗺</Text>
        <Text style={styles.emptyText}>No routes found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Offline notice */}
      {plan.offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>⚡ Offline mode — routes estimated without live transit data. Connect to the server for real-time schedules.</Text>
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
        <View style={styles.routesCountBadge}>
          <Text style={styles.routesCountText}>{plan.routes.length}</Text>
        </View>
        <Text style={styles.routesTitle}>Route{plan.routes.length !== 1 ? 's' : ''} Found</Text>
        <View style={styles.sortBtns}>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'time' && styles.sortBtnActive]}
            onPress={() => setSortBy('time')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'time' && styles.sortBtnTextActive]}>⚡ Fastest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'cost' && styles.sortBtnActive]}
            onPress={() => setSortBy('cost')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'cost' && styles.sortBtnTextActive]}>💰 Cheapest</Text>
          </TouchableOpacity>
        </View>
      </View>

      {sortedRoutes.map((r, i) => (
        <View key={i}>
          <RouteCard route={r} onSelect={handleSelectRoute} currencySymbol={currencySymbol} />
          <TouchableOpacity style={styles.mapBtn} onPress={() => handleViewMap(r)}>
            <Text style={styles.mapBtnText}>🗺 View Route Diagram</Text>
          </TouchableOpacity>
        </View>
      ))}

      {sortedRoutes.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>No routes found. Try increasing the max modes of transport.</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080F1E', padding: 16 },
  summary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontSize: 13, color: '#4A6284', fontWeight: '600' },
  summaryValue: { fontSize: 13, color: '#fff', fontWeight: '600', maxWidth: '65%', textAlign: 'right' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  nearbySection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  nearbyTitle: { fontSize: 13, fontWeight: '700', color: '#3A6BE8', marginBottom: 8 },
  nearbyItem: { fontSize: 13, color: '#8BAFD4', marginBottom: 4 },
  sortRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  routesCountBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#3A6BE8', alignItems: 'center', justifyContent: 'center',
  },
  routesCountText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  routesTitle: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  sortBtns: { flexDirection: 'row', gap: 6 },
  sortBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sortBtnActive: { backgroundColor: '#3A6BE8', borderColor: '#6B97F5' },
  sortBtnText: { fontSize: 12, fontWeight: '700', color: '#4A6284' },
  sortBtnTextActive: { color: '#fff' },
  mapBtn: {
    marginTop: -6, marginBottom: 14, marginHorizontal: 2,
    backgroundColor: 'rgba(58,107,232,0.15)',
    borderRadius: 12, padding: 11, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(58,107,232,0.25)',
  },
  mapBtnText: { fontSize: 13, fontWeight: '700', color: '#6B97F5' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#4A6284', fontSize: 15, textAlign: 'center' },
  offlineBanner: {
    backgroundColor: 'rgba(255,183,77,0.1)',
    borderRadius: 12, padding: 13, marginBottom: 14,
    borderLeftWidth: 4, borderLeftColor: '#FFB74D',
    borderWidth: 1, borderColor: 'rgba(255,183,77,0.2)',
  },
  offlineText: { fontSize: 12, color: '#FFB74D', lineHeight: 18 },
});
