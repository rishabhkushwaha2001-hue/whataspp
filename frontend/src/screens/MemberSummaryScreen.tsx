import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Image, Linking, Modal, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { CustomAlert } from '../components/CustomAlert';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { EditMemberModal } from '../components/EditMemberModal';
import { EditPaymentModal } from '../components/EditPaymentModal';
import { RenewalModal } from '../components/RenewalModal';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { invalidateCache } from '../hooks/useDataStore';
import { fetchMessageTemplates, buildPaymentReceiptMessage, getDefaultTemplates } from '../services/messageTemplates';

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
        setRenewalTemplate((dbRenewal && dbRenewal.trim()) ? dbRenewal : null);
      } catch (e) {
        const storedName = await AsyncStorage.getItem('gymName');
        if (storedName) setGymName(storedName);
      }
    };
    loadSettings();
  }, [id]);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
  if (!member) return <View style={styles.container}><Text style={{ color: colors.text }}>Member not found</Text></View>;

  const expiryDate = member?.next_due_date ? new Date(member.next_due_date) : null;
  const startDate = member?.joining_date ? new Date(member.joining_date) : null;
  
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
    timing?: string, allocatedSeat?: string, wifiDetails?: string, amountPaid?: number
  ) => {
    try {
      await api.post(`/members/${member._id}/renew`, {
        plan_duration_months: durationMonths, amount, amount_paid: amountPaid ?? null, payment_mode: paymentMode,
        next_due_date: nextDueDate, joining_date: joiningDate,
        daily_hours: hours, timing, allocated_seat: allocatedSeat,
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
                <View style={styles.planBadge}>
                  <FontAwesome name="star" size={10} color="#F59E0B" />
                  <Text style={styles.planBadgeText}>{member.plan_duration_months}M Plan</Text>
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
              <View>
                <Text style={styles.gridLabel}>Plan Type</Text>
                <Text style={styles.gridValue}>{member.plan_duration_months} Month</Text>
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
        </View>

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
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.m, paddingTop: 50 },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.l },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },

  // Profile Section
  profileSection: { marginBottom: spacing.l },
  profileGradient: {
    borderRadius: borderRadius.xl,
    padding: spacing.m,
    marginBottom: spacing.m,
    borderWidth: 1, borderColor: isDark ? '#312e81' : '#E0E7FF',
  },
  profileTopRow: { flexDirection: 'row', alignItems: 'center' },
  avatarLargeImage: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#fff', marginRight: 16 },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', marginRight: 16 },
  avatarText: { color: 'white', fontSize: 28, fontWeight: '800' },
  profileInfoBox: { flex: 1 },
  name: { fontSize: 20, fontWeight: '800', color: isDark ? '#fff' : '#111827', letterSpacing: -0.5 },
  idText: { fontSize: 13, color: isDark ? '#cbd5e1' : '#64748b' },
  statusMiniText: { fontSize: 11, fontWeight: '700', marginLeft: 8 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: borderRadius.s, alignSelf: 'flex-start',
    marginTop: 8,
  },
  planBadgeText: { fontSize: 11, fontWeight: '700', color: '#F59E0B' },

  // Main Actions Row (Call, WA, Renew)
  mainActionsRow: { flexDirection: 'row', gap: 8 },
  actionGhostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: borderRadius.m,
    backgroundColor: isDark ? '#1F2937' : '#fff',
    borderWidth: 1, borderColor: colors.border,
  },
  actionGhostText: { fontSize: 13, fontWeight: '600' },
  renewActionBtn: { flex: 1.5, borderRadius: borderRadius.m, overflow: 'hidden' },
  renewActionGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12,
  },
  renewActionText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Card general
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.m,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.l,
    ...shadows.card,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.m, marginLeft: 4 },

  // Current Plan Details
  planDateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  iconCircleSm: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  planDateText: { fontSize: 13, fontWeight: '600', color: colors.text },
  progressCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  progressPercent: { fontSize: 12, fontWeight: '800', color: colors.text },
  
  progressBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: 8, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  progressLabelText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  grid2x2: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { width: '45%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  gridLabel: { fontSize: 11, color: colors.textMuted },
  gridValue: { fontSize: 14, fontWeight: '700', color: colors.text },

  // Quick Actions Grid
  quickActionsGrid: { flexDirection: 'row', gap: 12, marginBottom: spacing.l, flexWrap: 'wrap' },
  quickActionCard: {
    width: (width - 32 - 36) / 4, // 4 items per row
    backgroundColor: colors.surface, borderRadius: borderRadius.m,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  quickActionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickActionLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },

  // Personal Details
  detailItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  detailLabel: { flex: 1, fontSize: 13, paddingLeft: 8 },
  detailValue: { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1 },

  // Timeline
  timeline: { paddingLeft: 8, marginTop: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 12, marginRight: 16, zIndex: 1 },
  timelineCard: { 
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.m, 
    padding: 12, borderWidth: 1, borderColor: colors.border, ...shadows.card 
  },
  timelineAmount: { fontSize: 16, fontWeight: '800', color: colors.text },
  timelineDate: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  timelineSubtitle: { fontSize: 11, color: colors.textSecondary },
  partialAlert: { padding: 6, borderRadius: 4, marginTop: 8, alignItems: 'center' },
  partialAlertText: { fontSize: 11, fontWeight: '700' },
});
