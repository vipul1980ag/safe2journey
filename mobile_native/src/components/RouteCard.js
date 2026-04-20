import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

const MODE_COLORS = {
  bus: '#4A90E2',
  metro: '#9B59B6',
  tram: '#9B59B6',
  walking: '#2ECC71',
  taxi: '#F39C12',
  auto: '#1ABC9C',
  car_bike: '#7F8C8D',
  train: '#E74C3C',
  ferry: '#3498DB',
  air: '#27AE60',
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

function openBooking(url) {
  if (url) Linking.openURL(url).catch(() => {});
}

export default function RouteCard({ route, onSelect, currencySymbol: propSymbol = '₹' }) {
  const currencySymbol = route.currencySymbol || propSymbol;
  const isMixed = route.originCurrencySymbol && route.destCurrencySymbol &&
                  route.originCurrencySymbol !== route.destCurrencySymbol;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{route.label}</Text>
        <View style={styles.badges}>
          {isMixed ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {route.originCurrencySymbol}{route.originCost} + {route.destCurrencySymbol}{route.destCost}
              </Text>
            </View>
          ) : (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{currencySymbol}{route.totalCost}</Text>
            </View>
          )}
          <View style={[styles.badge, styles.timeBadge]}>
            <Text style={[styles.badgeText, styles.timeBadgeText]}>{route.totalDurationMins} min</Text>
          </View>
        </View>
      </View>

      <View style={styles.legs}>
        {route.legs.map((leg, i) => {
          const sym = leg.currencySymbol || currencySymbol;
          const color = MODE_COLORS[leg.mode] || '#6B97F5';
          const hasBooking = !!leg.bookingUrl;
          return (
            <View key={i} style={styles.leg}>
              <View style={[styles.dot, { backgroundColor: color }]}>
                <Text style={styles.dotIcon}>{MODE_ICONS[leg.mode]}</Text>
              </View>
              <View style={styles.legInfo}>
                <View style={styles.legHeader}>
                  <Text style={[styles.modeName, { color }]}>{MODE_LABELS[leg.mode]}</Text>
                  {hasBooking && (
                    <TouchableOpacity
                      style={[styles.bookBtn, { backgroundColor: color }]}
                      onPress={() => openBooking(leg.bookingUrl)}
                    >
                      <Text style={styles.bookBtnText}>Book · {leg.bookingProvider}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.legDetail}>{leg.distanceKm} km · {leg.durationMins} min · {sym}{leg.cost}</Text>
                {leg.boardingStop ? <Text style={styles.meta}>Board: {leg.boardingStop}</Text> : null}
                {leg.alightingStop ? <Text style={styles.meta}>Alight: {leg.alightingStop}</Text> : null}
                {leg.nextScheduled ? (
                  <Text style={styles.schedule}>Next: {leg.nextScheduled} · every {leg.frequency} min</Text>
                ) : null}
                {leg.note ? <Text style={[styles.meta, { color: '#6B97F5' }]}>{leg.note}</Text> : null}
                {leg.routeId ? <Text style={styles.meta}>Route {leg.routeId}</Text> : null}
                {leg.line ? <Text style={[styles.meta, { color: '#9B59B6' }]}>{leg.line}</Text> : null}
              </View>
            </View>
          );
        })}
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  label: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  badges: { flexDirection: 'column', gap: 5, alignItems: 'flex-end' },
  badge: {
    backgroundColor: 'rgba(58,107,232,0.2)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(58,107,232,0.3)',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#6B97F5' },
  timeBadge: { backgroundColor: 'rgba(0,214,143,0.15)', borderColor: 'rgba(0,214,143,0.3)' },
  timeBadgeText: { color: '#00D68F' },
  legs: { borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.08)', marginLeft: 14, paddingLeft: 14 },
  leg: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-start' },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -29, marginRight: 10,
  },
  dotIcon: { fontSize: 16 },
  legInfo: { flex: 1 },
  legHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  modeName: { fontSize: 14, fontWeight: '700' },
  bookBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bookBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  legDetail: { fontSize: 12, color: '#4A6284', marginTop: 2 },
  schedule: { fontSize: 11, color: '#6B97F5', marginTop: 2 },
  meta: { fontSize: 11, color: '#2E4060', marginTop: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  dist: { fontSize: 12, color: '#2E4060' },
  selectBtn: {
    backgroundColor: '#3A6BE8',
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: '#6B97F5',
  },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
