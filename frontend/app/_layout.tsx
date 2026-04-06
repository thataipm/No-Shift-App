import 'react-native-url-polyfill/auto';
import { useEffect, useState, useCallback, useRef } from 'react';
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
} from '../lib/notifications';
import type { Session } from '@supabase/supabase-js';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const notificationsInitialized = useRef(false);

  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  // Treat a font error the same as loaded — fall back to system fonts rather
  // than blocking the app on the loading screen permanently.
  const fontsReady = fontsLoaded || !!fontError;

  const checkOnboarding = useCallback(async (userId: string) => {
    // Race the DB call against a 5-second timeout so a slow/unavailable network
    // on app resume never leaves the app permanently stuck on the loading screen.
    const timeout = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 5000)
    );
    const query = supabase
      .from('focuses')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .then(({ data }) => !!(data && data.length > 0));
    return Promise.race([query, timeout]);
  }, []);

  // Initialize push notifications once per app session.
  // Guard with a ref so calling this from both getSession and onAuthStateChange
  // paths doesn't result in a duplicate token fetch + DB write on cold start.
  const initNotifications = useCallback(async () => {
    if (notificationsInitialized.current) return;
    notificationsInitialized.current = true;
    setupNotificationHandlers();
    await setupAndroidChannel();
    const token = await registerForPushNotifications();
    if (token) await savePushToken(token);
  }, []);

  useEffect(() => {
    // Hard escape hatch: if nothing else resolves initialization within 10 s
    // (e.g. AsyncStorage hangs, Supabase SDK never fires), force the app past
    // the loading screen so it is never permanently stuck.
    const hardTimeout = setTimeout(() => {
      console.warn('[noshift] initialization timeout — forcing past loading screen');
      setInitialized(true);
      setCheckingOnboarding(false);
    }, 10000);

    // getSession: initial check on mount.
    // .catch() handles the case where getSession() itself rejects (e.g. AsyncStorage
    // corruption on Android). try/finally inside .then() handles errors thrown
    // by checkOnboarding(). Both paths guarantee setInitialized(true) is called.
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        try {
          setSession(session);
          if (session) {
            setCheckingOnboarding(true);
            const onboarded = await checkOnboarding(session.user.id);
            setHasOnboarded(onboarded);
            initNotifications();
          }
        } catch (e) {
          console.warn('[noshift] getSession init error:', e);
        } finally {
          clearTimeout(hardTimeout);
          setInitialized(true);
          setCheckingOnboarding(false);
        }
      })
      .catch((e) => {
        console.warn('[noshift] getSession failed:', e);
        clearTimeout(hardTimeout);
        setInitialized(true);
        setCheckingOnboarding(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Same guard: if checkOnboarding() throws (e.g. on token-refresh event
        // fired after app resumes with a slow network), setCheckingOnboarding(false)
        // must still be called — otherwise the routing effect is permanently blocked.
        try {
          setSession(session);
          if (session) {
            setCheckingOnboarding(true);
            const onboarded = await checkOnboarding(session.user.id);
            setHasOnboarded(onboarded);
            initNotifications();
          } else {
            setHasOnboarded(false);
          }
        } catch (e) {
          console.warn('[noshift] onAuthStateChange error:', e);
        } finally {
          setCheckingOnboarding(false);
        }
      }
    );
    return () => {
      clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, [checkOnboarding, initNotifications]);

  useEffect(() => {
    if (!initialized || !fontsReady || checkingOnboarding) return;
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
  }, [initialized, fontsReady, checkingOnboarding, session, hasOnboarded, segments]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsReady && initialized) {
      await SplashScreen.hideAsync();
    }
  }, [fontsReady, initialized]);

  if (!fontsReady || !initialized) {
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
        <Stack.Screen name="auth-callback" />
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
