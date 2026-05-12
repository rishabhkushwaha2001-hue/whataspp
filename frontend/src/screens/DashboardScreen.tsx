import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { width } = Dimensions.get('window');

const StatCard = ({ title, value, icon, color, subtitle, trend }: any) => (
  <GlassCard style={styles.statCard}>
    <View style={styles.statHeader}>
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <FontAwesome name={icon} size={18} color={color} />
      </View>
      {trend && (
        <View style={styles.trendContainer}>
          <FontAwesome name="caret-up" size={12} color={colors.success} />
          <Text style={styles.trendText}>{trend}%</Text>
        </View>
      )}
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statSubtitle}>{subtitle}</Text>
  </GlassCard>
);

export const DashboardScreen = () => {
  const [stats, setStats] = useState<any>(null);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setRefreshing(true);
    
    // Fetch Stats
    try {
      const statsRes = await api.get('/members/stats/dashboard');
      setStats(statsRes.data);
    } catch (error) {
      console.warn('Dashboard stats fetch failed', error);
    }

    // Fetch History separately so it doesn't block stats if it fails
    try {
      const historyRes = await api.get('/messages/history?limit=8');
      setRecentMessages(historyRes.data);
    } catch (error) {
      console.warn('Dashboard history fetch failed', error);
      // History might fail if not deployed yet, but we want stats to show
    }

    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const renderProgress = (label: string, value: number, total: number, color: string) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
      <View style={styles.progressItem}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>{label}</Text>
          <Text style={styles.progressValue}>{value} / {total}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDashboardData} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Fitness Hub</Text>
          <Text style={styles.subtitle}>Premium Admin Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            style={styles.avatar}
          >
            <FontAwesome name="user" size={20} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <StatCard 
          title="Total Members" 
          value={stats?.total_members || '0'} 
          icon="users" 
          color={colors.primary} 
          subtitle="Overall growth"
          trend="12"
        />
        <StatCard 
          title="Monthly Revenue" 
          value={`Rs. ${stats?.monthly_revenue?.toFixed(0) || '0'}`} 
          icon="money" 
          color={colors.accent} 
          subtitle="Total collections"
          trend="8"
        />
        <StatCard 
          title="Expiring Soon" 
          value={stats?.expiring_soon || '0'} 
          icon="clock-o" 
          color={colors.warning} 
          subtitle="Next 7 days"
        />
        <StatCard 
          title="Pending" 
          value={stats?.pending_payments || '0'} 
          icon="exclamation-circle" 
          color={colors.error} 
          subtitle="Action required"
        />
      </View>

      <Text style={styles.sectionTitle}>Membership Analytics</Text>
      <GlassCard style={styles.analyticsCard}>
        {renderProgress('Active Status', stats?.active_members || 0, stats?.total_members || 1, colors.accent)}
        {renderProgress('New Joinings (Month)', stats?.new_members_this_month || 0, 20, colors.secondary)}
        {renderProgress('Retention Rate', 85, 100, colors.primary)}
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <TouchableOpacity onPress={fetchDashboardData}>
          <Text style={styles.seeAll}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <GlassCard style={styles.activityCard}>
        {recentMessages.length === 0 ? (
          <Text style={styles.emptyText}>No recent activity found.</Text>
        ) : (
          recentMessages.map((msg, index) => (
            <View key={msg.id || index} style={styles.logItem}>
              <View style={[styles.logIcon, { backgroundColor: msg.status === 'sent' ? `${colors.success}20` : `${colors.error}20` }]}>
                <FontAwesome 
                  name={msg.status === 'sent' ? "whatsapp" : "exclamation"} 
                  size={14} 
                  color={msg.status === 'sent' ? colors.success : colors.error} 
                />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.logPhone}>{msg.recipient_phone}</Text>
                <Text style={styles.logText} numberOfLines={1}>{msg.message_body}</Text>
              </View>
              <Text style={styles.logTime}>
                {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))
        )}
      </GlassCard>
      
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingTop: 60 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.xl 
  },
  greeting: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
  profileBtn: { ...shadows.premium },
  avatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m, marginBottom: spacing.xl },
  statCard: { width: (width - spacing.l * 2 - spacing.m) / 2, padding: spacing.m },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s },
  iconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 2 },
  statTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  statSubtitle: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  trendContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${colors.success}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  trendText: { color: colors.success, fontSize: 10, fontWeight: '700', marginLeft: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.m },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.m },
  seeAll: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  analyticsCard: { padding: spacing.l, marginBottom: spacing.xl },
  progressItem: { marginBottom: spacing.m },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  progressValue: { color: colors.textSecondary, fontSize: 12 },
  progressBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  activityCard: { padding: spacing.m },
  logItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  logIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  logPhone: { color: colors.text, fontSize: 14, fontWeight: '600' },
  logText: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  logTime: { color: colors.textMuted, fontSize: 11 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', padding: 20 },
});
