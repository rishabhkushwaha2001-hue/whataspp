import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, Linking, TouchableOpacity, RefreshControl, Alert, TextInput, Switch } from 'react-native';
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
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [activeOffers, setActiveOffers] = useState<any[]>([]);
  const [appendOffers, setAppendOffers] = useState(true);
  const [reminderTemplate, setReminderTemplate] = useState<string | null>(null);
  const [renewalTemplate, setRenewalTemplate] = useState<string | null>(null);
  const router = useRouter();

  // ── Today's Queue State ────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'due' | 'queue'>('due');
  const [queueData, setQueueData] = useState<any>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueCategory, setQueueCategory] = useState<'all' | 'birthday' | 'expiring' | 'overdue'>('all');

  const QUEUE_CATS = [
    { key: 'birthday' as const, label: 'Birthday', icon: 'birthday-cake', color: '#EC4899' },
    { key: 'expiring' as const, label: 'Expiring', icon: 'clock-o',       color: '#F59E0B' },
    { key: 'overdue'  as const, label: 'Expired',  icon: 'exclamation-circle', color: '#EF4444' },
  ];

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await api.get('/reminders/today');
      setQueueData(res.data);
    } catch (e) {
      console.warn('Queue fetch failed', e);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const getQueueMembers = () => {
    if (!queueData) return [];
    let list: any[] = [];
    if (queueCategory === 'all') list = [
      ...(queueData.birthdays || []),
      ...(queueData.expiring_soon || []),
      ...(queueData.overdue || []),
    ];
    else if (queueCategory === 'birthday') list = queueData.birthdays || [];
    else if (queueCategory === 'expiring') list = queueData.expiring_soon || [];
    else if (queueCategory === 'overdue')  list = queueData.overdue || [];
    // Filter out already sent members — they disappear from the list
    return list.filter((m: any) => !sentMap[m._id]);
  };

  const getSentCount = () => Object.keys(sentMap).length;

  const appendOfferToMessage = (msg: string) => {
    if (!appendOffers || activeOffers.length === 0) return msg;
    const bestOffer = activeOffers[0];
    const discount = bestOffer.discount_type === 'Percentage' ? `${bestOffer.discount_value}%` : `₹${bestOffer.discount_value}`;
    const expiry = bestOffer.valid_until ? ` before ${new Date(bestOffer.valid_until).toLocaleDateString()}` : '';
    return `${msg}\n\n🎁 *Special Offer:* Use "${bestOffer.name}" to get ${discount} OFF on your next renewal${expiry}!`;
  };

  const handleQueueSend = async (member: any) => {
    const finalMsg = appendOfferToMessage(member.message_hint);
    const success = await sendWhatsAppMessage(member.phone, finalMsg);
    if (success) {
      setSentMap(prev => ({ ...prev, [member._id]: true }));
      try {
        await api.post('/messages/log', { recipient_phone: member.phone, message_body: finalMsg, status: 'sent' });
      } catch {}
    }
  };

  const handleSendAll = async () => {
    const members = getQueueMembers().filter((m: any) => !sentMap[m._id]);
    for (const m of members) {
      const finalMsg = appendOfferToMessage(m.message_hint);
      await sendWhatsAppMessage(m.phone, finalMsg);
      setSentMap(prev => ({ ...prev, [m._id]: true }));
      await new Promise(r => setTimeout(r, 700));
    }
  };

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
      fetchQueue();

      const fetchOffers = async () => {
        try {
          const res = await api.get('/offers/');
          setActiveOffers(res.data.filter((o: any) => o.is_active));
        } catch (e) { }
      };
      fetchOffers();

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
          setReminderTemplate(dbReminder && typeof dbReminder === 'string' && dbReminder.trim() ? dbReminder : null);
          setRenewalTemplate(dbRenewal && typeof dbRenewal === 'string' && dbRenewal.trim() ? dbRenewal : null);
        } catch (e) {
          const storedName = await AsyncStorage.getItem('gymName');
          if (storedName) setGymName(storedName);
        }
      };
      loadSettings();

      // Auto-refresh every 60 seconds while focused
      const interval = setInterval(fetchDueMembers, 60000);

      return () => clearInterval(interval);
    }, [fetchDueMembers, fetchQueue])
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
    amountPaid?: number,
    appliedOfferName?: string
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
        applied_offer_name: appliedOfferName
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

      {/* Header */}
      <View style={[styles.header, { paddingTop: 56 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.title}>Reminders</Text>
            <Text style={styles.subtitle}>
              {mainTab === 'due' ? 'Upcoming renewals within 5 days' : new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}
            </Text>
          </View>
          {mainTab === 'queue' && queueData?.total > 0 && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#25D366', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
              onPress={handleSendAll}
            >
              <FontAwesome name="whatsapp" size={14} color="white" />
              <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>Send All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Main Tab Switcher */}
        <View style={[styles.mainTabRow, { backgroundColor: colors.surfaceLight || colors.background, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.mainTab, mainTab === 'due' && { backgroundColor: colors.primary }]}
            onPress={() => setMainTab('due')}
          >
            <FontAwesome name="clock-o" size={13} color={mainTab === 'due' ? 'white' : colors.textMuted} />
            <Text style={[styles.mainTabText, { color: mainTab === 'due' ? 'white' : colors.textMuted }]}>Due Renewals</Text>
            {filteredMembers.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: mainTab === 'due' ? 'rgba(255,255,255,0.3)' : colors.primary }]}>
                <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{filteredMembers.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mainTab, mainTab === 'queue' && { backgroundColor: '#EC4899' }]}
            onPress={() => setMainTab('queue')}
          >
            <FontAwesome name="magic" size={13} color={mainTab === 'queue' ? 'white' : colors.textMuted} />
            <Text style={[styles.mainTabText, { color: mainTab === 'queue' ? 'white' : colors.textMuted }]}>Today's Queue</Text>
            {queueData?.total > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: mainTab === 'queue' ? 'rgba(255,255,255,0.3)' : '#EC4899' }]}>
                <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{queueData.total}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search — only for due tab */}
        {mainTab === 'due' && (
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
        )}
      </View>
      {/* Due Renewals Tab */}
      {mainTab === 'due' && (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item, idx) => `${item.id || item._id || 'item'}_${idx}`}
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
      )}

      {/* Today's Queue Tab */}
      {mainTab === 'queue' && (
        <ScrollView
          contentContainerStyle={{ padding: spacing.m, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={queueLoading} onRefresh={fetchQueue} tintColor="#EC4899" />}
        >
          {/* Category filter chips */}
          {queueData && (
            <>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.m }}>
                <TouchableOpacity
                  style={[styles.catChip, { borderColor: queueCategory === 'all' ? colors.primary : colors.border, backgroundColor: queueCategory === 'all' ? `${colors.primary}15` : colors.surface }]}
                  onPress={() => setQueueCategory('all')}
                >
                  <Text style={{ color: queueCategory === 'all' ? colors.primary : colors.textMuted, fontSize: 11, fontWeight: '700' }}>All {queueData.total}</Text>
                </TouchableOpacity>
                {QUEUE_CATS.map(cat => {
                  const count = cat.key === 'birthday' ? queueData.summary?.birthdays :
                                cat.key === 'expiring' ? queueData.summary?.expiring_soon :
                                queueData.summary?.overdue;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.catChip, { borderColor: queueCategory === cat.key ? cat.color : colors.border, backgroundColor: queueCategory === cat.key ? `${cat.color}15` : colors.surface }]}
                      onPress={() => setQueueCategory(cat.key)}
                    >
                      <FontAwesome name={cat.icon as any} size={11} color={cat.color} />
                      <Text style={{ color: queueCategory === cat.key ? cat.color : colors.textMuted, fontSize: 11, fontWeight: '700' }}>{cat.label} {count || 0}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sent progress banner */}
              {getSentCount() > 0 && (
                <View style={[styles.sentBanner, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                  <FontAwesome name="check-circle" size={14} color="#16A34A" />
                  <Text style={{ color: '#16A34A', fontSize: 12, fontWeight: '700', flex: 1 }}>
                    {getSentCount()} message{getSentCount() > 1 ? 's' : ''} sent today! 💬
                  </Text>
                  <TouchableOpacity onPress={() => setSentMap({})}>
                    <Text style={{ color: '#16A34A', fontSize: 11, textDecorationLine: 'underline' }}>Undo</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Offers toggle in Queue */}
              {activeOffers.length > 0 && (
                <TouchableOpacity 
                  style={[styles.offersToggleCard, { backgroundColor: appendOffers ? `${colors.primary}15` : colors.surfaceLight, borderColor: appendOffers ? colors.primary : colors.border }]}
                  onPress={() => setAppendOffers(!appendOffers)}
                >
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <FontAwesome name="gift" size={16} color={appendOffers ? colors.primary : colors.textMuted} />
                    <View>
                      <Text style={{fontSize: 13, fontWeight: '700', color: appendOffers ? colors.primary : colors.text}}>Append Active Offers</Text>
                      <Text style={{fontSize: 11, color: colors.textSecondary}}>"{activeOffers[0].name}" will be added to messages.</Text>
                    </View>
                  </View>
                  <Switch 
                    value={appendOffers} 
                    onValueChange={setAppendOffers} 
                    trackColor={{ true: colors.primary, false: colors.border }} 
                    style={{ transform: [{ scale: 0.8 }] }}
                  />
                </TouchableOpacity>
              )}

              {getQueueMembers().length === 0 ? (
                <View style={[styles.emptyContainer, { marginTop: 40 }]}>
                  <Text style={{ fontSize: 48 }}>{getSentCount() > 0 ? '🎉' : '🎉'}</Text>
                  <Text style={styles.emptyTitle}>
                    {getSentCount() > 0 ? `${getSentCount()} sent! All done!` : 'All caught up!'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {getSentCount() > 0
                      ? 'All reminders for this category have been sent.'
                      : 'No reminders for this category today'}
                  </Text>
                </View>
              ) : (
                getQueueMembers().map((m: any, idx: number) => {
                  const catColor = QUEUE_CATS.find(c => c.key === m.category)?.color || '#8B5CF6';
                  return (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      key={`${m._id}_${idx}`}
                      onPress={() => router.push(`/members/${m._id}`)}
                      style={[styles.queueCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: catColor }]}
                    >
                      <View style={[styles.queueAvatar, { backgroundColor: `${catColor}18` }]}>
                        <Text style={[styles.avatarText, { color: catColor }]}>{(m.full_name || '?')[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, { marginBottom: 2 }]}>{m.full_name}</Text>
                        <Text style={styles.memberId}>{m.phone}</Text>
                        <View style={[styles.labelBadge, { backgroundColor: `${catColor}15`, alignSelf: 'flex-start', marginTop: 4 }]}>
                          <Text style={{ color: catColor, fontSize: 10, fontWeight: '700' }}>{m.label}</Text>
                        </View>
                        {m.monthly_fees ? <Text style={[styles.memberId, { marginTop: 2 }]}>Fees: ₹{m.monthly_fees}</Text> : null}
                      </View>
                      <TouchableOpacity
                        style={[styles.queueWaBtn, { backgroundColor: '#25D366' }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleQueueSend(m);
                        }}
                      >
                        <FontAwesome name="whatsapp" size={18} color="white" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
          {queueLoading && !queueData && (
            <View style={{ gap: 12 }}>
              {[1,2,3].map(i => <View key={i} style={[styles.queueCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.border, height: 85 }]} />)}
            </View>
          )}
        </ScrollView>
      )}
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

  // Main tab switcher
  mainTabRow: {
    flexDirection: 'row', gap: 6, marginTop: spacing.m,
    borderRadius: borderRadius.m, padding: 4,
    borderWidth: 1,
  },
  mainTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: borderRadius.s - 2,
  },
  mainTabText: { fontSize: 12, fontWeight: '700' },
  tabBadge: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },

  // Category chips
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: borderRadius.full, borderWidth: 1.5,
  },

  // Queue member card
  queueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16,
    borderWidth: 1, borderLeftWidth: 4,
    marginBottom: 10,
    ...shadows.light,
  },
  queueAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  labelBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full,
  },
  queueWaBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.medium,
  },
  sentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: borderRadius.m, borderWidth: 1,
    marginBottom: spacing.m,
  },
  offersToggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, borderRadius: borderRadius.m, borderWidth: 1,
    marginBottom: spacing.m,
  }
});
