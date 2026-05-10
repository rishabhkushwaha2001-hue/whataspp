import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { api } from '../services/api';

export const DashboardScreen = () => {
  const [stats, setStats] = useState({ total_members: 0, active: 0, due_soon: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/members/status/due?days_ahead=30');
      setStats({
        total_members: res.data.length,
        active: res.data.length,
        due_soon: res.data.length
      });
    } catch (error) {
      console.warn('Dashboard fetch failed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchStats} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Gym Dashboard</Text>
        <Text style={styles.subtitle}>Real-time stats from Render DB</Text>
      </View>

      <View style={styles.grid}>
        <GlassCard style={[styles.statCard, { borderLeftColor: colors.primary, borderLeftWidth: 4 }]}>
          <Text style={styles.statLabel}>Total Members</Text>
          <Text style={styles.statValue}>{stats.total_members}</Text>
        </GlassCard>
        
        <GlassCard style={[styles.statCard, { borderLeftColor: colors.error, borderLeftWidth: 4 }]}>
          <Text style={styles.statLabel}>Due Soon</Text>
          <Text style={styles.statValue}>{stats.due_soon}</Text>
        </GlassCard>
      </View>

      <Text style={styles.sectionTitle}>Recent Sync</Text>
      <GlassCard style={styles.activityCard}>
        <Text style={styles.emptyText}>{stats.total_members > 0 ? `${stats.total_members} members fetched successfully.` : 'No data found in database.'}</Text>
      </GlassCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingTop: 60 },
  header: { marginBottom: spacing.xl },
  greeting: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  grid: { flexDirection: 'row', gap: spacing.m, marginBottom: spacing.xl },
  statCard: { flex: 1, padding: spacing.m, alignItems: 'flex-start' },
  statLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  statValue: { color: colors.text, fontSize: 32, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.m },
  activityCard: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});
