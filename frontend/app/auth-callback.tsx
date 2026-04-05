import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    async function handleCallback() {
      try {
        // Case 1: PKCE flow — code arrives as a query param
        if (params.code) {
          await supabase.auth.exchangeCodeForSession(String(params.code));
          router.replace('/(auth)/login');
          return;
        }

        // Case 2: Implicit flow — tokens are in the URL hash fragment
        // Expo Router doesn't expose hash params, so parse the raw URL
        const url = await Linking.getInitialURL();
        if (url) {
          const hashIndex = url.indexOf('#');
          if (hashIndex !== -1) {
            const hash = url.slice(hashIndex + 1);
            const urlParams = new URLSearchParams(hash);
            const access_token = urlParams.get('access_token');
            const refresh_token = urlParams.get('refresh_token');
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
        }
      } catch (err) {
        console.warn('Auth callback error:', err);
      }

      router.replace('/(auth)/login');
    }

    handleCallback();
  }, [params.code]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
});
