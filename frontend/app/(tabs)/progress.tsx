import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';
import { supabase, Checkin, Focus, calculateStreak } from '../../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

const SCREEN_W = Dimensions.get('window').width;
// Cell size: screen - content padding - card padding - 6 gaps between 7 cells
const CELL_SIZE = Math.floor((SCREEN_W - SPACING.lg * 2 - SPACING.lg * 2 - 6 * 4) / 7);
// 40 = reserved space for Y-axis labels on the left of the LineChart
const CHART_W = SCREEN_W - SPACING.lg * 2 - SPACING.lg * 2 - 40;

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

  // Line chart data — last 30 worked days (default momentum to 3 if not recorded)
  const lineData = checkins.filter(c => c.did_work).slice(-30).map(c => ({
    value: c.momentum ?? 3,
    dataPointColor: COLORS.primary,
    label: '',
  }));

  // Heatmap — 49 days, padded to start on correct day of week
  const rawDays = Array.from({ length: 49 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (48 - i));
    const dateStr = d.toISOString().split('T')[0];
    const ci = checkins.find(c => c.date === dateStr);
    return { dateStr, ci, day: d.getDay() };
  });
  // Pad with empty cells so first cell aligns to correct day column
  const leadingEmpty = rawDays[0].day;
  const heatmapCells = [
    ...Array.from({ length: leadingEmpty }, () => ({ empty: true })),
    ...rawDays.map(d => ({ empty: false, ...d })),
  ];

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

        {/* Streak — standalone hero, no card */}
        <View style={styles.streakHero} testID="streak-display">
          <Text style={styles.streakLabel}>CURRENT STREAK</Text>
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakSub}>consecutive days</Text>
        </View>

        {/* 2-col rate cards */}
        <View style={styles.rateRow}>
          <View style={styles.rateCard} testID="checkin-rate">
            <Text style={styles.rateValue}>{completionRate}%</Text>
            <Text style={styles.rateLabel}>CHECK-IN RATE</Text>
          </View>
          <View style={styles.rateCard} testID="focus-completion-rate">
            <Text style={styles.rateValue}>{focusCompletionRate}%</Text>
            <Text style={styles.rateLabel}>FOCUS COMPLETION</Text>
          </View>
        </View>

        {/* Momentum chart */}
        {lineData.length > 0 && (
          <View style={styles.card} testID="momentum-chart">
            <Text style={styles.cardTitle}>Momentum</Text>
            <Text style={styles.cardSub}>LAST 30 WORKED DAYS</Text>
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
              width={CHART_W}
              rulesColor={COLORS.borderSubtle}
              yAxisTextStyle={{ color: COLORS.textTertiary, fontFamily: FONTS.body, fontSize: 10 }}
            />
          </View>
        )}

        {/* Activity heatmap — properly day-aligned */}
        <View style={styles.card} testID="calendar-heatmap">
          <Text style={styles.cardTitle}>Activity</Text>
          <Text style={styles.cardSub}>LAST 7 WEEKS</Text>
          {/* Day-of-week column headers */}
          <View style={styles.heatRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <View key={i} style={{ width: CELL_SIZE, alignItems: 'center' }}>
                <Text style={styles.heatDayLabel}>{d}</Text>
              </View>
            ))}
          </View>
          {/* Cells */}
          <View style={styles.heatGrid}>
            {heatmapCells.map((cell, i) => {
              if (cell.empty) {
                return <View key={`e${i}`} style={[styles.heatCell, { backgroundColor: 'transparent' }]} />;
              }
              let bg = COLORS.surfaceHighest;
              if (cell.ci) {
                if (cell.ci.did_work) {
                  // 5-level gold intensity based on momentum
                  const level = cell.ci.momentum || 3;
                  const alpha = [0.2, 0.35, 0.55, 0.75, 1.0][level - 1];
                  bg = `rgba(255,191,0,${alpha})`;
                } else {
                  bg = 'rgba(255,184,174,0.4)';
                }
              }
              return <View key={i} style={[styles.heatCell, { backgroundColor: bg }]} />;
            })}
          </View>
          {/* Legend */}
          <View style={styles.heatLegend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.surfaceHighest }]} /><Text style={styles.legendText}>No check-in</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: 'rgba(255,191,0,0.55)' }]} /><Text style={styles.legendText}>Worked</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: 'rgba(255,184,174,0.4)' }]} /><Text style={styles.legendText}>Skipped</Text></View>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Totals</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Check-ins</Text>
            <Text style={styles.totalValue}>{totalCheckins}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Days Worked</Text>
            <Text style={styles.totalValue}>{workedDays}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Focuses Completed</Text>
            <Text style={styles.totalValue}>{completedFocuses}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: 48 },
  screenTitle: { fontFamily: FONTS.heading, fontSize: 36, color: COLORS.textPrimary, letterSpacing: -0.5 },

  // Streak hero — outside any card, full-bleed visual impact
  streakHero: { alignItems: 'center', paddingVertical: SPACING.lg, gap: 4 },
  streakLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.textTertiary, letterSpacing: 2.5, textTransform: 'uppercase' },
  streakNumber: { fontFamily: FONTS.heading, fontSize: 96, color: COLORS.primary, lineHeight: 104, letterSpacing: -2 },
  streakSub: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.primaryDim, fontStyle: 'italic' },

  // Rate cards — 2-col
  rateRow: { flexDirection: 'row', gap: SPACING.md },
  rateCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  rateValue: { fontFamily: FONTS.heading, fontSize: 36, color: COLORS.textPrimary },
  rateLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center' },

  // Generic card
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md },
  cardTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.textPrimary },
  cardSub: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, letterSpacing: 2, textTransform: 'uppercase', marginTop: -SPACING.sm },

  // Heatmap
  heatRow: { flexDirection: 'row', gap: 4 },
  heatDayLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, textAlign: 'center' },
  heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatCell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textTertiary },

  // Totals
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary },
  totalValue: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.textPrimary },
  totalDivider: { height: 1, backgroundColor: COLORS.borderSubtle },
});
