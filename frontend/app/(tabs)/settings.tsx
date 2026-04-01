import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Switch, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { supabase, Profile } from '../../lib/supabase';
import {
  enablePushNotifications,
  disablePushNotifications,
} from '../../lib/notifications';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const ADMIN_PIN = '2847';

export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [togglingNotif, setTogglingNotif] = useState(false);

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
    // Derive notification state from push_token
    setNotificationsEnabled(!!(data?.push_token));
  }, []);

  const handleNotificationToggle = async (value: boolean) => {
    setTogglingNotif(true);
    if (value) {
      const success = await enablePushNotifications();
      setNotificationsEnabled(success);
    } else {
      await disablePushNotifications();
      setNotificationsEnabled(false);
    }
    setTogglingNotif(false);
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
      if (newAttempts >= 3) {
        setShowPinModal(false);
        setPin('');
      } else {
        setPin('');
      }
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.row} testID="user-email-row">
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{profile?.email || '—'}</Text>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Daily Reminder</Text>
            <Switch
              testID="notification-toggle"
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              disabled={togglingNotif}
              trackColor={{ false: COLORS.surfaceElevated, true: COLORS.primaryMuted }}
              thumbColor={notificationsEnabled ? COLORS.primary : COLORS.textTertiary}
            />
          </View>
          {notificationsEnabled && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Reminder Time</Text>
              <Text style={styles.rowValue}>8:00 PM UTC</Text>
            </View>
          )}
          <Text style={styles.sectionHint}>
            {notificationsEnabled
              ? 'You\'ll get a daily reminder at 8 PM UTC if you haven\'t checked in.'
              : 'Enable to get a daily check-in reminder.'}
          </Text>
        </View>

        {/* Danger zone */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT ACTIONS</Text>
          <TouchableOpacity testID="logout-button" style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Version (hidden admin trigger) */}
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
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 60 },
  screenTitle: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  section: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderSubtle },
  sectionLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.textTertiary, letterSpacing: 1.2, padding: SPACING.md, paddingBottom: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle },
  rowLabel: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textPrimary },
  rowValue: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary, flex: 1, textAlign: 'right' },
  sectionHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textTertiary, padding: SPACING.md, paddingTop: 0 },
  logoutBtn: { margin: SPACING.md, borderWidth: 1, borderColor: COLORS.danger, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center' },
  logoutBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.danger },
  version: { paddingVertical: SPACING.lg, alignItems: 'center' },
  versionText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textTertiary },
  pinOverlay: { flex: 1, backgroundColor: COLORS.overlay, alignItems: 'center', justifyContent: 'center' },
  pinCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl, width: 280, gap: SPACING.md, borderWidth: 1, borderColor: COLORS.borderSubtle },
  pinTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.textPrimary, textAlign: 'center' },
  pinInput: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, padding: SPACING.md, color: COLORS.textPrimary, fontFamily: FONTS.bold, fontSize: 24, textAlign: 'center', borderWidth: 1, borderColor: COLORS.borderSubtle, letterSpacing: 12 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: '#000' },
  cancelBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  cancelBtnText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textTertiary },
});
