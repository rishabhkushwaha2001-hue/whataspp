import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  Dimensions, TextInput, Platform, KeyboardAvoidingView, SafeAreaView, Linking
} from 'react-native';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DatePickerModal } from './DatePickerModal';
import { DropdownModal } from './DropdownModal';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { sendWhatsAppMessage } from '../services/whatsapp';

const { height, width } = Dimensions.get('window');

interface RenewalModalProps {
  visible: boolean;
  member: any;
  onClose: () => void;
  enableHours?: boolean;
  onConfirm: (
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
  ) => Promise<{ success: boolean, message?: string } | void> | void;
  businessType?: string;
}

export const RenewalModal = ({
  visible, member, onClose, enableHours = false, businessType = 'gym', onConfirm,
}: RenewalModalProps) => {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(colors, isDark);

  // States
  const [step, setStep] = useState<'edit' | 'review' | 'success'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState('');

  const [renewalStartDate, setRenewalStartDate] = useState('');
  const [renewalEndDate, setRenewalEndDate] = useState('');
  const [datePickerType, setDatePickerType] = useState<'start'|'end'>('start');
  const [amount, setAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'pending'>('paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  // Library/Advanced States
  const [dailyHours, setDailyHours] = useState('');
  const [timing, setTiming] = useState('');
  const [allocatedSeat, setAllocatedSeat] = useState('');
  const [wifiDetails, setWifiDetails] = useState('');
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [availableSeats, setAvailableSeats] = useState<any[]>([]);
  const [wifiOptions, setWifiOptions] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (visible && member) {
      setStep('edit');
      setIsSaving(false);
      setWhatsappMsg('');
      setAmount(member.monthly_fees ? String(member.monthly_fees) : (member.plan_fee ? String(member.plan_fee) : ''));
      const oldExp = member.next_due_date || new Date().toISOString();
      const isExp = new Date(oldExp) < new Date();
      let startD = new Date();
      if (!isExp) startD = new Date(oldExp);
      
      const startStr = startD.toISOString().split('T')[0];
      setRenewalStartDate(startStr);
      
      const endD = new Date(startD);
      endD.setMonth(endD.getMonth() + 1);
      setRenewalEndDate(endD.toISOString().split('T')[0]);
      setDailyHours(member.daily_hours ? String(member.daily_hours) : '');
      setTiming(member.timing || '');
      setAllocatedSeat(member.allocated_seat || '');
      setWifiDetails(member.wifi_details || '');

      if (enableHours) {
        api.get('/settings/').then(res => setWifiOptions(res.data.wifi_networks || [])).catch(() => {});
        api.get('/seats/').then(res => setAvailableSeats(Array.isArray(res.data) ? res.data : res.data?.seats || [])).catch(() => {});
      }
    }
  }, [visible, member, enableHours]);

  const durationDays = renewalStartDate && renewalEndDate ? Math.round((new Date(renewalEndDate).getTime() - new Date(renewalStartDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  let finalAmount = parseFloat(amount) || 0;
  let finalAmountPaid = finalAmount;
  if (paymentStatus === 'pending') finalAmountPaid = 0;
  if (paymentStatus === 'partial') finalAmountPaid = parseFloat(amountPaid) || 0;

  const handleReview = () => {
    if (!renewalStartDate || !renewalEndDate) {
      alert("Please select both start and end dates.");
      return;
    }
    if (new Date(renewalEndDate) <= new Date(renewalStartDate)) {
      alert("End date must be after the start date.");
      return;
    }
    setStep('review');
  };

  const handleConfirmAction = async () => {
    setIsSaving(true);
    let durationMonths = Math.max(1, Math.round(durationDays / 30.0));

    const res = await onConfirm(
      durationMonths, finalAmount, paymentMode, renewalEndDate, renewalStartDate,
      parseInt(dailyHours) || undefined, timing, allocatedSeat, wifiDetails, finalAmountPaid
    );
    
    if (res && res.success) {
      if (res.message) setWhatsappMsg(res.message);
      setStep('success');
    } else if (res && !res.success) {
      alert("Failed to update membership.");
      setStep('edit');
    } else {
      // Fallback if no promise returned
      setStep('success');
    }
    setIsSaving(false);
  };

  const handleSendReceipt = async () => {
    if (whatsappMsg && member?.phone) {
      await sendWhatsAppMessage(member.phone, whatsappMsg);
    }
    onClose();
  };

  // Components


  const PaymentStatusPill = ({ id, label }: { id: any, label: string }) => {
    const active = paymentStatus === id;
    const activeColor = id === 'paid' ? colors.success : id === 'partial' ? '#F59E0B' : colors.error;
    return (
      <TouchableOpacity
        style={[styles.statusRadio, active && { borderColor: activeColor, backgroundColor: `${activeColor}10` }]}
        onPress={() => setPaymentStatus(id)}
      >
        <View style={[styles.radioCircle, active && { borderColor: activeColor }]}>
          {active && <View style={[styles.radioInner, { backgroundColor: activeColor }]} />}
        </View>
        <Text style={[styles.statusRadioText, { color: active ? activeColor : colors.text }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
        <SafeAreaView style={{ flex: 1 }}>
          
          {step === 'edit' && (
            <>
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                  <FontAwesome name="arrow-left" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Renew Membership</Text>
                <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                  <FontAwesome name="times" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Member Info */}
                <View style={styles.memberInfoRow}>
                  <View style={[styles.avatarSm, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={[styles.avatarSmText, { color: colors.primary }]}>{member?.full_name?.charAt(0) || 'M'}</Text>
                  </View>
                  <View>
                    <Text style={styles.memberName}>{member?.full_name}</Text>
                    <Text style={styles.memberId}>{member?.member_id || member?.phone}</Text>
                  </View>
                </View>

                {/* Duration */}
                <Text style={styles.sectionTitle}>1. Membership Duration</Text>
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Start Date</Text>
                      <TouchableOpacity style={styles.dateInputBox} onPress={() => { setDatePickerType('start'); setShowDatePicker(true); }}>
                        <FontAwesome name="calendar" size={14} color={colors.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.dateInputText}>{renewalStartDate ? renewalStartDate.split('-').reverse().join('/') : 'Select Date'}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>End Date</Text>
                      <TouchableOpacity style={styles.dateInputBox} onPress={() => { setDatePickerType('end'); setShowDatePicker(true); }}>
                        <FontAwesome name="calendar-check-o" size={14} color={colors.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.dateInputText}>{renewalEndDate ? renewalEndDate.split('-').reverse().join('/') : 'Select Date'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 4 }]}>QUICK PRESETS (DAYS)</Text>
                  <View style={styles.pillRow}>
                    {[30, 90, 180].map((val) => (
                      <TouchableOpacity key={`preset-days-${val}`} style={[styles.pill, { borderColor: colors.border }]} onPress={() => { const d = new Date(renewalStartDate); d.setDate(d.getDate() + val); setRenewalEndDate(d.toISOString().split('T')[0]); }}>
                        <Text style={[styles.pillText, { color: colors.text }]}>+{val} Days</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>QUICK PRESETS (MONTHS)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8, gap: 8 }}>
                    {[1, 2, 3, 4, 5, 6, 12].map((val) => (
                      <TouchableOpacity key={`preset-months-${val}`} style={[styles.pill, { borderColor: colors.border }]} onPress={() => { const d = new Date(renewalStartDate); d.setMonth(d.getMonth() + val); setRenewalEndDate(d.toISOString().split('T')[0]); }}>
                        <Text style={[styles.pillText, { color: colors.text }]}>{val}M</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={[styles.expiryVisualizer, { marginTop: 12 }]}>
                    <FontAwesome name="info-circle" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={[styles.expiryLabel, { color: colors.text, marginBottom: 0 }]}>Calculated Duration: <Text style={{ fontWeight: '800' }}>{durationDays} Days</Text></Text>
                  </View>
                </View>

                {/* Fee */}
                <Text style={styles.sectionTitle}>2. Membership Fee</Text>
                <View style={styles.card}>
                  <Text style={styles.inputLabel}>Final Amount (₹)</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="Enter amount"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Status */}
                <Text style={styles.sectionTitle}>3. Payment Status</Text>
                <View style={styles.card}>
                  <View style={styles.paymentStatusRow}>
                    <PaymentStatusPill id="paid" label="Paid" />
                    <PaymentStatusPill id="partial" label="Partial" />
                    <PaymentStatusPill id="pending" label="Pending" />
                  </View>
                  {paymentStatus === 'partial' && (
                    <View style={{ marginTop: spacing.m }}>
                      <Text style={styles.inputLabel}>Amount Paid So Far (₹)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        keyboardType="numeric"
                        value={amountPaid}
                        onChangeText={setAmountPaid}
                        placeholder="Enter paid amount"
                        placeholderTextColor={colors.textMuted}
                      />
                      <Text style={{ fontSize: 11, color: colors.error, marginTop: 4 }}>
                        Remaining Due: ₹{Math.max(0, (parseFloat(amount) || 0) - (parseFloat(amountPaid) || 0))}
                      </Text>
                    </View>
                  )}
                  {paymentStatus !== 'pending' && (
                    <View style={{ marginTop: spacing.m }}>
                      <Text style={styles.inputLabel}>Payment Mode</Text>
                      <View style={styles.pillRow}>
                        {['Cash', 'UPI', 'Card'].map(mode => (
                          <TouchableOpacity
                            key={mode}
                            style={[styles.pill, paymentMode === mode ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border }]}
                            onPress={() => setPaymentMode(mode)}
                          >
                            <Text style={[styles.pillText, paymentMode === mode ? { color: '#fff' } : { color: colors.text }]}>{mode}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                <View style={{ height: 100 }} />
              </ScrollView>

              <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                <TouchableOpacity onPress={handleReview}>
                  <LinearGradient colors={[colors.primary, colors.secondary || colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmBtn}>
                    <Text style={styles.confirmBtnText}>Review Renewal</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 'review' && (
            <View style={styles.reviewContainer}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setStep('edit')} style={styles.backBtn}>
                  <FontAwesome name="arrow-left" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Confirm Renewal</Text>
                <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                  <FontAwesome name="times" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.reviewScroll}>
                <View style={styles.shieldIconContainer}>
                  <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.shieldIcon}>
                    <FontAwesome name="shield" size={40} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.reviewMainTitle}>Renew Membership?</Text>
                </View>

                <View style={styles.reviewCard}>
                  <View style={[styles.memberInfoRow, { marginBottom: 24 }]}>
                    <View style={[styles.avatarSm, { backgroundColor: `${colors.primary}20` }]}>
                      <Text style={[styles.avatarSmText, { color: colors.primary }]}>{member?.full_name?.charAt(0) || 'M'}</Text>
                    </View>
                    <View>
                      <Text style={styles.memberName}>{member?.full_name}</Text>
                      <Text style={styles.memberId}>{member?.member_id || member?.phone}</Text>
                    </View>
                  </View>

                  <View style={styles.reviewDivider} />

                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewRowLabel}>New Expiry Date</Text>
                    <Text style={styles.reviewRowValue}>
                      {new Date(renewalEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'})}
                    </Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewRowLabel}>Final Amount</Text>
                    <Text style={styles.reviewRowValue}>₹{finalAmount}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewRowLabel}>Payment Status</Text>
                    <Text style={[styles.reviewRowValue, { color: paymentStatus === 'paid' ? colors.success : paymentStatus === 'partial' ? '#F59E0B' : colors.error }]}>
                      {paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partial' ? `₹${finalAmountPaid} Paid` : 'Pending'}
                    </Text>
                  </View>
                  {paymentStatus !== 'pending' && (
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewRowLabel}>Payment Mode</Text>
                      <Text style={styles.reviewRowValue}>{paymentMode}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border, flexDirection: 'row', gap: 12 }]}>
                <TouchableOpacity onPress={() => setStep('edit')} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirmAction} style={{ flex: 1 }} disabled={isSaving}>
                  <LinearGradient colors={[colors.primary, colors.secondary || colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.confirmBtn, { opacity: isSaving ? 0.7 : 1 }]}>
                    <Text style={styles.confirmBtnText}>{isSaving ? 'Renewing...' : 'Confirm Renewal'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'success' && (
            <View style={styles.successContainer}>
              <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 20 }}>
                {/* Simulated Sparkles */}
                <View style={styles.successIconWrapper}>
                  <FontAwesome name="check-circle" size={80} color={colors.success} />
                </View>
                <Text style={styles.successMainTitle}>Membership Renewed!</Text>
                <Text style={styles.successSubTitle}>Successfully renewed membership for</Text>
                <Text style={[styles.successSubTitle, { color: colors.primary, fontWeight: '700' }]}>{member?.full_name}</Text>
              </View>

              <View style={styles.successChecklist}>
                <View style={styles.checkRow}>
                  <View style={[styles.checkCircle, { backgroundColor: colors.success }]}><FontAwesome name="check" size={10} color="#fff" /></View>
                  <Text style={styles.checkText}>Expiry Date Updated</Text>
                  <Text style={styles.checkValue}>
                    {new Date(renewalEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'})}
                  </Text>
                </View>
                <View style={styles.checkRow}>
                  <View style={[styles.checkCircle, { backgroundColor: colors.success }]}><FontAwesome name="check" size={10} color="#fff" /></View>
                  <Text style={styles.checkText}>Amount Collected</Text>
                  <Text style={styles.checkValue}>₹{finalAmountPaid}</Text>
                </View>
                <View style={styles.checkRow}>
                  <View style={[styles.checkCircle, { backgroundColor: colors.success }]}><FontAwesome name="check" size={10} color="#fff" /></View>
                  <Text style={styles.checkText}>Database Synced</Text>
                </View>
              </View>

              <View style={styles.successFooter}>
                <TouchableOpacity onPress={handleSendReceipt}>
                  <LinearGradient colors={['#25D366', '#128C7E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmBtn}>
                    <FontAwesome name="whatsapp" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>Send WhatsApp Receipt</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.doneBtnGhost}>
                  <Text style={[styles.doneBtnGhostText, { color: colors.textMuted }]}>Done (Close)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <DatePickerModal visible={showDatePicker} initialDate={datePickerType === 'start' ? renewalStartDate : renewalEndDate} onSelect={(d) => { if (datePickerType === 'start') setRenewalStartDate(d); else setRenewalEndDate(d); setShowDatePicker(false); }} onClose={() => setShowDatePicker(false)} />
          <DropdownModal visible={showSeatModal} items={availableSeats.map(s => s.seat_number)} onSelect={(val) => { setAllocatedSeat(val); setShowSeatModal(false); }} onClose={() => setShowSeatModal(false)} title="Select Seat" />
          <DropdownModal visible={showWifiModal} items={wifiOptions} onSelect={(val) => { setWifiDetails(val); setShowWifiModal(false); }} onClose={() => setShowWifiModal(false)} title="Select WiFi" />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.l, paddingTop: Platform.OS === 'android' ? 40 : 16, paddingBottom: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.l },

  memberInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.l },
  avatarSm: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarSmText: { fontSize: 18, fontWeight: '700' },
  memberName: { fontSize: 16, fontWeight: '700', color: colors.text },
  memberId: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.s, marginLeft: 4 },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.l, padding: spacing.l, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.l, ...shadows.card },
  
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.m },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1 },
  pillText: { fontSize: 13, fontWeight: '600' },

  dateInputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.m, padding: 12, backgroundColor: colors.background },
  dateInputText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  
  expiryVisualizer: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1F2937' : '#F9FAFB', padding: spacing.m, borderRadius: borderRadius.m },
  expiryBox: { flex: 1 },
  expiryLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  expiryDateText: { fontSize: 14, fontWeight: '700', color: colors.text },

  inputLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: borderRadius.m, padding: 12, fontSize: 15 },
  
  paymentStatusRow: { flexDirection: 'row', gap: 12 },
  statusRadio: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderRadius: borderRadius.m, borderWidth: 1, borderColor: colors.border },
  radioCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  statusRadioText: { fontSize: 13, fontWeight: '600' },

  footer: { padding: spacing.l, paddingBottom: Platform.OS === 'ios' ? 34 : spacing.l, borderTopWidth: 1 },
  confirmBtn: { paddingVertical: 16, borderRadius: borderRadius.l, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Review Screen
  reviewContainer: { flex: 1, backgroundColor: colors.background },
  reviewScroll: { padding: spacing.xl, alignItems: 'center' },
  shieldIconContainer: { alignItems: 'center', marginBottom: 32, marginTop: 20 },
  shieldIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  reviewMainTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  reviewCard: { width: '100%', backgroundColor: colors.surface, borderRadius: borderRadius.l, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  reviewDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.l },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.m },
  reviewRowLabel: { fontSize: 14, color: colors.textMuted },
  reviewRowValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: borderRadius.l, alignItems: 'center', borderWidth: 1, backgroundColor: colors.surface },
  cancelBtnText: { fontSize: 16, fontWeight: '600' },

  // Success Screen
  successContainer: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  successIconWrapper: { width: 100, height: 100, borderRadius: 50, backgroundColor: `${colors.success}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successMainTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 8 },
  successSubTitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  successChecklist: { backgroundColor: colors.surface, borderRadius: borderRadius.l, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, marginTop: 32, ...shadows.card },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkText: { flex: 1, fontSize: 14, color: colors.textSecondary },
  checkValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  successFooter: { marginTop: 'auto', marginBottom: Platform.OS === 'ios' ? 20 : 0 },
  doneBtnGhost: { paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  doneBtnGhostText: { fontSize: 15, fontWeight: '600' }
});
