import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Switch, Modal, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Linking as RNLinking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase, Profile } from '../../lib/supabase';
import {
  enableLocalNotifications,
  disablePushNotifications,
  scheduleLocalReminder,
  cancelLocalReminder,
} from '../../lib/notifications';

import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

const REMINDER_TIME_KEY = '@noshift_reminder_time';
const NOTIF_PREF_KEY = '@noshift_notif_enabled';

function defaultReminderTime(): Date {
  const d = new Date();
  d.setHours(20, 0, 0, 0); // 8:00 PM
  return d;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const ADMIN_PIN = '2847';

export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [togglingNotif, setTogglingNotif] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date>(defaultReminderTime());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingTime, setPendingTime] = useState<Date>(defaultReminderTime());

  // Admin PIN flow
  const [longPressCount, setLongPressCount] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const longPressTimer = useRef<any>(null);

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(data);
    const stored = await AsyncStorage.getItem(NOTIF_PREF_KEY);
    setNotificationsEnabled(stored !== null ? stored === 'true' : !!(data?.push_token));
  }, []);

  // Load saved reminder time from storage
  useEffect(() => {
    AsyncStorage.getItem(REMINDER_TIME_KEY).then(stored => {
      if (stored) {
        const { hour, minute } = JSON.parse(stored);
        const d = new Date();
        d.setHours(hour, minute, 0, 0);
        setReminderTime(d);
        setPendingTime(d);
      }
    });
  }, []);

  const handleNotificationToggle = async (value: boolean) => {
    setTogglingNotif(true);
    if (value) {
      // enableLocalNotifications handles permission request + local scheduling.
      // Push token registration is a fire-and-forget side effect inside it —
      // so toggle success never depends on reaching Expo's push servers.
      const success = await enableLocalNotifications(
        reminderTime.getHours(),
        reminderTime.getMinutes(),
      );
      if (success) {
        await AsyncStorage.setItem(NOTIF_PREF_KEY, 'true');
      }
      setNotificationsEnabled(success);
    } else {
      await cancelLocalReminder();
      await disablePushNotifications();
      await AsyncStorage.setItem(NOTIF_PREF_KEY, 'false');
      setNotificationsEnabled(false);
    }
    setTogglingNotif(false);
  };

  const handleSaveReminderTime = async () => {
    setReminderTime(pendingTime);
    setShowTimePicker(false);
    const payload = { hour: pendingTime.getHours(), minute: pendingTime.getMinutes() };
    await AsyncStorage.setItem(REMINDER_TIME_KEY, JSON.stringify(payload));
    if (notificationsEnabled) {
      await scheduleLocalReminder(payload.hour, payload.minute);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchProfile().finally(() => setLoading(false));
  }, [fetchProfile]);

  const handleLogout = () => {
    Alert.alert('Sign out?', 'You will be returned to the login screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleVersionLongPress = () => {
    if (pinAttempts >= 3) return;
    setPin('');
    setShowPinModal(true);
  };

  const handlePinSubmit = () => {
    if (pin === ADMIN_PIN) {
      setShowPinModal(false);
      setPin('');
      setPinAttempts(0);
      router.push('/admin');
    } else {
      const newAttempts = pinAttempts + 1;
      setPinAttempts(newAttempts);
      if (newAttempts >= 3) { setShowPinModal(false); }
      setPin('');
    }
  };

  // Avatar initial from email
  const avatarLetter = profile?.email ? profile.email[0].toUpperCase() : '?';

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Profile block — avatar + email */}
        <View style={styles.profileBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileLabel}>SIGNED IN AS</Text>
            <Text style={styles.profileEmail} numberOfLines={1} testID="user-email-row">
              {profile?.email || '—'}
            </Text>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Daily Reminder</Text>
              <Text style={styles.rowHint}>Check-in nudge each day</Text>
            </View>
            <Switch
              testID="notification-toggle"
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              disabled={togglingNotif}
              trackColor={{ false: COLORS.surfaceHighest, true: COLORS.primaryMuted }}
              thumbColor={notificationsEnabled ? COLORS.primary : COLORS.textTertiary}
            />
          </View>
          {notificationsEnabled && (
            <>
              <View style={styles.rowDivider} />
              <TouchableOpacity
                testID="reminder-time-row"
                style={styles.row}
                onPress={() => { setPendingTime(reminderTime); setShowTimePicker(true); }}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Reminder Time</Text>
                  <Text style={styles.rowHint}>Tap to change</Text>
                </View>
                <Text style={styles.timeValue}>{formatTime(reminderTime)}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEGAL</Text>
          <TouchableOpacity
            testID="privacy-policy-row"
            style={styles.row}
            onPress={() => RNLinking.openURL('https://thataipm.github.io/No-Shift-App/privacy-policy.html')}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Text style={styles.rowHint}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity testID="logout-button" style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version — hidden admin trigger */}
        <TouchableOpacity
          testID="version-text"
          style={styles.version}
          onLongPress={handleVersionLongPress}
          delayLongPress={5000}
          activeOpacity={1}
        >
          <Text style={styles.versionText}>Noshift v{APP_VERSION}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <View style={styles.pinOverlay}>
          <View style={[styles.pinCard, { alignItems: 'stretch' }]} testID="reminder-time-modal">
            <Text style={styles.pinTitle}>Set Reminder Time</Text>
            <DateTimePicker
              testID="reminder-time-picker"
              value={pendingTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => { if (date) setPendingTime(date); }}
              style={Platform.OS === 'ios' ? { backgroundColor: COLORS.surface, borderRadius: 12 } : undefined}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveReminderTime} testID="reminder-time-save">
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTimePicker(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.pinOverlay}>
          <View style={styles.pinCard} testID="admin-pin-modal">
            <Text style={styles.pinTitle}>Enter PIN</Text>
            <TextInput
              testID="admin-pin-input"
              style={styles.pinInput}
              value={pin}
              onChangeText={t => { if (t.length <= 4) setPin(t); }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
            />
            <TouchableOpacity testID="admin-pin-submit" style={styles.primaryBtn} onPress={handlePinSubmit}>
              <Text style={styles.primaryBtnText}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="admin-pin-cancel" onPress={() => setShowPinModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: 60 },
  screenTitle: { fontFamily: FONTS.heading, fontSize: 36, color: COLORS.textPrimary, letterSpacing: -0.5 },

  // Profile block — no border, depth via bg
  profileBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.primary },
  profileInfo: { flex: 1, gap: 2 },
  profileLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, letterSpacing: 2, textTransform: 'uppercase' },
  profileEmail: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.textPrimary },

  // Section card — background shift only, no 1px borders
  section: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden' },
  sectionLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textTertiary, letterSpacing: 2, textTransform: 'uppercase', paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  rowDivider: { height: 1, backgroundColor: COLORS.borderSubtle, marginHorizontal: SPACING.md },
  rowLeft: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.textPrimary },
  rowHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textTertiary },
  timeValue: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.primary },

  // Sign out — soft destructive, not alarming red
  logoutBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,184,174,0.25)',
    borderRadius: RADIUS.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  logoutBtnText: { fontFamily: FONTS.label, fontSize: 14, color: COLORS.tertiaryContainer, letterSpacing: 1.5, textTransform: 'uppercase' },

  version: { paddingVertical: SPACING.sm, alignItems: 'center' },
  versionText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textTertiary },

  // PIN modal
  pinOverlay: { flex: 1, backgroundColor: COLORS.overlay, alignItems: 'center', justifyContent: 'center' },
  pinCard: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 280, gap: SPACING.md },
  pinTitle: { fontFamily: FONTS.heading, fontSize: 24, color: COLORS.textPrimary, textAlign: 'center' },
  pinInput: {
    backgroundColor: COLORS.surfaceHighest,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.bold,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 12,
  },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.onPrimary, letterSpacing: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  cancelBtnText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textTertiary },
});
