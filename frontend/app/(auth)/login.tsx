import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

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
            <Text style={styles.title}>Welcome back</Text>

            {!!error && (
              <View style={styles.errorBox} testID="login-error">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="login-email-input"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="login-password-input"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            <TouchableOpacity
              testID="login-submit-button"
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="login-signup-link"
              style={styles.secondaryBtn}
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text style={styles.secondaryBtnText}>Don't have an account? Sign up</Text>
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
  header: { alignItems: 'center', marginBottom: SPACING.xxl },
  logo: {
    fontFamily: FONTS.heading,
    fontSize: 40,
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  form: { gap: SPACING.md },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  errorBox: {
    backgroundColor: COLORS.dangerMuted,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  errorText: { fontFamily: FONTS.body, fontSize: 14, color: '#FF6B6B' },
  field: { gap: 6 },
  label: {
    fontFamily: FONTS.label,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
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
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: '#000' },
  secondaryBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  secondaryBtnText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary },
});
