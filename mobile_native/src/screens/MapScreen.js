// Copyright (c) 2024-2026 Vipul Agrawal. All Rights Reserved.
// Proprietary and confidential. Unauthorized copying, distribution,
// or modification of this file is strictly prohibited.
// See LICENSE file in the project root for full terms.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const MODE_COLORS = {
  bus: '#4A90E2', metro: '#9B59B6', walking: '#2ECC71',
  taxi: '#F39C12', auto: '#1ABC9C', car_bike: '#7F8C8D',
};
const MODE_ICONS = {
  bus: '🚌', metro: '🚇', walking: '🚶', taxi: '🚕', auto: '🛺', car_bike: '🚗',
};
const MODE_LABELS = {
  bus: 'Bus', metro: 'Metro', walking: 'Walk', taxi: 'Taxi', auto: 'Auto', car_bike: 'Car/Bike',
};

export default function MapScreen({ route }) {
  const { selectedRoute, startName, endName, currencySymbol = '₹' } = route.params;
  const legs = selectedRoute.legs;

  const points = [];
  legs.forEach((leg, i) => {
    if (i === 0) points.push({ label: leg.from || startName, type: 'start' });
    points.push({ label: leg.to, mode: leg.mode, type: i === legs.length - 1 ? 'end' : 'mid' });
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Route header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{selectedRoute.label}</Text>
        <View style={styles.headerBadges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{currencySymbol}{selectedRoute.totalCost}</Text>
          </View>
          <View style={[styles.badge, styles.timeBadge]}>
            <Text style={[styles.badgeText, styles.timeBadgeText]}>{selectedRoute.totalDurationMins} min</Text>
          </View>
          <View style={[styles.badge, styles.distBadge]}>
            <Text style={[styles.badgeText, styles.distBadgeText]}>{selectedRoute.totalDistanceKm} km</Text>
          </View>
        </View>
      </View>

      {/* Schematic route diagram */}
      <View style={styles.diagramCard}>
        <Text style={styles.diagramTitle}>Route Diagram</Text>
        <View style={{ paddingVertical: 12 }}>
          {points.map((pt, idx) => {
            const isLast = idx === points.length - 1;
            const leg = idx > 0 ? legs[idx - 1] : null;
            const color = leg ? (MODE_COLORS[leg.mode] || '#6B97F5') : '#3A6BE8';
            return (
              <View key={idx}>
                {idx > 0 && (
                  <View style={styles.connectorRow}>
                    <View style={styles.connectorSpace} />
                    <View style={[styles.connectorLine, { backgroundColor: color }]} />
                    <View style={styles.connectorInfo}>
                      <View style={[styles.modeChip, { backgroundColor: color + '28' }]}>
                        <Text style={[styles.modeChipText, { color }]}>{MODE_ICONS[legs[idx-1].mode]} {MODE_LABELS[legs[idx-1].mode]}</Text>
                      </View>
                      <Text style={styles.legMeta}>{legs[idx-1].distanceKm} km · {legs[idx-1].durationMins} min · {legs[idx-1].currencySymbol || currencySymbol}{legs[idx-1].cost}</Text>
                      {legs[idx-1].nextScheduled ? (
                        <Text style={[styles.scheduleText, { color }]}>Next: {legs[idx-1].nextScheduled} · every {legs[idx-1].frequency} min</Text>
                      ) : null}
                    </View>
                  </View>
                )}

                <View style={styles.stationRow}>
                  <View style={[styles.stationDot, {
                    backgroundColor: pt.type === 'start' ? '#3A6BE8' : pt.type === 'end' ? '#00D68F' : color,
                    borderColor: pt.type === 'start' ? '#6B97F5' : pt.type === 'end' ? '#00D68F' : color + 'AA',
                  }]}>
                    <Text style={styles.dotIcon}>{pt.type === 'start' ? '🟢' : pt.type === 'end' ? '🏁' : '•'}</Text>
                  </View>
                  <View style={styles.stationLabel}>
                    <Text style={[styles.stationName, {
                      color: pt.type === 'start' ? '#6B97F5' : pt.type === 'end' ? '#00D68F' : '#C8D8EC',
                      fontWeight: (pt.type === 'start' || pt.type === 'end') ? '800' : '600',
                    }]}>{pt.label}</Text>
                    {pt.type === 'start' && <Text style={styles.stationSub}>Start</Text>}
                    {pt.type === 'end' && <Text style={[styles.stationSub, { color: '#00D68F' }]}>Destination</Text>}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Leg breakdown */}
      <Text style={styles.sectionTitle}>Leg Details</Text>
      {legs.map((leg, i) => (
        <View key={i} style={[styles.legCard, { borderLeftColor: MODE_COLORS[leg.mode] || '#6B97F5' }]}>
          <View style={styles.legHeader}>
            <View style={[styles.legIconCircle, { backgroundColor: (MODE_COLORS[leg.mode] || '#6B97F5') + '28' }]}>
              <Text style={styles.legIcon}>{MODE_ICONS[leg.mode]}</Text>
            </View>
            <View style={styles.legHeaderText}>
              <Text style={[styles.legModeName, { color: MODE_COLORS[leg.mode] || '#6B97F5' }]}>
                {MODE_LABELS[leg.mode]}
              </Text>
              <Text style={styles.legRoute}>{leg.from} → {leg.to}</Text>
            </View>
          </View>
          <View style={styles.legStatsRow}>
            <View style={styles.legStat}>
              <Text style={styles.legStatVal}>{leg.distanceKm} km</Text>
              <Text style={styles.legStatLbl}>Distance</Text>
            </View>
            <View style={styles.legStat}>
              <Text style={styles.legStatVal}>{leg.durationMins} min</Text>
              <Text style={styles.legStatLbl}>Duration</Text>
            </View>
            <View style={styles.legStat}>
              <Text style={styles.legStatVal}>{leg.currencySymbol || currencySymbol}{leg.cost}</Text>
              <Text style={styles.legStatLbl}>Fare</Text>
            </View>
          </View>
          {leg.nextScheduled && (
            <View style={styles.scheduleRow}>
              <Text style={styles.scheduleIcon}>🕐</Text>
              <Text style={styles.scheduleInfo}>
                Next {MODE_LABELS[leg.mode]}: <Text style={{ fontWeight: '700', color: '#fff' }}>{leg.nextScheduled}</Text> · every {leg.frequency} min
              </Text>
            </View>
          )}
          {leg.routeId && <Text style={styles.metaInfo}>Route {leg.routeId}{leg.line ? ` · ${leg.line}` : ''}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080F1E' },
  header: {
    backgroundColor: 'rgba(58,107,232,0.2)',
    padding: 22, borderBottomWidth: 1, borderBottomColor: 'rgba(58,107,232,0.3)',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 12 },
  headerBadges: { flexDirection: 'row', gap: 8 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  timeBadge: { backgroundColor: 'rgba(0,214,143,0.15)', borderColor: 'rgba(0,214,143,0.3)' },
  timeBadgeText: { color: '#00D68F' },
  distBadge: { backgroundColor: 'rgba(255,255,255,0.07)' },
  distBadgeText: { color: '#8BAFD4' },
  diagramCard: {
    margin: 16, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  diagramTitle: { fontSize: 12, fontWeight: '700', color: '#4A6284', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  connectorRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 72 },
  connectorSpace: { width: 48, alignItems: 'center' },
  connectorLine: { width: 3, marginLeft: 23, marginRight: -3, borderRadius: 2 },
  connectorInfo: { flex: 1, paddingLeft: 14, justifyContent: 'center', gap: 4 },
  modeChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  modeChipText: { fontSize: 12, fontWeight: '700' },
  legMeta: { fontSize: 12, color: '#4A6284' },
  scheduleText: { fontSize: 11 },
  stationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stationDot: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  dotIcon: { fontSize: 18 },
  stationLabel: { flex: 1 },
  stationName: { fontSize: 15 },
  stationSub: { fontSize: 11, color: '#4A6284', marginTop: 2 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#4A6284',
    marginHorizontal: 16, marginBottom: 10, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  legCard: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, padding: 16, borderLeftWidth: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  legHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  legIconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  legIcon: { fontSize: 20 },
  legHeaderText: { flex: 1 },
  legModeName: { fontSize: 16, fontWeight: '800' },
  legRoute: { fontSize: 12, color: '#4A6284', marginTop: 2 },
  legStatsRow: { flexDirection: 'row', gap: 8 },
  legStat: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  legStatVal: { fontSize: 15, fontWeight: '800', color: '#fff' },
  legStatLbl: { fontSize: 11, color: '#4A6284', marginTop: 2 },
  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: 'rgba(58,107,232,0.15)',
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: 'rgba(58,107,232,0.2)',
  },
  scheduleIcon: { fontSize: 14 },
  scheduleInfo: { flex: 1, fontSize: 12, color: '#8BAFD4' },
  metaInfo: { fontSize: 11, color: '#2E4060', marginTop: 8 },
});
