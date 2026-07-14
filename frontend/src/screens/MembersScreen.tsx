import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Linking, RefreshControl, ScrollView, Dimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { RenewalModal } from '../components/RenewalModal';
import { fetchMessageTemplates, buildRenewalMessage, getDefaultTemplates } from '../services/messageTemplates';
import { useCachedFetch, invalidateCache } from '../hooks/useDataStore';

const { width } = Dimensions.get('window');
const AVATAR_COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#06B6D4', '#F97316'];

export const MembersScreen = () => {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const styles = getStyles(colors, isDark);

  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [renewingMember, setRenewingMember] = useState<any>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [gymName, setGymName] = useState('Gym');
  const [businessType, setBusinessType] = useState('gym');
  const [enableHours, setEnableHours] = useState(false);
  const [renewalTemplate, setRenewalTemplate] = useState<string | null>(null);

  const { data: membersRaw, refreshing, refresh: refreshMembers } = useCachedFetch<any[]>('members', '/members/');
  const members: any[] = Array.isArray(membersRaw) ? membersRaw : [];

  useEffect(() => { applyFilters(members, search, activeTab); }, [members, search, activeTab]);

  useFocusEffect(
    useCallback(() => {
      const loadSettings = async () => {
        try {
          const templates = await fetchMessageTemplates();
          setGymName(templates.gymName);
          setBusinessType(templates.businessType);
          setEnableHours(templates.enableHours);
          const defaults = getDefaultTemplates(templates.businessType);
          const dbRenewal = templates.renewalTemplate;
          setRenewalTemplate((dbRenewal && dbRenewal.trim()) ? dbRenewal : defaults.renewal);
        } catch (e) {
          const storedName = await AsyncStorage.getItem('gymName');
          if (storedName) setGymName(storedName);
        }
      };
      loadSettings();
    }, [])
  );

  const applyFilters = (data: any[], searchText: string, tab: string) => {
    const safeData = Array.isArray(data) ? data : [];
    let filtered = safeData;
    if (searchText) {
      filtered = filtered.filter(m =>
        m.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
        m.phone?.includes(searchText) ||
        m.member_id?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    if (tab === 'Active') filtered = filtered.filter(m => m.status === 'active' && new Date(m.next_due_date) > new Date());
    else if (tab === 'Expired') filtered = filtered.filter(m => m.status === 'expired' || new Date(m.next_due_date) < new Date());
    else if (tab === 'Partial') filtered = filtered.filter(m => m.pending_amount > 0);
    else if (tab === 'Manual') filtered = filtered.filter(m => m.category === 'Manual');
    setFilteredMembers(filtered);
  };

  const handleSearch = (text: string) => setSearch(text);
  const handleTabChange = (tab: string) => setActiveTab(tab);
  const handleRenew = (member: any) => { setRenewingMember(member); setShowRenewModal(true); };

  const confirmRenewal = async (
    durationMonths: number, amount: number, paymentMode: string,
    nextDueDate?: string, joiningDate?: string, hours?: number,
    timing?: string, allocatedSeat?: string, wifiDetails?: string, amountPaid?: number
  ) => {
    if (!renewingMember) return;
    try {
      await api.post(`/members/${renewingMember.id || renewingMember._id}/renew`, {
        plan_duration_months: durationMonths, amount, amount_paid: amountPaid ?? null, payment_mode: paymentMode,
        next_due_date: nextDueDate, joining_date: joiningDate,
        daily_hours: hours, timing, allocated_seat: allocatedSeat,
      });
      invalidateCache('members', 'dashboard_month', 'dashboard_all');
      refreshMembers();
      const nextDue = nextDueDate ? new Date(nextDueDate).toLocaleDateString() : 'N/A';
      const msg = buildRenewalMessage(renewalTemplate, businessType, {
        name: renewingMember.full_name, phone: renewingMember.phone, date: nextDue,
        joining_date: joiningDate ? new Date(joiningDate).toLocaleDateString() : 'N/A',
        paid_date: new Date().toLocaleDateString(),
        fees: amount, amountPaid: amountPaid ?? undefined,
        hours: hours ?? renewingMember.daily_hours,
        timing: timing ?? renewingMember.timing, gym: gymName, durationMonths,
        seat: businessType === 'library' ? (allocatedSeat || renewingMember.allocated_seat || 'Unassigned') : undefined,
        wifi: businessType === 'library' ? (wifiDetails || renewingMember.wifi_details || 'Not Provided') : undefined,
      });
      return { success: true, message: msg };
    } catch {
      return { success: false };
    }
  };

  const renderMember = ({ item }: { item: any }) => {
    const now = new Date();
    const dueDate = new Date(item.next_due_date);
    const isExpired = dueDate < now;
    const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    const isDueSoon = !isExpired && daysLeft <= 7;
    const memberId = item.id || item._id;

    const initials = item.full_name
      .split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
    const avatarColor = AVATAR_COLORS[item.full_name.charCodeAt(0) % AVATAR_COLORS.length];

    const statusLabel = isExpired ? 'Expired' : isDueSoon ? 'Due Soon' : 'Active';
    const statusColor = isExpired ? colors.error : isDueSoon ? (colors.warning || '#F59E0B') : colors.success;

    const joiningDateStr = item.joining_date
      ? new Date(item.joining_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;
    const dueDateStr = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => router.push({ pathname: `/members/${memberId}` as any, params: { name: item.full_name, mid: item.member_id, cat: item.category || 'New' } })}
        style={styles.cardWrapper}
      >
        <View style={styles.card}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: `${avatarColor}20`, borderColor: `${avatarColor}40` }]}>
            <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
          </View>

          {/* Main content */}
          <View style={styles.cardBody}>
            {/* Row 1: Name + Status pill */}
            <View style={styles.cardRow}>
              <Text style={styles.memberName} numberOfLines={1}>{item.full_name}</Text>
              <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>

            {/* Row 2: Member ID + Plan */}
            <View style={styles.cardRow2}>
              <Text style={styles.memberId}>{item.member_id}</Text>
              {item.plan_name || item.plan_duration_months ? (
                <View style={styles.planBadge}>
                  <FontAwesome name="star" size={9} color={colors.primary} />
                  <Text style={[styles.planText, { color: colors.primary }]}>
                    {item.plan_name || `${item.plan_duration_months}M Plan`}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Row 3: Dates */}
            {joiningDateStr && (
              <Text style={styles.dateRange}>
                {joiningDateStr} – {dueDateStr}
              </Text>
            )}

            {/* Row 4: Fee + Days */}
            <View style={styles.cardRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.feeText}>₹{item.monthly_fees || item.plan_fee || 0}</Text>
                {item.pending_amount > 0 ? (
                  <View style={[styles.dueBadge, { backgroundColor: `${colors.error}15` }]}>
                    <Text style={[styles.dueText, { color: colors.error }]}>Due</Text>
                  </View>
                ) : (
                  <Text style={[styles.paidLabel, { color: colors.success }]}>Paid</Text>
                )}
              </View>
              <View style={styles.daysBox}>
                <Text style={[styles.daysNum, { color: isExpired ? colors.error : daysLeft <= 7 ? (colors.warning || '#F59E0B') : colors.text }]}>
                  {Math.abs(daysLeft)}
                </Text>
                <Text style={styles.daysLabel}>{isExpired ? 'ago' : 'Days Left'}</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.border }]}
                onPress={() => {
                  const callPhone = item.phone?.length > 10 && item.phone.startsWith('91')
                    ? item.phone.substring(2) : item.phone;
                  Linking.openURL(`tel:${callPhone}`);
                }}
              >
                <FontAwesome name="phone" size={13} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.border }]}
                onPress={async () => { await sendWhatsAppMessage(item.phone); }}
              >
                <FontAwesome name="whatsapp" size={13} color="#25D366" />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.renewBtn}
                onPress={() => handleRenew(item)}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary || colors.primary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.renewGradient}
                >
                  <FontAwesome name="refresh" size={12} color="#fff" />
                  <Text style={styles.renewText}>Renewal</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const TABS = ['All', 'Active', 'Due', 'Expired', 'Partial'];

  return (
    <View style={styles.container}>
      <CustomAlert
        visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message}
        type={alertConfig.type} showCancel={alertConfig.showCancel} cancelText={alertConfig.cancelText}
        confirmText={alertConfig.confirmText}
        onClose={alertConfig.onClose || (() => setAlertConfig({ ...alertConfig, visible: false }))}
        onConfirm={alertConfig.onConfirm}
      />
      <RenewalModal
        visible={showRenewModal} member={renewingMember} enableHours={enableHours} businessType={businessType}
        onClose={() => setShowRenewModal(false)} onConfirm={confirmRenewal}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Members</Text>
            <Text style={styles.headerSubtitle}>Total Members {members.length.toLocaleString()}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn}>
              <FontAwesome name="sliders" size={16} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <FontAwesome name="bell-o" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <FontAwesome name="search" size={14} color={colors.textMuted} />
          <TextInput
            placeholder="Search by name, phone or member ID..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <FontAwesome name="times-circle" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.filterIconBtn, { backgroundColor: `${colors.primary}15` }]}>
              <FontAwesome name="filter" size={12} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.s }}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && { backgroundColor: colors.primary }]}
              onPress={() => handleTabChange(tab)}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? '#fff' : colors.textMuted }]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={filteredMembers}
        renderItem={renderMember}
        keyExtractor={item => item.id || item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshMembers} tintColor={colors.primary} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
              <FontAwesome name="users" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No members found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or filter</Text>
          </View>
        )}
      />
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    paddingTop: 52, paddingHorizontal: spacing.l, paddingBottom: spacing.m,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    ...shadows.card,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.m,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.m,
    height: 46, borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: isDark ? '#111827' : '#F9FAFB',
  },
  searchInput: { flex: 1, fontSize: 14 },
  filterIconBtn: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  // Tabs
  tab: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: borderRadius.full, marginRight: 8,
    backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  listContent: { padding: spacing.m, paddingBottom: 100 },

  // Card
  cardWrapper: { marginBottom: spacing.m },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },

  // Avatar
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.m, borderWidth: 1.5,
    alignSelf: 'flex-start', marginTop: 2,
  },
  avatarText: { fontSize: 18, fontWeight: '800' },

  // Card Body
  cardBody: { flex: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardRow2: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },

  memberName: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, letterSpacing: -0.2 },
  memberId: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: borderRadius.s,
    backgroundColor: `${colors.primary}12`,
  },
  planText: { fontSize: 10, fontWeight: '700' },

  dateRange: { fontSize: 10, color: colors.textMuted, marginBottom: 6 },

  feeText: { fontSize: 14, fontWeight: '800', color: colors.text },
  paidLabel: { fontSize: 10, fontWeight: '600' },
  dueBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  dueText: { fontSize: 10, fontWeight: '700' },

  daysBox: { alignItems: 'center' },
  daysNum: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  daysLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '600' },

  divider: { height: 1, marginVertical: spacing.s },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8, borderRadius: borderRadius.m,
    borderWidth: 1,
    backgroundColor: isDark ? '#111827' : '#F9FAFB',
  },
  actionText: { fontSize: 11, fontWeight: '600' },
  renewBtn: { flex: 1.2, borderRadius: borderRadius.m, overflow: 'hidden' },
  renewGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 10,
  },
  renewText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Empty
  emptyContainer: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted },
});
