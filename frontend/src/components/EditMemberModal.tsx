import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image, Platform
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius } from '../theme/theme';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DropdownModal } from './DropdownModal';
import { DatePickerModal } from './DatePickerModal';
import { useAppAlert } from '../hooks/useAppAlert';


interface EditMemberModalProps {
  visible: boolean;
  member: any;
  onClose: () => void;
  onSaved: (updated: any) => void;
}

const InputRow = ({
  label, value, onChangeText, keyboardType = 'default' as any,
  placeholder = '', colors, editable = true, maxLength
}: any) => (
  <View style={fieldStyles.inputGroup}>
    <Text style={[fieldStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    <TextInput
      style={[
        fieldStyles.input, 
        { borderColor: colors.border, color: editable ? colors.text : colors.textMuted, backgroundColor: editable ? colors.surfaceLight : colors.background }
      ]}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder || label}
      placeholderTextColor={colors.textMuted}
      autoCorrect={false}
      blurOnSubmit={false}
      editable={editable}
      maxLength={maxLength}
    />
  </View>
);

const fieldStyles = StyleSheet.create({
  inputGroup: { marginBottom: spacing.m },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: borderRadius.m, padding: spacing.m, fontSize: 15 },
});

// Helper: format time input (only digits & colon)
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
        val = h + ':59';
      }
    }
  }
  return val;
};

