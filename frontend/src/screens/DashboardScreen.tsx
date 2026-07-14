import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity, Image, Modal, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { useCachedParallelFetch, invalidateCache } from '../hooks/useDataStore';
import Svg, { Path, Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');

const Sparkline = ({ color, trend }: { color: string, trend: 'up' | 'down' }) => {
  const pathData = trend === 'up' 
    ? "M0 25 Q 15 10, 30 20 T 60 5 L 80 0" 
    : "M0 5 Q 15 20, 30 10 T 60 25 L 80 30";
  return (
    <View style={{ height: 35, width: 70 }}>
      <Svg height="100%" width="100%" viewBox="0 0 80 35" preserveAspectRatio="none">
        <Path d={pathData} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    </View>
  );
};

const HeroChart = () => (
  <View style={{ height: 60, width: '100%', marginTop: 24, marginBottom: 8 }}>
    <Svg height="100%" width="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
      <Path
        d="M0 35 Q 15 35, 30 25 T 60 25 T 100 10 L 100 40 L 0 40 Z"
        fill="rgba(255,255,255,0.05)"
      />
      <Path
        d="M0 35 Q 15 35, 30 25 T 60 25 T 100 10"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
      />
      <Circle cx="100" cy="10" r="3" fill="#ffffff" />
      <Circle cx="100" cy="10" r="6" fill="rgba(255,255,255,0.3)" />
    </Svg>
  </View>
);

export const DashboardScreen = () => {
  const { theme, colors } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(colors, isDark);
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [period, setPeriod] = useState<'month' | 'prev_month' | 'year' | 'all'>('month');
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [gymSettings, setGymSettings] = useState<any>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [hideRevenue, setHideRevenue] = useState(false);
  const [revealedOnce, setRevealedOnce] = useState(false);

  const { results, refreshing, refresh: refreshDashboard } = useCachedParallelFetch([
    { key: `dashboard_${period}`, endpoint: `/members/stats/dashboard?period=${period}` },
    { key: 'dashboard_attendance', endpoint: '/members/attendance/today' },
    { key: 'dashboard_messages', endpoint: '/messages/history?limit=4' },
    { key: 'dashboard_settings', endpoint: '/settings/' },
  ]);

  useEffect(() => {
    if (results[`dashboard_${period}`]) setStats(results[`dashboard_${period}`]);
    if (results['dashboard_attendance']) setAttendance(results['dashboard_attendance']);
    if (results['dashboard_messages']) setRecentMessages(results['dashboard_messages']);
    if (results['dashboard_settings']) setGymSettings(results['dashboard_settings']);
  }, [results, period]);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('hideRevenue').then(val => {
        setHideRevenue(val === 'true');
        setRevealedOnce(false);
      });
    }, [])
  );

  const handlePeriodChange = (newPeriod: 'month' | 'prev_month' | 'year' | 'all') => {
    invalidateCache(`dashboard_${newPeriod}`);
    setPeriod(newPeriod);
  };

  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [cachedGymName, setCachedGymName] = useState<string>('FitZone Gym');
  const [cachedAddress, setCachedAddress] = useState<string>('Premium CRM Analytics');
  
  useFocusEffect(
    useCallback(() => {
      const loadCachedInfo = async () => {
        try {
          const name = await AsyncStorage.getItem('gymName');
          const address = await AsyncStorage.getItem('gymAddress'); 
          if (name) setCachedGymName(name);
          if (address) setCachedAddress(address);
        } catch (e) {}
      };
      loadCachedInfo();
    }, [])
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const FilterTab = ({ label, active, onPress }: any) => (
    <TouchableOpacity 
      onPress={onPress} 
      style={[styles.filterTab, active && styles.filterTabActive]}
    >
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const KPICard = ({ title, value, icon, color, trend, trendVal, comparison }: any) => {
    const isUp = trend === 'up';
    const trendColor = isUp ? colors.success : colors.error;
    return (
      <View style={styles.kpiCard}>
        <View style={styles.kpiHeader}>
          <View style={[styles.kpiIconBox, { backgroundColor: `${color}15` }]}>
            <FontAwesome name={icon} size={14} color={color} />
          </View>
          <Text style={styles.kpiTitle}>{title}</Text>
        </View>
        <View style={styles.kpiMiddle}>
          <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Sparkline color={color} trend={trend} />
          </View>
        </View>
        <View style={styles.kpiFooter}>
          <View style={styles.kpiTrendRow}>
            <FontAwesome name={isUp ? 'arrow-up' : 'arrow-down'} size={10} color={trendColor} />
            <Text style={[styles.kpiTrendText, { color: trendColor }]}>{trendVal}</Text>
          </View>
          <Text style={styles.kpiCompareText}>{comparison}</Text>
        </View>
      </View>
    );
  };

  const getChange = (current: number, prev: number) => {
    if (!prev) return current > 0 ? 100 : 0;
    return ((current - prev) / prev) * 100;
  };

  const revChangeVal = getChange(stats?.monthly_revenue ?? 0, stats?.prev_revenue ?? 0);
  const revTrend = revChangeVal >= 0 ? 'up' : 'down';
  const revChangeStr = period === 'all' ? '' : `${Math.abs(revChangeVal).toFixed(1)}%`;

  const totalChangeVal = getChange(stats?.total_members ?? 0, stats?.prev_total_members ?? 0);
  const totalTrend = totalChangeVal >= 0 ? 'up' : 'down';
  const totalChangeStr = period === 'all' ? '' : `${Math.abs(totalChangeVal).toFixed(1)}%`;

  const attChangeVal = getChange(attendance?.length ?? 0, stats?.yesterday_attendance_count ?? 0);
  const attTrend = attChangeVal >= 0 ? 'up' : 'down';
  const attChangeStr = `${Math.abs(attChangeVal).toFixed(1)}%`;

  const activeChangeVal = getChange(stats?.active_members ?? 0, stats?.prev_active_members ?? 0);
  const activeTrend = activeChangeVal >= 0 ? 'up' : 'down';
  const activeChangeStr = period === 'all' ? '' : `${Math.abs(activeChangeVal).toFixed(1)}%`;

  const expChangeVal = getChange(stats?.expired_members ?? 0, stats?.prev_expired_members ?? 0);
  const expTrend = expChangeVal >= 0 ? 'up' : 'down';
  const expChangeStr = period === 'all' ? '' : `${Math.abs(expChangeVal).toFixed(1)}%`;

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refreshDashboard()} tintColor={colors.primary} />}
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
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{getGreeting()}, Admin 👋</Text>
          <Text style={styles.gymName}>{gymSettings?.gym_name || cachedGymName}</Text>
          <View style={styles.locationRow}>
            <FontAwesome name="map-marker" size={12} color={colors.textSecondary} />
            <Text style={styles.locationText}>{gymSettings?.address || cachedAddress}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.bellIcon}>
            <FontAwesome name="bell-o" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarContainer} onPress={() => router.push('/profile')}>
            {gymSettings?.logo_url ? (
              <Image source={{ uri: gymSettings.logo_url }} style={styles.avatarImage} />
            ) : (
              <LinearGradient colors={[colors.primary, '#8B5CF6']} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{(gymSettings?.gym_name || cachedGymName).substring(0, 1).toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={styles.onlineDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTab label="This Month" active={period === 'month'} onPress={() => handlePeriodChange('month')} />
        <FilterTab label="Last Month" active={period === 'prev_month'} onPress={() => handlePeriodChange('prev_month')} />
        <FilterTab label="This Year" active={period === 'year'} onPress={() => handlePeriodChange('year')} />
        <FilterTab label="All Time" active={period === 'all'} onPress={() => handlePeriodChange('all')} />
      </View>

      {/* Hero Revenue Card */}
      <TouchableOpacity 
         activeOpacity={hideRevenue ? 0.9 : 1}
         onPress={() => { if(hideRevenue) setRevealedOnce(r => !r); }}
      >
        <LinearGradient 
          colors={['#6C4DFF', '#4F46E5']} 
          start={{x: 0, y: 0}} end={{x: 1, y: 1}} 
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>Total Revenue</Text>
            <TouchableOpacity onPress={() => setHideRevenue(!hideRevenue)}>
              <FontAwesome name={hideRevenue && !revealedOnce ? 'eye-slash' : 'eye'} size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.heroMiddle}>
            <Text style={styles.heroValue}>
               {hideRevenue && !revealedOnce ? '₹ ****' : stats?.monthly_revenue ? `₹${stats.monthly_revenue.toLocaleString()}` : '₹0'}
            </Text>
            {period !== 'all' && (
              <View style={[styles.heroBadge, { backgroundColor: revTrend === 'up' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                <FontAwesome name={revTrend === 'up' ? "arrow-up" : "arrow-down"} size={10} color={revTrend === 'up' ? colors.success : colors.error} />
                <Text style={[styles.heroBadgeText, { color: revTrend === 'up' ? colors.success : colors.error }]}>{revChangeStr}</Text>
              </View>
            )}
          </View>
          
          {period !== 'all' && (
            <View style={styles.heroCompareRow}>
              <Text style={styles.heroCompareLabel}>{stats?.compare_label || 'vs Previous'}</Text>
              <Text style={styles.heroCompareValue}>₹{(stats?.prev_revenue ?? 0).toLocaleString()}</Text>
            </View>
          )}

          <HeroChart />

          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>View detailed analytics and insights</Text>
            <TouchableOpacity style={styles.heroFooterArrow} onPress={() => router.push('/revenue' as any)}>
              <FontAwesome name="arrow-right" size={14} color="#6C4DFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* 2x2 KPI Grid */}
      <View style={styles.kpiGrid}>
        <KPICard 
          title="Active Plans" 
          value={stats?.active_members ?? '0'} 
          icon="calendar-check-o" 
          color="#10B981" 
          trend={activeTrend} trendVal={activeChangeStr} comparison={stats?.compare_label || 'All time'} 
        />
        <KPICard 
          title="Expired Plans" 
          value={stats?.expired_members ?? '0'} 
          icon="calendar-times-o" 
          color="#EF4444" 
          trend={expTrend} trendVal={expChangeStr} comparison={stats?.compare_label || 'All time'} 
        />
        <KPICard 
          title="Today's Check-ins" 
          value={attendance?.length ?? 0} 
          icon="users" 
          color="#3B82F6" 
          trend={attTrend} trendVal={attChangeStr} comparison="vs Yesterday" 
        />
        <KPICard 
          title="Total Members" 
          value={stats?.total_members ?? 0} 
          icon="id-card-o" 
          color="#8B5CF6" 
          trend={totalTrend} trendVal={totalChangeStr} comparison={stats?.compare_label || 'All time'} 
        />
      </View>

      {/* AI Insight */}
      {stats?.expired_members > 0 && (
        <LinearGradient colors={isDark ? ['#422006', '#713F12'] : ['#FEF3C7', '#FDE68A']} style={styles.aiCard}>
          <View style={styles.aiIconWrapper}>
            <FontAwesome name="magic" size={16} color="#D97706" />
          </View>
          <View style={styles.aiContent}>
            <Text style={styles.aiTitle}>AI Insight</Text>
            <Text style={styles.aiDesc}>You have {stats.expired_members} members with pending dues. Consider sending a reminder.</Text>
          </View>
          <FontAwesome name="angle-right" size={20} color={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)"} />
        </LinearGradient>
      )}

      {/* Recent Check-ins */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Check-ins</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.listContainer}>
        {attendance.length === 0 ? (
          <Text style={styles.emptyText}>No one has checked in today.</Text>
        ) : (
          attendance.slice(0, 4).map((att, idx) => (
            <View key={idx} style={[styles.listItem, idx === Math.min(attendance.length, 4) - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.listAvatar, { backgroundColor: `${colors.primary}15` }]}>
                <Text style={[styles.listAvatarInitials, { color: colors.primary }]}>
                  {att.member_name ? att.member_name.substring(0, 2).toUpperCase() : 'M'}
                </Text>
              </View>
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{att.member_name || att.member_id}</Text>
                <Text style={styles.listSubtitle}>{att.member_phone}</Text>
              </View>
              <View style={styles.listAction}>
                <Text style={styles.listTime}>{new Date(att.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                <View style={styles.successBadge}>
                  <FontAwesome name="check" size={10} color="#10B981" />
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Recent Reminders */}
      <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
        <Text style={styles.sectionTitle}>Recent Reminders</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.listContainer}>
        {recentMessages.length === 0 ? (
          <Text style={styles.emptyText}>No recent reminders logged.</Text>
        ) : (
          recentMessages.map((msg, idx) => (
            <TouchableOpacity 
              key={msg._id} 
              onPress={() => { setSelectedMessage(msg); setShowMessageModal(true); }}
              style={[styles.listItem, idx === recentMessages.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={[styles.listAvatar, { backgroundColor: msg.status === 'sent' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                <FontAwesome name="whatsapp" size={20} color={msg.status === 'sent' ? '#10B981' : '#EF4444'} />
              </View>
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{msg.recipient_phone}</Text>
                <Text style={styles.listSubtitle} numberOfLines={1}>{msg.message_body}</Text>
              </View>
              <View style={styles.listAction}>
                <View style={[styles.statusTag, { backgroundColor: msg.status === 'sent' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                  <Text style={[styles.statusTagText, { color: msg.status === 'sent' ? '#10B981' : '#EF4444' }]}>
                    {msg.status === 'sent' ? 'Sent' : 'Failed'}
                  </Text>
                </View>
                <Text style={styles.listTimeStr}>{new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
        {[
          { title: 'Add Member', icon: 'user-plus', color: '#8B5CF6' },
          { title: 'New Payment', icon: 'money', color: '#10B981' },
          { title: 'Send Reminder', icon: 'bell-o', color: '#F59E0B' },
          { title: 'Reports', icon: 'file-text-o', color: '#3B82F6' },
          { title: 'More', icon: 'ellipsis-h', color: colors.textSecondary },
        ].map((action, i) => (
          <TouchableOpacity key={i} style={styles.actionItem}>
            <View style={[styles.actionIconBox, { backgroundColor: isDark ? `${action.color}20` : `${action.color}15` }]}>
              <FontAwesome name={action.icon as any} size={20} color={action.color} />
            </View>
            <Text style={styles.actionTitle}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Message Modal */}
      <Modal
        visible={showMessageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Message Log Details</Text>
              <TouchableOpacity onPress={() => setShowMessageModal(false)}>
                <FontAwesome name="times" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedMessage && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalLabel}>Recipient</Text>
                <Text style={styles.modalValue}>{selectedMessage.recipient_phone}</Text>
                
                <Text style={[styles.modalLabel, { marginTop: 16 }]}>Status</Text>
                <Text style={[styles.modalValue, { color: selectedMessage.status === 'sent' ? colors.success : colors.error }]}>
                  {selectedMessage.status?.toUpperCase()}
                </Text>

                <Text style={[styles.modalLabel, { marginTop: 16 }]}>Sent At</Text>
                <Text style={styles.modalValue}>{new Date(selectedMessage.sent_at).toLocaleString()}</Text>

                <Text style={[styles.modalLabel, { marginTop: 16 }]}>Message</Text>
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>{selectedMessage.message_body}</Text>
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

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#0F1117' : '#F7F8FC' },
  content: { padding: 20, paddingTop: 60 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 13, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' },
  gymName: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationText: { fontSize: 12, color: colors.textSecondary, marginLeft: 4 },
  
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bellIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#171A22' : 'white', alignItems: 'center', justifyContent: 'center', ...shadows.medium },
  avatarContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? '#171A22' : 'white', ...shadows.medium, padding: 2 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 20 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: 'white', fontSize: 16, fontWeight: '800' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: isDark ? '#0F1117' : '#F7F8FC' },

  filterContainer: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: isDark ? '#171A22' : 'white', borderWidth: 1, borderColor: isDark ? '#2A2D3A' : '#E2E8F0' },
  filterTabActive: { backgroundColor: '#6C4DFF', borderColor: '#6C4DFF' },
  filterTabText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterTabTextActive: { color: 'white', fontWeight: '700' },

  heroCard: { borderRadius: 24, padding: 24, marginBottom: 24, ...shadows.premium, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  heroMiddle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  heroValue: { color: 'white', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  heroBadgeText: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  heroCompareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroCompareLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  heroCompareValue: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  heroFooterText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },
  heroFooterArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  kpiCard: { width: (width - 40 - 16) / 2, backgroundColor: isDark ? '#171A22' : 'white', borderRadius: 20, padding: 16, ...shadows.medium, borderWidth: 1, borderColor: isDark ? '#2A2D3A' : 'transparent' },
  kpiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  kpiIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  kpiMiddle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  kpiValue: { color: colors.text, fontSize: 24, fontWeight: '800', flex: 1 },
  kpiFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiTrendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiTrendText: { fontSize: 11, fontWeight: '700' },
  kpiCompareText: { fontSize: 10, color: colors.textMuted },

  aiCard: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#92400E' : '#FDE68A' },
  aiIconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? 'rgba(217, 119, 6, 0.2)' : 'white', alignItems: 'center', justifyContent: 'center' },
  aiContent: { flex: 1 },
  aiTitle: { color: '#D97706', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  aiDesc: { color: isDark ? 'rgba(255,255,255,0.7)' : colors.text, fontSize: 12, lineHeight: 18 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  viewAllText: { fontSize: 13, color: '#6C4DFF', fontWeight: '700' },
  
  listContainer: { backgroundColor: isDark ? '#171A22' : 'white', borderRadius: 20, padding: 16, ...shadows.medium, borderWidth: 1, borderColor: isDark ? '#2A2D3A' : 'transparent' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#2A2D3A' : '#F1F5F9' },
  listAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  listAvatarInitials: { fontSize: 16, fontWeight: '800' },
  listInfo: { flex: 1 },
  listName: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  listSubtitle: { color: colors.textSecondary, fontSize: 13 },
  listAction: { alignItems: 'flex-end', gap: 6 },
  listTime: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  listTimeStr: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  successBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.2)', alignItems: 'center', justifyContent: 'center' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTagText: { fontSize: 10, fontWeight: '700' },

  quickActionsScroll: { gap: 16, paddingBottom: 10 },
  actionItem: { alignItems: 'center', width: 72 },
  actionIconBox: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionTitle: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', padding: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: isDark ? '#171A22' : 'white', borderRadius: 24, padding: 24, ...shadows.premium },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginBottom: 6 },
  modalValue: { fontSize: 15, color: colors.text, fontWeight: '700' },
  messageBox: { backgroundColor: isDark ? '#0F1117' : '#F8FAFC', padding: 16, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: isDark ? '#2A2D3A' : '#E2E8F0' },
  messageText: { color: colors.text, fontSize: 14, lineHeight: 22 },
  resendBtn: { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, marginTop: 24 },
  resendBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
});

