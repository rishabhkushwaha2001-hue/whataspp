import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { EditMemberModal } from '../components/EditMemberModal';
import { EditPaymentModal } from '../components/EditPaymentModal';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { invalidateCache } from '../hooks/useDataStore';

const { width } = Dimensions.get('window');

export const MemberSummaryScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const DetailItem = ({ icon, label, value, half }: any) => (
    <View style={[styles.detailItem, half && { flex: 1, paddingRight: 8 }]}>
      <View style={styles.detailIcon}>
        <FontAwesome name={icon} size={14} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={2} adjustsFontSizeToFit>{value}</Text>
      </View>
    </View>
  );

  const { id, name, mid, cat } = useLocalSearchParams<{ id: string, name?: string, mid?: string, cat?: string }>();
  const router = useRouter();
  
  // Initialize with params if available to show data instantly
  const [member, setMember] = useState<any>(name ? {
    full_name: name,
    member_id: mid,
    category: cat,
    _id: id
  } : null);
  
  const [loading, setLoading] = useState(!name);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [businessType, setBusinessType] = useState('gym');
  const [enableHours, setEnableHours] = useState(false);
  const [gymName, setGymName] = useState('Gym');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editPaymentState, setEditPaymentState] = useState<{ visible: boolean; payment: any }>({ visible: false, payment: null });

  // Helper: convert days to "X Months Y Days" display
  const formatDuration = (days: number) => {
    if (!days || days <= 0) return '0 Days';
    const months = Math.floor(days / 30);
    const rem = days % 30;
    if (months === 0) return `${days} Days`;
    if (rem === 0) return `${days} Days (${months} Month${months > 1 ? 's' : ''})`;
    return `${days} Days (${months} Month${months > 1 ? 's' : ''} ${rem} Day${rem > 1 ? 's' : ''})`;
  };

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
        console.error('Invalid ID passed to Summary:', cleanId);
        setLoading(false);
        return;
      }

      console.log(`📡 Fetching member details from: /members/${cleanId}`);
      try {
        const res = await api.get(`/members/${cleanId}`);
        setMember(res.data);
      } catch (error: any) {
        console.error('❌ Member details fetch failed:', error.response?.data || error.message);
        setAlertConfig({ visible: true, title: "Error", message: `Could not load details for ID: ${cleanId}`, type: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchMember();
    
    AsyncStorage.multiGet(['businessType', 'enableHours', 'gymName']).then(pairs => {
      const bt = pairs[0][1];
      const eh = pairs[1][1];
      const gn = pairs[2][1];
      if (bt) setBusinessType(bt);
      if (eh === 'true') setEnableHours(true);
      if (gn) setGymName(gn);
    });
  }, [id]);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
  if (!member) return <View style={styles.container}><Text style={styles.text}>Member not found</Text></View>;

  const expiryDate = member?.next_due_date ? new Date(member.next_due_date) : null;
  const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 0;
  const isExpired = daysRemaining < 0;

  const handleDelete = () => {
    setAlertConfig({
      visible: true,
      title: "Delete Member",
      message: `Are you sure you want to permanently delete ${member?.full_name}?\n\nThis will remove all their payment history and data.`,
      type: "warning",
      showCancel: true,
      confirmText: "Delete",
      onConfirm: async () => {
        setAlertConfig({ visible: false });
        try {
          await api.delete(`/members/${member._id}`);
          invalidateCache('members', 'dashboard_month', 'dashboard_all');
          setTimeout(() => {
            setAlertConfig({ 
              visible: true, title: "Deleted", message: "Member has been deleted.", type: "success", 
              onClose: () => { setAlertConfig({visible: false}); router.back(); }
            });
          }, 500);
        } catch (error) {
          setTimeout(() => {
            setAlertConfig({ visible: true, title: "Error", message: "Could not delete member.", type: "error" });
          }, 500);
        }
      }
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <CustomAlert 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        showCancel={alertConfig.showCancel}
        confirmText={alertConfig.confirmText}
        onClose={alertConfig.onClose || (() => setAlertConfig({ ...alertConfig, visible: false }))}
        onConfirm={alertConfig.onConfirm}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="chevron-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { flex: 1 }]}>Member Summary</Text>
        <TouchableOpacity onPress={() => setEditModalVisible(true)} style={{ padding: 8, marginRight: 4 }}>
          <FontAwesome name="pencil" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={{ padding: 8 }}>
          <FontAwesome name="trash" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <GlassCard style={styles.profileCard}>
        <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{member.full_name.charAt(0)}</Text>
        </LinearGradient>
        <Text style={styles.name}>{member.full_name}</Text>
        <Text style={styles.idText}>{member.member_id} • {member.category}</Text>
        
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: isExpired ? `${colors.error}20` : `${colors.success}20` }]}>
            <Text style={[styles.badgeText, { color: isExpired ? colors.error : colors.success }]}>
              {isExpired ? 'Expired' : 'Active'}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{member.plan_duration_months} Month Plan</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: spacing.l, paddingTop: spacing.m, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Plan Start</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              {(() => {
                // Priority 1: Calculate from next_due_date - plan_duration_months
                // This is always accurate for CURRENT plan, even for old/renewed members
                if (member.next_due_date && member.plan_duration_months) {
                  try {
                    const expiry = new Date(member.next_due_date);
                    expiry.setMonth(expiry.getMonth() - member.plan_duration_months);
                    return expiry.toLocaleDateString();
                  } catch { /* fall through */ }
                }
                // Priority 2: Latest payment's start_date (sorted newest first)
                const history = Array.isArray(member.payment_history) ? member.payment_history : [];
                const sorted = [...history].sort((a: any, b: any) => {
                  return new Date(b.start_date || b.date || 0).getTime() -
                         new Date(a.start_date || a.date || 0).getTime();
                });
                const latest = sorted[0];
                const planStart = latest?.start_date || latest?.date;
                if (planStart) {
                  try { return new Date(planStart).toLocaleDateString(); }
                  catch { /* fall through */ }
                }
                // Priority 3: Original joining date (last resort)
                if (member.joining_date) {
                  try { return new Date(member.joining_date).toLocaleDateString(); }
                  catch { return 'N/A'; }
                }
                return 'N/A';
              })()}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Plan Ending</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: isExpired ? colors.error : colors.text }}>
              {expiryDate ? expiryDate.toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.row}>
        <GlassCard style={styles.infoBox}>
          <Text style={styles.infoLabel}>Days Left</Text>
          <Text style={[styles.infoValue, { color: daysRemaining < 5 ? colors.error : colors.text }]}>
            {daysRemaining > 0 ? daysRemaining : 0}
          </Text>
        </GlassCard>
        <GlassCard style={styles.infoBox}>
          <Text style={styles.infoLabel}>Total Spent</Text>
          <Text style={[styles.infoValue, { color: colors.accent }]}>
            ₹{member.payment_history?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0}
          </Text>
        </GlassCard>
      </View>

      <Text style={styles.sectionTitle}>Personal Details</Text>
      <GlassCard style={styles.detailsCard}>
        <DetailItem icon="phone" label="Phone" value={member.phone || 'N/A'} />
        {member.aadhaar_number ? (
          <DetailItem icon="id-card" label="Aadhaar" value={member.aadhaar_number} />
        ) : null}
        <DetailItem icon="map-marker" label="Address" value={member.address || 'N/A'} />
        <DetailItem icon="calendar" label="Joining Date" value={member.joining_date ? new Date(member.joining_date).toLocaleDateString() : 'N/A'} />
        {businessType !== 'library' && (
          <DetailItem icon="user" label="Trainer" value={member.trainer_assigned || 'General'} />
        )}
        <View style={styles.row}>
          <DetailItem icon="birthday-cake" label="Age" value={member.age || 'N/A'} half />
          <DetailItem icon="balance-scale" label="Weight" value={member.weight ? `${member.weight} kg` : 'N/A'} half />
        </View>
        {enableHours && (member.daily_hours || member.timing) && (
          <View style={styles.row}>
            {member.daily_hours && <DetailItem icon="clock-o" label="Daily Hours" value={`${member.daily_hours} Hrs`} half={true} />}
            {member.timing && <DetailItem icon="sun-o" label="Timing" value={member.timing} half={true} />}
          </View>
        )}
        {/* Seat Info - Library only */}
        {businessType === 'library' && member.allocated_seat && (
          <View style={[styles.seatWifiBanner, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
                <FontAwesome name="map-pin" size={14} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.bannerLabel, { color: colors.textMuted }]}>Allocated Seat</Text>
                <Text style={[styles.bannerValue, { color: colors.primary }]}>{member.allocated_seat}</Text>
              </View>
            </View>
          </View>
        )}
        {/* WiFi Info - Library only */}
        {businessType === 'library' && member.wifi_details && (
          <View style={[styles.seatWifiBanner, { backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}30`, marginTop: spacing.s }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.accent}20` }]}>
                <FontAwesome name="wifi" size={14} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bannerLabel, { color: colors.textMuted }]}>WiFi Details</Text>
                <Text style={[styles.bannerValue, { color: colors.accent }]} numberOfLines={2}>{member.wifi_details}</Text>
              </View>
            </View>
          </View>
        )}
      </GlassCard>

      <Text style={styles.sectionTitle}>Payment History</Text>
      <View style={styles.timeline}>
        {member.payment_history?.slice().reverse().map((payment: any, index: number) => {
          // Calculate days from start to end date
          const payDays = (payment.start_date && payment.end_date)
            ? Math.max(0, Math.ceil((new Date(payment.end_date).getTime() - new Date(payment.start_date).getTime()) / 86400000))
            : 0;

          // Partial payment info
          const amt = Number(payment.amount) || 0;
          const amtPaid = payment.amount_paid != null ? Number(payment.amount_paid) : amt;
          const isPartial = payment.amount_paid != null && amtPaid < amt;
          const remaining = Math.max(0, amt - amtPaid);

          return (
            <View key={index} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <GlassCard style={styles.timelineCard}>
                {/* Header: Amount + Badges on Left, Type + Mode on Right */}
                <View style={styles.timelineHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.timelineAmount}>₹{payment.amount}</Text>
                    {isPartial ? (
                      <View style={[styles.statusBadge, { backgroundColor: `${colors.warning || '#F59E0B'}15`, borderColor: `${colors.warning || '#F59E0B'}30` }]}>
                        <FontAwesome name="exclamation-circle" size={10} color={colors.warning || '#F59E0B'} />
                        <Text style={[styles.statusBadgeText, { color: colors.warning || '#F59E0B' }]}>Partial</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: `${colors.success}15`, borderColor: `${colors.success}30` }]}>
                        <FontAwesome name="check-circle" size={10} color={colors.success} />
                        <Text style={[styles.statusBadgeText, { color: colors.success }]}>Paid</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.paymentModeText}>{payment.payment_mode}</Text>
                    <Text style={styles.paymentTypeText}>{payment.type || 'Payment'}</Text>
                  </View>
                </View>

                {/* Duration Badge */}
                {payDays > 0 && (
                  <View style={[styles.durationChip, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}>
                    <FontAwesome name="clock-o" size={11} color={colors.primary} />
                    <Text style={[styles.durationText, { color: colors.primary }]}>
                      {formatDuration(payDays)}
                    </Text>
                  </View>
                )}

                {/* Dates Box - sleek row layout */}
                <View style={[styles.datesBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                  <View style={styles.dateCol}>
                    <Text style={styles.dateLabel}>Paid On</Text>
                    <Text style={[styles.dateValue, { color: colors.textSecondary }]}>
                      {payment.date ? new Date(payment.date).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                  <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.dateCol}>
                    <Text style={styles.dateLabel}>Started</Text>
                    <Text style={[styles.dateValue, { color: colors.primary }]}>
                      {payment.start_date ? new Date(payment.start_date).toLocaleDateString() : (payment.date ? new Date(payment.date).toLocaleDateString() : 'N/A')}
                    </Text>
                  </View>
                  <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.dateCol}>
                    <Text style={styles.dateLabel}>Expiry</Text>
                    <Text style={[styles.dateValue, { color: colors.error }]}>
                      {(() => {
                          if (payment.end_date) return new Date(payment.end_date).toLocaleDateString();
                          const startDate = payment.start_date || payment.date;
                          if (startDate) {
                            const d = new Date(startDate);
                            d.setMonth(d.getMonth() + (payment.plan_months || 1));
                            return d.toLocaleDateString();
                          }
                          return 'N/A';
                      })()}
                    </Text>
                  </View>
                </View>

                {/* Partial Payment Breakdown */}
                {isPartial && (
                  <View style={[styles.partialBox, { backgroundColor: `${colors.error}08`, borderColor: `${colors.error}20` }]}>
                    <View style={styles.partialRow}>
                      <Text style={styles.partialLabel}>Total Amount</Text>
                      <Text style={[styles.partialValue, { color: colors.text }]}>₹{amt}</Text>
                    </View>
                    <View style={styles.partialRow}>
                      <Text style={styles.partialLabel}>Paid So Far</Text>
                      <Text style={[styles.partialValue, { color: colors.success }]}>₹{amtPaid}</Text>
                    </View>
                    <View style={[styles.partialRow, { borderTopWidth: 1, borderTopColor: `${colors.error}20`, paddingTop: 4, marginTop: 2 }]}>
                      <Text style={[styles.partialLabel, { fontWeight: '700' }]}>Remaining Due</Text>
                      <Text style={[styles.partialValue, { color: colors.error, fontWeight: '800' }]}>₹{remaining.toFixed(0)}</Text>
                    </View>
                  </View>
                )}

                {/* Edit Button */}
                <TouchableOpacity
                  style={[styles.editPayBtn, { borderColor: `${colors.primary}30`, backgroundColor: `${colors.primary}08` }]}
                  onPress={() => setEditPaymentState({ visible: true, payment })}
                >
                  <FontAwesome name="pencil" size={11} color={colors.primary} />
                  <Text style={[styles.editPayText, { color: colors.primary }]}>Edit Payment</Text>
                </TouchableOpacity>
              </GlassCard>
            </View>
          );
        })}
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>

    {/* Edit Member Modal */}
    <EditMemberModal
      visible={editModalVisible}
      member={member}
      onClose={() => setEditModalVisible(false)}
      onSaved={(updated) => {
        setMember({ ...member, ...updated });
        setEditModalVisible(false);
        invalidateCache('members', 'dashboard_month', 'dashboard_all');
      }}
    />

    {/* Edit Payment Modal */}
    <EditPaymentModal
      visible={editPaymentState.visible}
      payment={editPaymentState.payment}
      memberId={member?._id || ''}
      onClose={() => setEditPaymentState({ visible: false, payment: null })}
      onSaved={(updatedPaymentData) => {
        const oldPayment = editPaymentState.payment;
        setEditPaymentState({ visible: false, payment: null });
        invalidateCache('members', 'dashboard_month', 'dashboard_all');
        refreshMember();
        
        if (updatedPaymentData && oldPayment) {
          const oldPaid = oldPayment.amount_paid != null ? oldPayment.amount_paid : (oldPayment.amount || 0);
          const newPaid = updatedPaymentData.amount_paid != null ? updatedPaymentData.amount_paid : (updatedPaymentData.amount || 0);
          
          if (oldPaid !== newPaid) {
            const total = updatedPaymentData.amount || 0;
            const remaining = Math.max(0, total - newPaid);
            const gymUp = (member?.business_type === 'library' || businessType === 'library' ? 'Library' : 'Gym').toUpperCase();
            const finalGymName = gymName || gymUp;
            
            const receiptMsg = 
              `*${finalGymName} - PAYMENT UPDATED ✅*\n\n` +
              `Hello *${member?.full_name}*,\n\n` +
              `Your payment record has been updated.\n\n` +
              `💰 *Total Amount:* ₹${total}\n` +
              `✅ *Paid So Far:* ₹${newPaid}\n` +
              (remaining > 0 ? `⚠️ *Remaining Due:* ₹${remaining}\n` : `🎉 *All dues cleared!*\n`) +
              `\nThank you! 🙏`;
              
            setTimeout(() => {
              setAlertConfig({
                visible: true,
                title: "Payment Updated",
                message: "Payment saved successfully! Do you want to send a WhatsApp receipt to the member?",
                type: "success",
                showCancel: true,
                confirmText: "Send WhatsApp",
                cancelText: "No, Thanks",
                onConfirm: () => {
                   setAlertConfig({ visible: false });
                   sendWhatsAppMessage(member?.phone || '', receiptMsg);
                },
              });
            }, 600); // Wait for modal closing animation
          }
        }
      }}
    />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.m, paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.l },
  backBtn: { padding: 8, marginRight: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  profileCard: { padding: spacing.l, alignItems: 'center', marginBottom: spacing.m },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.m },
  avatarText: { color: 'white', fontSize: 32, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  idText: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.m },
  badgeContainer: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.full },
  badgeText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.m, marginBottom: spacing.m },
  infoBox: { flex: 1, padding: spacing.m, alignItems: 'center' },
  infoLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  infoValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginVertical: spacing.m },
  detailsCard: { padding: spacing.m },
  detailItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.m },
  detailIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  detailLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' },
  detailValue: { fontSize: 15, color: colors.text, fontWeight: '600' },
  timeline: { paddingLeft: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: spacing.m },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 20, marginRight: 16, zIndex: 1 },
  timelineCard: { flex: 1, padding: spacing.m },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  timelineAmount: { fontSize: 22, fontWeight: '800', color: colors.text },
  paymentModeText: { fontSize: 13, fontWeight: '700', color: colors.text },
  paymentTypeText: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' },
  
  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  // Dates Box
  datesBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.m,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  dateCol: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2, fontWeight: '600' },
  dateValue: { fontSize: 12, fontWeight: '700' },
  dateDivider: { width: 1, height: 24, opacity: 0.5 },

  // Duration chip
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
    marginBottom: 6,
  },
  durationText: { fontSize: 11, fontWeight: '700' },
  // Partial payment badge
  partialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
  },
  partialBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  // Partial breakdown box
  partialBox: {
    borderRadius: borderRadius.s,
    borderWidth: 1,
    padding: spacing.s,
    marginTop: 6,
    marginBottom: 6,
  },
  partialRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  partialLabel: { fontSize: 12, color: colors.textSecondary },
  partialValue: { fontSize: 12, fontWeight: '600' },
  // Edit payment button
  editPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.s,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
  },
  editPayText: { fontSize: 11, fontWeight: '700' },
  seatWifiBanner: {
    borderRadius: borderRadius.m,
    borderWidth: 1,
    padding: spacing.m,
    marginTop: spacing.m,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bannerValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
});
