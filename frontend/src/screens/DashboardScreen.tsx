import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';

export const DashboardScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Gym Dashboard</Text>
      <View style={styles.grid}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statLabel}>Total Members</Text>
          <Text style={styles.statValue}>0</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statLabel}>Expiring Soon</Text>
          <Text style={styles.statValue}>0</Text>
        </GlassCard>
      </View>
      <Text style={[styles.title, { marginTop: 30 }]}>Recent Activity</Text>
      <GlassCard style={{ padding: 20 }}>
        <Text style={{ color: colors.textSecondary }}>No recent activity to show.</Text>
      </GlassCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 20 },
  grid: { flexDirection: 'row', gap: 15 },
  statCard: { flex: 1, padding: 15, alignItems: 'center' },
  statLabel: { color: colors.textSecondary, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 28, fontWeight: 'bold' },
});
