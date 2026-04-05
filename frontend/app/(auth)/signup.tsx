import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !confirm.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    // Always use the production deep-link scheme so the confirmation email
    // redirects back into the app rather than localhost or an Expo Go URL.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: 'noshift://auth-callback' },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setEmailSent(true);
  };

  if (emailSent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.confirmContainer}>
          <Text style={styles.logo}>Noshift</Text>
          <Text style={styles.confirmIcon}>✦</Text>
          <Text style={styles.confirmHeading}>Check your email</Text>
          <Text style={styles.confirmBody}>
            {`We sent a confirmation link to ${email}.\nTap the link in that email, then come back here to sign in.`}
          </Text>
          <TouchableOpacity
            testID="signup-back-to-login"
            style={styles.primaryBtn}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.primaryBtnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>Noshift</Text>
            <Text style={styles.tagline}>Your ideas can wait. Your goal can't.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Commit to one goal. Start finishing.</Text>

            {!!error && (
              <View style={styles.errorBox} testID="signup-error">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="signup-email-input"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="signup-password-input"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min 6 characters"
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                testID="signup-confirm-input"
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat password"
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              testID="signup-submit-button"
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="signup-login-link"
              style={styles.secondaryBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryBtnText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flexGrow: 1, padding: SPACING.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  logo: { fontFamily: FONTS.heading, fontSize: 40, color: COLORS.primary, letterSpacing: -0.5 },
  tagline: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary, marginTop: 6, textAlign: 'center' },
  form: { gap: SPACING.md },
  title: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.textPrimary, marginBottom: 2 },
  subtitle: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  errorBox: { backgroundColor: COLORS.dangerMuted, borderRadius: RADIUS.sm, padding: SPACING.sm },
  errorText: { fontFamily: FONTS.body, fontSize: 14, color: '#FF6B6B' },
  field: { gap: 6 },
  label: { fontFamily: FONTS.label, fontSize: 12, color: COLORS.textSecondary, letterSpacing: 1.1, textTransform: 'uppercase' },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.body,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center', marginTop: SPACING.sm },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: '#000' },
  secondaryBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  secondaryBtnText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary },
  confirmContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  confirmIcon: { fontSize: 40, color: COLORS.primary },
  confirmHeading: { fontFamily: FONTS.heading, fontSize: 30, color: COLORS.textPrimary, textAlign: 'center' },
  confirmBody: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24 },
});
