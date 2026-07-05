import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ModernInput } from './ModernInput';
import { DatePickerModal } from './DatePickerModal';
import { api } from '../services/api';
import { useAppAlert } from '../hooks/useAppAlert';

const { height } = Dimensions.get('window');

interface EditPaymentModalProps {
  visible: boolean;
  payment: any;       // The payment record to edit
  memberId: string;   // Member's _id (ObjectId string)
  onClose: () => void;
  onSaved: (updatedData?: any) => void; // Refresh callback
}

export const EditPaymentModal = ({
  visible,
  payment,
  memberId,
  onClose,
  onSaved,
}: EditPaymentModalProps) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { showError, AlertModal } = useAppAlert();

  const [amountPaid, setAmountPaid] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end'>('start');

  useEffect(() => {
    if (visible && payment) {
      // amount_paid: if null/undefined = full payment (show total as paid)
      const paidVal = payment.amount_paid != null
        ? payment.amount_paid.toString()
        : payment.amount.toString();
      setAmountPaid(paidVal);
      const getLocalDateStr = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      // Start Date fallback: start_date -> payment.date
      let sDate = payment.start_date || payment.date;
      setStartDate(sDate ? getLocalDateStr(sDate) : '');

      // End Date fallback: end_date -> calculate from start date + plan_months
      let eDate = payment.end_date;
      if (!eDate && sDate) {
        const d = new Date(sDate);
        d.setMonth(d.getMonth() + (payment.plan_months || 1));
        eDate = d.toISOString();
      }
      setEndDate(eDate ? getLocalDateStr(eDate) : '');
    }
  }, [visible, payment]);

  const formatDateDisplay = (dateStr: string) =>
    dateStr ? dateStr.split('-').reverse().join('/') : 'Not Set';

  const getDaysCount = () => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    return Math.max(0, Math.ceil((e.getTime() - s.getTime()) / 86400000));
  };

  const getDurationFormatted = () => {
    const days = getDaysCount();
    if (days <= 0) return '0 Days';
    const months = Math.floor(days / 30);
    const rem = days % 30;
    if (months === 0) return `${days} Days`;
    if (rem === 0) return `${days} Days (${months} Month${months > 1 ? 's' : ''})`;
    return `${days} Days (${months} Month${months > 1 ? 's' : ''} ${rem} Day${rem > 1 ? 's' : ''})`;
  };

  const handleSave = async () => {
    const paymentId = payment?.id || payment?._id;
    if (!paymentId) {
      showError('Error', 'Payment ID not found. Cannot edit.');
      return;
    }
    const parsedPaid = parseFloat(amountPaid);
    if (isNaN(parsedPaid) || parsedPaid < 0) {
      showError('Invalid Amount', 'Please enter a valid paid amount.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      showError('Invalid Dates', 'End date cannot be before start date.');
      return;
    }

    setSaving(true);
    try {
      const body: any = { amount_paid: parsedPaid };
      if (startDate) body.start_date = new Date(startDate).toISOString();
      if (endDate) body.end_date = new Date(endDate).toISOString();

      await api.put(`/members/${memberId}/payments/${paymentId}`, body);
      onSaved({
        ...payment,
        amount_paid: parsedPaid,
        start_date: startDate ? new Date(startDate).toISOString() : payment.start_date,
        end_date: endDate ? new Date(endDate).toISOString() : payment.end_date
      });
      onClose();
    } catch (e: any) {
      showError('Save Failed', e?.response?.data?.detail || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !payment) return null;

  const totalAmount = payment.amount ?? 0;
  const paidNum = parseFloat(amountPaid) || 0;
  const remaining = Math.max(0, totalAmount - paidNum);
  const isPartial = payment.amount_paid != null && payment.amount_paid < totalAmount;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Edit Payment</Text>
              <Text style={styles.subtitle}>
                {payment.type || 'Payment'} • {payment.payment_mode || 'Cash'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome name="times" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ marginBottom: spacing.m }} keyboardShouldPersistTaps="handled">
            {/* Current Payment Summary */}
            <View style={[styles.summaryBox, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}25` }]}>
              <Text style={[styles.summaryTitle, { color: colors.primary }]}>Current Payment Info</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Plan Amount</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>₹{totalAmount}</Text>
              </View>
              {isPartial && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Previously Paid</Text>
                    <Text style={[styles.summaryValue, { color: colors.success }]}>₹{payment.amount_paid}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Remaining Due</Text>
                    <Text style={[styles.summaryValue, { color: colors.error }]}>
                      ₹{Math.max(0, totalAmount - payment.amount_paid).toFixed(0)}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Date Range Edit */}
            <Text style={styles.sectionLabel}>📅 Edit Date Range</Text>
            <View style={{ flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m }}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity onPress={() => { setDatePickerType('start'); setShowDatePicker(true); }}>
                  <ModernInput
                    label="Start Date"
                    value={formatDateDisplay(startDate)}
                    editable={false}
                    placeholder="Select"
                    icon={<FontAwesome name="calendar" size={14} color={colors.primary} />}
                  />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <TouchableOpacity onPress={() => { setDatePickerType('end'); setShowDatePicker(true); }}>
                  <ModernInput
                    label="End Date"
                    value={formatDateDisplay(endDate)}
                    editable={false}
                    placeholder="Select"
                    icon={<FontAwesome name="calendar" size={14} color={colors.error} />}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Duration Preview */}
            {startDate && endDate && (
              <View style={[styles.durationChip, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}20` }]}>
                <FontAwesome name="clock-o" size={12} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700', marginLeft: 6 }}>
                  {getDurationFormatted()}
                </Text>
              </View>
            )}

            {/* Paid Amount Edit */}
            <Text style={styles.sectionLabel}>💰 Update Paid Amount</Text>
            <ModernInput
              label={`Amount Paid (₹) — Total: ₹${totalAmount}`}
              value={amountPaid}
              onChangeText={setAmountPaid}
              keyboardType="numeric"
              placeholder={`Max ₹${totalAmount}`}
              icon={<FontAwesome name="rupee" size={14} color={colors.accent} />}
            />

            {/* Live Breakdown */}
            {paidNum > 0 && (
              <View style={[styles.breakdownRow, { backgroundColor: `${colors.accent}08`, borderColor: `${colors.accent}25` }]}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Total</Text>
                  <Text style={[styles.breakdownValue, { color: colors.text }]}>₹{totalAmount}</Text>
                </View>
                <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Paid</Text>
                  <Text style={[styles.breakdownValue, { color: colors.success }]}>₹{paidNum.toFixed(0)}</Text>
                </View>
                <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Remaining</Text>
                  <Text style={[styles.breakdownValue, { color: remaining > 0 ? colors.error : colors.success }]}>
                    {remaining > 0 ? `₹${remaining.toFixed(0)}` : '✓ Cleared'}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Date Picker */}
          <DatePickerModal
            visible={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            initialDate={datePickerType === 'start' ? startDate : endDate}
            title={datePickerType === 'start' ? 'Select Start Date' : 'Select End Date'}
            onSelect={(date) => {
              if (datePickerType === 'start') {
                setStartDate(date);
                if (endDate && date > endDate) setEndDate(date);
              } else {
                if (startDate && date < startDate) {
                  showError('Invalid Date', 'End date cannot be before start date.');
                } else {
                  setEndDate(date);
                }
              }
              setShowDatePicker(false);
            }}
          />

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <FontAwesome name="check" size={14} color="#fff" />
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <AlertModal />
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.m,
  },
  box: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.l,
    padding: spacing.l,
    width: '100%',
    maxHeight: height * 0.85,
    ...shadows.premium,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.m,
    paddingBottom: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: 4 },
  summaryBox: {
    borderRadius: borderRadius.m,
    borderWidth: 1,
    padding: spacing.m,
    marginBottom: spacing.m,
  },
  summaryTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.s },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 13, color: colors.textSecondary },
  summaryValue: { fontSize: 13, fontWeight: '700' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.s,
    letterSpacing: 0.3,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: spacing.m,
  },
  breakdownRow: {
    flexDirection: 'row',
    borderRadius: borderRadius.m,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: spacing.s,
    marginBottom: spacing.m,
  },
  breakdownItem: { flex: 1, alignItems: 'center', padding: spacing.m },
  breakdownDivider: { width: 1 },
  breakdownLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  breakdownValue: { fontSize: 15, fontWeight: '800' },
  footer: {
    flexDirection: 'row',
    gap: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.m,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: { fontSize: 14, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: borderRadius.m,
  },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
