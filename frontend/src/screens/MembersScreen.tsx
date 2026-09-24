import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Linking, RefreshControl, ScrollView, Dimensions, Image, Platform, Modal,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
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
import { Skeleton } from '../components/Skeleton';

const { width } = Dimensions.get('window');
const AVATAR_COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#06B6D4', '#F97316'];

export const MembersScreen = () => {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const isDark = theme === 'dark';
  const styles = getStyles(colors, isDark);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [renewingMember, setRenewingMember] = useState<any>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [gymName, setGymName] = useState('Gym');
  const [businessType, setBusinessType] = useState('gym');
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const [enableHours, setEnableHours] = useState(false);
  const [renewalTemplate, setRenewalTemplate] = useState<string | null>(null);

  const { data: membersRaw, loading, refreshing, refresh: refreshMembers } = useCachedFetch<any[]>('members', '/members/');
  const members: any[] = Array.isArray(membersRaw) ? membersRaw : [];

  const isInitialLoading = loading && (membersRaw === null || members.length === 0);

  const filteredMembers = useMemo(() => {
    const safeData = Array.isArray(members) ? members : [];
    let filtered = safeData;
    if (search) {
      filtered = filtered.filter(m =>
        m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.phone?.includes(search) ||
        m.member_id?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (activeTab === 'Active') filtered = filtered.filter(m => m.status === 'active' && new Date(m.next_due_date) > new Date());
    else if (activeTab === 'Expired') filtered = filtered.filter(m => m.status === 'expired' || new Date(m.next_due_date) < new Date());
    else if (activeTab === 'Due') filtered = filtered.filter(m => m.pending_amount > 0 && (!m.amount_paid || m.amount_paid === 0));
    else if (activeTab === 'Partial') filtered = filtered.filter(m => m.pending_amount > 0 && m.amount_paid > 0);
    else if (activeTab === 'Manual') filtered = filtered.filter(m => m.category === 'Manual');
    return filtered;
  }, [members, search, activeTab]);

  useEffect(() => {
    if (params.filter && ['All', 'Active', 'Due', 'Expired', 'Partial'].includes(params.filter)) {
      setActiveTab(params.filter);
    }
  }, [params.filter]);

  useFocusEffect(
    useCallback(() => {
      refreshMembers();
      const loadSettings = async () => {
        try {
          const templates = await fetchMessageTemplates();
          setGymName(templates.gymName);
          setBusinessType(templates.businessType);
          setEnableHours(templates.enableHours);
          const defaults = getDefaultTemplates(templates.businessType);
          const dbRenewal = templates.renewalTemplate;
          setRenewalTemplate(dbRenewal && typeof dbRenewal === 'string' && dbRenewal.trim() ? dbRenewal : null);
        } catch (e) {
          const storedName = await AsyncStorage.getItem('gymName');
          if (storedName) setGymName(storedName);
        }
      };
      loadSettings();
    }, [refreshMembers])
  );



  const handleSearch = (text: string) => setSearch(text);
  const handleTabChange = (tab: string) => setActiveTab(tab);
  const handleRenew = (member: any) => { setRenewingMember(member); setShowRenewModal(true); };

  const confirmRenewal = async (
    durationMonths: number, amount: number, paymentMode: string,
    nextDueDate?: string, joiningDate?: string, hours?: number,
    timing?: string, allocatedSeat?: string, wifiDetails?: string, amountPaid?: number, appliedOfferName?: string, planName?: string
  ) => {
    if (!renewingMember) return;
    try {
      await api.post(`/members/${renewingMember.id || renewingMember._id}/renew`, {
        plan_duration_months: durationMonths, amount, amount_paid: amountPaid ?? null, payment_mode: paymentMode,
        next_due_date: nextDueDate, joining_date: joiningDate,
        daily_hours: hours, timing, allocated_seat: allocatedSeat, applied_offer_name: appliedOfferName, plan_name: planName
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
        plan_name: planName,
        applied_offer_name: appliedOfferName,
      });
      return { success: true, message: msg };
    } catch {
      return { success: false };
    }
  };

  const renderMember = ({ item }: { item: any }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Sort payments by start_date ascending (exact same logic as MemberSummaryScreen)
    const sortedPayments = (item.payment_history || []).slice().sort((a: any, b: any) => {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });

    let activePlan: any = null;
    if (sortedPayments.length > 0) {
      for (let i = 0; i < sortedPayments.length; i++) {
        const p = sortedPayments[i];
        const sDate = new Date(p.start_date);
        sDate.setHours(0, 0, 0, 0);
        const eDate = new Date(p.end_date);
        eDate.setHours(0, 0, 0, 0);

        if (today >= sDate && today <= eDate) {
          activePlan = p;
          break;
        }
      }

      if (!activePlan) {
        const allPast = sortedPayments.filter((p: any) => {
          const eDate = new Date(p.end_date);
          eDate.setHours(0, 0, 0, 0);
          return eDate.getTime() < today.getTime();
        });
        if (allPast.length > 0) {
          activePlan = allPast[allPast.length - 1];
        } else {
          activePlan = sortedPayments[0];
        }
      }
    }

    const dueDate = activePlan?.end_date ? new Date(activePlan.end_date) : (item.next_due_date ? new Date(item.next_due_date) : new Date());
    const startDateObj = activePlan?.start_date ? new Date(activePlan.start_date) : (item.joining_date ? new Date(item.joining_date) : null);
    
    const dueDateMidnight = new Date(dueDate);
    dueDateMidnight.setHours(0, 0, 0, 0);

    const isExpired = dueDateMidnight < today;
    const daysLeft = Math.ceil((dueDateMidnight.getTime() - today.getTime()) / 86400000);
    const isDueSoon = !isExpired && daysLeft <= 7;
    const memberId = item.id || item._id;

    const initials = item.full_name
      .split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
    const avatarColor = AVATAR_COLORS[item.full_name.charCodeAt(0) % AVATAR_COLORS.length];

    const statusLabel = isExpired ? 'Expired' : isDueSoon ? 'Due Soon' : 'Active';
    const statusColor = isExpired ? colors.error : isDueSoon ? (colors.warning || '#F59E0B') : colors.success;

    const joiningDateStr = startDateObj
      ? startDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;
    const dueDateStr = dueDateMidnight.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: `/members/${memberId}` as any, params: { name: item.full_name, mid: item.member_id, cat: item.category || 'New' } })}
        style={[styles.card, { marginBottom: spacing.m }]}
      >
        {/* Avatar */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setZoomImageUri(item.photo_url)}
          disabled={!item.photo_url}
          style={[styles.avatar, { backgroundColor: `${avatarColor}20`, borderColor: `${avatarColor}40`, overflow: 'hidden' }]}
        >
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
          )}
        </TouchableOpacity>

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
          <View style={[styles.cardRow2, { justifyContent: 'space-between' }]}>
            <Text style={[styles.memberId, { flexShrink: 0 }]}>{item.member_id}</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 1, justifyContent: 'flex-end', marginLeft: 8 }}>
              {(activePlan ? activePlan.plan_name : item.plan_name) || item.plan_duration_months ? (
                <View style={[styles.planBadge, { flexShrink: 1, maxWidth: 120 }]}>
                  <FontAwesome name="star" size={9} color={colors.primary} style={{ flexShrink: 0 }} />
                  <Text style={[styles.planText, { color: colors.primary }]} numberOfLines={1} ellipsizeMode="tail">
                    {activePlan ? (activePlan.plan_name || `${activePlan.plan_months}M Plan`) : (item.plan_name || `${item.plan_duration_months}M Plan`)}
                  </Text>
                </View>
              ) : null}
              {item.trainer_assigned && item.trainer_assigned !== 'General' && item.trainer_assigned !== 'General Coach' ? (
                <View style={[styles.planBadge, { backgroundColor: '#EDE9FE', borderColor: '#7C3AED', flexShrink: 1, maxWidth: 100 }]}>
                  <FontAwesome name="user" size={9} color="#7C3AED" style={{ flexShrink: 0 }} />
                  <Text style={[styles.planText, { color: '#6D28D9' }]} numberOfLines={1} ellipsizeMode="tail">
                    {item.trainer_assigned}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Row 3: Dates */}
          {joiningDateStr && (
            <Text style={styles.dateRange}>
              {joiningDateStr} – {dueDateStr}
            </Text>
          )}

          {/* Row 4: Fee + Days */}
          <View style={styles.cardRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
              <Text style={styles.feeText}>₹{activePlan ? activePlan.amount : (item.monthly_fees || item.plan_fee || 0)}</Text>
              {item.pending_amount > 0 ? (
                item.amount_paid > 0 ? (
                  <View style={[styles.dueBadge, { backgroundColor: '#F59E0B18', paddingHorizontal: 4, paddingVertical: 1.5 }]}>
                    <Text style={[styles.dueText, { color: '#F59E0B', fontSize: 9 }]}>Partial</Text>
                  </View>
                ) : (
                  <View style={[styles.dueBadge, { backgroundColor: `${colors.error}15`, paddingHorizontal: 4, paddingVertical: 1.5 }]}>
                    <Text style={[styles.dueText, { color: colors.error, fontSize: 9 }]}>Due</Text>
                  </View>
                )
              ) : (
                <Text style={[styles.paidLabel, { color: colors.success, fontSize: 9 }]}>Paid</Text>
              )}
              {item.timing ? (() => {
                // Determine shift label from timing string
                const t = item.timing.toLowerCase();
                const hourMatch = t.match(/(\d{1,2})\s*(?::\d{2})?\s*(am|pm)/i);
                let shiftLabel = '⏰ Shift';
                let shiftBg = isDark ? 'rgba(59, 130, 246, 0.12)' : '#E0F2FE';
                let shiftColor = '#0284C7';

                // Extract start hour in 24h
                let startHour = -1;
                const timeMatches = [...t.matchAll(/(\d{1,2})(?::\d{2})?\s*(am|pm)/gi)];
                if (timeMatches.length > 0) {
                  const h = parseInt(timeMatches[0][1]);
                  const period = timeMatches[0][2].toLowerCase();
                  startHour = period === 'pm' && h !== 12 ? h + 12 : (period === 'am' && h === 12 ? 0 : h);
                }

                if (startHour >= 4 && startHour < 12) {
                  shiftLabel = '🌅 Morning';
                  shiftBg = isDark ? 'rgba(251, 191, 36, 0.12)' : '#FEF9C3';
                  shiftColor = '#B45309';
                } else if (startHour >= 12 && startHour < 17) {
                  shiftLabel = '☀️ Afternoon';
                  shiftBg = isDark ? 'rgba(249, 115, 22, 0.12)' : '#FFEDD5';
                  shiftColor = '#C2410C';
                } else if (startHour >= 17 || startHour === 0) {
                  shiftLabel = '🌆 Evening';
                  shiftBg = isDark ? 'rgba(139, 92, 246, 0.12)' : '#EDE9FE';
                  shiftColor = '#7C3AED';
                }

                return (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: shiftBg,
                    paddingHorizontal: 5, paddingVertical: 2,
                    borderRadius: 4, gap: 2,
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: shiftColor }}>{shiftLabel}</Text>
                  </View>
                );
              })() : null}

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
            {isInitialLoading ? (
              <Skeleton width={110} height={14} style={{ marginTop: 4 }} />
            ) : (
              <Text style={styles.headerSubtitle}>Total Members {members.length.toLocaleString()}</Text>
            )}
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
      {isInitialLoading ? (
        <ScrollView style={styles.listContent} showsVerticalScrollIndicator={false}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <View key={i} style={styles.cardWrapper}>
              <View style={styles.card}>
                <Skeleton width={52} height={52} borderRadius={26} style={{ marginRight: spacing.m, alignSelf: 'flex-start', marginTop: 2 }} />
                <View style={styles.cardBody}>
                  <View style={styles.cardRow}>
                    <Skeleton width={130} height={18} />
                    <Skeleton width={65} height={20} borderRadius={10} />
                  </View>
                  <Skeleton width={90} height={14} style={{ marginBottom: 6 }} />
                  <Skeleton width={130} height={12} style={{ marginBottom: 12 }} />
                  <View style={styles.cardRow}>
                    <Skeleton width={60} height={18} />
                    <Skeleton width={45} height={26} borderRadius={6} />
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View style={styles.actionsRow}>
                    <Skeleton width={80} height={36} borderRadius={8} style={{ flex: 1 }} />
                    <Skeleton width={80} height={36} borderRadius={8} style={{ flex: 1 }} />
                    <Skeleton width={100} height={36} borderRadius={8} style={{ flex: 1.2 }} />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredMembers}
          renderItem={renderMember}
          keyExtractor={(item, idx) => `${item.id || item._id || 'mem'}_${idx}`}
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
      )}

      {/* Image Zoom Modal */}
      <Modal visible={!!zoomImageUri} transparent animationType="fade" onRequestClose={() => setZoomImageUri(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.zoomContainer} onPress={() => setZoomImageUri(null)}>
          <View style={styles.zoomCloseBtn}>
            <FontAwesome name="times" size={20} color="#fff" />
          </View>
          {zoomImageUri && (
            <Image source={{ uri: zoomImageUri }} style={styles.zoomImage} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
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
  cardWrapper: { marginBottom: spacing.m, borderRadius: borderRadius.xl, overflow: 'hidden' },
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
    height: 36, borderRadius: borderRadius.m,
    borderWidth: 1,
    backgroundColor: isDark ? '#111827' : '#F9FAFB',
  },
  actionText: { fontSize: 11, fontWeight: '600' },
  renewBtn: { flex: 1.2, height: 36, borderRadius: borderRadius.m, overflow: 'hidden' },
  renewGradient: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingHorizontal: 10,
  },
  renewText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Empty
  emptyContainer: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted },

  // Zoom styles
  zoomContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  zoomCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 25,
    zIndex: 999,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: {
    width: Dimensions.get('window').width * 0.95,
    height: Dimensions.get('window').width * 0.95,
    borderRadius: 16,
  },
});
