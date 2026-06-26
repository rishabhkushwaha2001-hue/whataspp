import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, Linking, Alert, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius } from '../theme/theme';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { RenewalModal } from '../components/RenewalModal';
import { fetchMessageTemplates, buildRenewalMessage, getDefaultTemplates } from '../services/messageTemplates';

export const MembersScreen = () => {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const [members, setMembers] = useState<any[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [renewingMember, setRenewingMember] = useState<any>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [gymName, setGymName] = useState('Gym');
  const [businessType, setBusinessType] = useState('gym');
  const [enableHours, setEnableHours] = useState(false);
  const [renewalTemplate, setRenewalTemplate] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/members/');
      setMembers(res.data);
      applyFilters(res.data, search, activeTab);
    } catch (error) {
      console.warn('Fetch members failed');
    } finally {
      setRefreshing(false);
    }
  }, [search, activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
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
    }, [fetchMembers])
  );

  const applyFilters = (data: any[], searchText: string, tab: string) => {
    let filtered = data;
    if (searchText) {
      filtered = filtered.filter(m =>
        m.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
        m.phone.includes(searchText) ||
        m.member_id?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    if (tab === 'Active') filtered = filtered.filter(m => m.status === 'active' && new Date(m.next_due_date) > new Date());
    else if (tab === 'Expired') filtered = filtered.filter(m => m.status === 'expired' || new Date(m.next_due_date) < new Date());
    else if (tab === 'Manual') filtered = filtered.filter(m => m.category === 'Manual');
    setFilteredMembers(filtered);
  };

  const handleSearch = (text: string) => { setSearch(text); applyFilters(members, text, activeTab); };
  const handleTabChange = (tab: string) => { setActiveTab(tab); applyFilters(members, search, tab); };
  const handleRenew = (member: any) => { setRenewingMember(member); setShowRenewModal(true); };

  const confirmRenewal = async (
    durationMonths: number, amount: number, paymentMode: string,
    nextDueDate?: string, joiningDate?: string, hours?: number,
    timing?: string, allocatedSeat?: string, wifiDetails?: string, amountPaid?: number
  ) => {
    if (!renewingMember) return;
    try {
      await api.post(`/members/${renewingMember.id || renewingMember._id}/renew`, {
        plan_duration_months: durationMonths, amount, amount_paid: amountPaid, payment_mode: paymentMode,
        next_due_date: nextDueDate, joining_date: joiningDate,
        daily_hours: hours, timing, allocated_seat: allocatedSeat,
      });
      fetchMembers();
      // Use nextDueDate directly (already selected by user) — no API response needed
      const nextDue = nextDueDate ? new Date(nextDueDate).toLocaleDateString() : 'N/A';
      const msg = buildRenewalMessage(renewalTemplate, businessType, {
        name: renewingMember.full_name, phone: renewingMember.phone, date: nextDue,
        fees: amountPaid ? amountPaid : amount, hours: hours ?? renewingMember.daily_hours,
        timing: timing ?? renewingMember.timing, gym: gymName, durationMonths,
        seat: allocatedSeat || renewingMember.allocated_seat || 'Unassigned',
        wifi: wifiDetails || renewingMember.wifi_details || 'Not Provided',
      });
      setAlertConfig({
        visible: true, title: "Success",
        message: "Membership renewed successfully!", type: "success",
        confirmText: "Send Receipt",
        onConfirm: () => {
          setAlertConfig({ visible: false });
          setTimeout(async () => { await sendWhatsAppMessage(renewingMember.phone, msg); }, 100);
        },
        onClose: () => setAlertConfig({ visible: false })
      });
    } catch (error) {
      setAlertConfig({ visible: true, title: "Error", message: "Failed to renew membership", type: "error" });
    }
  };

  const isDark = theme === 'dark';

  const renderMember = ({ item }: { item: any }) => {
    const isExpired = new Date(item.next_due_date) < new Date();
    const memberId = item.id || item._id;
    const initials = item.full_name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
    const daysLeft = Math.ceil((new Date(item.next_due_date).getTime() - Date.now()) / 86400000);

    // Avatar color based on name
    const avatarColors = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];
    const avatarColor = avatarColors[item.full_name.charCodeAt(0) % avatarColors.length];

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => router.push({ pathname: `/members/${memberId}` as any, params: { name: item.full_name, mid: item.member_id, cat: item.category || 'New' } })}
      >
        <View style={[styles.card, {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: isDark ? '#000' : '#8B5CF6',
        }]}>
          {/* Left accent bar */}
          <View style={[styles.accentBar, { backgroundColor: isExpired ? colors.error : avatarColor }]} />

          <View style={styles.cardInner}>
            {/* Top row: Avatar + Name/ID + Status */}
            <View style={styles.topRow}>
              <View style={[styles.avatar, { backgroundColor: `${avatarColor}20` }]}>
                <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
              </View>

              <View style={styles.nameBlock}>
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                  {item.full_name}
                </Text>
              </View>

              <View style={[styles.statusPill, {
                backgroundColor: isExpired ? `${colors.error}15` : `${colors.success}15`,
              }]}>
                <View style={[styles.statusDot, { backgroundColor: isExpired ? colors.error : colors.success }]} />
                <Text style={[styles.statusText, { color: isExpired ? colors.error : colors.success }]}>
                  {isExpired ? 'Expired' : 'Active'}
                </Text>
              </View>
            </View>

            {/* Info chips row */}
            <View style={styles.chipsRow}>
              <View style={[styles.chip, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
                <FontAwesome name="money" size={10} color={colors.accent} />
                <Text style={[styles.chipText, { color: colors.textSecondary }]}>₹{item.monthly_fees}</Text>
              </View>


              <View style={[styles.chip, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
                <FontAwesome name="calendar" size={10} color={isExpired ? colors.error : colors.primary} />
                <Text style={[styles.chipText, { color: isExpired ? colors.error : colors.textSecondary }]}>
                  {isExpired ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
                </Text>
              </View>

              {businessType === 'library' && item.allocated_seat && (
                <View style={[styles.chip, { backgroundColor: isDark ? '#2D1B69' : '#EDE9FE' }]}>
                  <FontAwesome name="map-pin" size={10} color="#8B5CF6" />
                  <Text style={[styles.chipText, { color: '#8B5CF6' }]}>{item.allocated_seat}</Text>
                </View>
              )}

              {enableHours && item.timing && (
                <View style={[styles.chip, { backgroundColor: isDark ? '#2D1F07' : '#FEF3C7' }]}>
                  <FontAwesome name="clock-o" size={10} color="#D97706" />
                  <Text style={[styles.chipText, { color: '#D97706' }]} numberOfLines={1}>{item.timing}</Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}
                onPress={() => {
                  const callPhone = item.phone.length > 10 && item.phone.startsWith('91') ? item.phone.substring(2) : item.phone;
                  Linking.openURL(`tel:${callPhone}`);
                }}
              >
                <FontAwesome name="phone" size={13} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}
                onPress={async () => { await sendWhatsAppMessage(item.phone); }}
              >
                <FontAwesome name="whatsapp" size={13} color="#25D366" />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.renewBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleRenew(item)}
              >
                <FontAwesome name="refresh" size={12} color="#fff" />
                <Text style={styles.renewText}>Renew</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Members</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{filteredMembers.length} total</Text>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <FontAwesome name="search" size={14} color={colors.textMuted} />
          <TextInput
            placeholder="Search by name, phone or ID..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <FontAwesome name="times-circle" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.s }}>
          {['All', 'Active', 'Expired', 'Manual'].map(tab => (
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

      <FlatList
        data={filteredMembers}
        renderItem={renderMember}
        keyExtractor={item => item.id || item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchMembers} tintColor={colors.primary} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
              <FontAwesome name="users" size={32} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No members found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Try adjusting your search or filter</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.m,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.m,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: borderRadius.m, paddingHorizontal: spacing.m,
    height: 44, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: borderRadius.full, marginRight: 8,
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  listContent: { padding: spacing.m, paddingBottom: 100 },

  // Card
  card: {
    flexDirection: 'row',
    borderRadius: borderRadius.l,
    marginBottom: spacing.m,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  accentBar: { width: 4 },
  cardInner: { flex: 1, padding: spacing.m },

  // Top row
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.m },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  nameBlock: { flex: 1, marginRight: 8 },
  memberName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  memberId: { fontSize: 11, marginTop: 1 },

  // Status pill
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.full,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.m },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.s,
  },
  chipText: { fontSize: 11, fontWeight: '500' },

  divider: { height: 1, marginBottom: spacing.m },

  // Actions
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: borderRadius.m, flex: 1,
    justifyContent: 'center',
  },
  actionText: { fontSize: 12, fontWeight: '600' },
  renewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: borderRadius.m,
    flex: 1.3, justifyContent: 'center',
  },
  renewText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Empty state
  emptyContainer: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySubtitle: { fontSize: 14 },
});
