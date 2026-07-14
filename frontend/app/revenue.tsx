import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme, shadows } from '../src/theme/theme';
import { api } from '../src/services/api';
import Svg, { Path, Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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

export default function RevenueScreen() {
  const { theme, colors } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const styles = getStyles(colors, isDark);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [statsYear, setStatsYear] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, membersRes] = await Promise.all([
        api.get('/members/stats/dashboard?period=year'),
        api.get('/members/'),
      ]);
      setStatsYear(statsRes.data);
      setAllMembers(membersRes.data || []);
    } catch (e) {
      console.error('Revenue fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const monthlyBreakdown = useMemo(() => {
    const data: Record<number, { count: number; revenue: number }> = {};
    allMembers.forEach((m: any) => {
      const dateVal = m.joining_date || m.created_at;
      if (!dateVal) return;
      const d = new Date(dateVal);
      const mo = d.getMonth();
      if (!data[mo]) data[mo] = { count: 0, revenue: 0 };
      data[mo].count += 1;
      
      const planFee = parseFloat(m.plan_fee);
      const fee = parseFloat(m.fee);
      const amount = (!isNaN(planFee) ? planFee : (!isNaN(fee) ? fee : 0));
      data[mo].revenue += amount;
    });
    return MONTHS.map((m, idx) => ({
      month: m,
      count: data[idx]?.count || 0,
      revenue: data[idx]?.revenue || 0,
    }));
  }, [allMembers, currentYear]);

  const calculatedMax = Math.max(...monthlyBreakdown.map(m => m.revenue));
  const maxBar = isNaN(calculatedMax) || calculatedMax <= 0 ? 1 : calculatedMax;

  const filteredMembers = useMemo(() => {
    if (selectedMonth === null) return allMembers;
    return allMembers.filter((m: any) => {
      const dateVal = m.joining_date || m.created_at;
      if (!dateVal) return false;
      const d = new Date(dateVal);
      return d.getMonth() === selectedMonth;
    });
  }, [allMembers, selectedMonth, currentYear]);

  const activeCount = useMemo(
    () => selectedMonth === null
      ? (statsYear?.active_members ?? 0)
      : filteredMembers.filter((m: any) => m.status === 'active').length,
    [selectedMonth, filteredMembers, statsYear],
  );

  const expiredCount = useMemo(
    () => selectedMonth === null
      ? (statsYear?.expired_members ?? 0)
      : filteredMembers.filter((m: any) => m.status !== 'active').length,
    [selectedMonth, filteredMembers, statsYear],
  );

  const newJoins = useMemo(
    () => selectedMonth === null
      ? (statsYear?.new_members_count ?? 0)
      : filteredMembers.filter((m: any) => (m.category || '').toLowerCase() !== 'renewal').length,
    [selectedMonth, filteredMembers, statsYear],
  );

  const renewals = useMemo(
    () => selectedMonth === null
      ? (statsYear?.renewal_members_count ?? 0)
      : filteredMembers.filter((m: any) => (m.category || '').toLowerCase() === 'renewal').length,
    [selectedMonth, filteredMembers, statsYear],
  );

  const heroLabel = selectedMonth === null
    ? `TOTAL REVENUE (${currentYear})`
    : `ESTIMATED REVENUE — ${FULL_MONTHS[selectedMonth].toUpperCase()}`;

  const totalRevenue = selectedMonth === null
    ? (statsYear?.monthly_revenue ?? 0)
    : (monthlyBreakdown[selectedMonth]?.revenue ?? 0);

  const todaysRevenue = statsYear?.todays_collections ?? 0;

  const KPICard = ({ title, value, icon, color, trend }: any) => {
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
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#0F1117' : '#F7F8FC', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6C4DFF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C4DFF" />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="arrow-left" size={16} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.title}>Revenue Insights</Text>
          <Text style={styles.subtitle}>
            {selectedMonth === null ? 'Tap a month below to filter' : `Showing: ${FULL_MONTHS[selectedMonth]}`}
          </Text>
        </View>
        {selectedMonth !== null && (
          <TouchableOpacity onPress={() => setSelectedMonth(null)} style={styles.clearBtn}>
            <FontAwesome name="times" size={12} color="#6C4DFF" />
            <Text style={styles.clearBtnText}> Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <LinearGradient 
        colors={['#6C4DFF', '#4F46E5']} 
        start={{x: 0, y: 0}} end={{x: 1, y: 1}} 
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>{heroLabel}</Text>
          {selectedMonth !== null && (
             <Text style={styles.heroEstimatedMark}>* Estimated from plan fees</Text>
          )}
        </View>
        <Text style={styles.heroAmount}>₹{Math.round(totalRevenue).toLocaleString()}</Text>
        
        <HeroChart />

        <View style={styles.heroFooterRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>₹{Math.round(todaysRevenue).toLocaleString()}</Text>
            <Text style={styles.heroStatLabel}>Today's Col.</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{activeCount}</Text>
            <Text style={styles.heroStatLabel}>Active</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{statsYear?.total_members ?? 0}</Text>
            <Text style={styles.heroStatLabel}>Total Joined</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.grid}>
        <KPICard title={selectedMonth !== null ? 'Active (joined)' : 'Active Members'} value={activeCount} icon="check-circle" color="#10B981" trend="up" />
        <KPICard title={selectedMonth !== null ? 'Expired (joined)' : 'Expired'} value={expiredCount} icon="exclamation-circle" color="#EF4444" trend="down" />
        <KPICard title="New Joins" value={newJoins} icon="user-plus" color="#3B82F6" trend="up" />
        <KPICard title="Renewals" value={renewals} icon="refresh" color="#F59E0B" trend="up" />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Monthly Revenue ({currentYear})</Text>
        {selectedMonth !== null && (
          <TouchableOpacity onPress={() => setSelectedMonth(null)}>
            <Text style={styles.resetText}>Reset ×</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.chartCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.barChart}>
            {monthlyBreakdown.map((item, idx) => {
              const barH = maxBar > 0 ? (item.revenue / maxBar) * 110 : 4;
              const isCurrentMonth = idx === currentMonth;
              const isSelected = selectedMonth === idx;
              const hasData = item.revenue > 0;
              return (
                <TouchableOpacity
                  key={item.month}
                  style={styles.barCol}
                  onPress={() => setSelectedMonth(isSelected ? null : idx)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.barAmount, isSelected && { color: '#6C4DFF' }]}>
                    {hasData ? (item.revenue >= 1000 ? `${Math.round(item.revenue / 1000)}k` : `${Math.round(item.revenue)}`) : ''}
                  </Text>
                  <View style={[styles.barBg, isSelected && { borderWidth: 2, borderColor: '#6C4DFF' }]}>
                    <LinearGradient
                      colors={
                        isSelected
                          ? ['#6C4DFF', '#4F46E5']
                          : isCurrentMonth && selectedMonth === null
                          ? ['#8B5CF6', '#6C4DFF']
                          : hasData
                          ? (isDark ? ['#2A2D3A', '#171A22'] : ['#E2E8F0', '#F1F5F9'])
                          : (isDark ? ['#171A22', '#171A22'] : ['#F8FAFC', '#F8FAFC'])
                      }
                      style={[styles.barFill, { height: Math.max(barH, 4) }]}
                    />
                  </View>
                  <Text style={[
                    styles.barLabel,
                    isSelected && { color: '#6C4DFF', fontWeight: '800' },
                    isCurrentMonth && selectedMonth === null && { color: '#8B5CF6', fontWeight: '700' },
                  ]}>
                    {item.month}
                  </Text>
                  {isSelected && <View style={styles.barDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={[styles.sectionRow, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>
          {selectedMonth !== null ? `${FULL_MONTHS[selectedMonth]} Members` : 'All Members (This Year)'}
        </Text>
        <Text style={styles.sectionCount}>{filteredMembers.length} members</Text>
      </View>
      <View style={styles.listContainer}>
        {filteredMembers.length === 0 ? (
          <Text style={styles.emptyText}>
            {selectedMonth !== null
              ? `No members joined in ${FULL_MONTHS[selectedMonth]}.`
              : 'No member data.'}
          </Text>
        ) : (
          filteredMembers.slice(0, 40).map((m: any, idx: number) => {
            const dateVal = m.joining_date || m.created_at;
            const joinDate = dateVal ? new Date(dateVal) : null;
            const joinStr = joinDate
              ? `${joinDate.getDate()} ${MONTHS[joinDate.getMonth()]} ${joinDate.getFullYear()}`
              : 'N/A';
            const isActive = m.status === 'active';
            return (
              <View
                key={m._id || idx}
                style={[styles.listItem, idx === Math.min(filteredMembers.length, 40) - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={[styles.listAvatar, { backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                  <Text style={[styles.listAvatarInitials, { color: isActive ? '#10B981' : '#EF4444' }]}>
                    {m.full_name ? m.full_name.substring(0, 2).toUpperCase() : 'M'}
                  </Text>
                </View>
                <View style={styles.listBody}>
                  <Text style={styles.listName}>{m.full_name || 'Member'}</Text>
                  <Text style={styles.listDate}>Joined: {joinStr} · {m.category || 'New'}</Text>
                </View>
                <View style={styles.listRight}>
                  <View style={[styles.statusTag, { backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                    <Text style={[styles.statusTagText, { color: isActive ? '#10B981' : '#EF4444' }]}>
                      {isActive ? 'Active' : 'Expired'}
                    </Text>
                  </View>
                  {(m.plan_fee > 0 || m.fee > 0) && (
                    <Text style={styles.listFee}>₹{parseFloat(m.plan_fee || m.fee || 0).toLocaleString()}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#0F1117' : '#F7F8FC' },
  content: { padding: 20, paddingTop: 60 },
  
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#171A22' : 'white', alignItems: 'center', justifyContent: 'center', ...shadows.medium, borderWidth: 1, borderColor: isDark ? '#2A2D3A' : 'transparent' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2, fontWeight: '600' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(108, 77, 255, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  clearBtnText: { color: '#6C4DFF', fontSize: 12, fontWeight: '700' },

  heroCard: { borderRadius: 24, padding: 24, marginBottom: 24, ...shadows.premium, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  heroEstimatedMark: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '500' },
  heroAmount: { color: 'white', fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  
  heroFooterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 12 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { color: 'white', fontSize: 15, fontWeight: '700' },
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4, fontWeight: '500' },
  heroDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  kpiCard: { width: (width - 40 - 16) / 2, backgroundColor: isDark ? '#171A22' : 'white', borderRadius: 20, padding: 16, ...shadows.medium, borderWidth: 1, borderColor: isDark ? '#2A2D3A' : 'transparent' },
  kpiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  kpiIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  kpiMiddle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiValue: { color: colors.text, fontSize: 24, fontWeight: '800', flex: 1 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sectionCount: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  resetText: { color: '#6C4DFF', fontSize: 13, fontWeight: '700' },

  chartCard: { backgroundColor: isDark ? '#171A22' : 'white', borderRadius: 20, padding: 20, ...shadows.medium, borderWidth: 1, borderColor: isDark ? '#2A2D3A' : 'transparent', marginBottom: 24 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 4, minHeight: 165 },
  barCol: { alignItems: 'center', width: 42, marginHorizontal: 4 },
  barAmount: { color: colors.textSecondary, fontSize: 10, marginBottom: 6, fontWeight: '700' },
  barBg: { width: 24, borderRadius: 12, overflow: 'hidden', height: 110, justifyContent: 'flex-end', borderWidth: 0, backgroundColor: isDark ? '#0F1117' : '#F1F5F9' },
  barFill: { width: '100%', borderRadius: 10 },
  barLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 8, fontWeight: '600' },
  barDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4, backgroundColor: '#6C4DFF' },

  listContainer: { backgroundColor: isDark ? '#171A22' : 'white', borderRadius: 20, padding: 16, ...shadows.medium, borderWidth: 1, borderColor: isDark ? '#2A2D3A' : 'transparent' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#2A2D3A' : '#F1F5F9' },
  listAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  listAvatarInitials: { fontSize: 15, fontWeight: '800' },
  listBody: { flex: 1 },
  listName: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  listDate: { color: colors.textSecondary, fontSize: 12 },
  listRight: { alignItems: 'flex-end', gap: 6 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTagText: { fontSize: 10, fontWeight: '700' },
  listFee: { fontSize: 13, fontWeight: '800', color: colors.success },
  
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', padding: 24 },
});
