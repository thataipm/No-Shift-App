import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import { supabase, Focus, Checkin, calculateStreak, getDaysInto, getDaysRemaining, getTodayStr } from '../../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS, CARD_STYLE } from '../../constants/theme';

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
  const [parkTitle, setParkTitle] = useState('');
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

  // 7-day mini bar chart data
  const barData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const ci = checkins.find(c => c.date === dateStr);
    return {
      value: ci?.did_work ? (ci.momentum || 3) : 0,
      frontColor: ci?.did_work ? COLORS.primary : COLORS.surfaceElevated,
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
    if (!parkTitle.trim()) { Alert.alert('Enter an idea title first'); return; }
    setSavingFriction(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingFriction(false); return; }
    const { error } = await supabase.from('parked_ideas').insert({ user_id: user.id, title: parkTitle.trim() });
    setSavingFriction(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setParkTitle('');
    setShowFriction(false);
    setFrictionStep('initial');
    Alert.alert('Idea Parked ✓', 'Find it in your Ideas tab when you\'re ready.');
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
          <TouchableOpacity testID="new-idea-button" style={styles.newIdeaBtn} onPress={() => {
            if (focus) {
              setShowFriction(true);
              setFrictionStep('initial');
            } else {
              router.push('/onboarding');
            }
          }}>
            <Text style={styles.newIdeaBtnText}>+ New Focus</Text>
          </TouchableOpacity>
        </View>

        {focus ? (
          <>
            {/* Active Focus Card */}
            <View style={styles.focusCard} testID="active-focus-card">
              <Text style={styles.cardLabel}>ACTIVE FOCUS</Text>
              <Text style={styles.focusTitle}>{focus.title}</Text>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.streakNumber}>{streak}</Text>
                  <Text style={styles.statLabel}>DAY STREAK</Text>
                </View>
                <View style={styles.statDivider} />
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
                <Text style={styles.chartLabel}>LAST 7 DAYS</Text>
                <BarChart
                  data={barData}
                  barWidth={26}
                  spacing={8}
                  roundedTop
                  noOfSections={5}
                  yAxisColor="transparent"
                  xAxisColor="transparent"
                  hideYAxisText
                  hideAxesAndRules
                  maxValue={5}
                  height={70}
                  barBorderRadius={4}
                />
              </View>
            </View>

            {/* Check-in button */}
            <TouchableOpacity
              testID="checkin-button"
              style={[styles.primaryBtn, !!todayCheckin && styles.btnCheckedIn]}
              onPress={() => {
                if (!todayCheckin) {
                  setCiStep(1);
                  setShowCheckin(true);
                }
              }}
              disabled={!!todayCheckin}
            >
              <Text style={[styles.primaryBtnText, !!todayCheckin && styles.btnCheckedInText]}>
                {todayCheckin ? (todayCheckin.did_work ? '✓ Checked In Today' : '✓ Logged Today') : 'Check In Today'}
              </Text>
            </TouchableOpacity>

            {/* Mark complete */}
            <TouchableOpacity testID="mark-complete-button" style={styles.outlineBtn} onPress={handleMarkComplete}>
              <Text style={styles.outlineBtnText}>Mark as Complete</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Empty state */
          <View style={styles.emptyState} testID="empty-focus-state">
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
                    <Text style={styles.frictionFocusTitle}>{focus?.title}</Text>
                    <Text style={styles.frictionFocusSub}>{daysInto} days in · {daysRemaining} days left</Text>
                  </View>
                  <Text style={styles.frictionBody}>Don't let a new idea derail your progress. Park it for later — or are you sure you want to switch?</Text>

                  <TouchableOpacity testID="friction-park-button" style={styles.primaryBtn} onPress={() => setFrictionStep('park')}>
                    <Text style={styles.primaryBtnText}>Park This Idea Instead</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="friction-switch-button" style={styles.dangerOutlineBtn} onPress={() => setFrictionStep('switch_confirm')}>
                    <Text style={styles.dangerOutlineBtnText}>I Want to Switch</Text>
                  </TouchableOpacity>
                </View>
              )}

              {frictionStep === 'park' && (
                <View style={styles.modalContent}>
                  <Text style={styles.modalHeading}>Park this idea</Text>
                  <Text style={styles.modalSub}>Give it a title and come back to it later.</Text>
                  <TextInput
                    testID="friction-park-title-input"
                    style={styles.noteInput}
                    value={parkTitle}
                    onChangeText={setParkTitle}
                    placeholder="My new idea…"
                    placeholderTextColor={COLORS.textTertiary}
                    autoFocus
                    maxLength={100}
                  />
                  <TouchableOpacity
                    testID="friction-save-park"
                    style={[styles.primaryBtn, savingFriction && styles.btnDisabled]}
                    onPress={handleParkIdea}
                    disabled={savingFriction}
                  >
                    <Text style={styles.primaryBtnText}>{savingFriction ? 'Saving…' : 'Park It'}</Text>
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
                  <TouchableOpacity testID="friction-cancel-switch" style={styles.outlineBtn} onPress={() => setFrictionStep('initial')}>
                    <Text style={styles.outlineBtnText}>Go Back</Text>
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
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  logo: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.primary },
  newIdeaBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.borderActive },
  newIdeaBtnText: { fontFamily: FONTS.label, fontSize: 12, color: COLORS.primary },
  focusCard: { ...CARD_STYLE, borderColor: COLORS.borderActive, gap: SPACING.md },
  cardLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.primary, letterSpacing: 1.2 },
  focusTitle: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.textPrimary, lineHeight: 34 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: COLORS.borderSubtle },
  streakNumber: { fontFamily: FONTS.heading, fontSize: 48, color: COLORS.primary, lineHeight: 56 },
  statValue: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.textPrimary },
  statLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, letterSpacing: 1 },
  chartSection: { gap: SPACING.xs },
  chartLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.textTertiary, letterSpacing: 1.1 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  btnCheckedIn: { backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.borderSubtle },
  btnCheckedInText: { color: COLORS.textSecondary },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: '#000' },
  outlineBtn: { borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center' },
  outlineBtnText: { fontFamily: FONTS.label, fontSize: 14, color: COLORS.textSecondary },
  emptyState: { gap: SPACING.md, alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.textPrimary, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingBottom: 40, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md },
  frictionOverlay: { flex: 1, backgroundColor: 'rgba(15,15,15,0.95)', justifyContent: 'flex-end' },
  frictionCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingBottom: 40, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderSubtle, alignSelf: 'center', marginBottom: SPACING.sm },
  modalContent: { gap: SPACING.md },
  modalHeading: { fontFamily: FONTS.heading, fontSize: 24, color: COLORS.textPrimary },
  modalFocusTitle: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.textSecondary },
  modalSub: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary },
  yesNoRow: { flexDirection: 'row', gap: SPACING.md },
  yesNoBtn: { flex: 1, paddingVertical: 18, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderSubtle, alignItems: 'center' },
  yesActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  noActive: { backgroundColor: COLORS.dangerMuted, borderColor: COLORS.danger },
  yesNoBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.textSecondary },
  yesActiveText: { color: COLORS.primary },
  noActiveText: { color: COLORS.danger },
  noteInput: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, padding: SPACING.md, color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 16, borderWidth: 1, borderColor: COLORS.borderSubtle, minHeight: 80, textAlignVertical: 'top' },
  momentumValue: { fontFamily: FONTS.heading, fontSize: 56, color: COLORS.primary, textAlign: 'center' },
  momentumRow: { flexDirection: 'row', justifyContent: 'space-between' },
  momentumBtn: { width: 52, height: 52, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  momentumActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  momentumBtnText: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textSecondary },
  momentumActiveText: { color: '#000' },
  cancelBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  cancelBtnText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textTertiary },
  frictionWarning: { fontFamily: FONTS.heading, fontSize: 32, color: COLORS.primary },
  frictionHeading: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.textPrimary },
  frictionFocusBlock: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.primary, gap: 4 },
  frictionFocusTitle: { fontFamily: FONTS.headingMedium, fontSize: 18, color: COLORS.textPrimary },
  frictionFocusSub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary },
  frictionBody: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
  dangerOutlineBtn: { borderWidth: 1, borderColor: COLORS.danger, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center' },
  dangerOutlineBtnText: { fontFamily: FONTS.label, fontSize: 14, color: COLORS.danger },
  dangerBtn: { backgroundColor: COLORS.danger, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  dangerBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: '#fff' },
});