export const EditMemberModal = ({ visible, member, onClose, onSaved }: EditMemberModalProps) => {
  const { colors } = useTheme();
  const { showError, showSuccess, AlertModal } = useAppAlert();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [address, setAddress] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [dailyHours, setDailyHours] = useState('');
  const [allocatedSeat, setAllocatedSeat] = useState('');
  const [wifiDetails, setWifiDetails] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');

  // Plan Dates
  const [joiningDate, setJoiningDate] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'joining' | 'nextDue'>('joining');

  // Timing — start + end with AM/PM (like RenewalModal)
  const [timingStartHour, setTimingStartHour] = useState('');
  const [timingStartAmPm, setTimingStartAmPm] = useState('AM');
  const [timingEndHour, setTimingEndHour] = useState('');
  const [timingEndAmPm, setTimingEndAmPm] = useState('PM');

  const [seats, setSeats] = useState<any[]>([]);
  const [fullSeatsData, setFullSeatsData] = useState<any[]>([]); // full seat objects with allotted_members
  const [seatConflicts, setSeatConflicts] = useState<any[]>([]); // members on selected seat
  const [wifiNetworks, setWifiNetworks] = useState<any[]>([]);
  const [seatDropdownVisible, setSeatDropdownVisible] = useState(false);
  const [wifiDropdownVisible, setWifiDropdownVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [businessType, setBusinessType] = useState('gym');
  const [enableHours, setEnableHours] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(['businessType', 'enableHours']).then(pairs => {
      const bt = pairs[0][1];
      const eh = pairs[1][1];
      if (bt) setBusinessType(bt);
      if (eh === 'true') setEnableHours(true);
    });
  }, []);

  // Auto-calculate end time from dailyHours + start time
  useEffect(() => {
    if (dailyHours && timingStartHour && timingStartAmPm) {
      const hours = parseInt(dailyHours);
      if (!isNaN(hours) && hours > 0) {
        let startH = parseInt(timingStartHour.split(':')[0] || timingStartHour);
        if (isNaN(startH)) return;
        if (timingStartAmPm === 'PM' && startH !== 12) startH += 12;
        if (timingStartAmPm === 'AM' && startH === 12) startH = 0;
        let endH = (startH + hours) % 24;
        let endAmPm = endH >= 12 ? 'PM' : 'AM';
        let formattedEndH = endH > 12 ? endH - 12 : endH === 0 ? 12 : endH;
        const minPart = timingStartHour.includes(':')
          ? ':' + (timingStartHour.split(':')[1] || '').padEnd(2, '0')
          : ':00';
        setTimingEndHour(`${String(formattedEndH).padStart(2, '0')}${minPart}`);
        setTimingEndAmPm(endAmPm);
      }
    }
  }, [dailyHours, timingStartHour, timingStartAmPm]);

  // Build timing string for save
  const buildTimingString = () => {
    if (!timingStartHour) return '';
    const startMin = timingStartHour.includes(':') ? timingStartHour : timingStartHour + ':00';
    const endMin = timingEndHour.includes(':') ? timingEndHour : (timingEndHour || '00') + ':00';
    return `${startMin} ${timingStartAmPm} - ${endMin} ${timingEndAmPm}`;
  };

  // Parse existing timing string (e.g. "9:00 AM - 5:00 PM") into parts
  const parseTiming = (timing: string) => {
    if (!timing) return;
    try {
      const parts = timing.split(' - ');
      if (parts.length !== 2) return;
      const [startPart, endPart] = parts;
      const [startTime, startAmPm] = startPart.split(' ');
      const [endTime, endAmPm] = endPart.split(' ');
      if (startTime) setTimingStartHour(startTime);
      if (startAmPm) setTimingStartAmPm(startAmPm);
      if (endTime) setTimingEndHour(endTime);
      if (endAmPm) setTimingEndAmPm(endAmPm);
    } catch (e) {}
  };

  useEffect(() => {
    if (visible && member) {
      setFullName(member.full_name || '');
      setPhone(member.phone || '');

      setAddress(member.address || '');
      setAadhaarNumber(member.aadhaar_number || '');
      setDailyHours(member.daily_hours ? String(member.daily_hours) : '');
      setAllocatedSeat(member.allocated_seat || '');
      setWifiDetails(member.wifi_details || '');
      setAge(member.age ? String(member.age) : '');
      setWeight(member.weight ? String(member.weight) : '');
      setNotes(member.notes || '');
      
      const getLocalDateStr = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      setJoiningDate(getLocalDateStr(member.joining_date));
      setNextDueDate(getLocalDateStr(member.next_due_date));
      
      parseTiming(member.timing || '');
      fetchSeats();
      fetchWifi();
    }
  }, [visible, member]);

  const fetchSeats = async () => {
    try {
      const res = await api.get('/seats/');
      setFullSeatsData(res.data); // keep full data for conflict check
      setSeats(res.data.map((s: any) => ({ id: s._id, label: s.seat_number, value: s.seat_number })));
    } catch (e) { }
  };

  // When user selects a seat, show who's already on it (excluding current member)
  const handleSeatSelect = (seatNumber: string) => {
    setAllocatedSeat(seatNumber);
    const seatData = fullSeatsData.find((s: any) => s.seat_number === seatNumber);
    if (seatData && seatData.allotted_members) {
      const currentMemberId = member?.member_id;
      const others = seatData.allotted_members.filter(
        (m: any) => m.member_id !== currentMemberId
      );
      setSeatConflicts(others);
    } else {
      setSeatConflicts([]);
    }
  };

  const fetchWifi = async () => {
    try {
      const res = await api.get('/settings/');
      const networks = res.data?.wifi_networks || [];
      setWifiNetworks(networks.map((n: any) => ({
        id: n.ssid || n.name,
        label: `${n.ssid || n.name} • ${n.password || ''}`,
        value: `SSID: ${n.ssid || n.name} | Pass: ${n.password || 'N/A'}`,
      })));
    } catch (e) { }
  };



  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Missing Name', 'Name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const memberId = member._id || member.id;
      const timingStr = buildTimingString();
      const payload: any = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        aadhaar_number: aadhaarNumber.trim(),
      };
      if (timingStr) payload.timing = timingStr;
      if (dailyHours) payload.daily_hours = parseInt(dailyHours);
      if (allocatedSeat) payload.allocated_seat = allocatedSeat;
      if (wifiDetails) payload.wifi_details = wifiDetails;
      if (age) payload.age = parseInt(age);
      if (weight) payload.weight = parseFloat(weight);
      if (notes) payload.notes = notes;

      
      if (joiningDate) payload.joining_date = new Date(joiningDate).toISOString();
      if (nextDueDate) payload.next_due_date = new Date(nextDueDate).toISOString();

      const res = await api.put(`/members/${memberId}`, payload);
      showSuccess('Success', 'Member details updated successfully!', () => {
        onSaved(res.data);
      });
    } catch (e: any) {
      showError('Save Failed', e.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const AmPmToggle = ({ value, onChange, colors }: any) => (
    <View style={{ flexDirection: 'row' }}>
      {['AM', 'PM'].map(opt => (
        <TouchableOpacity
          key={opt}
          style={{
            backgroundColor: value === opt ? colors.primary : 'transparent',
            paddingHorizontal: 7, paddingVertical: 5, borderRadius: 4,
            marginLeft: 2,
          }}
          onPress={() => onChange(opt)}
        >
          <Text style={{ color: value === opt ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome name="times" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Edit Member</Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: saving ? colors.textMuted : colors.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" enableOnAndroid={true} extraScrollHeight={20}>
            {/* Basic Info */}
            <Text style={[styles.section, { color: colors.text }]}>👤 Basic Info</Text>
            <InputRow colors={colors} label="Full Name" value={fullName} onChangeText={setFullName} />
            <InputRow colors={colors} label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={false} maxLength={10} />
            <InputRow colors={colors} label="Aadhaar Number (Optional)" value={aadhaarNumber} onChangeText={setAadhaarNumber} keyboardType="numeric" maxLength={12} />
            <InputRow colors={colors} label="Address" value={address} onChangeText={setAddress} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <InputRow colors={colors} label="Age" value={age} onChangeText={setAge} keyboardType="numeric" />
              </View>
              <View style={{ width: spacing.m }} />
              <View style={{ flex: 1 }}>
                <InputRow colors={colors} label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
              </View>
            </View>

            {/* Plan Dates */}
            <Text style={[styles.section, { color: colors.text }]}>📅 Plan Dates</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={fieldStyles.inputGroup}>
                  <Text style={[fieldStyles.label, { color: colors.textSecondary }]}>Plan Start</Text>
                  <TouchableOpacity onPress={() => { setDatePickerType('joining'); setShowDatePicker(true); }} style={[fieldStyles.input, { borderColor: colors.border, backgroundColor: colors.surfaceLight, justifyContent: 'center' }]}>
                    <Text style={{ color: joiningDate ? colors.text : colors.textMuted }}>
                      {joiningDate ? joiningDate.split('-').reverse().join('/') : 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ width: spacing.m }} />
              <View style={{ flex: 1 }}>
                <View style={fieldStyles.inputGroup}>
                  <Text style={[fieldStyles.label, { color: colors.textSecondary }]}>Next Due Date</Text>
                  <TouchableOpacity onPress={() => { setDatePickerType('nextDue'); setShowDatePicker(true); }} style={[fieldStyles.input, { borderColor: colors.border, backgroundColor: colors.surfaceLight, justifyContent: 'center' }]}>
                    <Text style={{ color: nextDueDate ? colors.text : colors.textMuted }}>
                      {nextDueDate ? nextDueDate.split('-').reverse().join('/') : 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Seat & Timing */}
            <Text style={[styles.section, { color: colors.text }]}>{businessType === 'library' ? '🪑 Seat & Timing' : '⏰ Timing'}</Text>

            {businessType === 'library' && (
              <>
                {/* Seat Dropdown */}
                <View style={fieldStyles.inputGroup}>
                  <Text style={[fieldStyles.label, { color: colors.textSecondary }]}>Allocated Seat</Text>
                  <TouchableOpacity
                    style={[fieldStyles.input, styles.dropdownBtn, {
                      borderColor: seatConflicts.length > 0 ? '#f59e0b' : colors.border,
                      backgroundColor: colors.surfaceLight
                    }]}
                    onPress={() => setSeatDropdownVisible(true)}
                  >
                    <Text style={{ color: allocatedSeat ? colors.text : colors.textMuted, fontSize: 15 }}>
                      {allocatedSeat || 'Select Seat'}
                    </Text>
                    <FontAwesome name="chevron-down" size={12} color={colors.textMuted} />
                  </TouchableOpacity>

                  {/* ⚠️ Conflict Warning — existing members on this seat */}
                  {seatConflicts.length > 0 && (
                    <View style={[styles.conflictBanner, { backgroundColor: '#fffbeb', borderColor: '#f59e0b' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <FontAwesome name="exclamation-triangle" size={13} color="#d97706" />
                        <Text style={{ color: '#d97706', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>
                          Seat already allotted to:
                        </Text>
                      </View>
                      {seatConflicts.map((m: any, idx: number) => (
                        <View key={idx} style={styles.conflictMember}>
                          <FontAwesome name="user" size={11} color="#92400e" style={{ marginRight: 6 }} />
                          <View>
                            <Text style={{ color: '#92400e', fontWeight: '700', fontSize: 13 }}>
                              {m.name || m.member_id}
                            </Text>
                            <Text style={{ color: '#b45309', fontSize: 11, marginTop: 1 }}>
                              🕐 {m.timing || 'Timing not set'}
                            </Text>
                          </View>
                        </View>
                      ))}
                      <Text style={{ color: '#92400e', fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
                        Make sure your timing doesn't overlap with theirs.
                      </Text>
                    </View>
                  )}

                  {/* ✅ Seat is free */}
                  {allocatedSeat && seatConflicts.length === 0 && (
                    <View style={[styles.conflictBanner, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
                      <FontAwesome name="check-circle" size={13} color="#16a34a" />
                      <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
                        Seat {allocatedSeat} is free — no other members assigned
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Daily Hours + Timing — shown when enableHours is ON (both gym & library) */}
            {enableHours && (
              <>
                {/* Daily Hours */}
                <InputRow
                  colors={colors}
                  label="Daily Hours"
                  value={dailyHours}
                  onChangeText={setDailyHours}
                  keyboardType="numeric"
                  placeholder="e.g. 8"
                />

                {/* Timing Slot */}
                <View style={fieldStyles.inputGroup}>
                  <Text style={[fieldStyles.label, { color: colors.textSecondary }]}>
                    Timing Slot 🌞 (e.g. 10:00 AM TO 06:00 PM)
                  </Text>
                  <View style={[styles.timingRow, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.timeInput, { color: colors.text }]}
                      placeholder="10:00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={timingStartHour}
                      onChangeText={(t) => setTimingStartHour(formatTimeInput(t))}
                      blurOnSubmit={false}
                    />
                    <AmPmToggle value={timingStartAmPm} onChange={setTimingStartAmPm} colors={colors} />
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800', marginHorizontal: 8 }}>TO</Text>
                    <TextInput
                      style={[styles.timeInput, { color: colors.text }]}
                      placeholder="06:00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={timingEndHour}
                      onChangeText={(t) => setTimingEndHour(formatTimeInput(t))}
                      blurOnSubmit={false}
                    />
                    <AmPmToggle value={timingEndAmPm} onChange={setTimingEndAmPm} colors={colors} />
                  </View>
                  {timingStartHour ? (
                    <View style={[styles.timingPreview, { backgroundColor: `${colors.primary}12` }]}>
                      <FontAwesome name="clock-o" size={12} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
                        {buildTimingString()}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            )}

            {/* WiFi — only dropdown, no manual edit */}
            {businessType === 'library' && (
              <>
                <Text style={[styles.section, { color: colors.text }]}>📶 WiFi</Text>
                <View style={fieldStyles.inputGroup}>
                  <Text style={[fieldStyles.label, { color: colors.textSecondary }]}>Assigned Network</Text>
                  <TouchableOpacity
                    style={[fieldStyles.input, styles.dropdownBtn, {
                      borderColor: wifiDetails ? colors.primary : colors.border,
                      backgroundColor: wifiDetails ? `${colors.primary}10` : colors.surfaceLight,
                    }]}
                    onPress={() => wifiNetworks.length > 0 ? setWifiDropdownVisible(true) : showError('No WiFi Networks', 'Add WiFi networks in Settings first.')}
                  >
                    <View style={{ flex: 1 }}>
                      {wifiDetails ? (
                        <>
                          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                            {wifiDetails.split('|')[0]?.replace('SSID:', '').trim() || wifiDetails}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                            {wifiDetails.split('|')[1]?.replace('Pass:', 'Password:').trim() || ''}
                          </Text>
                        </>
                      ) : (
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                          {wifiNetworks.length > 0 ? 'Select WiFi Network' : 'No networks — add in Settings'}
                        </Text>
                      )}
                    </View>
                    <FontAwesome name="wifi" size={16} color={wifiDetails ? colors.primary : colors.textMuted} />
                  </TouchableOpacity>
                  {wifiDetails && (
                    <TouchableOpacity
                      onPress={() => setWifiDetails('')}
                      style={{ alignSelf: 'flex-end', marginTop: 4 }}
                    >
                      <Text style={{ color: colors.error, fontSize: 12 }}>✕ Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {/* Notes */}
            <Text style={[styles.section, { color: colors.text }]}>📝 Notes</Text>
            <View style={fieldStyles.inputGroup}>
              <TextInput
                style={[fieldStyles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceLight, minHeight: 70 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any notes about this member..."
                placeholderTextColor={colors.textMuted}
                multiline
                blurOnSubmit={false}
              />
            </View>

            <View style={{ height: 40 }} />
          </KeyboardAwareScrollView>
        </View>
      </View>

      <DropdownModal
        visible={seatDropdownVisible}
        title="Select Seat"
        items={seats}
        onSelect={(item: any) => handleSeatSelect(item.value)}
        onClose={() => setSeatDropdownVisible(false)}
      />

      <DropdownModal
        visible={wifiDropdownVisible}
        title="Select WiFi Network"
        items={wifiNetworks}
        onSelect={(item: any) => setWifiDetails(item.value)}
        onClose={() => setWifiDropdownVisible(false)}
      />

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(date) => {
          if (datePickerType === 'joining') setJoiningDate(date);
          else setNextDueDate(date);
          setShowDatePicker(false);
        }}
        initialDate={datePickerType === 'joining' ? joiningDate : nextDueDate}
      />

      <AlertModal />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.l, borderBottomWidth: 1,
  },
  closeBtn: { padding: 8, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: borderRadius.m, minWidth: 70, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  content: { padding: spacing.l },
  section: { fontSize: 15, fontWeight: '700', marginBottom: spacing.m, marginTop: spacing.m },
  row: { flexDirection: 'row' },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timingRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: borderRadius.m, borderWidth: 1,
    paddingHorizontal: 12, height: 50,
  },
  timeInput: { flex: 1, fontSize: 14 },
  timingPreview: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8, padding: 8,
    borderRadius: borderRadius.s,
  },
  conflictBanner: {
    marginTop: 8,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    padding: spacing.m,
    flexDirection: 'column',
  },
  conflictMember: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
    marginTop: 4,
  },
});
