import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, shadows } from '../../src/theme/theme';
import { GlassCard } from '../../src/components/GlassCard';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function StudentProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  
  useEffect(() => {
    AsyncStorage.getItem('memberName').then(n => {
      if(n) setName(n);
    });
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>Profile</Text>
      
      <GlassCard style={styles.card}>
        <View style={styles.avatar}>
          <FontAwesome name="user" size={40} color="#fff" />
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
        <Text style={[styles.role, { color: colors.textSecondary }]}>Student</Text>
      </GlassCard>

      <TouchableOpacity style={styles.actionBtn} onPress={handleLogout}>
        <View style={[styles.iconBox, { backgroundColor: '#fee2e2' }]}>
          <FontAwesome name="sign-out" size={20} color="#ef4444" />
        </View>
        <Text style={[styles.actionText, { color: '#ef4444' }]}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.l, paddingTop: 60 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: spacing.l },
  card: { alignItems: 'center', padding: spacing.xl, marginBottom: spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  name: { fontSize: 22, fontWeight: 'bold' },
  role: { fontSize: 14, marginTop: 5 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: spacing.m, backgroundColor: '#fff', borderRadius: borderRadius.m, ...shadows.premium },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  actionText: { fontSize: 16, fontWeight: 'bold' }
});
