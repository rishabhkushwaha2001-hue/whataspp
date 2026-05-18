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
        const isAdmin = await AsyncStorage.getItem('isAdmin');

        if (!gymId) {
          router.replace('/login');
        } else if (isAdmin === 'true') {
          router.replace('/super-admin');
        } else {
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

