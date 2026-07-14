import { Stack } from 'expo-router';
import { ThemeProvider } from '../src/theme/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="super-admin" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="members/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="revenue" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

