import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  Dimensions, TextInput, Platform, ActivityIndicator, Alert
} from 'react-native';
import { useTheme, spacing, shadows } from '../theme/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DatePickerModal } from './DatePickerModal';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { useAppAlert } from '../hooks/useAppAlert';
import { buildPlanUpdatedMessage } from '../services/messageTemplates';

interface ChangePlanModalProps {
  visible: boolean;
  member: any;
  currentPayment?: any;
  gymName?: string;
  businessType?: string;
  onClose: () => void;
  onSaved: (updatedMember: any) => void;
}

export const ChangePlanModal = ({
  visible,
  member,
  currentPayment,
  gymName = 'Gym',
  businessType = 'gym',
  onClose,
  onSaved,
}: ChangePlanModalProps) => {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(colors, isDark);
  const { showError, showSuccess, showAlert, AlertModal } = useAppAlert();

  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('custom');
  
  const [planName, setPlanName] = useState('');
  const [durationMonths, setDurationMonths] = useState('1');
  const [amount, setAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial'>('paid');
  const [paymentMode, setPaymentMode] = useState('Cash');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end'>('start');
  const [isPlanExpired, setIsPlanExpired] = useState(false);

  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Formatting date helper YYYY-MM-DD
  const toDateString = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (visible && member) {
      // Initialize with active plan / member current data
      const curPlanName = currentPayment?.plan_name || member.plan_name || 'Custom';
      setPlanName(curPlanName);

      const curMonths = currentPayment?.plan_months || member.plan_duration_months || 1;
      setDurationMonths(String(curMonths));

      const curAmount = currentPayment?.amount != null ? String(currentPayment.amount) : (member.monthly_fees ? String(member.monthly_fees) : '1000');
      setAmount(curAmount);

      const curPaid = currentPayment?.amount_paid != null ? String(currentPayment.amount_paid) : curAmount;
      setAmountPaid(curPaid);
      setPaymentStatus(curPaid === curAmount ? 'paid' : 'partial');

      setPaymentMode(currentPayment?.payment_mode || member.payment_mode || 'Cash');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const eDateRaw = currentPayment?.end_date || member.next_due_date;
      let dueDateObj: Date | null = null;
      let expired = false;

      if (eDateRaw) {
        const parsed = new Date(eDateRaw);
        if (!isNaN(parsed.getTime())) {
          dueDateObj = parsed;
          const dueMidnight = new Date(parsed);
          dueMidnight.setHours(0, 0, 0, 0);
          expired = dueMidnight.getTime() < today.getTime();
        }
      }

      setIsPlanExpired(expired);

      let baseStartObj: Date;
      if (expired && dueDateObj) {
        // Plan has expired -> Start from last date (previous expiry/due date) like in Renewal
        baseStartObj = dueDateObj;
      } else {
        // Plan is running / active -> Start from current plan's start date
        const sDateRaw = currentPayment?.start_date || member.joining_date;
        const sDateObj = sDateRaw ? new Date(sDateRaw) : null;
        baseStartObj = sDateObj && !isNaN(sDateObj.getTime()) ? sDateObj : new Date();
      }

      setStartDate(toDateString(baseStartObj));

      // Calculate end date from baseStartObj + duration
      const months = parseInt(String(curMonths)) || 1;
      if (!expired && dueDateObj) {
        setEndDate(toDateString(dueDateObj));
      } else {
        const autoEnd = new Date(baseStartObj);
        autoEnd.setMonth(autoEnd.getMonth() + months);
        setEndDate(toDateString(autoEnd));
      }

      // Fetch master plans
      setLoadingPlans(true);
      api.get('/plans/')
        .then((res) => {
          const activeList = (res.data || []).filter((p: any) => p.is_active);
          setPlans(activeList);
          // Try to match current plan name to an active preset
          const matched = activeList.find((p: any) => p.name?.toLowerCase() === curPlanName.toLowerCase());
          if (matched) {
            setSelectedPlanId(matched._id);
          } else {
            setSelectedPlanId('custom');
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPlans(false));
    }
  }, [visible, member, currentPayment]);

  const handleSelectPlan = (plan: any) => {
    if (!plan || plan === 'custom') {
      setSelectedPlanId('custom');
      return;
    }

    setSelectedPlanId(plan._id);
    setPlanName(plan.name);

    // Compute duration in months
    const months = plan.duration_days ? Math.max(1, Math.round(plan.duration_days / 30)) : 1;
    setDurationMonths(String(months));

    const price = String(plan.price || 0);
    setAmount(price);
    if (paymentStatus === 'paid') {
      setAmountPaid(price);
    }

    // Auto-recalculate end date based on startDate + months
    const baseStart = startDate ? new Date(startDate) : new Date();
    const newEnd = new Date(baseStart);
    if (plan.duration_days) {
      newEnd.setDate(newEnd.getDate() + plan.duration_days);
    } else {
      newEnd.setMonth(newEnd.getMonth() + months);
    }
    setEndDate(toDateString(newEnd));
  };

  const handleStartDateChange = (newDateStr: string) => {
    setStartDate(newDateStr);
    const s = new Date(newDateStr);
    if (!isNaN(s.getTime())) {
      const months = parseInt(durationMonths) || 1;
      const endD = new Date(s);
      endD.setMonth(endD.getMonth() + months);
      setEndDate(toDateString(endD));
    }
  };

  const handleDurationChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setDurationMonths(clean);
    if (clean && startDate) {
      const s = new Date(startDate);
      const months = parseInt(clean);
      if (!isNaN(s.getTime()) && months > 0) {
        const endD = new Date(s);
        endD.setMonth(endD.getMonth() + months);
        setEndDate(toDateString(endD));
      }
    }
  };

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      showError('Invalid Amount', 'Please enter a valid plan fee.');
      return;
    }

    const parsedPaid = paymentStatus === 'paid'
      ? parsedAmount
      : (parseFloat(amountPaid) || 0);

    if (parsedPaid > parsedAmount) {
      showError('Invalid Paid Amount', 'Amount paid cannot exceed total plan fee.');
      return;
    }

    const months = parseInt(durationMonths) || 1;
    if (months <= 0) {
      showError('Invalid Duration', 'Plan duration must be at least 1 month.');
      return;
    }

    setIsSaving(true);
    try {
      const memberId = member._id || member.id || member.member_id;
      if (!memberId) {
        showError('Invalid Member', 'Member ID is missing.');
        return;
      }

      const parseIso = (dStr: string) => {
        if (!dStr) return undefined;
        try {
          const d = new Date(dStr);
          return isNaN(d.getTime()) ? undefined : d.toISOString();
        } catch {
          return undefined;
        }
      };

      const payload: any = {
        plan_name: planName.trim() || `${months} Month Plan`,
        plan_duration_months: months,
        amount: parsedAmount,
        amount_paid: parsedPaid,
        payment_mode: paymentMode,
        start_date: parseIso(startDate),
        next_due_date: parseIso(endDate),
      };

      const res = await api.post(`/members/${memberId}/change-plan`, payload);
      const updatedMember = res.data;

      // Build WhatsApp message (prepare but don't send yet)
      let whatsappMsgToSend: string | null = null;
      if (sendWhatsApp && member.phone) {
        try {
          const sDisplay = startDate ? startDate.split('-').reverse().join('/') : 'N/A';
          const eDisplay = endDate ? endDate.split('-').reverse().join('/') : 'N/A';
          whatsappMsgToSend = buildPlanUpdatedMessage(businessType, {
            name: member.full_name,
            phone: member.phone,
            gym: gymName,
            plan_name: payload.plan_name,
            durationMonths: months,
            startDate: sDisplay,
            expiryDate: eDisplay,
            totalAmount: parsedAmount,
            amountPaid: parsedPaid,
            paymentMode: paymentMode,
            seat: member.allocated_seat,
            hours: member.daily_hours,
            timing: member.timing,
            wifi: member.wifi_details,
          });
        } catch (msgErr) {
          console.log('WhatsApp message build failed', msgErr);
        }
      }

      // Show success first, then ask about WhatsApp using professional themed alert
      showSuccess('Plan Updated 🎉', `Current plan for ${member.full_name} has been updated successfully!`, () => {
        if (whatsappMsgToSend && member.phone) {
          setTimeout(() => {
            showAlert({
              type: 'info',
              title: 'Send WhatsApp Confirmation?',
              message: `Would you like to send the updated plan receipt to ${member.full_name} via WhatsApp?`,
              buttons: [
                {
                  text: 'Skip',
                  style: 'cancel',
                  onPress: () => {
                    onSaved(updatedMember);
                    onClose();
                  },
                },
                {
                  text: 'Send WhatsApp',
                  style: 'default',
                  onPress: () => {
                    sendWhatsAppMessage(member.phone, whatsappMsgToSend!);
                    onSaved(updatedMember);
                    onClose();
                  },
                },
              ],
            });
          }, 200);
        } else {
          onSaved(updatedMember);
          onClose();
        }
      });
    } catch (e: any) {
      console.error('Plan update error:', e);
      const errMsg = e?.response?.data?.detail 
        || (typeof e?.response?.data === 'string' ? e.response.data : null)
        || e?.message 
        || 'Failed to update current plan.';
      showError('Update Failed', errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible || !member) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <FontAwesome name="refresh" size={15} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                Change Current Plan
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="middle">
                {member.full_name}
                {member.member_id ? `  ·  ${member.member_id}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome name="times" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Current Active / Expired Plan Badge */}
            <View style={[
              styles.activeBanner,
              isPlanExpired && {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
              }
            ]}>
              <FontAwesome
                name={isPlanExpired ? "exclamation-triangle" : "info-circle"}
                size={14}
                color={isPlanExpired ? colors.error : colors.primary}
              />
              <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                <Text style={[styles.activeBannerTitle, isPlanExpired && { color: colors.error }]}>
                  {isPlanExpired ? '⚠ EXPIRED PLAN' : '✦ CURRENT PLAN'}
                </Text>
                <Text style={styles.activeBannerValue} numberOfLines={1} ellipsizeMode="tail">
                  {member.plan_name || `${member.plan_duration_months || 1}M Plan`}  ·  ₹{member.monthly_fees || 0}
                </Text>
                {member.next_due_date ? (
                  <Text style={[styles.activeBannerDate, isPlanExpired && { color: colors.error }]} numberOfLines={1}>
                    {isPlanExpired ? 'Expired' : 'Expires'}:  {new Date(member.next_due_date).toLocaleDateString('en-GB')}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Predefined Plan Selection */}
            <Text style={styles.sectionLabel}>⭐ SELECT NEW PLAN</Text>
            {loadingPlans ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsRow}>
                {plans.map((p) => {
                  const isSelected = selectedPlanId === p._id;
                  return (
                    <TouchableOpacity
                      key={p._id}
                      style={[
                        styles.presetCard,
                        isSelected && { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
                      ]}
                      onPress={() => handleSelectPlan(p)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <FontAwesome name="star" size={12} color={isSelected ? colors.primary : '#F59E0B'} />
                        <Text style={[styles.presetPrice, isSelected && { color: colors.primary }]}>₹{p.price}</Text>
                      </View>
                      <Text style={[styles.presetName, isSelected && { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.presetDays}>
                        {p.duration_days ? `${p.duration_days} Days` : '1 Month'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[
                    styles.presetCard,
                    selectedPlanId === 'custom' && { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
                  ]}
                  onPress={() => handleSelectPlan('custom')}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <FontAwesome name="pencil" size={12} color={selectedPlanId === 'custom' ? colors.primary : colors.textMuted} />
                    <Text style={styles.presetPrice}>Custom</Text>
                  </View>
                  <Text style={[styles.presetName, selectedPlanId === 'custom' && { color: colors.text, fontWeight: '800' }]}>
                    Custom Plan
                  </Text>
                  <Text style={styles.presetDays}>Set manual</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Plan Name & Duration */}
            <View style={styles.row}>
              <View style={{ flex: 1.6 }}>
                <Text style={styles.inputLabel}>Plan Name</Text>
                <View style={styles.inputBox}>
                  <FontAwesome name="tag" size={14} color={colors.primary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={planName}
                    onChangeText={setPlanName}
                    placeholder="e.g. 3 Months Gold"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Duration (Months)</Text>
                <View style={styles.inputBox}>
                  <FontAwesome name="clock-o" size={14} color={colors.primary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={durationMonths}
                    onChangeText={handleDurationChange}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                    maxLength={3}
                  />
                </View>
              </View>
            </View>

            {/* Date Range: Start & End */}
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>📅 PLAN VALIDITY DATES</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => { setDatePickerType('start'); setShowDatePicker(true); }}
                >
                  <FontAwesome name="calendar" size={14} color={colors.primary} />
                  <Text style={[styles.dateText, { color: colors.text }]} numberOfLines={1}>
                    {startDate ? startDate.split('-').reverse().join('/') : 'Select'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Expiry Date</Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => { setDatePickerType('end'); setShowDatePicker(true); }}
                >
                  <FontAwesome name="calendar-check-o" size={14} color={colors.error} />
                  <Text style={[styles.dateText, { color: colors.text }]} numberOfLines={1}>
                    {endDate ? endDate.split('-').reverse().join('/') : 'Select'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Fee & Payment Details */}
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>💰 FEES & PAYMENT</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Total Plan Fee (₹)</Text>
                <View style={styles.inputBox}>
                  <FontAwesome name="inr" size={14} color={colors.primary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { color: colors.text, fontWeight: '700' }]}
                    value={amount}
                    onChangeText={(val) => {
                      setAmount(val);
                      if (paymentStatus === 'paid') setAmountPaid(val);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Payment Mode</Text>
                <View style={styles.paymentModeRow}>
                  {['Cash', 'UPI', 'Card'].map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.modeChip,
                        paymentMode === mode && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setPaymentMode(mode)}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          { color: paymentMode === mode ? '#fff' : colors.textSecondary },
                        ]}
                      >
                        {mode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Payment Status: Full vs Partial */}
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.statusToggle,
                    paymentStatus === 'paid' && { backgroundColor: `${colors.success}15`, borderColor: colors.success },
                  ]}
                  onPress={() => {
                    setPaymentStatus('paid');
                    setAmountPaid(amount);
                  }}
                >
                  <FontAwesome
                    name={paymentStatus === 'paid' ? 'check-circle' : 'circle-o'}
                    size={14}
                    color={paymentStatus === 'paid' ? colors.success : colors.textMuted}
                  />
                  <Text style={[styles.statusToggleText, { color: paymentStatus === 'paid' ? colors.success : colors.textSecondary }]}>
                    Fully Paid (₹{amount || 0})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusToggle,
                    paymentStatus === 'partial' && { backgroundColor: `${colors.warning || '#F59E0B'}15`, borderColor: colors.warning || '#F59E0B' },
                  ]}
                  onPress={() => setPaymentStatus('partial')}
                >
                  <FontAwesome
                    name={paymentStatus === 'partial' ? 'dot-circle-o' : 'circle-o'}
                    size={14}
                    color={paymentStatus === 'partial' ? (colors.warning || '#F59E0B') : colors.textMuted}
                  />
                  <Text style={[styles.statusToggleText, { color: paymentStatus === 'partial' ? (colors.warning || '#F59E0B') : colors.textSecondary }]}>
                    Partial Payment
                  </Text>
                </TouchableOpacity>
              </View>

              {paymentStatus === 'partial' && (
                <View style={styles.inputBox}>
                  <FontAwesome name="money" size={14} color={colors.warning || '#F59E0B'} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={amountPaid}
                    onChangeText={setAmountPaid}
                    keyboardType="numeric"
                    placeholder="Enter Paid Amount"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={{ fontSize: 11, color: colors.error, fontWeight: '700', marginLeft: 4 }}>
                    Due: ₹{Math.max(0, (parseFloat(amount) || 0) - (parseFloat(amountPaid) || 0))}
                  </Text>
                </View>
              )}
            </View>

            {/* WhatsApp Notification Toggle */}
            <TouchableOpacity
              style={styles.whatsAppToggleRow}
              onPress={() => setSendWhatsApp(!sendWhatsApp)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[styles.waIconBox, { backgroundColor: '#25D36618' }]}>
                  <FontAwesome name="whatsapp" size={18} color="#25D366" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.waTitle, { color: colors.text }]} numberOfLines={1}>Send WhatsApp Confirmation</Text>
                  <Text style={styles.waSubtitle} numberOfLines={1} ellipsizeMode="tail">Receipt to {member.phone || 'member'}</Text>
                </View>
              </View>
              <FontAwesome
                name={sendWhatsApp ? 'check-square' : 'square-o'}
                size={20}
                color={sendWhatsApp ? '#25D366' : colors.textMuted}
              />
            </TouchableOpacity>
          </ScrollView>

          {/* Action Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleSave} disabled={isSaving}>
              <LinearGradient
                colors={[colors.primary, colors.secondary || colors.primary]}
                style={styles.confirmGradient}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <FontAwesome name="check" size={14} color="#fff" />
                    <Text style={styles.confirmText}>Update Plan</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Date Picker Modal */}
          <DatePickerModal
            visible={showDatePicker}
            initialDate={datePickerType === 'start' ? startDate : endDate}
            onClose={() => setShowDatePicker(false)}
            onSelect={(d: string) => {
              if (datePickerType === 'start') {
                handleStartDateChange(d);
              } else {
                setEndDate(d);
              }
              setShowDatePicker(false);
            }}
          />

          <AlertModal />
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: isDark ? '#111827' : '#FFFFFF',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      paddingBottom: Platform.OS === 'ios' ? 24 : 12,
      ...shadows.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.l,
      paddingTop: spacing.l,
      paddingBottom: spacing.m,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1F2937' : '#F1F5F9',
      overflow: 'hidden',
    },
    headerIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: '500',
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: spacing.l,
      paddingBottom: 20,
    },
    activeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#E0E7FF',
    },
    activeBannerTitle: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.8,
    },
    activeBannerValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
      flexShrink: 1,
    },
    activeBannerDate: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 2,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    presetsRow: {
      flexDirection: 'row',
      marginBottom: 14,
    },
    presetCard: {
      width: 125,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: isDark ? '#1F2937' : '#E2E8F0',
      backgroundColor: isDark ? '#192231' : '#F8FAFC',
      marginRight: 10,
    },
    presetPrice: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    presetName: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 2,
    },
    presetDays: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E2E8F0',
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
      backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
    },
    input: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
    },
    dateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E2E8F0',
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
      backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
      gap: 8,
    },
    dateText: {
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    dateHintRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      marginTop: 7,
      marginBottom: 2,
      paddingHorizontal: 4,
    },
    dateHintText: {
      fontSize: 11,
      fontWeight: '600',
      flex: 1,
      lineHeight: 15,
    },
    paymentModeRow: {
      flexDirection: 'row',
      gap: 6,
      height: 44,
      alignItems: 'center',
    },
    modeChip: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
    },
    modeChipText: {
      fontSize: 11,
      fontWeight: '700',
    },
    statusToggle: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E2E8F0',
      backgroundColor: isDark ? '#1F2937' : '#F8FAFB',
    },
    statusToggleText: {
      fontSize: 12,
      fontWeight: '700',
    },
    whatsAppToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(37, 211, 102, 0.25)' : 'rgba(37, 211, 102, 0.3)',
      backgroundColor: isDark ? 'rgba(37, 211, 102, 0.08)' : '#F0FDF4',
    },
    waIconBox: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    waTitle: {
      fontSize: 13,
      fontWeight: '700',
    },
    waSubtitle: {
      fontSize: 11,
      color: '#15803D',
      marginTop: 1,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.l,
      paddingTop: spacing.m,
      borderTopWidth: 1,
      gap: 12,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1F2937' : '#F8FAFB',
    },
    cancelBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    confirmBtn: {
      flex: 1.6,
      borderRadius: 14,
      overflow: 'hidden',
      ...shadows.card,
    },
    confirmGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
    },
    confirmText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '800',
    },
  });
