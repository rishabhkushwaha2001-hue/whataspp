// ⚠️ expo-notifications remote push notifications are NOT supported in Expo Go (SDK 53+).
// These functions are safe no-ops when running in Expo Go.
// To enable push notifications, build a development build using: npx expo run:android

/**
 * Stub: Returns null in Expo Go. Will work in a dev/production build.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  return null;
}

/**
 * Stub: Does nothing in Expo Go. Safe to call anywhere.
 */
export async function syncPushTokenWithBackend(): Promise<boolean> {
  return false;
}
