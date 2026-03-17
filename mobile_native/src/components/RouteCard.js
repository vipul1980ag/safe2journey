import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const MODE_COLORS = {
  bus: '#1976D2',
  metro: '#7B1FA2',
  tram: '#7B1FA2',
  walking: '#388E3C',
  taxi: '#F57C00',
  auto: '#00796B',
  car_bike: '#455A64',
  train: '#C62828',
  ferry: '#0277BD',
  air: '#558B2F',
};

const MODE_ICONS = {
  bus: '🚌',
  metro: '🚇',
  tram: '🚋',
  walking: '🚶',
  taxi: '🚕',
  auto: '🛺',
  car_bike: '🚗',
  train: '🚆',
  ferry: '⛴',
  air: '✈',
};

const MODE_LABELS = {
  bus: 'Bus',
  metro: 'Metro',
  tram: 'Tram',
  walking: 'Walk',
  taxi: 'Taxi',
  auto: 'Auto',
  car_bike: 'Car/Bike',
  train: 'Train',
  ferry: 'Ferry',
  air: 'Flight',
};

export default function RouteCard({ route, onSelect }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{route.label}</Text>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>₹{route.totalCost}</Text>
          </View>
          <View style={[styles.badge, styles.timeBadge]}>
            <Text style={[styles.badgeText, styles.timeBadgeText]}>{route.totalDurationMins} min</Text>
          </View>
        </View>
      </View>

      <View style={styles.legs}>
        {route.legs.map((leg, i) => (
          <View key={i} style={styles.leg}>
            <View style={[styles.dot, { backgroundColor: MODE_COLORS[leg.mode] || '#999' }]}>
              <Text style={styles.dotIcon}>{MODE_ICONS[leg.mode]}</Text>
            </View>
            <View style={styles.legInfo}>
              <Text style={styles.modeName}>{MODE_LABELS[leg.mode]}</Text>
              <Text style={styles.legDetail}>{leg.distanceKm} km · {leg.durationMins} min · ₹{leg.cost}</Text>
              {leg.nextScheduled ? (
                <Text style={styles.schedule}>Next: {leg.nextScheduled} · every {leg.frequency} min</Text>
              ) : null}
              {leg.routeId ? <Text style={styles.meta}>Route {leg.routeId}</Text> : null}
              {leg.line ? <Text style={[styles.meta, { color: '#7B1FA2' }]}>{leg.line}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.dist}>{route.totalDistanceKm} km total</Text>
        {onSelect && (
          <TouchableOpacity onPress={() => onSelect(route)} style={styles.selectBtn}>
            <Text style={styles.selectBtnText}>Select Route</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  label: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  badges: { flexDirection: 'row', gap: 6 },
  badge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#1565C0' },
  timeBadge: { backgroundColor: '#E8F5E9' },
  timeBadgeText: { color: '#2E7D32' },
  legs: { borderLeftWidth: 2, borderLeftColor: '#E0E0E0', marginLeft: 14, paddingLeft: 14 },
  leg: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -29,
    marginRight: 10,
  },
  dotIcon: { fontSize: 16 },
  legInfo: { flex: 1 },
  modeName: { fontSize: 14, fontWeight: '700', color: '#333' },
  legDetail: { fontSize: 12, color: '#666', marginTop: 2 },
  schedule: { fontSize: 11, color: '#1565C0', marginTop: 2 },
  meta: { fontSize: 11, color: '#999', marginTop: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  dist: { fontSize: 12, color: '#999' },
  selectBtn: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
