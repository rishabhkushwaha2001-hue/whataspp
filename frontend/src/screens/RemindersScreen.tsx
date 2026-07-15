import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Linking, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
import { invalidateCache } from '../hooks/useDataStore';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { RenewalModal } from '../components/RenewalModal';
import { fetchMessageTemplates, buildReminderMessage, buildRenewalMessage, getDefaultTemplates } from '../services/messageTemplates';

export const RemindersScreen = () => {
  const { theme, colors } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(colors, isDark);
  const [members, setMembers] = useState<any[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [renewingMember, setRenewingMember] = useState<any>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [gymName, setGymName] = useState('Gym');
  const [businessType, setBusinessType] = useState('gym');
  const [enableHours, setEnableHours] = useState(false);
  const [reminderTemplate, setReminderTemplate] = useState<string | null>(null);
  const [renewalTemplate, setRenewalTemplate] = useState<string | null>(null);
  const router = useRouter();

  const applyFilters = useCallback((data: any[], searchText: string) => {
    let filtered = data;
    if (searchText) {
      filtered = filtered.filter(m => 
        m.full_name.toLowerCase().includes(searchText.toLowerCase()) || 
        m.phone.includes(searchText) ||
        m.member_id?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    setFilteredMembers(filtered);
  }, []);

  const fetchDueMembers = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/members/status/due?days_ahead=5');
      setMembers(res.data);
    } catch (error) {
      console.warn('Reminders fetch failed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    applyFilters(members, search);
  }, [members, search, applyFilters]);

  useFocusEffect(
    useCallback(() => {
      fetchDueMembers();

      const loadSettings = async () => {
        try {
          const templates = await fetchMessageTemplates();
          setGymName(templates.gymName);
          setBusinessType(templates.businessType);
          setEnableHours(templates.enableHours);
          // Use DB template if non-empty, else fallback to system default
          const defaults = getDefaultTemplates(templates.businessType);
          const dbReminder = templates.reminderTemplate;
          const dbRenewal = templates.renewalTemplate;
          setReminderTemplate((dbReminder && dbReminder.trim()) ? dbReminder : null);
          setRenewalTemplate((dbRenewal && dbRenewal.trim()) ? dbRenewal : null);
        } catch (e) {
          const storedName = await AsyncStorage.getItem('gymName');
          if (storedName) setGymName(storedName);
        }
      };
      loadSettings();

      // Auto-refresh every 60 seconds while focused
      const interval = setInterval(fetchDueMembers, 60000);

      return () => clearInterval(interval);
    }, [fetchDueMembers])
  );

  const handleSearch = (text: string) => {
    setSearch(text);
  };

  const sendReminder = async (member: any) => {
    const dueDate = new Date(member.next_due_date).toLocaleDateString();
    const isExpired = new Date(member.next_due_date) < new Date(new Date().setHours(0,0,0,0));
    
    const message = buildReminderMessage(
      reminderTemplate,
      businessType,
      {
        name: member.full_name,
        date: dueDate,
        fees: member.monthly_fees,
        hours: member.daily_hours,
        timing: member.timing,
        gym: gymName,
        isExpired,
      }
    );
    
    try {
      await api.post('/messages/log', {
        recipient_phone: member.phone,
        message_body: message,
        status: 'sent'
      });
      
      const success = await sendWhatsAppMessage(member.phone, message);
      if (!success) {
        setAlertConfig({ visible: true, title: 'WhatsApp Error', message: 'WhatsApp app could not be opened on this device. Please install it first.', type: 'error' });
      }
    } catch (error: any) {
      console.error('Log or Link failed', error);
      setAlertConfig({
        visible: true,
        title: 'Warning',
        message: 'Could not complete the action. The number might be invalid or WhatsApp is not responding.',
        type: 'warning',
        showCancel: true,
        cancelText: 'Cancel',
        confirmText: 'Try Anyway',
        onConfirm: async () => {
          setAlertConfig({ visible: false });
          setTimeout(async () => {
            const success = await sendWhatsAppMessage(member.phone, message);
            if (!success) {
              setAlertConfig({ visible: true, title: 'Error', message: 'Invalid WhatsApp Number or Link', type: 'error' });
            }
          }, 500);
        }
      });
    }
  };

  const handleRenew = (member: any) => {
    setRenewingMember(member);
    setShowRenewModal(true);
  };

  const confirmRenewal = async (
    durationMonths: number, 
    amount: number, 
    paymentMode: string, 
    nextDueDate?: string, 
    joiningDate?: string,
    hours?: number,
    timing?: string,
    allocatedSeat?: string,
    wifiDetails?: string,
    amountPaid?: number
  ) => {
    if (!renewingMember) return { success: false };
    try {
      await api.post(`/members/${renewingMember.id || renewingMember._id}/renew`, {
        plan_duration_months: durationMonths,
        amount: amount,
        amount_paid: amountPaid ?? null,
        payment_mode: paymentMode,
        next_due_date: nextDueDate,
        joining_date: joiningDate,
        daily_hours: hours,
        timing: timing,
        allocated_seat: allocatedSeat,
      });
      invalidateCache('members', 'dashboard_month', 'dashboard_all');
      fetchDueMembers();
      
      const nextDue = nextDueDate ? new Date(nextDueDate).toLocaleDateString() : 'N/A';
      const msg = buildRenewalMessage(renewalTemplate, businessType, {
        name: renewingMember.full_name,
        phone: renewingMember.phone,
        date: nextDue,
        joining_date: joiningDate ? new Date(joiningDate).toLocaleDateString() : 'N/A',
        paid_date: new Date().toLocaleDateString(),
        fees: amount,
        amountPaid: amountPaid ?? undefined,
        hours: hours ?? renewingMember.daily_hours,
        timing: timing ?? renewingMember.timing,
        gym: gymName,
        durationMonths,
        seat: businessType === 'library' ? (allocatedSeat || renewingMember.allocated_seat || 'Unassigned') : undefined,
        wifi: businessType === 'library' ? (wifiDetails || 'Not Provided') : undefined,
      });
      return { success: true, message: msg };
    } catch (error) {
      return { success: false };
    }
  };

  return (
    <View style={styles.container}>
      <CustomAlert 
        {...alertConfig} 
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      />
      <RenewalModal
        visible={showRenewModal}
        member={renewingMember}
        enableHours={enableHours}
        businessType={businessType}
        onClose={() => setShowRenewModal(false)}
        onConfirm={confirmRenewal}
      />
      <View style={[styles.header, { paddingTop: 56 }]}>
        <Text style={styles.title}>Due Reminders</Text>
        <Text style={styles.subtitle}>Upcoming renewals within 5 days</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
          <FontAwesome name="search" size={14} color={colors.textMuted} />
          <TextInput
            placeholder="Search name, phone or ID..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={handleSearch}
          />
        </View>
      </View>
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id || item._id}
        contentContainerStyle={[styles.content, { paddingTop: 10 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDueMembers} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const now = new Date();
          const dueDate = new Date(item.next_due_date);
          const isExpired = dueDate < now;
          const daysLeft = item.remaining_days;
          const isDueSoon = !isExpired && daysLeft <= 7;
          const memberId = item.id || item._id;

          const initials = item.full_name
            .split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
          const avatarColors = ['#8B5CF6','#EC4899','#10B981','#F59E0B','#3B82F6'];
          const avatarColor = avatarColors[item.full_name.charCodeAt(0) % avatarColors.length];

          const statusLabel = isExpired ? 'Expired' : isDueSoon ? 'Due Soon' : 'Active';
          const statusColor = isExpired ? colors.error : isDueSoon ? (colors.warning || '#F59E0B') : colors.success;

          const joiningDateStr = item.joining_date
            ? new Date(item.joining_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : null;
          const dueDateStr = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

          return (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push(`/members/${memberId}`)}
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
                    <Text style={styles.memberId}>{item.member_id || item.phone}</Text>
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
                          <Text style={[styles.dueText, { color: colors.error }]}>Partial</Text>
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
                      onPress={() => sendReminder(item)}
                    >
                      <FontAwesome name="whatsapp" size={13} color="#25D366" />
                      <Text style={[styles.actionText, { color: colors.textSecondary }]}>Remind</Text>
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
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <FontAwesome name="check-circle" size={48} color={colors.success} />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>No renewals due in the next 5 days</Text>
          </View>
        )}
      />
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.m, paddingTop: 56, paddingBottom: 100 },
  header: { marginBottom: spacing.l, paddingHorizontal: spacing.s },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: borderRadius.m, paddingHorizontal: spacing.m,
    height: 44, borderWidth: 1, marginTop: spacing.m,
  },
  searchInput: { flex: 1, fontSize: 14 },

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

  emptyContainer: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted },
});
