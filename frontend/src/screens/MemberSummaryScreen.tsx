import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Image, Linking, Modal, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { CustomAlert } from '../components/CustomAlert';
import { useAppAlert } from '../hooks/useAppAlert';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { EditMemberModal } from '../components/EditMemberModal';
import { EditPaymentModal } from '../components/EditPaymentModal';
import { RenewalModal } from '../components/RenewalModal';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { invalidateCache } from '../hooks/useDataStore';
import { fetchMessageTemplates, buildPaymentReceiptMessage, buildRenewalMessage, getDefaultTemplates } from '../services/messageTemplates';
import { Skeleton } from '../components/Skeleton';

const { width } = Dimensions.get('window');

export const MemberSummaryScreen = () => {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(colors, isDark);

  const { id, name, mid, cat } = useLocalSearchParams<{ id: string, name?: string, mid?: string, cat?: string }>();
  const router = useRouter();

  const [member, setMember] = useState<any>(name ? {
    full_name: name, member_id: mid, category: cat, _id: id
  } : null);

  const [loading, setLoading] = useState(!name);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [businessType, setBusinessType] = useState('gym');
  const [enableHours, setEnableHours] = useState(false);
  const [gymName, setGymName] = useState('Gym');
  const [renewalTemplate, setRenewalTemplate] = useState<string | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [editPaymentState, setEditPaymentState] = useState<{ visible: boolean; payment: any }>({ visible: false, payment: null });
  const [showPlanTooltip, setShowPlanTooltip] = useState(false);
  const [showTopPlanTooltip, setShowTopPlanTooltip] = useState(false);

  const refreshMember = async () => {
    const cleanId = Array.isArray(id) ? id[0] : id;
    if (!cleanId || cleanId === 'undefined') return;
    try {
      const res = await api.get(`/members/${cleanId}`);
      setMember(res.data);
    } catch (e) {
      console.warn('Refresh failed');
    }
  };

  useEffect(() => {
    const fetchMember = async () => {
      const cleanId = Array.isArray(id) ? id[0] : id;
      if (!cleanId || cleanId === 'undefined') {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get(`/members/${cleanId}`);
        setMember(res.data);
      } catch (error: any) {
        setAlertConfig({ visible: true, title: "Error", message: "Could not load details", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchMember();

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
  }, [id]);

  if (loading) return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <FontAwesome name="arrow-left" size={16} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Member Details</Text>
        <View style={[styles.iconBtn, { marginLeft: 'auto', marginRight: 8, opacity: 0.5 }]} />
        <View style={[styles.iconBtn, { opacity: 0.5 }]} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.m }} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={[styles.profileGradient, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderColor: 'transparent' }]}>
            <View style={styles.profileTopRow}>
              <Skeleton width={72} height={72} borderRadius={36} style={{ marginRight: 16 }} />
              <View style={styles.profileInfoBox}>
                <Skeleton width={150} height={24} style={{ marginBottom: 8 }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Skeleton width={80} height={14} />
                  <Skeleton width={60} height={14} />
                </View>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
                  <Skeleton width={70} height={20} borderRadius={4} />
                  <Skeleton width={90} height={20} borderRadius={4} />
                </View>
              </View>
            </View>
          </View>
          <View style={styles.mainActionsRow}>
            <Skeleton width={80} height={40} borderRadius={borderRadius.m} style={{ flex: 1 }} />
            <Skeleton width={80} height={40} borderRadius={borderRadius.m} style={{ flex: 1 }} />
            <Skeleton width={100} height={40} borderRadius={borderRadius.m} style={{ flex: 1.5 }} />
          </View>
        </View>

        <Skeleton width={140} height={18} style={{ marginBottom: spacing.m, marginLeft: 4 }} />
        <View style={styles.card}>
          <View style={styles.planDateRow}>
            <Skeleton width={160} height={20} />
            <Skeleton width={44} height={44} borderRadius={22} />
          </View>
          <Skeleton width="100%" height={6} borderRadius={3} style={{ marginBottom: 8 }} />
          <View style={styles.progressLabels}>
            <Skeleton width={80} height={14} />
            <Skeleton width={80} height={14} />
          </View>
          <View style={styles.grid2x2}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={styles.gridItem}>
                <Skeleton width={32} height={32} borderRadius={16} />
                <View>
                  <Skeleton width={50} height={12} style={{ marginBottom: 4 }} />
                  <Skeleton width={70} height={16} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <Skeleton width={120} height={18} style={{ marginBottom: spacing.m, marginLeft: 4 }} />
        <View style={styles.quickActionsGrid}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={styles.quickActionCard}>
              <Skeleton width={36} height={36} borderRadius={10} style={{ marginBottom: 6 }} />
              <Skeleton width={50} height={12} />
            </View>
          ))}
        </View>

        <Skeleton width={130} height={18} style={{ marginBottom: spacing.m, marginLeft: 4 }} />
        <View style={styles.card}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[styles.detailItem, { borderBottomWidth: i === 3 ? 0 : 1, borderBottomColor: colors.border }]}>
              <Skeleton width={14} height={14} style={{ marginRight: 8 }} />
              <Skeleton width={100} height={14} style={{ flex: 1 }} />
              <Skeleton width={120} height={14} style={{ flex: 1, alignItems: 'flex-end' }} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
  if (!member) return <View style={styles.container}><Text style={{ color: colors.text }}>Member not found</Text></View>;

  // Sort payments by start_date ascending to identify active and upcoming plans
  const sortedPayments = useMemo(() => {
    return (member?.payment_history || []).slice().sort((a: any, b: any) => {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });
  }, [member?.payment_history]);

  const now = new Date();

  // Find active and upcoming plans
  const { activePlan, upcomingPlans } = useMemo(() => {
    let active: any = null;
    let upcoming: any[] = [];
    
    if (sortedPayments.length > 0) {
      // Find the payment plan that includes today's date
      for (let i = 0; i < sortedPayments.length; i++) {
        const p = sortedPayments[i];
        const sDate = new Date(p.start_date);
        const eDate = new Date(p.end_date);
        if (now >= sDate && now <= eDate) {
          active = p;
          upcoming = sortedPayments.filter((item: any) => new Date(item.start_date) > new Date(active.end_date));
          break;
        }
      }

      // If no plan matches current date (e.g. member is expired or plans are in future)
      if (!active) {
        const allPast = sortedPayments.filter((p: any) => new Date(p.end_date) < now);
        if (allPast.length > 0) {
          active = allPast[allPast.length - 1];
          upcoming = sortedPayments.filter((p: any) => new Date(p.start_date) > new Date(active.end_date));
        } else {
          active = sortedPayments[0];
          upcoming = sortedPayments.slice(1);
        }
      }
    }
    return { activePlan: active, upcomingPlans: upcoming };
  }, [sortedPayments]);

  const expiryDate = activePlan?.end_date ? new Date(activePlan.end_date) : (member?.next_due_date ? new Date(member.next_due_date) : null);
  const startDate = activePlan?.start_date ? new Date(activePlan.start_date) : (member?.joining_date ? new Date(member.joining_date) : null);
  
  const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - new Date().getTime()) / 86400000) : 0;
  const isExpired = daysRemaining < 0;
  const isDueSoon = !isExpired && daysRemaining <= 7;
  const statusLabel = isExpired ? 'Expired' : isDueSoon ? 'Due Soon' : 'Active';
  const statusColor = isExpired ? colors.error : isDueSoon ? (colors.warning || '#F59E0B') : colors.success;

  // Calculate Progress Percentage for Current Plan
  let progressPercent = 100;
  let totalPlanDays = 30; // Default
  if (expiryDate && startDate) {
    totalPlanDays = Math.ceil((expiryDate.getTime() - startDate.getTime()) / 86400000) || 30;
    const daysPassed = totalPlanDays - daysRemaining;
    progressPercent = Math.min(100, Math.max(0, (daysPassed / totalPlanDays) * 100));
  }

  const handleDelete = () => {
    setAlertConfig({
      visible: true, title: "Delete Member",
      message: `Are you sure you want to permanently delete ${member?.full_name}?`,
      type: "warning", showCancel: true, confirmText: "Delete",
      onConfirm: async () => {
        setAlertConfig({ visible: false });
        try {
          await api.delete(`/members/${member._id}`);
          invalidateCache('members', 'dashboard_month', 'dashboard_all');
          setTimeout(() => {
            setAlertConfig({ visible: true, title: "Deleted", message: "Member has been deleted.", type: "success", onClose: () => { setAlertConfig({ visible: false }); router.back(); } });
          }, 500);
        } catch {
          setTimeout(() => { setAlertConfig({ visible: true, title: "Error", message: "Could not delete.", type: "error" }); }, 500);
        }
      }
    });
  };

  const confirmRenewal = async (
    durationMonths: number, amount: number, paymentMode: string,
    nextDueDate?: string, joiningDate?: string, hours?: number,
    timing?: string, allocatedSeat?: string, wifiDetails?: string, amountPaid?: number, appliedOfferName?: string, planName?: string
  ) => {
    try {
      await api.post(`/members/${member._id}/renew`, {
        plan_duration_months: durationMonths, amount, amount_paid: amountPaid ?? null, payment_mode: paymentMode,
        next_due_date: nextDueDate, joining_date: joiningDate,
        daily_hours: hours, timing, allocated_seat: allocatedSeat, applied_offer_name: appliedOfferName, plan_name: planName
      });
      invalidateCache('members', 'dashboard_month', 'dashboard_all');
      refreshMember();
      const nextDue = nextDueDate ? new Date(nextDueDate).toLocaleDateString() : 'N/A';
      const msg = buildRenewalMessage(renewalTemplate, businessType, {
        name: member.full_name, phone: member.phone, date: nextDue,
        joining_date: joiningDate ? new Date(joiningDate).toLocaleDateString() : 'N/A',
        paid_date: new Date().toLocaleDateString(), fees: amount, amountPaid: amountPaid ?? undefined,
        hours: hours ?? member.daily_hours, timing: timing ?? member.timing, gym: gymName, durationMonths,
        seat: businessType === 'library' ? (allocatedSeat || member.allocated_seat || 'Unassigned') : undefined,
        wifi: businessType === 'library' ? (wifiDetails || member.wifi_details || 'Not Provided') : undefined,
        plan_name: planName,
      });
      return { success: true, message: msg };
    } catch {
      return { success: false };
    }
  };

  const handleSendReceipt = (payment: any) => {
    const paymentDate = payment.date
      ? new Date(payment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const startDate = payment.start_date
      ? new Date(payment.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';
    const expiryDate = payment.end_date
      ? new Date(payment.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';
    const payDays = (payment.start_date && payment.end_date)
      ? Math.max(1, Math.ceil((new Date(payment.end_date).getTime() - new Date(payment.start_date).getTime()) / 86400000))
      : 30;
    const amt = Number(payment.amount) || 0;
    const paid = payment.amount_paid != null ? Number(payment.amount_paid) : amt;

    const msg = buildPaymentReceiptMessage(businessType, {
      name: member.full_name,
      phone: member.phone,
      gym: gymName,
      paymentDate,
      startDate,
      expiryDate,
      totalAmount: amt,
      amountPaid: paid,
      paymentMode: payment.payment_mode || 'Cash',
      durationDays: payDays,
      hours: member.daily_hours,
      timing: member.timing,
      seat: businessType === 'library' ? (member.allocated_seat || undefined) : undefined,
      wifi: businessType === 'library' ? (member.wifi_details || undefined) : undefined,
      plan_name: payment.plan_name || member.plan_name,
    });
    sendWhatsAppMessage(member.phone, msg);
  };

  const initials = member?.full_name?.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() || 'M';
  const avatarColors = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];
  const avatarColor = avatarColors[(member?.full_name?.charCodeAt(0) || 0) % avatarColors.length];

  return (
    <View style={styles.container}>
      <CustomAlert 
        visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type}
        showCancel={alertConfig.showCancel} confirmText={alertConfig.confirmText} cancelText={alertConfig.cancelText}
        onClose={alertConfig.onClose || (() => setAlertConfig({ ...alertConfig, visible: false }))} onConfirm={alertConfig.onConfirm}
      />
      <RenewalModal
        visible={showRenewModal} member={member} enableHours={enableHours} businessType={businessType}
        onClose={() => setShowRenewModal(false)} onConfirm={confirmRenewal}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <FontAwesome name="arrow-left" size={16} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Member Details</Text>
          <TouchableOpacity onPress={() => setEditModalVisible(true)} style={[styles.iconBtn, { marginLeft: 'auto', marginRight: 8 }]}>
            <FontAwesome name="pencil" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
            <FontAwesome name="trash" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* Profile Card & Main Actions */}
        <View style={styles.profileSection}>
          <LinearGradient
            colors={isDark ? ['#1e1b4b', '#312e81'] : ['#E0E7FF', '#F3E8FF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.profileGradient}
          >
            <View style={styles.profileTopRow}>
              {member.photo_url ? (
                <Image source={{ uri: member.photo_url }} style={styles.avatarLargeImage} />
              ) : (
                <View style={[styles.avatarLarge, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.profileInfoBox}>
                <Text style={styles.name} numberOfLines={1}>{member.full_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Text style={styles.idText}>{member.member_id}</Text>
                  <Text style={[styles.statusMiniText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  <View style={{ position: 'relative', zIndex: 999 }}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setShowTopPlanTooltip(!showTopPlanTooltip)}
                      style={[styles.planBadge, { maxWidth: 200 }]}
                    >
                      <FontAwesome name="star" size={10} color="#F59E0B" style={{ flexShrink: 0 }} />
                      <Text style={styles.planBadgeText} numberOfLines={1} ellipsizeMode="tail">
                        {member.plan_name && member.plan_name !== 'Custom' ? member.plan_name : `${member.plan_duration_months}M Plan`}
                      </Text>
                    </TouchableOpacity>
                    {showTopPlanTooltip && (
                      <View style={{
                        position: 'absolute',
                        top: 26,
                        left: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                        zIndex: 9999,
                        width: 240,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 6,
                        elevation: 5
                      }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                          {member.plan_name && member.plan_name !== 'Custom' ? member.plan_name : `${member.plan_duration_months} Month Plan`}
                        </Text>
                      </View>
                    )}
                  </View>
                  {member.applied_offer_name && (
                    <View style={[styles.planBadge, { backgroundColor: '#ECFDF5', borderColor: '#10B981', maxWidth: 160 }]}>
                      <FontAwesome name="tag" size={10} color="#10B981" style={{ flexShrink: 0 }} />
                      <Text style={[styles.planBadgeText, { color: '#059669' }]} numberOfLines={1} ellipsizeMode="tail">
                        {member.applied_offer_name}
                      </Text>
                    </View>
                  )}
                  {member.trainer_assigned && member.trainer_assigned !== 'General' && member.trainer_assigned !== 'General Coach' && (
                    <View style={[styles.planBadge, { backgroundColor: '#EDE9FE', borderColor: '#7C3AED', maxWidth: 180 }]}>
                      <FontAwesome name="user" size={10} color="#7C3AED" style={{ flexShrink: 0 }} />
                      <Text style={[styles.planBadgeText, { color: '#6D28D9' }]} numberOfLines={1} ellipsizeMode="tail">
                        Coach: {member.trainer_assigned}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Quick Actions (Call, WA, Renew) */}
          <View style={styles.mainActionsRow}>
            <TouchableOpacity style={styles.actionGhostBtn} onPress={() => Linking.openURL(`tel:${member.phone}`)}>
              <FontAwesome name="phone" size={14} color={colors.primary} />
              <Text style={[styles.actionGhostText, { color: colors.text }]}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionGhostBtn} onPress={async () => await sendWhatsAppMessage(member.phone)}>
              <FontAwesome name="whatsapp" size={14} color="#25D366" />
              <Text style={[styles.actionGhostText, { color: colors.text }]}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.renewActionBtn} onPress={() => setShowRenewModal(true)}>
              <LinearGradient colors={[colors.primary, colors.secondary || colors.primary]} style={styles.renewActionGradient}>
                <FontAwesome name="refresh" size={13} color="#fff" />
                <Text style={styles.renewActionText}>Renewal</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Current Plan Details Card */}
        <Text style={styles.sectionTitle}>Current Plan Details</Text>
        <View style={styles.card}>
          <View style={styles.planDateRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.iconCircleSm, { backgroundColor: `${colors.primary}15` }]}>
                <FontAwesome name="calendar" size={12} color={colors.primary} />
              </View>
              <Text style={styles.planDateText}>
                {startDate ? startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'} – {expiryDate ? expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
              </Text>
            </View>
            {/* The circular percentage replacement */}
            <View style={[styles.progressCircle, { borderColor: colors.primary }]}>
              <Text style={styles.progressPercent}>{Math.round(progressPercent)}%</Text>
            </View>
          </View>
          
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: colors.primary }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressLabelText, { color: statusColor }]}>{isExpired ? `Expired ${Math.abs(daysRemaining)} days ago` : `${daysRemaining} Days Left`}</Text>
            <Text style={styles.progressLabelText}>Total {totalPlanDays} Days</Text>
          </View>

          <View style={styles.grid2x2}>
            <View style={styles.gridItem}>
              <View style={[styles.iconCircleSm, { backgroundColor: `${colors.primary}15` }]}><FontAwesome name="inr" size={12} color={colors.primary} /></View>
              <View>
                <Text style={styles.gridLabel}>Amount</Text>
                <Text style={styles.gridValue}>₹{member.monthly_fees || member.plan_fee || 0} <Text style={{ fontSize: 10, color: colors.success }}>Paid</Text></Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={[styles.iconCircleSm, { backgroundColor: `#F59E0B15` }]}><FontAwesome name="star" size={12} color="#F59E0B" /></View>
              <View style={{ flex: 1, position: 'relative', zIndex: 99 }}>
                <TouchableOpacity 
                  activeOpacity={0.75} 
                  onPress={() => setShowPlanTooltip(!showPlanTooltip)}
                  style={{ width: '100%' }}
                >
                  <Text style={styles.gridLabel}>Plan Type</Text>
                  {member.plan_name && member.plan_name !== 'Custom' ? (
                    <Text style={[styles.gridValue, { color: '#D97706', fontSize: 12 }]} numberOfLines={1} ellipsizeMode="tail">{member.plan_name}</Text>
                  ) : (
                    <Text style={styles.gridValue}>{member.plan_duration_months} Month</Text>
                  )}
                </TouchableOpacity>
                {showPlanTooltip && (
                  <View style={{
                    position: 'absolute',
                    bottom: 38,
                    right: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.15)',
                    zIndex: 999,
                    width: 250,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 5
                  }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                      {member.plan_name && member.plan_name !== 'Custom' ? member.plan_name : `${member.plan_duration_months} Month Plan`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={[styles.iconCircleSm, { backgroundColor: `#8B5CF615` }]}><FontAwesome name="calendar-plus-o" size={12} color="#8B5CF6" /></View>
              <View>
                <Text style={styles.gridLabel}>Join Date</Text>
                <Text style={styles.gridValue}>{startDate ? startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={[styles.iconCircleSm, { backgroundColor: `#3B82F615` }]}><FontAwesome name="user-o" size={12} color="#3B82F6" /></View>
              <View>
                <Text style={styles.gridLabel}>Total Spent</Text>
                <Text style={styles.gridValue}>₹{member.payment_history?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0}</Text>
              </View>
            </View>
          </View>

          {/* Trainer / Coach Assigned Banner */}
          <View style={{
            marginTop: 14,
            padding: 12,
            backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : '#F3E8FF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(124, 58, 237, 0.3)' : '#DDD6FE',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' }}>
                <FontAwesome name="user-circle-o" size={18} color="#fff" />
              </View>
              <View>
                <Text style={{ fontSize: 11, color: isDark ? '#DDD6FE' : '#6D28D9', fontWeight: '600' }}>ASSIGNED TRAINER / COACH</Text>
                <Text style={{ fontSize: 14, color: isDark ? '#fff' : '#4C1D95', fontWeight: '800' }}>
                  {member.trainer_assigned || 'General Coach'}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#7C3AED50'
              }}
              onPress={() => setEditModalVisible(true)}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#7C3AED' }}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Plans Section */}
        {upcomingPlans.length > 0 && (
          <View style={{ marginBottom: spacing.m }}>
            <Text style={styles.sectionTitle}>Upcoming Plans</Text>
            {upcomingPlans.map((upPlan: any, idx: number) => {
              const upStart = upPlan.start_date ? new Date(upPlan.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
              const upEnd = upPlan.end_date ? new Date(upPlan.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
              return (
                <View 
                  key={upPlan.id || idx} 
                  style={[
                    styles.card, 
                    { 
                      borderColor: colors.primary, 
                      borderWidth: 1, 
                      borderStyle: 'dashed', 
                      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : '#F0F9FF',
                      marginBottom: 8,
                      padding: 12
                    }
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                        <FontAwesome name="rocket" size={11} color="#0284C7" />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                        {upPlan.plan_name || `${upPlan.plan_months}M Plan`}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981' }}>Paid • ₹{upPlan.amount}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8, fontWeight: '600' }}>
                    Starts: {upStart} ➔ Ends: {upEnd}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Quick Actions Grid */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {[
            { id: 'pay', icon: 'list-alt', label: 'Payment History', color: '#8B5CF6' },
            { id: 'att', icon: 'calendar-check-o', label: 'Attendance', color: '#06B6D4' },
            { id: 'freeze', icon: 'snowflake-o', label: 'Freeze', color: '#F59E0B' },
            { id: 'more', icon: 'ellipsis-h', label: 'More', color: colors.textMuted }
          ].map(action => (
            <TouchableOpacity 
              key={action.id} 
              style={styles.quickActionCard}
              onPress={() => {
                if (action.id === 'pay') setShowPaymentHistoryModal(true);
              }}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
                <FontAwesome name={action.icon as any} size={18} color={action.color} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Personal Details */}
        <Text style={styles.sectionTitle}>Personal Details</Text>
        <View style={styles.card}>
          <DetailItem icon="phone" label="Phone Number" value={member.phone || 'N/A'} colors={colors} styles={styles} />
          <DetailItem icon="envelope-o" label="Email" value={member.email || 'N/A'} colors={colors} styles={styles} />
          <DetailItem icon="birthday-cake" label="Age / Date of Birth" value={member.age ? `${member.age} Yrs` : 'N/A'} colors={colors} styles={styles} hideBorder />
          {enableHours && (member.daily_hours || member.timing) && (
            <DetailItem icon="clock-o" label="Timing" value={member.timing || `${member.daily_hours} Hrs`} colors={colors} styles={styles} hideBorder={!member.allocated_seat} />
          )}
          {businessType === 'library' && member.allocated_seat && (
            <DetailItem icon="map-pin" label="Allocated Seat" value={member.allocated_seat} colors={colors} styles={styles} hideBorder />
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Payment History Modal */}
      <Modal visible={showPaymentHistoryModal} animationType="slide" transparent={true} onRequestClose={() => setShowPaymentHistoryModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? 40 : 16 }]}>
            <TouchableOpacity onPress={() => setShowPaymentHistoryModal(false)} style={styles.iconBtn}>
              <FontAwesome name="arrow-left" size={16} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Payment History</Text>
            <View style={{ width: 32 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.l }}>
            {!member?.payment_history || member.payment_history.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <FontAwesome name="list-alt" size={40} color={colors.textMuted} style={{ marginBottom: 16 }} />
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>No payments found.</Text>
              </View>
            ) : (
              member.payment_history.slice().reverse().map((payment: any, index: number) => {
                const amt = Number(payment.amount) || 0;
                const amtPaid = payment.amount_paid != null ? Number(payment.amount_paid) : amt;
                const isPartial = payment.amount_paid != null && amtPaid < amt;
                const payDays = (payment.start_date && payment.end_date)
                  ? Math.max(0, Math.ceil((new Date(payment.end_date).getTime() - new Date(payment.start_date).getTime()) / 86400000))
                  : 0;

                return (
                  <View key={index} style={[styles.card, { padding: 0, overflow: 'hidden', marginBottom: 16 }]}>
                    <View style={{ padding: 16 }}>
                      {/* Top Row: Amount & Mode */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <View>
                          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>₹{payment.amount}</Text>
                          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                            {payment.payment_mode || 'Cash'} • {payment.date ? new Date(payment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'}) : 'N/A'}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: isPartial ? `${colors.warning || '#F59E0B'}20` : `${colors.success}20`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: isPartial ? (colors.warning || '#F59E0B') : colors.success }}>
                            {isPartial ? 'Partial' : 'Paid'}
                          </Text>
                        </View>
                      </View>

                      {/* Middle Row: Duration Info */}
                      <View style={{ backgroundColor: isDark ? '#111827' : '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ fontSize: 12, color: colors.textMuted }}>Period</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>
                            {payment.start_date ? new Date(payment.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'} - {payment.end_date ? new Date(payment.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: colors.textMuted }}>Duration</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{payDays} Days</Text>
                        </View>
                      </View>

                      {isPartial && (
                        <View style={[styles.partialAlert, { backgroundColor: `${colors.error}15`, marginBottom: 16 }]}>
                          <Text style={[styles.partialAlertText, { color: colors.error }]}>Remaining Due: ₹{Math.max(0, amt - amtPaid)}</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Bottom Action Row */}
                    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
                      <TouchableOpacity 
                        style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border, flexDirection: 'row', justifyContent: 'center' }}
                        onPress={() => { setShowPaymentHistoryModal(false); setTimeout(() => setEditPaymentState({ visible: true, payment }), 300); }}
                      >
                        <FontAwesome name="pencil" size={14} color={colors.textSecondary} style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>Edit Payment</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={{ flex: 1, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                        onPress={() => handleSendReceipt(payment)}
                      >
                        <FontAwesome name="whatsapp" size={16} color="#25D366" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Send Receipt</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Modals */}
      <EditMemberModal visible={editModalVisible} member={member} onClose={() => setEditModalVisible(false)} onSaved={(updated) => { setMember({ ...member, ...updated }); setEditModalVisible(false); invalidateCache('members', 'dashboard_month', 'dashboard_all'); }} />
      <EditPaymentModal
        visible={editPaymentState.visible}
        payment={editPaymentState.payment}
        memberId={member?._id || ''}
        onClose={() => setEditPaymentState({ visible: false, payment: null })}
        onSaved={(updatedPaymentData) => {
          setEditPaymentState({ visible: false, payment: null });
          invalidateCache('members', 'dashboard_month', 'dashboard_all');
          refreshMember();
        }}
      />
    </View>
  );
};

const DetailItem = ({ icon, label, value, colors, styles, hideBorder = false }: any) => (
  <View style={[styles.detailItem, !hideBorder && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
    <FontAwesome name={icon} size={14} color={colors.textMuted} style={{ width: 20 }} />
    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
  </View>
);

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#090D16' : '#F8FAFC' },
  content: { padding: spacing.m, paddingTop: 50 },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.l },
  iconBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
    ...(!isDark ? shadows.light : {}),
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', letterSpacing: -0.3 },
  
  // Profile Section
  profileSection: { marginBottom: spacing.l },
  profileGradient: {
    borderRadius: 24,
    padding: spacing.l,
    marginBottom: spacing.m,
    borderWidth: 1, borderColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#E0E7FF',
    ...(!isDark ? shadows.card : {}),
  },
  profileTopRow: { flexDirection: 'row', alignItems: 'center' },
  avatarLargeImage: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: '#fff', marginRight: 16 },
  avatarLarge: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', marginRight: 16 },
  avatarText: { color: 'white', fontSize: 30, fontWeight: '900' },
  profileInfoBox: { flex: 1 },
  name: { fontSize: 22, fontWeight: '900', color: isDark ? '#fff' : '#0F172A', letterSpacing: -0.6 },
  idText: { fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', fontWeight: '600', marginTop: 2 },
  statusMiniText: { fontSize: 11, fontWeight: '800', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
    paddingHorizontal: 9, paddingVertical: 4.5,
    borderRadius: 8, alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1, borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.3)',
  },
  planBadgeText: { fontSize: 11, fontWeight: '800', color: '#D97706' },

  // Main Actions Row (Call, WA, Renew)
  mainActionsRow: { flexDirection: 'row', gap: 10 },
  actionGhostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13, borderRadius: 16,
    backgroundColor: isDark ? '#1E293B' : '#fff',
    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
    ...(!isDark ? shadows.light : {}),
  },
  actionGhostText: { fontSize: 13, fontWeight: '700', color: colors.text },
  renewActionBtn: { flex: 1.5, borderRadius: 16, overflow: 'hidden', ...(!isDark ? shadows.card : {}) },
  renewActionGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13,
  },
  renewActionText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // Card general
  card: {
    backgroundColor: isDark ? '#131A2A' : '#fff',
    borderRadius: 20,
    padding: spacing.l,
    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0',
    marginBottom: spacing.l,
    ...shadows.card,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: isDark ? '#94A3B8' : '#475569', marginBottom: spacing.m, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Current Plan Details
  planDateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  iconCircleSm: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planDateText: { fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  progressCircle: { width: 46, height: 46, borderRadius: 23, borderWidth: 3.5, alignItems: 'center', justifyContent: 'center' },
  progressPercent: { fontSize: 12, fontWeight: '900', color: colors.text },
  
  progressBarBg: { height: 7, backgroundColor: isDark ? '#1E293B' : '#E2E8F0', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  progressBarFill: { height: 7, borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  progressLabelText: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },

  grid2x2: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  gridItem: { 
    width: '47%', 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9'
  },
  gridLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  gridValue: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 1 },

  // Quick Actions Grid
  quickActionsGrid: { flexDirection: 'row', gap: 12, marginBottom: spacing.l, flexWrap: 'wrap' },
  quickActionCard: {
    width: (width - 32 - 36) / 4, // 4 items per row
    backgroundColor: isDark ? '#131A2A' : '#fff', borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0',
    ...(!isDark ? shadows.light : {}),
  },
  quickActionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickActionLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },

  // Personal Details
  detailItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  detailLabel: { flex: 1, fontSize: 13, paddingLeft: 8, fontWeight: '600', color: colors.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '700', textAlign: 'right', flex: 1, color: colors.text },

  // Timeline
  timeline: { paddingLeft: 8, marginTop: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 12, marginRight: 16, zIndex: 1 },
  timelineCard: { 
    flex: 1, backgroundColor: isDark ? '#131A2A' : '#fff', borderRadius: 16, 
    padding: 14, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0', ...shadows.card 
  },
  timelineAmount: { fontSize: 16, fontWeight: '800', color: colors.text },
  timelineDate: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  timelineSubtitle: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  partialAlert: { padding: 6, borderRadius: 4, marginTop: 8, alignItems: 'center' },
  partialAlertText: { fontSize: 11, fontWeight: '800' },
});
