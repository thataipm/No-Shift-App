import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';
import { supabase, Checkin, Focus, calculateStreak } from '../../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS, CARD_STYLE } from '../../constants/theme';

const WIDTH = Dimensions.get('window').width - SPACING.lg * 2;

export default function ProgressScreen() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [focuses, setFocuses] = useState<Focus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: ci }, { data: fc }] = await Promise.all([
      supabase.from('checkins').select('*').eq('user_id', user.id).order('date', { ascending: true }),
      supabase.from('focuses').select('*').eq('user_id', user.id),
    ]);
    setCheckins(ci || []);
    setFocuses(fc || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const streak = calculateStreak(checkins);
  const totalCheckins = checkins.length;
  const workedDays = checkins.filter(c => c.did_work).length;
  const completionRate = totalCheckins > 0 ? Math.round((workedDays / totalCheckins) * 100) : 0;
  const completedFocuses = focuses.filter(f => f.status === 'completed').length;
  const totalFocuses = focuses.filter(f => f.status !== 'active').length;
  const focusCompletionRate = totalFocuses > 0 ? Math.round((completedFocuses / totalFocuses) * 100) : 0;

  // Line chart data
  const lineData = checkins.filter(c => c.did_work && c.momentum).map(c => ({
    value: c.momentum!,
    dataPointColor: COLORS.primary,
    label: '',
  }));

  // Calendar heatmap — last 49 days (7 weeks)
  const heatmapDays = Array.from({ length: 49 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (48 - i));
    const dateStr = d.toISOString().split('T')[0];
    const ci = checkins.find(c => c.date === dateStr);
    return { dateStr, ci, day: d.getDay() };
  });

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <Text style={styles.screenTitle}>Progress</Text>

        {/* Streak & Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardLarge]} testID="streak-display">
            <Text style={styles.bigStat}>{streak}</Text>
            <Text style={styles.statLabel}>DAY STREAK</Text>
          </View>
          <View style={styles.statCol}>
            <View style={styles.statCard} testID="checkin-rate">
              <Text style={styles.medStat}>{completionRate}%</Text>
              <Text style={styles.statLabel}>CHECK-IN RATE</Text>
            </View>
            <View style={styles.statCard} testID="focus-completion-rate">
              <Text style={styles.medStat}>{focusCompletionRate}%</Text>
              <Text style={styles.statLabel}>FOCUS COMPLETION</Text>
            </View>
          </View>
        </View>

        {/* Momentum Chart */}
        {lineData.length > 1 && (
          <View style={styles.card} testID="momentum-chart">
            <Text style={styles.sectionLabel}>MOMENTUM OVER TIME</Text>
            <LineChart
              data={lineData}
              color={COLORS.primary}
              thickness={2}
              hideDataPoints={lineData.length > 20}
              dataPointsColor={COLORS.primary}
              dataPointsRadius={4}
              startFillColor={COLORS.primaryMuted}
              endFillColor="transparent"
              areaChart
              yAxisColor="transparent"
              xAxisColor={COLORS.borderSubtle}
              xAxisLabelTextStyle={{ color: COLORS.textTertiary, fontFamily: FONTS.body, fontSize: 10 }}
              noOfSections={5}
              maxValue={5}
              height={140}
              width={WIDTH - SPACING.lg * 2}
              rulesColor={COLORS.borderSubtle}
              yAxisTextStyle={{ color: COLORS.textTertiary, fontFamily: FONTS.body, fontSize: 10 }}
            />
          </View>
        )}

        {/* Calendar Heatmap */}
        <View style={styles.card} testID="calendar-heatmap">
          <Text style={styles.sectionLabel}>CHECK-IN CALENDAR</Text>
          <View style={styles.heatmapGrid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={styles.heatmapDayLabel}>{d}</Text>
            ))}
            {heatmapDays.map((item, i) => {
              let bg = COLORS.surfaceElevated;
              if (item.ci) {
                if (item.ci.did_work) {
                  const opacity = 0.3 + (item.ci.momentum || 3) * 0.14;
                  bg = `rgba(186, 117, 23, ${opacity.toFixed(2)})`;
                } else {
                  bg = 'rgba(211,47,47,0.25)';
                }
              }
              return <View key={i} style={[styles.heatCell, { backgroundColor: bg }]} />;
            })}
          </View>
          <View style={styles.heatmapLegend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.surfaceElevated }]} /><Text style={styles.legendText}>None</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: 'rgba(186,117,23,0.5)' }]} /><Text style={styles.legendText}>Worked</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: 'rgba(211,47,47,0.3)' }]} /><Text style={styles.legendText}>Skipped</Text></View>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>TOTALS</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Check-ins</Text>
            <Text style={styles.summaryValue}>{totalCheckins}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Days Worked</Text>
            <Text style={styles.summaryValue}>{workedDays}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Focuses Completed</Text>
            <Text style={styles.summaryValue}>{completedFocuses}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 },
  screenTitle: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  statsGrid: { flexDirection: 'row', gap: SPACING.sm },
  statCol: { flex: 1, gap: SPACING.sm },
  statCard: { ...CARD_STYLE, flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  statCardLarge: { flex: 1.2 },
  bigStat: { fontFamily: FONTS.heading, fontSize: 56, color: COLORS.primary, lineHeight: 64 },
  medStat: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.textPrimary },
  statLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, letterSpacing: 1, textAlign: 'center' },
  card: { ...CARD_STYLE, gap: SPACING.sm },
  sectionLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.textSecondary, letterSpacing: 1.2 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatmapDayLabel: { width: 36, fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, textAlign: 'center' },
  heatCell: { width: 34, height: 34, borderRadius: 4 },
  heatmapLegend: { flexDirection: 'row', gap: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textTertiary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary },
  summaryValue: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.textPrimary },
});
