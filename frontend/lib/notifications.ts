import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert, Linking } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications appear when app is in foreground
export function setupNotificationHandlers() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Setup Android notification channel
export async function setupAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('checkin_reminders', {
      name: 'Check-in Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }
}

// Request notification permissions and get push token
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  // Only works on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check and request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Get Expo push token
  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    return tokenData.data;
  } catch (error) {
    console.warn('Could not get push token:', error);
    return null;
  }
}

// Save or clear push token in Supabase profiles
export async function savePushToken(token: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', user.id);

  if (error) console.error('Error updating push token:', error);
}

// Full registration flow: request permission + save token
export async function enablePushNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  await setupAndroidChannel();
  const token = await registerForPushNotifications();

  if (!token) {
    // If permission denied, guide user to settings
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'denied') {
      Alert.alert(
        'Notifications Blocked',
        'To receive daily reminders, enable notifications in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
    return false;
  }

  await savePushToken(token);
  return true;
}

// Disable push notifications (clear token)
export async function disablePushNotifications(): Promise<void> {
  await savePushToken(null);
}

// Setup notification tap listener (navigate to home/checkin on tap)
export function setupNotificationListeners(onTap?: () => void) {
  if (Platform.OS === 'web') return () => {};

  const tapSub = Notifications.addNotificationResponseReceivedListener(() => {
    onTap?.();
  });

  return () => tapSub.remove();
}
