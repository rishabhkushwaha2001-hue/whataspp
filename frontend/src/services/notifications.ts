import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

// Configure how notifications are displayed when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests push notification permissions and retrieves the Expo Push Token.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('Push notifications are not supported on web.');
    return null;
  }

  if (!Device.isDevice) {
    console.log('Must use a physical device for Push Notifications.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Notification permissions were not granted.');
      return null;
    }

    // Replace with your actual Expo projectId from app.json / EAS config if needed
    // EAS Project ID: 8b080331-6de2-493f-b127-966283f16220
    const projectId = '8b080331-6de2-493f-b127-966283f16220';
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Registers the device push token with the backend database for the logged-in student/member.
 */
export async function syncPushTokenWithBackend(): Promise<boolean> {
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return false;

    // Retrieve active session details
    const role = await AsyncStorage.getItem('role');
    const memberId = await AsyncStorage.getItem('memberId');

    if (role === 'student' && memberId) {
      // Send token to student/member collection endpoint
      await api.post(`/members/${memberId}/push-token`, { push_token: token });
      console.log('Successfully registered student push token with backend.');
      return true;
    } else {
      console.log('No active student session found to link push token.');
    }
  } catch (error) {
    console.error('Failed to sync push token with backend:', error);
  }
  return false;
}
