import 'react-native-url-polyfill/auto';
import { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/theme';
import {
  setupNotificationHandlers,
  setupAndroidChannel,
  registerForPushNotifications,
  savePushToken,
  setupNotificationListeners,
} from '../lib/notifications';
import type { Session } from '@supabase/supabase-js';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  const checkOnboarding = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('focuses')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    return !!(data && data.length > 0);
  }, []);

  // Initialize push notifications when session exists
  const initNotifications = useCallback(async () => {
    setupNotificationHandlers();
    await setupAndroidChannel();
    const token = await registerForPushNotifications();
    if (token) await savePushToken(token);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        const onboarded = await checkOnboarding(session.user.id);
        setHasOnboarded(onboarded);
        initNotifications();
      }
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session) {
          const onboarded = await checkOnboarding(session.user.id);
          setHasOnboarded(onboarded);
          initNotifications();
        } else {
          setHasOnboarded(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [checkOnboarding, initNotifications]);

  useEffect(() => {
    if (!initialized || !fontsLoaded) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const inTabs = segments[0] === '(tabs)';
    const inAdmin = segments[0] === 'admin';
    const inFocusComplete = segments[0] === 'focus-complete';

    if (!session && !inAuth) {
      router.replace('/(auth)/login');
    } else if (session && !hasOnboarded && !inOnboarding && !inTabs && !inAdmin && !inFocusComplete) {
      router.replace('/onboarding');
    } else if (session && hasOnboarded && inAuth) {
      router.replace('/(tabs)');
    }
  }, [initialized, fontsLoaded, session, hasOnboarded, segments]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && initialized) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, initialized]);

  if (!fontsLoaded || !initialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="focus-complete" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
