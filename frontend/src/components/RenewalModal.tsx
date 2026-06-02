import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions, Alert } from 'react-native';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ModernInput } from './ModernInput';
import { DatePickerModal } from './DatePickerModal';

const { height } = Dimensions.get('window');

interface RenewalModalProps {
  visible: boolean;
  member: any;
  onClose: () => void;
  onConfirm: (durationMonths: number, amount: number, paymentMode: string, nextDueDate?: string, joiningDate?: string) => void;
}

export const RenewalModal = ({
  visible,
  member,
  onClose,
  onConfirm,
}: RenewalModalProps) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const getNextMonthDate = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  };

  const [joiningDate, setJoiningDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [amount, setAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'joining' | 'expiry'>('joining');

  // Compute monthly rate
  const getMonthlyRate = () => {
    if (!member) return 0;
    const fees = member.monthly_fees || 0;
    const dur = member.plan_duration_months || 1;
    return fees / dur;
  };

  // Reset/Initialize state when member or visibility changes
  useEffect(() => {
    if (visible && member) {
      const now = new Date();
      const currentDue = member.next_due_date ? new Date(member.next_due_date) : null;
      const validDue = currentDue && !isNaN(currentDue.getTime()) ? currentDue : null;
      
      // Default From Date (joiningDate): Default start date to the member's current expiry to keep it continuous.
      const baseDate = validDue || now;
      
      const fromStr = baseDate.toISOString().split('T')[0];
      const toStr = getNextMonthDate(fromStr);
      
      setJoiningDate(fromStr);
      setExpiryDate(toStr);
      setAmount(member.monthly_fees?.toString() || '0');
      setPaymentMode(member.payment_mode || 'Cash');
    }
  }, [visible, member]);

  const getDurationInDays = () => {
    if (!joiningDate || !expiryDate) return 0;
    const s = new Date(joiningDate);
    const e = new Date(expiryDate);
    const diff = e.getTime() - s.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  };

  const durationDays = getDurationInDays();

  const handleConfirm = () => {
    if (expiryDate < joiningDate) {
      Alert.alert('Invalid Expiry Date', 'To Date cannot be before From Date.');
      return;
    }
    const parsedAmount = parseFloat(amount) || 0;
    const planMonths = Math.max(1, Math.round(durationDays / 30.0));
    onConfirm(planMonths, parsedAmount, paymentMode, new Date(expiryDate).toISOString(), new Date(joiningDate).toISOString());
  };

  const handlePresetSelect = (monthsVal: number) => {
    const d = new Date(joiningDate);
    d.setMonth(d.getMonth() + monthsVal);
    setExpiryDate(d.toISOString().split('T')[0]);
  };

  if (!visible || !member) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Renew Membership</Text>
              <Text style={styles.subtitle}>{member.full_name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome name="times" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            {/* Live Preview */}
            <View style={styles.previewContainer}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Current Due Date:</Text>
                <Text style={styles.previewValue}>
                  {member.next_due_date ? new Date(member.next_due_date).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
            </View>

            {/* Date Range Selection (From & To) */}
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: spacing.s }}>
                <TouchableOpacity onPress={() => { setDatePickerType('joining'); setShowDatePicker(true); }}>
                  <ModernInput 
                    label="From Date (Start) *" 
                    value={joiningDate} 
                    editable={false} 
                    placeholder="Select Date" 
                    icon={<FontAwesome name="calendar" size={14} color={colors.primary} />} 
                  />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.s }}>
                <TouchableOpacity onPress={() => { setDatePickerType('expiry'); setShowDatePicker(true); }}>
                  <ModernInput 
                    label="To Date (Expiry) *" 
                    value={expiryDate} 
                    editable={false} 
                    placeholder="Select Date" 
                    icon={<FontAwesome name="calendar" size={14} color={colors.primary} />} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Presets */}
            <View style={styles.presetsRow}>
              {[{ label: '1M', val: 1 }, { label: '2M', val: 2 }, { label: '3M', val: 3 }, { label: '6M', val: 6 }, { label: '12M', val: 12 }].map((preset) => {
                return (
                  <TouchableOpacity
                    key={preset.label}
                    onPress={() => handlePresetSelect(preset.val)}
                    style={styles.presetBtn}
                  >
                    <Text style={styles.presetText}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Real-time Duration Display */}
            <View style={styles.durationDisplay}>
              <FontAwesome name="info-circle" size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.durationDisplayText}>
                Renewal Duration: <Text style={{ color: colors.primary, fontWeight: '800' }}>{durationDays} Days</Text>
              </Text>
            </View>

            {/* Amount Field */}
            <ModernInput
              label="Renewal Amount (₹) *"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="e.g. 1000"
              icon={<FontAwesome name="money" size={16} color={colors.accent} />}
            />

            {/* Payment Mode Selector */}
            <View style={styles.selectorContainer}>
              <Text style={styles.selectorLabel}>Payment Mode</Text>
              <View style={styles.selectorRow}>
                {['Cash', 'UPI', 'Card'].map((mode) => {
                  const isSelected = paymentMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => setPaymentMode(mode)}
                      style={[styles.selectorBtn, isSelected && styles.selectorBtnActive]}
                    >
                      <Text style={[styles.selectorText, isSelected && styles.selectorTextActive]}>
                        {mode}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Date Picker Modal */}
          <DatePickerModal 
            visible={showDatePicker} 
            onClose={() => setShowDatePicker(false)} 
            onSelect={(date) => {
              if (datePickerType === 'joining') {
                const selectedStr = date; // 'YYYY-MM-DD'
                const currentDue = member.next_due_date ? new Date(member.next_due_date) : null;
                
                let minDateStr = '';
                if (currentDue && !isNaN(currentDue.getTime())) {
                  const year = currentDue.getFullYear();
                  const month = String(currentDue.getMonth() + 1).padStart(2, '0');
                  const day = String(currentDue.getDate()).padStart(2, '0');
                  minDateStr = `${year}-${month}-${day}`;
                } else {
                  const today = new Date();
                  const year = today.getFullYear();
                  const month = String(today.getMonth() + 1).padStart(2, '0');
                  const day = String(today.getDate()).padStart(2, '0');
                  minDateStr = `${year}-${month}-${day}`;
                }
                
                if (selectedStr < minDateStr) {
                  const parts = minDateStr.split('-');
                  const formattedMinDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                  Alert.alert(
                    'Invalid Date',
                    `Renewal start date cannot be earlier than ${formattedMinDate} (when the current membership expired or expires).`
                  );
                } else {
                  setJoiningDate(date);
                  // Shift expiry date by 1 month
                  const d = new Date(date);
                  d.setMonth(d.getMonth() + 1);
                  setExpiryDate(d.toISOString().split('T')[0]);
                }
              } else {
                if (date < joiningDate) {
                  Alert.alert('Invalid Date', 'Expiry date cannot be before start date.');
                } else {
                  setExpiryDate(date);
                }
              }
            }} 
            initialDate={datePickerType === 'joining' ? joiningDate : expiryDate}
            title={datePickerType === 'joining' ? 'Select Start Date' : 'Select Expiry Date'}
          />

          {/* Footer Actions */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Confirm Renew</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
  alertBox: {
    backgroundColor: colors.surface,
    padding: spacing.l,
    borderRadius: borderRadius.l,
    width: '100%',
    maxHeight: height * 0.85,
    ...shadows.premium,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.s,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContainer: {
    marginBottom: spacing.m,
  },
  previewContainer: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginBottom: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  previewLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  previewValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.m,
    marginTop: spacing.xs,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    paddingVertical: 8,
    borderRadius: borderRadius.s,
    marginHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  selectorContainer: {
    marginBottom: spacing.m,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectorText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  selectorTextActive: {
    color: 'white',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.m,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.m,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
  },
  durationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    padding: 10,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    marginBottom: spacing.m,
  },
  durationDisplayText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
