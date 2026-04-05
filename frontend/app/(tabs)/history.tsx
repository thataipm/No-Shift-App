import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, Focus } from '../../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

function StatusBadge({ status }: { status: Focus['status'] }) {
  const cfg = {
    active: { bg: COLORS.primaryMuted, text: COLORS.primary, label: 'ACTIVE' },
    completed: { bg: 'rgba(46,125,50,0.15)', text: COLORS.success, label: 'COMPLETED' },
    abandoned: { bg: COLORS.dangerMuted, text: COLORS.danger, label: 'ABANDONED' },
  }[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const [focuses, setFocuses] = useState<Focus[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('focuses')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'active')
      .order('created_at', { ascending: false });
    setFocuses(data || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const renderFocus = ({ item }: { item: Focus }) => {
    const isOpen = expanded === item.id;
    const accentStyle = item.status === 'completed' ? styles.cardCompleted : item.status === 'abandoned' ? styles.cardAbandoned : null;
    return (
      <TouchableOpacity
        testID={`history-focus-${item.id}`}
        style={[styles.card, accentStyle]}
        onPress={() => setExpanded(isOpen ? null : item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardMeta}>
            <Text style={styles.focusTitle} numberOfLines={isOpen ? undefined : 2}>{item.title}</Text>
            <Text style={styles.dateRange}>
              {formatDate(item.created_at)} — {item.completed_at ? formatDate(item.completed_at) : item.deadline ? formatDate(item.deadline) : 'ongoing'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <StatusBadge status={item.status} />
            <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
          </View>
        </View>

        {isOpen && (
          <View style={styles.details}>
            {!!item.why && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>WHY</Text>
                <Text style={styles.detailValue}>{item.why}</Text>
              </View>
            )}
            {!!item.success_criteria && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>SUCCESS CRITERIA</Text>
                <Text style={styles.detailValue}>{item.success_criteria}</Text>
              </View>
            )}
            {!!item.reflection && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>REFLECTION</Text>
                <Text style={styles.detailValue}>{item.reflection}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>History</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={focuses}
          keyExtractor={i => i.id}
          renderItem={renderFocus}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty} testID="history-empty">
              <Text style={styles.emptyIcon}>◎</Text>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptyBody}>Complete or abandon a focus to see it here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: SPACING.lg, paddingBottom: SPACING.sm },
  screenTitle: { fontFamily: FONTS.heading, fontSize: 36, color: COLORS.textPrimary, letterSpacing: -0.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 48 },

  // Cards — left-accent strip, no full border
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.borderSubtle,
    gap: SPACING.sm,
  },
  cardCompleted: { borderLeftColor: COLORS.primary },
  cardAbandoned: { borderLeftColor: COLORS.tertiaryContainer },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  cardMeta: { flex: 1, gap: 4 },
  focusTitle: { fontFamily: FONTS.heading, fontSize: 20, color: COLORS.textPrimary, lineHeight: 26 },
  dateRange: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textTertiary },
  chevron: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textTertiary, marginTop: 4 },

  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.sm },
  badgeText: { fontFamily: FONTS.label, fontSize: 10, letterSpacing: 1 },

  details: { gap: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: SPACING.md },
  detailSection: { gap: 3 },
  detailLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.primary, letterSpacing: 1.5, textTransform: 'uppercase' },
  detailValue: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },

  empty: { paddingTop: 80, alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyIcon: { fontFamily: FONTS.heading, fontSize: 40, color: COLORS.textTertiary },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.textPrimary, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
});
