import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const MODE_COLORS = {
  bus: '#1976D2', metro: '#7B1FA2', walking: '#388E3C',
  taxi: '#F57C00', auto: '#00796B', car_bike: '#455A64',
};
const MODE_ICONS = {
  bus: '🚌', metro: '🚇', walking: '🚶', taxi: '🚕', auto: '🛺', car_bike: '🚗',
};
const MODE_LABELS = {
  bus: 'Bus', metro: 'Metro', walking: 'Walk', taxi: 'Taxi', auto: 'Auto', car_bike: 'Car/Bike',
};

function lerp(a, b, t) { return a + (b - a) * t; }

export default function MapScreen({ route }) {
  const { selectedRoute, startName, endName, currencySymbol = '₹' } = route.params;
  const legs = selectedRoute.legs;

  // Build waypoints from legs
  const points = [];
  legs.forEach((leg, i) => {
    if (i === 0) points.push({ label: leg.from || startName, type: 'start' });
    points.push({ label: leg.to, mode: leg.mode, type: i === legs.length - 1 ? 'end' : 'mid' });
  });

  const CARD_W = width - 48;
  const dotSize = 40;
  const lineH = 64;
  const totalH = points.length * dotSize + (points.length - 1) * lineH + 48;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Route header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{selectedRoute.label}</Text>
        <View style={styles.headerBadges}>
          <View style={styles.badge}><Text style={styles.badgeText}>{currencySymbol}{selectedRoute.totalCost}</Text></View>
          <View style={[styles.badge, styles.timeBadge]}><Text style={[styles.badgeText, styles.timeBadgeText]}>{selectedRoute.totalDurationMins} min</Text></View>
          <View style={[styles.badge, styles.distBadge]}><Text style={[styles.badgeText, styles.distBadgeText]}>{selectedRoute.totalDistanceKm} km</Text></View>
        </View>
      </View>

      {/* Schematic route diagram */}
      <View style={styles.diagramCard}>
        <Text style={styles.diagramTitle}>Route Diagram</Text>
        <View style={{ paddingVertical: 12 }}>
          {points.map((pt, idx) => {
            const isLast = idx === points.length - 1;
            const leg = idx > 0 ? legs[idx - 1] : null;
            const color = leg ? (MODE_COLORS[leg.mode] || '#999') : '#1565C0';
            return (
              <View key={idx}>
                {/* Connector line above (except first) */}
                {idx > 0 && (
                  <View style={styles.connectorRow}>
                    <View style={styles.connectorSpace} />
                    <View style={[styles.connectorLine, { backgroundColor: color }]} />
                    <View style={styles.connectorInfo}>
                      <View style={[styles.modeChip, { backgroundColor: color + '22' }]}>
                        <Text style={[styles.modeChipText, { color }]}>{MODE_ICONS[legs[idx-1].mode]} {MODE_LABELS[legs[idx-1].mode]}</Text>
                      </View>
                      <Text style={styles.legMeta}>{legs[idx-1].distanceKm} km · {legs[idx-1].durationMins} min · {currencySymbol}{legs[idx-1].cost}</Text>
                      {legs[idx-1].nextScheduled ? (
                        <Text style={[styles.scheduleText, { color }]}>Next: {legs[idx-1].nextScheduled} · every {legs[idx-1].frequency} min</Text>
                      ) : null}
                    </View>
                  </View>
                )}

                {/* Station dot */}
                <View style={styles.stationRow}>
                  <View style={[styles.stationDot, {
                    backgroundColor: pt.type === 'start' ? '#1565C0' : pt.type === 'end' ? '#2E7D32' : color,
                    borderColor: pt.type === 'start' ? '#0D47A1' : pt.type === 'end' ? '#1B5E20' : color + 'AA',
                  }]}>
                    <Text style={styles.dotIcon}>{pt.type === 'start' ? '🟢' : pt.type === 'end' ? '🏁' : '•'}</Text>
                  </View>
                  <View style={styles.stationLabel}>
                    <Text style={[styles.stationName, {
                      color: pt.type === 'start' ? '#1565C0' : pt.type === 'end' ? '#2E7D32' : '#333',
                      fontWeight: (pt.type === 'start' || pt.type === 'end') ? '800' : '600',
                    }]}>{pt.label}</Text>
                    {pt.type === 'start' && <Text style={styles.stationSub}>Start</Text>}
                    {pt.type === 'end' && <Text style={[styles.stationSub, { color: '#2E7D32' }]}>Destination</Text>}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Leg breakdown cards */}
      <Text style={styles.sectionTitle}>Leg Details</Text>
      {legs.map((leg, i) => (
        <View key={i} style={[styles.legCard, { borderLeftColor: MODE_COLORS[leg.mode] || '#999' }]}>
          <View style={styles.legHeader}>
            <View style={[styles.legIconCircle, { backgroundColor: (MODE_COLORS[leg.mode] || '#999') + '22' }]}>
              <Text style={styles.legIcon}>{MODE_ICONS[leg.mode]}</Text>
            </View>
            <View style={styles.legHeaderText}>
              <Text style={[styles.legModeName, { color: MODE_COLORS[leg.mode] || '#333' }]}>
                {MODE_LABELS[leg.mode]}
              </Text>
              <Text style={styles.legRoute}>{leg.from} → {leg.to}</Text>
            </View>
          </View>
          <View style={styles.legStatsRow}>
            <View style={styles.legStat}><Text style={styles.legStatVal}>{leg.distanceKm} km</Text><Text style={styles.legStatLbl}>Distance</Text></View>
            <View style={styles.legStat}><Text style={styles.legStatVal}>{leg.durationMins} min</Text><Text style={styles.legStatLbl}>Duration</Text></View>
            <View style={styles.legStat}><Text style={styles.legStatVal}>{currencySymbol}{leg.cost}</Text><Text style={styles.legStatLbl}>Fare</Text></View>
          </View>
          {leg.nextScheduled && (
            <View style={styles.scheduleRow}>
              <Text style={[styles.scheduleIcon]}>🕐</Text>
              <Text style={styles.scheduleInfo}>Next {MODE_LABELS[leg.mode]}: <Text style={{ fontWeight: '700' }}>{leg.nextScheduled}</Text> · every {leg.frequency} min</Text>
            </View>
          )}
          {leg.routeId && <Text style={styles.metaInfo}>Route {leg.routeId}{leg.line ? ` · ${leg.line}` : ''}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { backgroundColor: '#1565C0', padding: 20 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 10 },
  headerBadges: { flexDirection: 'row', gap: 8 },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  timeBadge: { backgroundColor: '#E8F5E9' },
  timeBadgeText: { color: '#2E7D32' },
  distBadge: { backgroundColor: 'rgba(255,255,255,0.15)' },
  distBadgeText: { color: '#fff' },
  diagramCard: { margin: 16, backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
  diagramTitle: { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  connectorRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 72 },
  connectorSpace: { width: 48, alignItems: 'center' },
  connectorLine: { width: 3, marginLeft: 23, marginRight: -3, borderRadius: 2 },
  connectorInfo: { flex: 1, paddingLeft: 14, justifyContent: 'center', gap: 3 },
  modeChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  modeChipText: { fontSize: 12, fontWeight: '700' },
  legMeta: { fontSize: 12, color: '#777' },
  scheduleText: { fontSize: 11 },
  stationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stationDot: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  dotIcon: { fontSize: 18 },
  stationLabel: { flex: 1 },
  stationName: { fontSize: 15 },
  stationSub: { fontSize: 11, color: '#999', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#555', marginHorizontal: 16, marginBottom: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  legCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderLeftWidth: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  legHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  legIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  legIcon: { fontSize: 20 },
  legHeaderText: { flex: 1 },
  legModeName: { fontSize: 16, fontWeight: '800' },
  legRoute: { fontSize: 12, color: '#777', marginTop: 2 },
  legStatsRow: { flexDirection: 'row', gap: 8 },
  legStat: { flex: 1, backgroundColor: '#F5F7FA', borderRadius: 8, padding: 10, alignItems: 'center' },
  legStatVal: { fontSize: 15, fontWeight: '800', color: '#222' },
  legStatLbl: { fontSize: 11, color: '#888', marginTop: 2 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#E3F2FD', borderRadius: 8, padding: 8 },
  scheduleIcon: { fontSize: 14 },
  scheduleInfo: { flex: 1, fontSize: 12, color: '#1565C0' },
  metaInfo: { fontSize: 11, color: '#999', marginTop: 8 },
});
