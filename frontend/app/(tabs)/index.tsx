import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import { supabase, Focus, Checkin, calculateStreak, getDaysInto, getDaysRemaining, getTodayStr } from '../../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

const SCREEN_W = Dimensions.get('window').width;
// card width = screen - content padding (lg*2) - card padding (lg*2)
const BAR_CHART_W = SCREEN_W - SPACING.lg * 4;

export default function HomeScreen() {
  const router = useRouter();
  const [focus, setFocus] = useState<Focus | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Check-in modal
  const [showCheckin, setShowCheckin] = useState(false);
  const [ciStep, setCiStep] = useState(1);
  const [didWork, setDidWork] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [momentum, setMomentum] = useState(3);
  const [savingCheckin, setSavingCheckin] = useState(false);

  // Friction gate modal
  const [showFriction, setShowFriction] = useState(false);
  const [frictionStep, setFrictionStep] = useState<'initial' | 'park' | 'switch_confirm' | 'reflection'>('initial');
  const [switchReflection, setSwitchReflection] = useState('');
  const [savingFriction, setSavingFriction] = useState(false);

  const today = getTodayStr();
  const todayCheckin = checkins.find(c => c.date === today);
  const streak = calculateStreak(checkins);
  const daysInto = focus ? getDaysInto(focus.created_at) : 0;
  const daysRemaining = focus ? getDaysRemaining(focus.deadline) : 0;

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: focusData } = await supabase
      .from('focuses')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    const activeFocus = focusData?.[0] || null;
    setFocus(activeFocus);

    if (activeFocus) {
      const { data: checkinData } = await supabase
        .from('checkins')
        .select('*')
        .eq('focus_id', activeFocus.id)
        .order('date', { ascending: true });
      setCheckins(checkinData || []);
    } else {
      setCheckins([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // 7-day bar chart — worked days gold, no-check days empty
  const barData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const ci = checkins.find(c => c.date === dateStr);
    return {
      value: ci?.did_work ? (ci.momentum || 3) : 0,
      frontColor: ci?.did_work ? COLORS.primary : COLORS.surfaceHighest,
      topLabelComponent: undefined as any,
    };
  });

  const handleCheckinSave = async () => {
    if (!focus || didWork === null) return;
    setSavingCheckin(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingCheckin(false); return; }

    const { error } = await supabase.from('checkins').upsert({
      focus_id: focus.id,
      user_id: user.id,
      date: today,
      did_work: didWork,
      note: note.trim() || null,
      momentum,
    });

    setSavingCheckin(false);
    if (error) { Alert.alert('Error', error.message); return; }

    setShowCheckin(false);
    setCiStep(1);
    setDidWork(null);
    setNote('');
    setMomentum(3);
    await fetchData();
  };

  const handleMarkComplete = () => {
    Alert.alert('Mark as Complete?', 'This will complete your current focus. Well done!', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete It', style: 'default',
        onPress: async () => {
          if (!focus) return;
          const { error } = await supabase.from('focuses').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          }).eq('id', focus.id);
          if (error) { Alert.alert('Error', error.message); return; }
          router.push({
            pathname: '/focus-complete',
            params: { focusId: focus.id, focusTitle: focus.title },
          });
        },
      },
    ]);
  };

  const handleParkIdea = async () => {
    if (!focus) return;
    setSavingFriction(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingFriction(false); return; }
    // Save current focus as a parked idea
    await supabase.from('parked_ideas').insert({ user_id: user.id, title: focus.title });
    // Mark active focus as abandoned (paused)
    await supabase.from('focuses').update({
      status: 'abandoned',
      reflection: 'Parked for later — continuing from Ideas tab',
    }).eq('id', focus.id);
    setSavingFriction(false);
    setShowFriction(false);
    setFrictionStep('initial');
    await fetchData();
  };

  const handleSwitchFocus = async () => {
    if (!focus) return;
    setSavingFriction(true);
    const { error } = await supabase.from('focuses').update({
      status: 'abandoned',
      reflection: switchReflection.trim() || null,
    }).eq('id', focus.id);
    setSavingFriction(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowFriction(false);
    setFrictionStep('initial');
    setSwitchReflection('');
    router.replace('/onboarding');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Noshift</Text>
          <TouchableOpacity
            testID="new-idea-button"
            style={styles.newIdeaBtn}
            onPress={() => {
              if (focus) { setShowFriction(true); setFrictionStep('initial'); }
              else { router.push('/onboarding'); }
            }}
          >
            <Text style={styles.newIdeaBtnText}>+ New Focus</Text>
          </TouchableOpacity>
        </View>

        {focus ? (
          <>
            {/* Active Focus Card — left gold accent, no full border */}
            <View style={styles.focusCard} testID="active-focus-card">
              <Text style={styles.cardLabel}>ACTIVE FOCUS</Text>
              <Text style={styles.focusTitle}>{focus.title}</Text>

              {/* Streak as hero — centered, dominates the card */}
              <View style={styles.streakHero}>
                <Text style={styles.streakNumber}>{streak}</Text>
                <Text style={styles.streakLabel}>DAY STREAK</Text>
              </View>

              {/* 2-col stats — days in + days left */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{daysInto}</Text>
                  <Text style={styles.statLabel}>DAYS IN</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{daysRemaining}</Text>
                  <Text style={styles.statLabel}>DAYS LEFT</Text>
                </View>
              </View>

              {/* Mini 7-day chart */}
              <View style={styles.chartSection}>
                <Text style={styles.chartLabel}>THIS WEEK</Text>
                <BarChart
                  data={barData}
                  barWidth={28}
                  spacing={10}
                  roundedTop
                  noOfSections={5}
                  yAxisColor="transparent"
                  xAxisColor="transparent"
                  hideYAxisText
                  hideAxesAndRules
                  maxValue={5}
                  height={60}
                  width={BAR_CHART_W}
                  barBorderRadius={4}
                />
              </View>
            </View>

            {/* Primary CTA — gold pill, full width, prominent */}
            <TouchableOpacity
              testID="checkin-button"
              style={[styles.primaryBtn, !!todayCheckin && styles.btnCheckedIn]}
              onPress={() => {
                if (!todayCheckin) { setCiStep(1); setShowCheckin(true); }
              }}
              disabled={!!todayCheckin}
            >
              <Text style={[styles.primaryBtnText, !!todayCheckin && styles.btnCheckedInText]}>
                {todayCheckin ? (todayCheckin.did_work ? '✓ Checked In Today' : '✓ Logged Today') : 'Check In Today'}
              </Text>
            </TouchableOpacity>

            {/* Mark complete — text link, far less visual weight than CTA */}
            <TouchableOpacity testID="mark-complete-button" style={styles.textLink} onPress={handleMarkComplete}>
              <Text style={styles.textLinkText}>Mark as Complete</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyState} testID="empty-focus-state">
            <Text style={styles.emptyIcon}>◎</Text>
            <Text style={styles.emptyTitle}>No active focus</Text>
            <Text style={styles.emptyBody}>You don't have an active goal yet.{'\n'}Start one now and stay committed.</Text>
            <TouchableOpacity testID="start-focus-button" style={styles.primaryBtn} onPress={() => router.push('/onboarding')}>
              <Text style={styles.primaryBtnText}>Start a Focus →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── CHECK-IN MODAL ── */}
      <Modal visible={showCheckin} transparent animationType="slide" onRequestClose={() => setShowCheckin(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard} testID="checkin-modal">
              <View style={styles.modalHandle} />

              {ciStep === 1 && (
                <View style={styles.modalContent}>
                  <Text style={styles.modalStepLabel}>STEP 1 OF 3</Text>
                  <Text style={styles.modalHeading}>Did you work on this today?</Text>
                  <Text style={styles.modalFocusTitle}>{focus?.title}</Text>
                  <View style={styles.yesNoRow}>
                    <TouchableOpacity
                      testID="checkin-yes-button"
                      style={[styles.yesNoBtn, didWork === true && styles.yesActive]}
                      onPress={() => { setDidWork(true); setCiStep(2); }}
                    >
                      <Text style={[styles.yesNoBtnText, didWork === true && styles.yesActiveText]}>Yes ✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="checkin-no-button"
                      style={[styles.yesNoBtn, didWork === false && styles.noActive]}
                      onPress={() => { setDidWork(false); setCiStep(2); }}
                    >
                      <Text style={[styles.yesNoBtnText, didWork === false && styles.noActiveText]}>No ✗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {ciStep === 2 && (
                <View style={styles.modalContent}>
                  <Text style={styles.modalStepLabel}>STEP 2 OF 3</Text>
                  <Text style={styles.modalHeading}>Any notes?</Text>
                  <Text style={styles.modalSub}>Optional — one line is enough.</Text>
                  <TextInput
                    testID="checkin-note-input"
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="What happened today…"
                    placeholderTextColor={COLORS.textTertiary}
                    maxLength={150}
                  />
                  <TouchableOpacity testID="checkin-note-next" style={styles.primaryBtn} onPress={() => setCiStep(3)}>
                    <Text style={styles.primaryBtnText}>Continue →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {ciStep === 3 && (
                <View style={styles.modalContent}>
                  <Text style={styles.modalStepLabel}>STEP 3 OF 3</Text>
                  <Text style={styles.modalHeading}>Momentum today?</Text>
                  <Text style={styles.momentumValue}>{momentum}</Text>
                  <View style={styles.momentumRow}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <TouchableOpacity
                        key={n}
                        testID={`momentum-${n}`}
                        style={[styles.momentumBtn, momentum === n && styles.momentumActive]}
                        onPress={() => setMomentum(n)}
                      >
                        <Text style={[styles.momentumBtnText, momentum === n && styles.momentumActiveText]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.momentumDesc}>{['Felt Stuck', 'Getting Going', 'Steady Flow', 'In the Zone', 'Peak State'][momentum - 1]}</Text>
                  <TouchableOpacity
                    testID="checkin-save-button"
                    style={[styles.primaryBtn, savingCheckin && styles.btnDisabled]}
                    onPress={handleCheckinSave}
                    disabled={savingCheckin}
                  >
                    <Text style={styles.primaryBtnText}>{savingCheckin ? 'Saving…' : 'Save Check-In'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity testID="checkin-close" style={styles.cancelBtn} onPress={() => setShowCheckin(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── FRICTION GATE MODAL ── */}
      <Modal visible={showFriction} transparent animationType="fade" onRequestClose={() => setShowFriction(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.frictionOverlay}>
            <View style={styles.frictionCard} testID="friction-gate-modal">
              <View style={styles.modalHandle} />

              {frictionStep === 'initial' && (
                <View style={styles.modalContent}>
                  <Text style={styles.frictionWarning}>Wait.</Text>
                  <Text style={styles.frictionHeading}>You're already committed.</Text>
                  <View style={styles.frictionFocusBlock}>
                    <Text style={styles.frictionFocusLabel}>ACTIVE</Text>
                    <Text style={styles.frictionFocusTitle}>{focus?.title}</Text>
                    <Text style={styles.frictionFocusSub}>{daysInto} days in · {daysRemaining} days left</Text>
                  </View>
                  <Text style={styles.frictionBody}>Don't let a new idea derail your progress. Park it for later — or are you sure you want to switch?</Text>
                  <TouchableOpacity testID="friction-park-button" style={styles.primaryBtn} onPress={() => setFrictionStep('park')}>
                    <Text style={styles.primaryBtnText}>Park Current Focus</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="friction-switch-button" style={styles.ghostBtn} onPress={() => setFrictionStep('switch_confirm')}>
                    <Text style={styles.ghostBtnText}>I Want to Switch</Text>
                  </TouchableOpacity>
                </View>
              )}

              {frictionStep === 'park' && (
                <View style={styles.modalContent}>
                  <Text style={styles.modalHeading}>Park your focus?</Text>
                  <Text style={styles.modalSub}>
                    <Text style={{ color: COLORS.primary }}>"{focus?.title}"</Text>
                    {'\n'}will be saved to your Ideas. Find it there when you're ready to continue.
                  </Text>
                  <TouchableOpacity
                    testID="friction-save-park"
                    style={[styles.primaryBtn, savingFriction && styles.btnDisabled]}
                    onPress={handleParkIdea}
                    disabled={savingFriction}
                  >
                    <Text style={styles.primaryBtnText}>{savingFriction ? 'Parking…' : 'Park It →'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setFrictionStep('initial')}>
                    <Text style={styles.cancelBtnText}>Go Back</Text>
                  </TouchableOpacity>
                </View>
              )}

              {frictionStep === 'switch_confirm' && (
                <View style={styles.modalContent}>
                  <Text style={styles.frictionWarning}>Are you sure?</Text>
                  <Text style={styles.modalSub}>You'll mark <Text style={{ color: COLORS.primary }}>{focus?.title}</Text> as abandoned. This can't be undone.</Text>
                  <TouchableOpacity testID="friction-confirm-switch" style={styles.dangerBtn} onPress={() => setFrictionStep('reflection')}>
                    <Text style={styles.dangerBtnText}>Yes, Abandon It</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="friction-cancel-switch" style={styles.ghostBtn} onPress={() => setFrictionStep('initial')}>
                    <Text style={styles.ghostBtnText}>Go Back</Text>
                  </TouchableOpacity>
                </View>
              )}

              {frictionStep === 'reflection' && (
                <View style={styles.modalContent}>
                  <Text style={styles.modalHeading}>One last thing…</Text>
                  <Text style={styles.modalSub}>What did you learn from this? (Optional)</Text>
                  <TextInput
                    testID="friction-reflection-input"
                    style={styles.noteInput}
                    value={switchReflection}
                    onChangeText={setSwitchReflection}
                    placeholder="What I learned…"
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    maxLength={300}
                    autoFocus
                  />
                  <TouchableOpacity
                    testID="friction-final-switch"
                    style={[styles.dangerBtn, savingFriction && styles.btnDisabled]}
                    onPress={handleSwitchFocus}
                    disabled={savingFriction}
                  >
                    <Text style={styles.dangerBtnText}>{savingFriction ? 'Saving…' : 'Start New Focus'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity testID="friction-close" style={styles.cancelBtn} onPress={() => { setShowFriction(false); setFrictionStep('initial'); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontFamily: FONTS.heading, fontSize: 32, color: COLORS.primary, fontStyle: 'italic' },
  newIdeaBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceContainer,
  },
  newIdeaBtnText: { fontFamily: FONTS.label, fontSize: 12, color: COLORS.textSecondary, letterSpacing: 0.5 },

  // Focus card — depth via left accent + bg shift, no full border
  focusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    gap: SPACING.md,
  },
  cardLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.primaryDim, letterSpacing: 2, textTransform: 'uppercase' },
  focusTitle: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.textPrimary, lineHeight: 34 },

  // Streak hero — dominant visual in the card
  streakHero: { alignItems: 'center', paddingVertical: SPACING.sm },
  streakNumber: { fontFamily: FONTS.heading, fontSize: 80, color: COLORS.primary, lineHeight: 88 },
  streakLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.textTertiary, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 },

  // Stats — 2 items, centered under streak
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stat: { alignItems: 'center', gap: 2, paddingHorizontal: SPACING.xl },
  statDivider: { width: 1, height: 36, backgroundColor: COLORS.borderSubtle },
  statValue: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.textPrimary },
  statLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Chart
  chartSection: { gap: SPACING.xs },
  chartLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Buttons
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 20, alignItems: 'center' },
  btnCheckedIn: { backgroundColor: COLORS.surfaceElevated },
  btnCheckedInText: { color: COLORS.textSecondary },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.onPrimary, letterSpacing: 1 },

  // Mark complete — just a text link, far lower visual weight than CTA
  textLink: { alignItems: 'center', paddingVertical: SPACING.xs },
  textLinkText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textTertiary },

  // Ghost button — border only, for secondary actions in friction
  ghostBtn: {
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  ghostBtnText: { fontFamily: FONTS.label, fontSize: 14, color: COLORS.textSecondary },

  // Empty state
  emptyState: { gap: SPACING.md, alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyIcon: { fontSize: 48, color: COLORS.textTertiary },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.textPrimary, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 23 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 48,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.lg,
  },
  frictionOverlay: { flex: 1, backgroundColor: 'rgba(10,10,10,0.97)', justifyContent: 'flex-end' },
  frictionCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 48,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.lg,
  },
  modalHandle: { width: 40, height: 3, borderRadius: 2, backgroundColor: COLORS.borderSubtle, alignSelf: 'center', marginBottom: SPACING.sm },
  modalContent: { gap: SPACING.md },
  modalStepLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.primaryDim, letterSpacing: 2, textTransform: 'uppercase' },
  modalHeading: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.textPrimary },
  modalFocusTitle: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.textSecondary, fontStyle: 'italic' },
  modalSub: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
  yesNoRow: { flexDirection: 'row', gap: SPACING.md },
  yesNoBtn: {
    flex: 1,
    paddingVertical: 22,
    borderRadius: RADIUS.lg,
    backgroundColor: 'transparent',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
  },
  yesActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.borderActive },
  noActive: { backgroundColor: COLORS.dangerMuted, borderColor: 'rgba(211,47,47,0.3)' },
  yesNoBtnText: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.textPrimary },
  yesActiveText: { color: COLORS.primary },
  noActiveText: { color: COLORS.danger },
  noteInput: {
    backgroundColor: COLORS.surfaceHighest,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.body,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  momentumValue: { fontFamily: FONTS.heading, fontSize: 64, color: COLORS.primary, textAlign: 'center' },
  momentumRow: { flexDirection: 'row', justifyContent: 'space-between' },
  momentumBtn: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentumActive: { backgroundColor: COLORS.primary },
  momentumBtnText: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textSecondary },
  momentumActiveText: { color: COLORS.onPrimary },
  momentumDesc: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textTertiary, textAlign: 'center', fontStyle: 'italic' },
  cancelBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  cancelBtnText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textTertiary },
  frictionWarning: { fontFamily: FONTS.heading, fontSize: 36, color: COLORS.primary, fontStyle: 'italic' },
  frictionHeading: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.textPrimary },
  frictionFocusBlock: {
    backgroundColor: COLORS.surfaceHighest,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    gap: 4,
  },
  frictionFocusLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  frictionFocusTitle: { fontFamily: FONTS.headingMedium, fontSize: 18, color: COLORS.textPrimary },
  frictionFocusSub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary },
  frictionBody: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary, lineHeight: 23 },
  dangerBtn: { backgroundColor: COLORS.tertiaryContainer, borderRadius: RADIUS.pill, paddingVertical: 18, alignItems: 'center' },
  dangerBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.onTertiary, letterSpacing: 1 },
});
