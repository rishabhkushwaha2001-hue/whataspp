import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../src/theme/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const gymId = await AsyncStorage.getItem('gymId');
        const role = await AsyncStorage.getItem('role');

        if (!gymId) {
          router.replace('/login');
        } else if (role === 'super_admin') {
          router.replace('/super-admin');
        } else {
          // Student portal is hidden for now — all roles use admin tabs
          // TODO: restore this when student portal is ready:
          // } else if (role === 'student') {
          //   router.replace('/(student_tabs)/dashboard' as any);
          router.replace('/(tabs)');
        }
      } catch (e) {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Connecting to database...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

