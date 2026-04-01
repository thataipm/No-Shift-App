import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import { supabase } from '../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS, CARD_STYLE } from '../constants/theme';
import { useRouter } from 'expo-router';

const WIDTH = Dimensions.get('window').width - SPACING.lg * 2;

type AdminStats = {
  total_users: number;
  new_today: number;
  new_this_week: number;
  new_this_month: number;
  dau: number;
  wau: number;
  mau: number;
  total_focuses: number;
  completed_focuses: number;
  abandoned_focuses: number;
  active_focuses: number;
  avg_checkins_per_user: number;
  total_parked_ideas: number;
  signups_per_day: { date: string; count: number }[];
  d7_retention: number;
  d30_retention: number;
};

export default function AdminScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setError('');
    const { data, error } = await supabase.rpc('get_admin_stats');
    if (error) {
      setError(error.message.includes('unauthorized') ? 'Admin access required.' : error.message);
    } else {
      setStats(data);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  const onRefresh = async () => { setRefreshing(true); await fetchStats(); setRefreshing(false); };

  const pieData = stats ? [
    { value: stats.completed_focuses, color: COLORS.adminAccent, label: 'Completed' },
    { value: stats.abandoned_focuses, color: COLORS.danger, label: 'Abandoned' },
    { value: stats.active_focuses, color: 'rgba(24,95,165,0.4)', label: 'Active' },
  ].filter(d => d.value > 0) : [];

  const signupLineData = stats?.signups_per_day?.map(d => ({
    value: d.count,
    label: d.date.slice(5),
    dataPointColor: COLORS.adminAccent,
  })) || [];

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={COLORS.adminAccent} /></View></SafeAreaView>;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity testID="admin-back-button" style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.adminAccent} />}
      >
        <View style={styles.titleRow}>
          <TouchableOpacity testID="admin-back-button" onPress={() => router.back()}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Admin</Text>
        </View>

        {stats && (
          <>
            {/* Users */}
            <Text style={styles.sectionTitle}>Users</Text>
            <View style={styles.grid}>
              <StatCard label="Total Users" value={String(stats.total_users)} />
              <StatCard label="New Today" value={String(stats.new_today)} />
              <StatCard label="This Week" value={String(stats.new_this_week)} />
              <StatCard label="This Month" value={String(stats.new_this_month)} />
            </View>

            {/* Engagement */}
            <Text style={styles.sectionTitle}>Engagement</Text>
            <View style={styles.grid}>
              <StatCard label="DAU" value={String(stats.dau)} />
              <StatCard label="WAU" value={String(stats.wau)} />
              <StatCard label="MAU" value={String(stats.mau)} />
              <StatCard label="Avg Check-ins" value={String(stats.avg_checkins_per_user)} />
            </View>

            {/* Retention */}
            <Text style={styles.sectionTitle}>Retention</Text>
            <View style={styles.grid}>
              <StatCard label="D7 Retention" value={`${stats.d7_retention}%`} />
              <StatCard label="D30 Retention" value={`${stats.d30_retention}%`} />
            </View>

            {/* Focus stats */}
            <Text style={styles.sectionTitle}>Focuses</Text>
            <View style={styles.grid}>
              <StatCard label="Total" value={String(stats.total_focuses)} />
              <StatCard label="Completed" value={String(stats.completed_focuses)} />
              <StatCard label="Abandoned" value={String(stats.abandoned_focuses)} />
              <StatCard label="Parked Ideas" value={String(stats.total_parked_ideas)} />
            </View>

            {/* Pie chart: focus outcomes */}
            {pieData.length > 0 && (
              <View style={styles.chartCard} testID="admin-pie-chart">
                <Text style={styles.chartTitle}>Focus Outcomes</Text>
                <View style={styles.pieContainer}>
                  <PieChart
                    data={pieData}
                    donut
                    radius={70}
                    innerRadius={45}
                    centerLabelComponent={() => (
                      <Text style={styles.pieCenterText}>{stats.total_focuses}</Text>
                    )}
                  />
                  <View style={styles.pieLegend}>
                    {pieData.map((d, i) => (
                      <View key={i} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                        <Text style={styles.legendLabel}>{d.label}: {d.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Line chart: signups */}
            {signupLineData.length > 1 && (
              <View style={styles.chartCard} testID="admin-signups-chart">
                <Text style={styles.chartTitle}>Signups (Last 30 Days)</Text>
                <LineChart
                  data={signupLineData}
                  color={COLORS.adminAccent}
                  thickness={2}
                  hideDataPoints={signupLineData.length > 15}
                  dataPointsColor={COLORS.adminAccent}
                  startFillColor="rgba(24,95,165,0.2)"
                  endFillColor="transparent"
                  areaChart
                  yAxisColor="transparent"
                  xAxisColor={COLORS.borderSubtle}
                  xAxisLabelTextStyle={{ color: COLORS.textTertiary, fontFamily: FONTS.body, fontSize: 9 }}
                  noOfSections={4}
                  height={120}
                  width={WIDTH - SPACING.lg * 2}
                  rulesColor={COLORS.borderSubtle}
                  yAxisTextStyle={{ color: COLORS.textTertiary, fontFamily: FONTS.body, fontSize: 10 }}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard} testID={`admin-stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.lg },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  screenTitle: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.adminAccent },
  backLink: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary },
  sectionTitle: { fontFamily: FONTS.label, fontSize: 12, color: COLORS.textTertiary, letterSpacing: 1.2, marginTop: SPACING.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: 'rgba(24,95,165,0.2)',
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.adminAccent },
  statLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, textAlign: 'center', letterSpacing: 0.8 },
  chartCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: 'rgba(24,95,165,0.15)', gap: SPACING.md },
  chartTitle: { fontFamily: FONTS.label, fontSize: 12, color: COLORS.textSecondary, letterSpacing: 1 },
  pieContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  pieCenterText: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.adminAccent },
  pieLegend: { gap: SPACING.sm, flex: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendLabel: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary },
  errorText: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.danger, textAlign: 'center' },
  backBtn: { borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: RADIUS.pill, paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText: { fontFamily: FONTS.label, fontSize: 14, color: COLORS.textSecondary },
});
