import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Animated, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase, Checkin, calculateStreak } from '../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS, CARD_STYLE } from '../constants/theme';

export default function FocusCompleteScreen() {
  const router = useRouter();
  const { focusId, focusTitle } = useLocalSearchParams<{ focusId: string; focusTitle: string }>();
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    if (focusId) {
      supabase.from('checkins').select('*').eq('focus_id', focusId).then(({ data }) => {
        setCheckins(data || []);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [focusId]);

  const streak = calculateStreak(checkins);
  const totalCheckins = checkins.length;
  const workedDays = checkins.filter(c => c.did_work).length;
  const avgMomentum = checkins.filter(c => c.momentum).length > 0
    ? (checkins.reduce((a, c) => a + (c.momentum || 0), 0) / checkins.filter(c => c.momentum).length).toFixed(1)
    : '—';

  const handleSaveReflection = async () => {
    if (!focusId) return;
    setSaving(true);
    const { error } = await supabase.from('focuses').update({
      reflection: reflection.trim() || null,
    }).eq('id', focusId);
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    router.replace('/(tabs)');
  };

  const handleStartNext = () => {
    router.replace('/(tabs)/parking');
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Celebration */}
          <Animated.View style={[styles.celebration, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.celebrationEmoji}>✦</Text>
            <Text style={styles.celebrationTitle}>Focus Complete!</Text>
          </Animated.View>

          <Text style={styles.focusTitle}>{focusTitle}</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{workedDays}</Text>
              <Text style={styles.statLabel}>DAYS WORKED</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>FINAL STREAK</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{avgMomentum}</Text>
              <Text style={styles.statLabel}>AVG MOMENTUM</Text>
            </View>
          </View>

          {/* Reflection */}
          <View style={styles.reflectionCard}>
            <Text style={styles.reflectionLabel}>WHAT DID YOU LEARN?</Text>
            <TextInput
              testID="reflection-input"
              style={styles.reflectionInput}
              value={reflection}
              onChangeText={setReflection}
              placeholder="What did this focus teach you?"
              placeholderTextColor={COLORS.textTertiary}
              multiline
              maxLength={500}
            />
          </View>

          <TouchableOpacity
            testID="save-reflection-button"
            style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={handleSaveReflection}
            disabled={saving}
          >
            <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save & Finish'}</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="start-next-focus-button" style={styles.outlineBtn} onPress={handleStartNext}>
            <Text style={styles.outlineBtnText}>Start Next Focus →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40, alignItems: 'stretch' },
  celebration: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  celebrationEmoji: { fontSize: 64, color: COLORS.primary },
  celebrationTitle: { fontFamily: FONTS.heading, fontSize: 32, color: COLORS.textPrimary, textAlign: 'center' },
  focusTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primary, textAlign: 'center', marginBottom: SPACING.sm },
  statsRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderActive },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: COLORS.borderSubtle },
  statValue: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.primary },
  statLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, letterSpacing: 1, textAlign: 'center' },
  reflectionCard: { ...CARD_STYLE, gap: SPACING.sm },
  reflectionLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.primary, letterSpacing: 1.2 },
  reflectionInput: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.body,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: '#000' },
  outlineBtn: { borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center' },
  outlineBtnText: { fontFamily: FONTS.label, fontSize: 14, color: COLORS.textSecondary },
});
