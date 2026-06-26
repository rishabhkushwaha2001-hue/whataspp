import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Linking, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { RenewalModal } from '../components/RenewalModal';
import { fetchMessageTemplates, buildReminderMessage, buildRenewalMessage, getDefaultTemplates } from '../services/messageTemplates';

export const RemindersScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
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
      
      // Apply filters locally on fresh data
      let filtered = res.data;
      if (search) {
        filtered = res.data.filter((m: any) => 
          m.full_name.toLowerCase().includes(search.toLowerCase()) || 
          m.phone.includes(search) ||
          m.member_id?.toLowerCase().includes(search.toLowerCase())
        );
      }
      setFilteredMembers(filtered);
    } catch (error) {
      console.warn('Reminders fetch failed');
    } finally {
      setRefreshing(false);
    }
  }, [search]);

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
          setReminderTemplate((dbReminder && dbReminder.trim()) ? dbReminder : defaults.reminder);
          setRenewalTemplate((dbRenewal && dbRenewal.trim()) ? dbRenewal : defaults.renewal);
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
    applyFilters(members, text);
  };

  const sendReminder = async (member: any) => {
    const dueDate = new Date(member.next_due_date).toLocaleDateString();
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
    setShowRenewModal(false);
    if (!renewingMember) return;
    try {
      await api.post(`/members/${renewingMember.id || renewingMember._id}/renew`, {
        plan_duration_months: durationMonths,
        amount: amount,
        amount_paid: amountPaid,
        payment_mode: paymentMode,
        next_due_date: nextDueDate,
        joining_date: joiningDate,
        daily_hours: hours,
        timing: timing,
        allocated_seat: allocatedSeat,
      });
      fetchDueMembers();
      // Use nextDueDate directly (already selected by user) — no API response needed
      const nextDue = nextDueDate ? new Date(nextDueDate).toLocaleDateString() : 'N/A';
      const msg = buildRenewalMessage(renewalTemplate, businessType, {
        name: renewingMember.full_name,
        phone: renewingMember.phone,
        date: nextDue,
        fees: amountPaid ? amountPaid : amount,
        hours: hours ?? renewingMember.daily_hours,
        timing: timing ?? renewingMember.timing,
        gym: gymName,
        durationMonths,
        seat: businessType === 'library' ? (allocatedSeat || renewingMember.allocated_seat || 'Unassigned') : undefined,
        wifi: businessType === 'library' ? (wifiDetails || 'Not Provided') : undefined,
      });
      setAlertConfig({
        visible: true,
        title: "Success",
        message: "Membership renewed successfully!",
        type: "success",
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
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id || item._id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDueMembers} tintColor={colors.primary} />}
        ListHeaderComponent={() => (
          <View style={styles.header}>
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
        )}
        renderItem={({ item }) => {
          const isExpired = item.remaining_days <= 0;
          const initials = item.full_name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
          const avatarColors = ['#8B5CF6','#EC4899','#10B981','#F59E0B','#3B82F6'];
          const avatarColor = avatarColors[item.full_name.charCodeAt(0) % avatarColors.length];
          return (
            <TouchableOpacity activeOpacity={0.75} onPress={() => router.push(`/members/${item.id || item._id}`)}>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.accentBar, { backgroundColor: isExpired ? colors.error : colors.warning }]} />
                <View style={styles.cardInner}>
                  <View style={styles.topRow}>
                    <View style={[styles.avatar, { backgroundColor: `${avatarColor}20` }]}>
                      <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
                    </View>
                    <View style={styles.nameBlock}>
                      <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{item.full_name}</Text>
                      <Text style={[styles.memberPhone, { color: colors.textMuted }]}>{item.phone}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: isExpired ? `${colors.error}15` : `${colors.warning}15` }]}>
                      <Text style={[styles.badgeText, { color: isExpired ? colors.error : colors.warning }]}>
                        {isExpired ? 'EXPIRED' : `${item.remaining_days}d left`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <View style={styles.infoChip}>
                      <FontAwesome name="calendar" size={10} color={colors.textMuted} />
                      <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        {new Date(item.next_due_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                      </Text>
                    </View>
                    <View style={styles.infoChip}>
                      <FontAwesome name="money" size={10} color={colors.accent} />
                      <Text style={[styles.infoText, { color: colors.textSecondary }]}>₹{item.monthly_fees}</Text>
                    </View>
                    <View style={styles.infoChip}>
                      <FontAwesome name="clock-o" size={10} color={colors.primary} />
                      <Text style={[styles.infoText, { color: colors.textSecondary }]}>{item.plan_duration_months}M Plan</Text>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#25D36615', borderColor: '#25D36630' }]}
                      onPress={() => sendReminder(item)}
                    >
                      <FontAwesome name="whatsapp" size={14} color="#25D366" />
                      <Text style={[styles.actionText, { color: '#25D366' }]}>Remind</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}
                      onPress={() => handleRenew(item)}
                    >
                      <FontAwesome name="refresh" size={14} color={colors.primary} />
                      <Text style={[styles.actionText, { color: colors.primary }]}>Renew</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.accent}15` }]}>
              <FontAwesome name="check-circle" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>All caught up!</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>No renewals due in the next 5 days</Text>
          </View>
        )}
      />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
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
  card: {
    flexDirection: 'row', borderRadius: borderRadius.l,
    marginBottom: spacing.m, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  accentBar: { width: 4 },
  cardInner: { flex: 1, padding: spacing.m },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { fontSize: 14, fontWeight: '800' },
  nameBlock: { flex: 1, marginRight: 8 },
  memberName: { fontSize: 15, fontWeight: '700' },
  memberPhone: { fontSize: 12, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.full },
  badgeText: { fontSize: 10, fontWeight: '800' },

  infoRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.s },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 12 },
  divider: { height: 1, marginBottom: spacing.s },

  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: borderRadius.m, borderWidth: 1,
  },
  actionText: { fontSize: 12, fontWeight: '700' },

  emptyContainer: { marginTop: 80, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySubtitle: { fontSize: 13 },

  // legacy (kept for safety)
  infoContainer: { flex: 1 },
  mainInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberDue: { fontSize: 12, color: colors.textMuted },
});
