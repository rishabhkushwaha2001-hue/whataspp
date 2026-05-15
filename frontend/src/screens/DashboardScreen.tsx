import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity, Linking, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
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

const FilterTab = ({ label, active, onPress }: any) => (
  <TouchableOpacity 
    onPress={onPress} 
    style={[styles.filterTab, active && styles.filterTabActive]}
  >
    <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export const DashboardScreen = () => {
  const [stats, setStats] = useState<any>(null);
  const [period, setPeriod] = useState<'month' | 'prev_month' | 'year' | 'all'>('month');
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [gymSettings, setGymSettings] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (currentPeriod = period) => {
    setRefreshing(true);
    try {
      const statsRes = await api.get(`/members/stats/dashboard?period=${currentPeriod}`);
      setStats(statsRes.data);
    } catch (error) {
      console.warn('Dashboard stats fetch failed', error);
    }

    try {
      const attendanceRes = await api.get('/members/attendance/today');
      setAttendance(attendanceRes.data);
    } catch (error) {
      console.warn('Attendance fetch failed');
    }

    try {
      const historyRes = await api.get('/messages/history?limit=4');
      setRecentMessages(historyRes.data);
    } catch (error) {
      console.warn('History fetch failed', error);
    }

    try {
      const settingsRes = await api.get('/settings/');
      setGymSettings(settingsRes.data);
    } catch (error) {
      console.warn('Settings fetch failed');
    }
    setRefreshing(false);
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const handlePeriodChange = (newPeriod: 'month' | 'prev_month' | 'year' | 'all') => {
    setPeriod(newPeriod);
    fetchDashboardData(newPeriod);
  };

  const renderProgress = (label: string, value: number, total: number, color: string, icon?: string) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
      <View style={styles.progressItem}>
        <View style={styles.progressLabels}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {icon && <FontAwesome name={icon as any} size={12} color={color} style={{ marginRight: 6 }} />}
            <Text style={styles.progressLabel}>{label}</Text>
          </View>
          <Text style={styles.progressValue}>{value}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  const handleReset = () => {
    setAlertConfig({
      visible: true,
      title: "⚠️ Reset Database",
      message: "Are you sure you want to DELETE ALL members, payments, and attendance records? This cannot be undone.",
      type: "warning",
      showCancel: true,
      confirmText: "YES, DELETE ALL",
      onConfirm: async () => {
        setAlertConfig({ visible: false });
        try {
          await api.post('members/admin/reset-database');
          setTimeout(() => {
            setAlertConfig({ visible: true, title: "Success", message: "Database has been cleared.", type: "success", showCancel: false, confirmText: "OK", onConfirm: undefined });
          }, 500);
          fetchDashboardData();
        } catch (error: any) {
          const errMsg = error.response?.data?.detail || error.message;
          setTimeout(() => {
            setAlertConfig({ visible: true, title: "Error", message: `Failed to reset database: ${errMsg}`, type: "error", showCancel: false, confirmText: "OK", onConfirm: undefined });
          }, 500);
        }
      }
    });
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchDashboardData()} tintColor={colors.primary} />}
    >
      <CustomAlert 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        showCancel={alertConfig.showCancel}
        confirmText={alertConfig.confirmText}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
        onConfirm={alertConfig.onConfirm}
      />
      <View style={styles.header}>
        <TouchableOpacity onLongPress={handleReset} delayLongPress={2000}>
          <Text style={styles.greeting}>{gymSettings?.gym_name || 'MBUDDY GYM'}</Text>
          <Text style={styles.subtitle}>{gymSettings?.address || 'Premium CRM Analytics'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileBtn}>
          <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.avatar}>
            <FontAwesome name="user" size={20} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <FilterTab label="This Month" active={period === 'month'} onPress={() => handlePeriodChange('month')} />
        <FilterTab label="Prev Month" active={period === 'prev_month'} onPress={() => handlePeriodChange('prev_month')} />
        <FilterTab label="Yearly" active={period === 'year'} onPress={() => handlePeriodChange('year')} />
        <FilterTab label="All Time" active={period === 'all'} onPress={() => handlePeriodChange('all')} />
      </View>

      <View style={styles.statsGrid}>
        <StatCard 
          title="Revenue" 
          value={`₹${stats?.monthly_revenue?.toLocaleString() || '0'}`} 
          icon="money" 
          color={colors.accent} 
          subtitle={period === 'month' ? "This month" : period === 'prev_month' ? "Last month" : period === 'year' ? "This year" : "Overall"}
        />
        <StatCard 
          title="Active Members" 
          value={stats?.active_members || '0'} 
          icon="users" 
          color={colors.primary} 
          subtitle={`${stats?.expired_members || 0} Expired`}
        />
        <StatCard 
          title="Expiring Soon" 
          value={stats?.expiring_soon || '0'} 
          icon="hourglass-end" 
          color={colors.warning} 
          subtitle="Next 7 days"
        />
        <StatCard 
          title="Today's Collection" 
          value={`₹${stats?.todays_collections?.toLocaleString() || '0'}`} 
          icon="calendar-check-o" 
          color={colors.secondary} 
          subtitle="Real-time update"
        />
      </View>

      <Text style={styles.sectionTitle}>Registration Categories</Text>
      <GlassCard style={styles.analyticsCard}>
        {renderProgress('New Enrollments', stats?.new_members_count || 0, stats?.total_members || 1, colors.secondary, 'plus-circle')}
        {renderProgress('Renewals', stats?.renewal_members_count || 0, stats?.total_members || 1, colors.primary, 'refresh')}
        {renderProgress('Manual (No WhatsApp)', stats?.manual_members_count || 0, stats?.total_members || 1, colors.textMuted, 'user-secret')}
      </GlassCard>

      <Text style={styles.sectionTitle}>Today's Attendance</Text>
      <GlassCard style={styles.activityCard}>
        {attendance.length === 0 ? (
          <Text style={styles.emptyText}>No check-ins yet today.</Text>
        ) : (
          attendance.map((log, index) => (
            <View key={log.id || index} style={styles.logItem}>
              <View style={[styles.logIcon, { backgroundColor: `${colors.accent}20` }]}>
                <FontAwesome name="check" size={14} color={colors.accent} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.logPhone}>{log.member_name}</Text>
                <Text style={styles.logText}>Checked in at {new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>
          ))
        )}
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent WhatsApp Logs</Text>
      </View>

      <GlassCard style={styles.activityCard}>
        {recentMessages.length === 0 ? (
          <Text style={styles.emptyText}>No recent messages found.</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  greeting: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
  profileBtn: { ...shadows.premium },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  filterContainer: { flexDirection: 'row', backgroundColor: colors.surface, padding: 4, borderRadius: borderRadius.m, marginBottom: spacing.xl },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.s },
  filterTabActive: { backgroundColor: colors.surfaceLight },
  filterTabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: colors.text },
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
  analyticsCard: { padding: spacing.l, marginBottom: spacing.xl },
  progressItem: { marginBottom: spacing.m },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  progressLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  progressValue: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
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
