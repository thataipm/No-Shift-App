import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

const MIN_DAYS = 3;
const TOTAL_STEPS = 6;

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + MIN_DAYS);

  const animate = (cb: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setTimeout(cb, 150);
  };

  const nextStep = () => animate(() => setStep(s => s + 1));
  const prevStep = () => animate(() => setStep(s => s - 1));

  const handleCommit = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { error } = await supabase.from('focuses').insert({
      user_id: user.id,
      title: title.trim(),
      why: why.trim() || null,
      success_criteria: successCriteria.trim() || null,
      deadline: deadline.toISOString().split('T')[0],
      status: 'active',
    });

    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Progress */}
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.progressDot, i < step && styles.progressDotActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            {/* STEP 1: Welcome */}
            {step === 1 && (
              <View style={styles.stepContainer} testID="onboarding-step-1">
                <Text style={styles.stepLogo}>Noshift</Text>
                <Text style={styles.stepHeading}>Stop jumping.{'\n'}Start finishing.</Text>
                <Text style={styles.stepBody}>
                  One goal. Total commitment. No excuses.{'\n\n'}
                  You're about to make a promise to yourself — and this app will hold you to it.
                </Text>
                <TouchableOpacity testID="onboarding-get-started" style={styles.primaryBtn} onPress={nextStep}>
                  <Text style={styles.primaryBtnText}>Get Started →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: Title */}
            {step === 2 && (
              <View style={styles.stepContainer} testID="onboarding-step-2">
                <Text style={styles.stepLabel}>STEP 1 OF 4</Text>
                <Text style={styles.stepHeading}>What are you committing to?</Text>
                <Text style={styles.stepBody}>Be specific. Not "get fit" — "run a 5K".</Text>
                <TextInput
                  testID="onboarding-title-input"
                  style={styles.bigInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Launch my first product"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  maxLength={100}
                  autoFocus
                />
                <TouchableOpacity
                  testID="onboarding-next-step2"
                  style={[styles.primaryBtn, !title.trim() && styles.btnDisabled]}
                  onPress={nextStep}
                  disabled={!title.trim()}
                >
                  <Text style={styles.primaryBtnText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 3: Why */}
            {step === 3 && (
              <View style={styles.stepContainer} testID="onboarding-step-3">
                <Text style={styles.stepLabel}>STEP 2 OF 4</Text>
                <Text style={styles.stepHeading}>Why does this matter to you?</Text>
                <Text style={styles.stepBody}>Your "why" is your anchor on hard days.</Text>
                <TextInput
                  testID="onboarding-why-input"
                  style={styles.bigInput}
                  value={why}
                  onChangeText={setWhy}
                  placeholder="e.g. I want to prove I can see something through"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  maxLength={200}
                  autoFocus
                />
                <TouchableOpacity testID="onboarding-next-step3" style={styles.primaryBtn} onPress={nextStep}>
                  <Text style={styles.primaryBtnText}>Continue →</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="onboarding-skip-step3" style={styles.skipBtn} onPress={nextStep}>
                  <Text style={styles.skipBtnText}>Skip →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 4: Success criteria */}
            {step === 4 && (
              <View style={styles.stepContainer} testID="onboarding-step-4">
                <Text style={styles.stepLabel}>STEP 3 OF 4</Text>
                <Text style={styles.stepHeading}>What does success look like?</Text>
                <Text style={styles.stepBody}>How will you know when you're done?</Text>
                <TextInput
                  testID="onboarding-success-input"
                  style={styles.bigInput}
                  value={successCriteria}
                  onChangeText={setSuccessCriteria}
                  placeholder="e.g. I have a live product with 10 paying customers"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  maxLength={200}
                  autoFocus
                />
                <TouchableOpacity testID="onboarding-next-step4" style={styles.primaryBtn} onPress={nextStep}>
                  <Text style={styles.primaryBtnText}>Continue →</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="onboarding-skip-step4" style={styles.skipBtn} onPress={nextStep}>
                  <Text style={styles.skipBtnText}>Skip →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 5: Deadline */}
            {step === 5 && (
              <View style={styles.stepContainer} testID="onboarding-step-5">
                <Text style={styles.stepLabel}>STEP 4 OF 4</Text>
                <Text style={styles.stepHeading}>How long will you commit?</Text>
                <Text style={styles.stepBody}>Pick a deadline. Minimum 3 days.</Text>

                <View style={styles.dateDisplay}>
                  <Text style={styles.dateValue}>{deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                  <Text style={styles.dateSub}>{daysUntil} day{daysUntil !== 1 ? 's' : ''} from now</Text>
                </View>

                {(Platform.OS === 'ios' || showDatePicker) && (
                  <DateTimePicker
                    testID="onboarding-date-picker"
                    value={deadline}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, date) => {
                      setShowDatePicker(false);
                      if (date) setDeadline(date);
                    }}
                    minimumDate={minDate}
                    style={Platform.OS === 'ios' ? { backgroundColor: COLORS.surface, borderRadius: 16 } : undefined}
                  />
                )}

                {Platform.OS === 'android' && !showDatePicker && (
                  <TouchableOpacity testID="onboarding-pick-date" style={styles.outlineBtn} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.outlineBtnText}>Change Date</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity testID="onboarding-next-step5" style={styles.primaryBtn} onPress={nextStep}>
                  <Text style={styles.primaryBtnText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 6: Summary */}
            {step === 6 && (
              <View style={styles.stepContainer} testID="onboarding-step-6">
                <Text style={styles.stepHeading}>Your Commitment</Text>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>{title}</Text>
                  {!!why && (
                    <View style={styles.summarySection}>
                      <Text style={styles.summaryLabel}>WHY</Text>
                      <Text style={styles.summaryValue}>{why}</Text>
                    </View>
                  )}
                  {!!successCriteria && (
                    <View style={styles.summarySection}>
                      <Text style={styles.summaryLabel}>SUCCESS LOOKS LIKE</Text>
                      <Text style={styles.summaryValue}>{successCriteria}</Text>
                    </View>
                  )}
                  <View style={styles.summarySection}>
                    <Text style={styles.summaryLabel}>COMMITTED UNTIL</Text>
                    <Text style={styles.summaryValue}>
                      {deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      {'  ·  '}{daysUntil} days
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  testID="onboarding-commit-button"
                  style={[styles.commitBtn, loading && styles.btnDisabled]}
                  onPress={handleCommit}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>{loading ? 'Saving…' : "I'm Committed"}</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {step > 1 && (
          <TouchableOpacity testID="onboarding-back" style={styles.backBtn} onPress={prevStep}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: SPACING.md, paddingHorizontal: SPACING.lg },
  progressDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.borderSubtle },
  progressDotActive: { backgroundColor: COLORS.primary, width: 20 },
  scroll: { flexGrow: 1, padding: SPACING.lg },
  stepContainer: { flex: 1, justifyContent: 'center', gap: SPACING.lg, paddingBottom: SPACING.xl },
  stepLogo: { fontFamily: FONTS.heading, fontSize: 36, color: COLORS.primary, textAlign: 'center' },
  stepLabel: { fontFamily: FONTS.label, fontSize: 12, color: COLORS.textTertiary, letterSpacing: 1.2 },
  stepHeading: { fontFamily: FONTS.heading, fontSize: 32, color: COLORS.textPrimary, lineHeight: 40 },
  stepBody: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.textSecondary, lineHeight: 24 },
  bigInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.body,
    fontSize: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateDisplay: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    alignItems: 'center',
    gap: 4,
  },
  dateValue: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.textPrimary },
  dateSub: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.primary },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnText: { fontFamily: FONTS.label, fontSize: 14, color: COLORS.textSecondary },
  commitBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 18, alignItems: 'center' },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: '#000' },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    gap: SPACING.md,
  },
  summaryTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.textPrimary },
  summarySection: { gap: 4 },
  summaryLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.primary, letterSpacing: 1.2 },
  summaryValue: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary },
  backBtn: { padding: SPACING.lg },
  backBtnText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary },
  skipBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  skipBtnText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textTertiary },
});
