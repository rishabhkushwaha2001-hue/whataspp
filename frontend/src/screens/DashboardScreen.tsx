import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity, Linking, Alert, Modal, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { sendWhatsAppMessage } from '../services/whatsapp';

const { width } = Dimensions.get('window');

export const DashboardScreen = () => {
  const { theme, colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();

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
  const [stats, setStats] = useState<any>(null);
  const [period, setPeriod] = useState<'month' | 'prev_month' | 'year' | 'all'>('month');
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [gymSettings, setGymSettings] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [hideRevenue, setHideRevenue] = useState(false);
  const [revealedOnce, setRevealedOnce] = useState(false);

  const fetchDashboardData = useCallback(async (currentPeriod = period) => {
    setRefreshing(true);
    try {
      const [statsRes, attendanceRes, historyRes, settingsRes] = await Promise.all([
        api.get(`/members/stats/dashboard?period=${currentPeriod}`).catch(e => { console.warn('Stats fetch failed', e); return null; }),
        api.get('/members/attendance/today').catch(e => { console.warn('Attendance fetch failed', e); return null; }),
        api.get('/messages/history?limit=4').catch(e => { console.warn('History fetch failed', e); return null; }),
        api.get('/settings/').catch(e => { console.warn('Settings fetch failed', e); return null; })
      ]);
      
      if (statsRes) setStats(statsRes.data);
      if (attendanceRes) setAttendance(attendanceRes.data);
      if (historyRes) setRecentMessages(historyRes.data);
      if (settingsRes) setGymSettings(settingsRes.data);
    } catch (error) {
      console.warn('Dashboard parallel fetch error', error);
    } finally {
      setRefreshing(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
      // Reload revenue visibility preference each time screen is focused
      AsyncStorage.getItem('hideRevenue').then(val => {
        setHideRevenue(val === 'true');
        setRevealedOnce(false); // reset reveal on each focus
      });
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
  const [cachedGymName, setCachedGymName] = useState<string>('Gym Dashboard');
  const [cachedAddress, setCachedAddress] = useState<string>('Premium CRM Analytics');

  useFocusEffect(
    useCallback(() => {
      const loadCachedInfo = async () => {
        try {
          const name = await AsyncStorage.getItem('gymName');
          const address = await AsyncStorage.getItem('gymAddress'); 
          if (name) setCachedGymName(name);
          if (address) setCachedAddress(address);
        } catch (e) {
          console.log('Failed to read storage cache on dashboard');
        }
      };
      loadCachedInfo();
    }, [])
  );

  const handleReset = () => {
    setAlertConfig({
      visible: true,
      title: "⚠️ Danger Zone",
      message: "Are you sure you want to DELETE ALL members, payments, and attendance records? This cannot be undone.",
      type: "error",
      showCancel: true,
      cancelText: "Cancel (Safe)",
      confirmText: "YES, WIPE ALL DATA",
      onConfirm: async () => {
        setAlertConfig({ visible: false });
        setTimeout(() => {
          setAlertConfig({
            visible: true,
            title: "⚠️ FINAL WARNING",
            message: "Last chance! This will delete ALL your members and payment history permanently. Are you 100% sure?",
            type: "error",
            showCancel: true,
            cancelText: "NO, Go Back",
            confirmText: "DELETE EVERYTHING",
            onConfirm: async () => {
              setAlertConfig({ visible: false });
              try {
                await api.post('/members/admin/reset-database');
                setTimeout(() => {
                  setAlertConfig({ visible: true, title: "Cleared", message: "Database has been cleared.", type: "success", showCancel: false, confirmText: "OK", onConfirm: undefined });
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
        }, 300);
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
        <TouchableOpacity 
          onLongPress={handleReset} 
          delayLongPress={5000}
          onPress={() => router.push('/profile')}
          style={{ flex: 1, marginRight: spacing.m }}
        >
          <Text style={styles.greeting}>
            {gymSettings?.gym_name || cachedGymName}
          </Text>
          <Text style={styles.subtitle}>
            {gymSettings?.address || cachedAddress}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
          {gymSettings?.logo_url ? (
            <Image 
              source={{ uri: gymSettings.logo_url }} 
              style={styles.logoImage} 
            />
          ) : (
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(gymSettings?.gym_name || cachedGymName).substring(0, 1).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <FilterTab label="This Month" active={period === 'month'} onPress={() => handlePeriodChange('month')} />
        <FilterTab label="Last Month" active={period === 'prev_month'} onPress={() => handlePeriodChange('prev_month')} />
        <FilterTab label="This Year" active={period === 'year'} onPress={() => handlePeriodChange('year')} />
        <FilterTab label="All Time" active={period === 'all'} onPress={() => handlePeriodChange('all')} />
      </View>

      <View style={styles.statsGrid}>
        {/* Revenue Card — tap to reveal when hidden */}
        <TouchableOpacity
          activeOpacity={hideRevenue ? 0.7 : 1}
          onPress={() => { if (hideRevenue) setRevealedOnce(r => !r); }}
          style={{ width: (width - spacing.l * 2 - spacing.m) / 2 }}
        >
          <GlassCard style={[styles.statCard, hideRevenue && !revealedOnce && { borderColor: `${colors.warning}30`, borderWidth: 1 }] as any}>
            <View style={styles.statHeader}>
              <View style={[styles.iconContainer, { backgroundColor: `${colors.success}20` }]}>
                <FontAwesome name={hideRevenue && !revealedOnce ? 'lock' : 'money'} size={18} color={colors.success} />
              </View>
              {hideRevenue && (
                <FontAwesome
                  name={revealedOnce ? 'eye' : 'eye-slash'}
                  size={13}
                  color={colors.textMuted}
                />
              )}
            </View>
            <Text style={styles.statValue}>
              {hideRevenue && !revealedOnce
                ? '₹ ****'
                : stats?.monthly_revenue ? `₹${stats.monthly_revenue}` : '₹0'}
            </Text>
            <Text style={styles.statTitle}>Revenue</Text>
            <Text style={styles.statSubtitle}>
              {hideRevenue && !revealedOnce ? 'Tap to reveal' : 'Gross Income'}
            </Text>
          </GlassCard>
        </TouchableOpacity>

        <StatCard 
          title="Active Plans" 
          value={stats?.active_members ?? '...'} 
          icon="check-circle" 
          color={colors.primary} 
          subtitle="Current members"
        />
      </View>

      <Text style={styles.sectionTitle}>Overview Breakdown</Text>
      <GlassCard style={styles.analyticsCard}>
        {renderProgress(
          "Active Subscription Rate", 
          stats?.active_members ?? 0, 
          stats?.total_members ?? 0, 
          colors.success, 
          "check"
        )}
        {renderProgress(
          "Expired Subscriptions", 
          stats?.expired_members ?? 0, 
          stats?.total_members ?? 0, 
          colors.error, 
          "exclamation"
        )}
        {renderProgress(
          "Today's Gym Attendance", 
          attendance?.length ?? 0, 
          stats?.active_members ?? 0, 
          colors.primary, 
          "user"
        )}
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent WhatsApp Logs</Text>
      </View>

      <GlassCard style={styles.activityCard}>
        {recentMessages.length === 0 ? (
          <Text style={styles.emptyText}>No recent reminders logged.</Text>
        ) : (
          recentMessages.map((msg) => (
            <TouchableOpacity 
              key={msg._id} 
              onPress={() => { setSelectedMessage(msg); setShowMessageModal(true); }}
              style={styles.logItem}
            >
              <View style={[styles.logIcon, { backgroundColor: msg.status === 'sent' ? `${colors.success}15` : `${colors.error}15` }]}>
                <FontAwesome name={msg.status === 'sent' ? "whatsapp" : "exclamation-triangle"} size={16} color={msg.status === 'sent' ? colors.success : colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.logPhone}>{msg.recipient_phone}</Text>
                  <Text style={styles.logTime}>{new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <Text style={styles.logText} numberOfLines={1}>{msg.message_body}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </GlassCard>

      <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
        <Text style={styles.sectionTitle}>Today's Check-ins</Text>
      </View>
      <GlassCard style={styles.activityCard}>
        {attendance.length === 0 ? (
          <Text style={styles.emptyText}>No one has checked in today.</Text>
        ) : (
          attendance.map((att, idx) => (
            <View key={idx} style={styles.logItem}>
              <View style={[styles.logIcon, { backgroundColor: `${colors.primary}15` }]}>
                <FontAwesome name="check-circle" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.logPhone}>{att.member_name || att.member_id}</Text>
                  <Text style={styles.logTime}>{new Date(att.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                {att.member_phone && <Text style={styles.logText}>{att.member_phone}</Text>}
              </View>
            </View>
          ))
        )}
      </GlassCard>

      <Modal
        visible={showMessageModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Message Log Details</Text>
              <TouchableOpacity onPress={() => setShowMessageModal(false)} style={styles.modalCloseBtn}>
                <FontAwesome name="times" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedMessage && (
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Recipient:</Text>
                  <Text style={styles.modalDetailValue}>{selectedMessage.recipient_phone}</Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Status:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: selectedMessage.status === 'sent' ? `${colors.success}20` : `${colors.error}20` }]}>
                    <Text style={[styles.statusText, { color: selectedMessage.status === 'sent' ? colors.success : colors.error }]}>
                      {selectedMessage.status?.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Sent Time:</Text>
                  <Text style={styles.modalDetailValue}>
                    {selectedMessage.sent_at ? new Date(selectedMessage.sent_at).toLocaleString() : 'N/A'}
                  </Text>
                </View>
                
                <Text style={[styles.modalDetailLabel, { marginTop: spacing.m, marginBottom: 8 }]}>Message Body:</Text>
                <View style={styles.messageBodyBox}>
                  <Text style={styles.messageBodyText}>{selectedMessage.message_body}</Text>
                </View>

                <TouchableOpacity 
                  style={styles.resendBtn}
                  onPress={async () => {
                    setShowMessageModal(false);
                    await sendWhatsAppMessage(selectedMessage.recipient_phone, selectedMessage.message_body);
                  }}
                >
                  <FontAwesome name="whatsapp" size={18} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.resendBtnText}>Open Chat & Resend</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  greeting: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, fontWeight: '500' },
  profileBtn: { ...shadows.premium },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border },
  logoImage: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.border },
  avatarText: { color: 'white', fontSize: 20, fontWeight: '800' },
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
  progressBarBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  activityCard: { padding: spacing.m },
  logItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  logIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  logPhone: { color: colors.text, fontSize: 14, fontWeight: '600' },
  logText: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  logTime: { color: colors.textMuted, fontSize: 11 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', padding: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.m,
  },
  modalContent: {
    backgroundColor: colors.surface,
    padding: spacing.l,
    borderRadius: borderRadius.l,
    width: '90%',
    maxHeight: 500,
    ...shadows.premium,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.s,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    marginVertical: spacing.s,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalDetailLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  modalDetailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  messageBodyBox: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.s,
  },
  messageBodyText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  resendBtn: {
    flexDirection: 'row',
    backgroundColor: colors.success,
    paddingVertical: 14,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.l,
    marginBottom: spacing.m,
  },
  resendBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
});
