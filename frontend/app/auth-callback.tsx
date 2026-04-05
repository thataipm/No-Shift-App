import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    // Supabase JS handles the token from the URL automatically via onAuthStateChange.
    // Just redirect to login after a brief moment to let the session settle.
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
});
