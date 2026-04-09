import 'react-native-url-polyfill/auto';
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Per-user AsyncStorage key for caching the onboarding flag.
// Once a user has a focus they have onboarded — this never goes back to false.
// Caching this means zero network/DB work on every cold start after the first.
const onboardedKey = (uid: string) => `@noshift_onboarded_${uid}`;

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
  // If fonts fail to load fall back to system fonts — never block on this.
  const fontsReady = fontsLoaded || !!fontError;

  // Checks onboarding status. Reads from AsyncStorage cache first so repeat
  // cold starts need zero network calls. On cache miss queries the DB once
  // and writes the result back so future starts are instant.
  const checkOnboarding = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const cached = await AsyncStorage.getItem(onboardedKey(userId));
      if (cached === 'true') return true;
    } catch (_) {}

    // Cache miss — query Supabase with a 5 s timeout
    const timeout = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 5000));
    const query = supabase
      .from('focuses')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .then(({ data }) => {
        const result = !!(data && data.length > 0);
        if (result) {
          // Write to cache so this DB call never happens again
          AsyncStorage.setItem(onboardedKey(userId), 'true').catch(() => {});
        }
        return result;
      });
    return Promise.race([query, timeout]);
  }, []);

  const initNotifications = useCallback(async () => {
    if (notificationsInitialized.current) return;
    notificationsInitialized.current = true;
    setupNotificationHandlers();
    await setupAndroidChannel();
    const token = await registerForPushNotifications();
    if (token) await savePushToken(token);
  }, []);

  useEffect(() => {
    // Absolute last-resort escape hatch. Fires at 5 s if initialize() itself
    // somehow hangs (e.g. Promise.race internals stall on old Android WebView).
    const hardTimeout = setTimeout(() => {
      console.warn('[noshift] hard timeout — forcing past loading screen');
      setInitialized(true);
      setCheckingOnboarding(false);
    }, 5000);

    async function initialize() {
      try {
        // Race getSession against a 4 s wall-clock timeout.
        // When the app is killed and reopened on Android, the Supabase SDK may
        // need to refresh an expired token via HTTP. If the network isn't ready
        // yet that call can hang indefinitely. We cap it at 4 s — if it times
        // out we fall through as "no session" so the user sees the login screen
        // rather than being stuck forever. They log in once and the new token
        // is cached; subsequent opens are fast because the token is fresh.
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>(resolve =>
            setTimeout(() => resolve({ data: { session: null } }), 4000)
          ),
        ]);

        const sess = result.data.session;
        setSession(sess);

        if (sess) {
          // checkOnboarding is now instant on repeat starts thanks to the cache.
          const onboarded = await checkOnboarding(sess.user.id);
          setHasOnboarded(onboarded);
          initNotifications();
        }
      } catch (e) {
        console.warn('[noshift] initialize error:', e);
      } finally {
        clearTimeout(hardTimeout);
        setInitialized(true);
        setCheckingOnboarding(false);
      }
    }

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // INITIAL_SESSION fires on every cold start and is already handled by
        // initialize() above. TOKEN_REFRESHED is a background credential rotation.
        // Neither requires re-checking onboarding — just sync the session object.
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          setSession(session);
          return;
        }

        // SIGNED_IN: user just logged in — check onboarding (writes cache on success)
        // SIGNED_OUT: user logged out — clear state
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

    if (!session) {
      if (!inAuth) router.replace('/(auth)/login');
    } else if (!hasOnboarded) {
      if (!inOnboarding) router.replace('/onboarding');
    } else {
      // Logged in + onboarded — go to tabs unless already there or in an overlay screen
      if (!inTabs && !inAdmin && !inFocusComplete && !inOnboarding) router.replace('/(tabs)');
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
