import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions, TextInput } from 'react-native';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ModernInput } from './ModernInput';
import { DatePickerModal } from './DatePickerModal';
import { api } from '../services/api';
import { DropdownModal } from './DropdownModal';
import { useAppAlert } from '../hooks/useAppAlert';

const { height } = Dimensions.get('window');

interface RenewalModalProps {
  visible: boolean;
  member: any;
  onClose: () => void;
  enableHours?: boolean; // Show daily hours & timing fields (library mode)
  onConfirm: (
    durationMonths: number,
    amount: number,
    paymentMode: string,
    nextDueDate?: string,
    joiningDate?: string,
    hours?: number,
    timing?: string,
    allocatedSeat?: string,
    wifiDetails?: string
  ) => void;
}

export const RenewalModal = ({
  visible,
  member,
  onClose,
  enableHours = false,
  onConfirm,
}: RenewalModalProps) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { showError, AlertModal } = useAppAlert();
  const getNextMonthDate = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  };

  const [joiningDate, setJoiningDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [amount, setAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [dailyHours, setDailyHours] = useState('');
  const [timingStartHour, setTimingStartHour] = useState('');
  const [timingStartAmPm, setTimingStartAmPm] = useState('AM');
  const [timingEndHour, setTimingEndHour] = useState('');
  const [timingEndAmPm, setTimingEndAmPm] = useState('PM');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'joining' | 'expiry'>('joining');
  const [allocatedSeat, setAllocatedSeat] = useState('');
  const [wifiDetails, setWifiDetails] = useState('');
  const [availableSeats, setAvailableSeats] = useState<any[]>([]);
  const [wifiOptions, setWifiOptions] = useState<any[]>([]);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [showWifiModal, setShowWifiModal] = useState(false);


  
  useEffect(() => {
    if (enableHours && visible) {
      api.get('/settings/').then(res => {
        setWifiOptions(res.data.wifi_networks || []);
      }).catch(() => {});
      api.get('/seats/').then(res => {
        setAvailableSeats(Array.isArray(res.data) ? res.data : res.data?.seats || []);
      }).catch(() => {});
    }
  }, [enableHours, visible]);

  useEffect(() => {
    if (dailyHours && timingStartHour && timingStartAmPm) {
      const hours = parseInt(dailyHours);
      if (!isNaN(hours) && hours > 0) {
        let startH = parseInt(timingStartHour.split(':')[0] || timingStartHour);
        if (isNaN(startH)) return;
        if (timingStartAmPm === 'PM' && startH !== 12) startH += 12;
        if (timingStartAmPm === 'AM' && startH === 12) startH = 0;
        let endH = startH + hours;
        endH = endH % 24;
        let endAmPm = 'AM';
        let formattedEndH = endH;
        if (endH >= 12) {
          endAmPm = 'PM';
          if (endH > 12) formattedEndH = endH - 12;
        } else if (endH === 0) {
          formattedEndH = 12;
        }
        let minPart = timingStartHour.includes(':') 
          ? ':' + (timingStartHour.split(':')[1] || '').padEnd(2, '0') 
          : ':00';
        setTimingEndHour(`${formattedEndH.toString().padStart(2, '0')}${minPart}`);
        setTimingEndAmPm(endAmPm);
      }
    }
  }, [dailyHours, timingStartHour, timingStartAmPm]);

  const getHoursDifference = (startH: string, startAmPm: string, endH: string, endAmPm: string) => {
    const parseTime = (timeStr: string, amPm: string) => {
      let [hStr, mStr] = timeStr.split(':');
      let h = parseInt(hStr || '0');
      let m = parseInt(mStr || '0');
      if (isNaN(h)) h = 0;
      if (isNaN(m)) m = 0;

      if (amPm === 'PM' && h !== 12) h += 12;
      if (amPm === 'AM' && h === 12) h = 0;

      return h + (m / 60);
    };

    let s = parseTime(startH, startAmPm);
    let e = parseTime(endH, endAmPm);

    let diff = e - s;
    if (diff < 0) diff += 24;
    return diff;
  };

  const formatTimeInput = (text: string) => {
    let val = text.replace(/[^0-9:]/g, '');
    if (val === ':') return '';

    let parts = val.split(':');
    
    if (parts.length === 1) {
      let p = parts[0];
      if (p.length >= 2) {
        if (parseInt(p[0]) > 1) {
          val = p[0] + ':' + p.substring(1);
        } else if (p.length === 3) {
          val = p.substring(0, 2) + ':' + p.substring(2);
        } else if (p.length > 3) {
          val = p.substring(0, 2) + ':' + p.substring(2, 4);
        }
      }
    }

    parts = val.split(':');
    if (parts.length > 1) {
      let h = parts[0];
      let m = parts[1];
      
      if (h.length === 2 && parseInt(h) > 12) val = h[0] + ':' + h[1] + m;
      
      parts = val.split(':');
      h = parts[0];
      m = parts[1];

      if (m && m.length >= 2) {
        if (parseInt(m.substring(0, 2)) > 59) {
          m = '59';
        } else {
          m = m.substring(0, 2);
        }
      }
      val = h + ':' + m;
    } else {
      let h = parts[0];
      if (h.length === 2 && parseInt(h) > 12) {
        val = h[0] + ':' + h[1];
      }
    }
    
    return val;
  };

  // Reset/Initialize state when member or visibility changes
useEffect(() => {
    if (visible && member) {
      setAmount(member.monthly_fees ? member.monthly_fees.toString() : '0');
      
      const nowStr = new Date().toISOString().split('T')[0];
      const nextDue = member.next_due_date ? new Date(member.next_due_date).toISOString().split('T')[0] : nowStr;
      
      let baseStart = nowStr;
      if (new Date(nextDue) > new Date()) {
        baseStart = nextDue;
      }
      
      setJoiningDate(baseStart);
      const planMonths = member.plan_duration_months || 1;
      const baseD = new Date(baseStart);
      baseD.setMonth(baseD.getMonth() + planMonths);
      setExpiryDate(baseD.toISOString().split('T')[0]);
      
      setDailyHours(member.daily_hours ? member.daily_hours.toString() : '');
      setAllocatedSeat(member.allocated_seat || '');
      setWifiDetails('');
      
      if (member.timing) {
        const parts = member.timing.split('to');
        if (parts.length === 2) {
          const startMatch = parts[0].trim().match(/(AM|PM)/i);
          const endMatch = parts[1].trim().match(/(AM|PM)/i);
          if (startMatch) setTimingStartAmPm(startMatch[0].toUpperCase());
          setTimingStartHour(parts[0].replace(/(AM|PM)/i, '').trim());
          if (endMatch) setTimingEndAmPm(endMatch[0].toUpperCase());
          setTimingEndHour(parts[1].replace(/(AM|PM)/i, '').trim());
        }
      } else {
        setTimingStartHour(''); setTimingStartAmPm('AM');
        setTimingEndHour(''); setTimingEndAmPm('PM');
      }
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

  
  const formatTo24Hour = (hour: string, amPm: string) => {
    if (!hour) return null;
    let h = parseInt(hour, 10);
    if (amPm === 'PM' && h !== 12) h += 12;
    if (amPm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:00`;
  };

  const checkTimeOverlap = (start1: string, end1: string, start2: string, end2: string) => {
    const timeToMins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const s1 = timeToMins(start1), e1 = timeToMins(end1);
    const s2 = timeToMins(start2), e2 = timeToMins(end2);
    let _e1 = e1, _e2 = e2;
    if (_e1 <= s1) _e1 += 24 * 60;
    if (_e2 <= s2) _e2 += 24 * 60;
    return Math.max(s1, s2) < Math.min(_e1, _e2);
  };

  const handleConfirm = () => {
    if (expiryDate < joiningDate) {
      showError('Invalid Expiry Date', 'To Date cannot be before From Date.');
      return;
    }
    const parsedAmount = parseFloat(amount) || 0;
    const planMonths = Math.max(1, Math.round(durationDays / 30.0));
    const parsedHours = (enableHours && dailyHours && !isNaN(parseInt(dailyHours)))
      ? parseInt(dailyHours)
      : undefined;
      

    let parsedTiming = undefined;
    if (enableHours && parsedHours && timingStartHour && timingEndHour) {
      const diff = getHoursDifference(timingStartHour, timingStartAmPm, timingEndHour, timingEndAmPm);
      if (diff !== parsedHours) {
        showError('Invalid Timing Slot', `You are renewing a ${parsedHours}-hour plan, but the timing slot is ${diff} hours long. It must be exactly ${parsedHours} hours.`);
        return;
      }
      parsedTiming = `${timingStartHour.trim()} ${timingStartAmPm} - ${timingEndHour.trim()} ${timingEndAmPm}`;
      
      // Conflict checking
      if (allocatedSeat) {
        const seatObj = availableSeats.find(s => s.seat_number === allocatedSeat);
        if (seatObj && seatObj.allotted_members) {
          const newStart = formatTo24Hour(timingStartHour, timingStartAmPm);
          const newEnd = formatTo24Hour(timingEndHour, timingEndAmPm);
          
          if (newStart && newEnd) {
            const overlappingMember = seatObj.allotted_members.find((am: any) => {
              if (am.timing && String(am.member_id) !== String(member.member_id) && String(am.member_id) !== String(member._id)) {
                const parts = am.timing.split(' to ');
                if (parts.length === 2) {
                  const [t1, amPm1] = parts[0].trim().split(' ');
                  const [t2, amPm2] = parts[1].trim().split(' ');
                  if (t1 && amPm1 && t2 && amPm2) {
                    const existingStart = formatTo24Hour(t1.split(':')[0], amPm1);
                    const existingEnd = formatTo24Hour(t2.split(':')[0], amPm2);
                    if (existingStart && existingEnd) {
                      return checkTimeOverlap(newStart, newEnd, existingStart, existingEnd);
                    }
                  }
                }
              }
              return false;
            });
            
            if (overlappingMember) {
              showError('Seat Unavailable', `Seat ${allocatedSeat} is already occupied by ${overlappingMember.name} during this time (${overlappingMember.timing})!`);
              return;
            }
          }
        }
      }
    }

    onConfirm(
      planMonths,
      parsedAmount,
      paymentMode,
      new Date(expiryDate).toISOString(),
      new Date(joiningDate).toISOString(),
      parsedHours,
      parsedTiming,
      allocatedSeat,
      wifiDetails
    );
  };

  const handlePresetSelect = (monthsVal: number) => {
    const d = new Date(joiningDate);
    d.setMonth(d.getMonth() + monthsVal);
    setExpiryDate(d.toISOString().split('T')[0]);
  };

  if (!visible || !member) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
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
                    value={joiningDate.split('-').reverse().join('/')}
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
                    value={expiryDate.split('-').reverse().join('/')}
                    editable={false}
                    placeholder="Select Date"
                    icon={<FontAwesome name="calendar" size={14} color={colors.primary} />}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Presets */}
            <View style={styles.presetsRow}>
              {[{ label: '1M', val: 1 }, { label: '2M', val: 2 }, { label: '3M', val: 3 }, { label: '6M', val: 6 }, { label: '12M', val: 12 }].map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  onPress={() => handlePresetSelect(preset.val)}
                  style={styles.presetBtn}
                >
                  <Text style={styles.presetText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
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

            {/* ⏰ Hours + Timing — Library mode only */}
            {enableHours && (
              <View style={styles.hoursBox}>
                <View style={styles.hoursHeader}>
                  <FontAwesome name="clock-o" size={14} color={colors.primary} />
                  <Text style={styles.hoursTitle}>⏰ Study Hours & Timing</Text>
                </View>
                <View style={{ flexDirection: 'column', gap: 16 }}>
                  <View>
                    <ModernInput
                      label="Daily Hours"
                      value={dailyHours}
                      onChangeText={setDailyHours}
                      keyboardType="numeric"
                      placeholder="e.g. 8"
                      icon={<FontAwesome name="clock-o" size={14} color={colors.primary} />}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontWeight: '600' }}>Timing Slot 🌞 (e.g. 10:00 AM TO 06:00 PM)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: colors.surfaceLight, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
                      <TextInput 
                        style={{ flex: 1, color: colors.text, fontSize: 14 }} 
                        placeholder="10:00" 
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric" 
                        value={timingStartHour} 
                        onChangeText={(t) => setTimingStartHour(formatTimeInput(t))} 
                      />
                      <TouchableOpacity 
                        style={{ backgroundColor: timingStartAmPm === 'AM' ? colors.primary : 'transparent', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 4, marginRight: 4 }} 
                        onPress={() => setTimingStartAmPm('AM')}>
                        <Text style={{ color: timingStartAmPm === 'AM' ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>AM</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={{ backgroundColor: timingStartAmPm === 'PM' ? colors.primary : 'transparent', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 4, marginRight: 8 }} 
                        onPress={() => setTimingStartAmPm('PM')}>
                        <Text style={{ color: timingStartAmPm === 'PM' ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>PM</Text>
                      </TouchableOpacity>
                      
                      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800', marginHorizontal: 8 }}>TO</Text>
                      
                      <TextInput 
                        style={{ flex: 1, color: colors.text, fontSize: 14, marginLeft: 8 }} 
                        placeholder="05:00" 
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric" 
                        value={timingEndHour} 
                        onChangeText={(t) => setTimingEndHour(formatTimeInput(t))} 
                      />
                      <TouchableOpacity 
                        style={{ backgroundColor: timingEndAmPm === 'AM' ? colors.primary : 'transparent', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 4, marginRight: 4 }} 
                        onPress={() => setTimingEndAmPm('AM')}>
                        <Text style={{ color: timingEndAmPm === 'AM' ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>AM</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={{ backgroundColor: timingEndAmPm === 'PM' ? colors.primary : 'transparent', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 4 }} 
                        onPress={() => setTimingEndAmPm('PM')}>
                        <Text style={{ color: timingEndAmPm === 'PM' ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>PM</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {enableHours && (
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: spacing.s }}>
                  <TouchableOpacity onPress={() => setShowSeatModal(true)}>
                    <ModernInput
                      label="Allocated Seat"
                      value={allocatedSeat}
                      editable={false}
                      placeholder="Select Seat"
                      icon={<FontAwesome name="desktop" size={14} color={colors.primary} />}
                    />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.s }}>
                  <TouchableOpacity onPress={() => setShowWifiModal(true)}>
                    <ModernInput
                      label="WiFi Network"
                      value={wifiDetails}
                      editable={false}
                      placeholder="Select WiFi"
                      icon={<FontAwesome name="wifi" size={14} color={colors.primary} />}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

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
                const currentDue = member.next_due_date ? new Date(member.next_due_date) : null;
                let minDateStr = '';
                if (currentDue && !isNaN(currentDue.getTime())) {
                  const y = currentDue.getFullYear();
                  const mo = String(currentDue.getMonth() + 1).padStart(2, '0');
                  const d = String(currentDue.getDate()).padStart(2, '0');
                  minDateStr = `${y}-${mo}-${d}`;
                } else {
                  const today = new Date();
                  minDateStr = today.toISOString().split('T')[0];
                }
                if (date < minDateStr) {
                  const [y, mo, d] = minDateStr.split('-');
                  showError('Invalid Date', `Start date cannot be before ${d}/${mo}/${y}.`);
                } else {
                  setJoiningDate(date);
                  const nd = new Date(date);
                  nd.setMonth(nd.getMonth() + 1);
                  setExpiryDate(nd.toISOString().split('T')[0]);
                }
              } else {
                if (date < joiningDate) {
                  showError('Invalid Date', 'Expiry date cannot be before start date.');
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
              <Text style={styles.confirmBtnText}>Confirm Renew ✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    
      <DropdownModal
        visible={showSeatModal}
        title="Select Seat"
        items={availableSeats.map(s => ({
          label: s.status === 'Available' ? `${s.seat_number} (Available)` : s.status === 'Reserved' ? `${s.seat_number} (Reserved)` : `${s.seat_number} (Occupied: ${s.allotted_members?.map((m:any) => m.name).join(', ') || 'Unknown'})`,
          value: s.seat_number
        }))}
        onSelect={(val) => setAllocatedSeat(val.value)}
        onClose={() => setShowSeatModal(false)}
      />
      <DropdownModal
        visible={showWifiModal}
        title="Select WiFi Network"
        items={wifiOptions.map(w => ({
          label: `${w.name} (Pass: ${w.password})`,
          value: w.name
        }))}
        onSelect={(val) => setWifiDetails(val.value)}
        onClose={() => setShowWifiModal(false)}
      />

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
  alertBox: {
    backgroundColor: colors.surface,
    padding: spacing.l,
    borderRadius: borderRadius.l,
    width: '100%',
    maxHeight: height * 0.88,
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
  titleContainer: { flex: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  closeBtn: { padding: 4 },
  scrollContainer: { marginBottom: spacing.m },
  previewContainer: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginBottom: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  previewLabel: { color: colors.textSecondary, fontSize: 13 },
  previewValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
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
  presetText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  // Hours Box
  hoursBox: {
    backgroundColor: `${colors.primary}08`,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    borderColor: `${colors.primary}25`,
    padding: spacing.m,
    marginBottom: spacing.m,
  },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.s,
  },
  hoursTitle: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  selectorContainer: { marginBottom: spacing.m },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  selectorRow: { flexDirection: 'row', gap: 8 },
  selectorBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectorText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  selectorTextActive: { color: 'white' },
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
  cancelBtnText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.m,
    alignItems: 'center',
  },
  confirmBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row' },
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
  durationDisplayText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
