import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Linking, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { ModernInput } from '../components/ModernInput';
import { DatePickerModal } from '../components/DatePickerModal';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DropdownModal } from '../components/DropdownModal';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { fetchMessageTemplates, buildJoiningMessage, getDefaultTemplates } from '../services/messageTemplates';
import { invalidateCache } from '../hooks/useDataStore';

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

export const MessageScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const getNextMonthDate = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  };

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [trainer, setTrainer] = useState('General');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [address, setAddress] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [notes, setNotes] = useState('');
  const [dailyHours, setDailyHours] = useState('');
  const [timingStartHour, setTimingStartHour] = useState('');
  const [timingStartAmPm, setTimingStartAmPm] = useState('AM');
  const [timingEndHour, setTimingEndHour] = useState('');
  const [timingEndAmPm, setTimingEndAmPm] = useState('PM');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(getNextMonthDate(new Date().toISOString().split('T')[0]));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'joining' | 'expiry'>('joining');
  const [isManual, setIsManual] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [gymName, setGymName] = useState('Gym');
  const [businessType, setBusinessType] = useState('gym');
  const [enableHours, setEnableHours] = useState(false);
  const [joiningMsgTemplate, setJoiningMsgTemplate] = useState<string | null>(null);
  const [allocatedSeat, setAllocatedSeat] = useState('');
  const [wifiDetails, setWifiDetails] = useState('');
  const [availableSeats, setAvailableSeats] = useState<any[]>([]);
  const [wifiOptions, setWifiOptions] = useState<any[]>([]);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [showWifiModal, setShowWifiModal] = useState(false);

  const [alertConfig, setAlertConfig] = useState<{ visible: boolean, title: string, message: string, type: 'success' | 'error' }>({
    visible: false, title: '', message: '', type: 'success'
  });

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
        
        // Use minute preservation if input has it
        let minPart = timingStartHour.includes(':') 
          ? ':' + (timingStartHour.split(':')[1] || '').padEnd(2, '0') 
          : ':00';
        setTimingEndHour(`${formattedEndH.toString().padStart(2, '0')}${minPart}`);
        setTimingEndAmPm(endAmPm);
      }
    }
  }, [dailyHours, timingStartHour, timingStartAmPm]);

  useFocusEffect(
    useCallback(() => {
      const loadSettings = async () => {
        try {
          const storedName = await AsyncStorage.getItem('gymName');
          if (storedName) setGymName(storedName);
          const templates = await fetchMessageTemplates();
          setBusinessType(templates.businessType);
          setEnableHours(templates.enableHours);
          setGymName(templates.gymName);
          const dbTemplate = templates.joiningTemplate;
          if (dbTemplate && dbTemplate.trim()) {
            setJoiningMsgTemplate(dbTemplate);
          } else {
            const defaults = getDefaultTemplates(templates.businessType);
            setJoiningMsgTemplate(defaults.joining);
          }
          if (templates.businessType === 'library') {
            try {
              const seatsRes = await api.get('/seats/');
              setAvailableSeats(Array.isArray(seatsRes.data) ? seatsRes.data : seatsRes.data?.seats || []);
            } catch (err) { console.log('Err fetching seats', err); }
            setWifiOptions(templates.wifiNetworks || []);
          }
        } catch (e) {
          console.log('Failed to load settings', e);
        }
      };
      loadSettings();
    }, [])
  );


  const showCustomAlert = (title: string, message: string, type: 'success' | 'error' = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const checkTimeOverlap = (start1: string, end1: string, start2: string, end2: string) => {
    if (!start1 || !end1 || !start2 || !end2) return false;
    const timeToMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    let s1 = timeToMin(start1), e1 = timeToMin(end1);
    let s2 = timeToMin(start2), e2 = timeToMin(end2);
    if (e1 <= s1) e1 += 24 * 60;
    if (e2 <= s2) e2 += 24 * 60;
    return Math.max(s1, s2) < Math.min(e1, e2);
  };

  const formatTo24Hour = (hour: string, amPm: string) => {
    if (!hour) return null;
    let h = parseInt(hour, 10);
    if (amPm === 'PM' && h !== 12) h += 12;
    if (amPm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:00`;
  };

  const handleEnroll = async () => {
    if (!name || !phone || !amount) {
      showCustomAlert('Missing Details', 'Please fill all required fields (Name, Phone, Amount)', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = phone.replace(/[^0-9]/g, '');

      if (formattedPhone.length !== 10) {
        showCustomAlert('Invalid Phone', 'Please enter a valid 10-digit mobile number', 'error');
        setIsLoading(false);
        return;
      }

      const finalPhone = formattedPhone;

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        showCustomAlert('Error', 'Invalid amount entered', 'error');
        setIsLoading(false);
        return;
      }

      const getDurationInDays = (start: string, end: string) => {
        const s = new Date(start);
        const e = new Date(end);
        const diff = e.getTime() - s.getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
      };

      const durationDays = getDurationInDays(joiningDate, expiryDate);

      if (enableHours && dailyHours && timingStartHour && timingEndHour) {
        const expectedHours = parseInt(dailyHours);
        if (!isNaN(expectedHours)) {
          const diff = getHoursDifference(timingStartHour, timingStartAmPm, timingEndHour, timingEndAmPm);
          if (diff !== expectedHours) {
            showCustomAlert('Invalid Timing Slot', `You selected a ${expectedHours}-hour plan, but the timing slot is ${diff} hours long. It must be exactly ${expectedHours} hours.`, 'error');
            setIsLoading(false);
            return;
          }
        }
      }

      let timingStr = '';
      if (enableHours && dailyHours) {
        if (timingStartHour && timingEndHour) {
          const s = timingStartHour.includes(':') ? timingStartHour : `${timingStartHour}:00`;
          const e = timingEndHour.includes(':') ? timingEndHour : `${timingEndHour}:00`;
          timingStr = `${s} ${timingStartAmPm} to ${e} ${timingEndAmPm}`;
          
          // Conflict checking
          if (businessType === 'library' && allocatedSeat) {
            const seatObj = availableSeats.find(s => s.seat_number === allocatedSeat);
            if (seatObj && seatObj.allotted_members) {
              const newStart = formatTo24Hour(timingStartHour, timingStartAmPm);
              const newEnd = formatTo24Hour(timingEndHour, timingEndAmPm);
              
              if (newStart && newEnd) {
                const overlappingMember = seatObj.allotted_members.find((am: any) => {
                  if (am.timing) {
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
                  showCustomAlert('Seat Unavailable', `Seat ${allocatedSeat} is already occupied by ${overlappingMember.name} during this time (${overlappingMember.timing})!`, 'error');
                  setIsLoading(false);
                  return;
                }
              }
            }
          }
        }
      }

      let welcomeMsg = '';
      if (!isManual) {
        const finalExpiryStr = new Date(expiryDate).toLocaleDateString();
        const joiningDateStr = new Date(joiningDate).toLocaleDateString();
        const hoursVal = (enableHours && dailyHours) ? parseInt(dailyHours) : undefined;

        const parsedAmountPaid = amountPaid && parseFloat(amountPaid) > 0 ? parseFloat(amountPaid) : undefined;
        welcomeMsg = buildJoiningMessage(
          joiningMsgTemplate,
          businessType,
          {
            name,
            phone: finalPhone,
            date: finalExpiryStr,
            joining_date: joiningDateStr,
            fees: amount,
            amountPaid: parsedAmountPaid,
            hours: hoursVal,
            timing: timingStr,
            gym: gymName,
            durationDays,
            seat: businessType === 'library' ? allocatedSeat : undefined,
            wifi: businessType === 'library' ? wifiDetails : undefined,
          }
        );
      }

      const enrollmentData = {
        full_name: name,
        phone: finalPhone,
        address: address || 'Not provided',
        joining_date: new Date(joiningDate).toISOString(),
        next_due_date: new Date(expiryDate).toISOString(),
        monthly_fees: parsedAmount,
        plan_duration_months: Math.max(1, Math.round(durationDays / 30.0)),
        gender: gender,
        age: age && !isNaN(parseInt(age)) ? parseInt(age) : undefined,
        weight: weight && !isNaN(parseFloat(weight)) ? parseFloat(weight) : undefined,
        trainer_assigned: trainer,
        payment_mode: paymentMode,
        amount_paid: amountPaid && parseFloat(amountPaid) > 0 ? parseFloat(amountPaid) : null,
        notes: notes || '',
        category: isManual ? "Manual" : "New",
        daily_hours: (enableHours && dailyHours) ? parseInt(dailyHours) : undefined,
        timing: timingStr,
        allocated_seat: businessType === 'library' ? allocatedSeat : undefined,
        wifi_details: businessType === 'library' ? wifiDetails : undefined,
      };

      const response = await api.post('/members/', enrollmentData);

      // Invalidate cache immediately so MembersScreen and Dashboard refresh on focus
      invalidateCache('members', 'dashboard_month', 'dashboard_all');

      if (!isManual) {
        try {
          await api.post('/messages/log', {
            recipient_phone: finalPhone,
            message_body: welcomeMsg,
            status: "sent"
          });
        } catch (e) { console.warn('Log failed'); }

        showCustomAlert(
          'Enrollment Successful',
          `Member saved! Now opening WhatsApp to send the receipt...`,
          'success'
        );

        setTimeout(async () => {
          await sendWhatsAppMessage(finalPhone, welcomeMsg);
          clearForm();
        }, 1500);

      } else {
        showCustomAlert('Success', 'Member added manually to the database.', 'success');
        clearForm();
      }

    } catch (error: any) {
      let errMsg = error.message;
      if (error.response?.data?.detail) {
        errMsg = typeof error.response.data.detail === 'string'
          ? error.response.data.detail
          : JSON.stringify(error.response.data.detail);
      }
      showCustomAlert('Enrollment Failed', errMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const clearForm = () => {
    setName(''); setPhone(''); setAmount(''); setAmountPaid(''); setAge(''); setWeight('');
    setAddress(''); setAadhaar(''); setNotes(''); setTrainer('General'); setDailyHours(''); setTimingStartHour(''); setTimingStartAmPm('AM'); setTimingEndHour(''); setTimingEndAmPm('PM');
    setAllocatedSeat(''); setWifiDetails('');
    setGender('Male');
    setPaymentMode('Cash');
    setIsManual(false);
    const todayStr = new Date().toISOString().split('T')[0];
    setJoiningDate(todayStr);
    setExpiryDate(getNextMonthDate(todayStr));
  };

  const Selector = ({ options, selected, onSelect, label }: any) => (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <View style={styles.selectorRow}>
        {options.map((opt: any) => {
          const isSelected = (typeof opt === 'string' ? opt : opt.value) === selected;
          return (
            <TouchableOpacity
              key={typeof opt === 'string' ? opt : opt.value}
              onPress={() => onSelect(typeof opt === 'string' ? opt : opt.value)}
              style={[styles.selectorBtn, isSelected && styles.selectorBtnActive]}
            >
              <Text style={[styles.selectorText, isSelected && styles.selectorTextActive]} adjustsFontSizeToFit numberOfLines={1}>
                {typeof opt === 'string' ? opt : opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Member Portal</Text>
          <Text style={styles.subtitle}>Enroll new or renew existing members</Text>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.manualRow}>
            <View>
              <Text style={styles.manualTitle}>Manual Add</Text>
              <Text style={styles.manualSub}>Skip WhatsApp receipt</Text>
            </View>
            <Switch
              value={isManual}
              onValueChange={setIsManual}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              thumbColor={isManual ? colors.text : '#f4f3f4'}
            />
          </View>

          <ModernInput label="Full Name *" value={name} onChangeText={setName} placeholder="e.g. John Doe" icon={<FontAwesome name="user-o" size={16} color={colors.textSecondary} />} />

          {enableHours && (
            <View>
              <ModernInput
                label={businessType === 'library' ? "Study Hours ⏰" : "Daily Hours ⏰"}
                value={dailyHours}
                onChangeText={setDailyHours}
                keyboardType="numeric"
                placeholder="e.g. 8"
                icon={<FontAwesome name="clock-o" size={16} color={colors.primary} />}
              />
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8, marginTop: 4, fontWeight: '600' }}>Timing Slot 🌞</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.m, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6 }}>
                    <TextInput
                      style={{ flex: 1, color: colors.text, fontSize: 13 }}
                      placeholder="10:00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={timingStartHour}
                      onChangeText={(t) => setTimingStartHour(formatTimeInput(t))}
                    />
                    <TouchableOpacity
                      style={{ backgroundColor: timingStartAmPm === 'AM' ? colors.primary : 'transparent', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => setTimingStartAmPm('AM')}>
                      <Text style={{ color: timingStartAmPm === 'AM' ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: timingStartAmPm === 'PM' ? colors.primary : 'transparent', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => setTimingStartAmPm('PM')}>
                      <Text style={{ color: timingStartAmPm === 'PM' ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>PM</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', alignSelf: 'center', marginHorizontal: 2 }}>TO</Text>

                <View style={{ flex: 1, marginLeft: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.m, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6 }}>
                    <TextInput
                      style={{ flex: 1, color: colors.text, fontSize: 13, marginLeft: 4 }}
                      placeholder="05:00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={timingEndHour}
                      onChangeText={(t) => setTimingEndHour(formatTimeInput(t))}
                    />
                    <TouchableOpacity
                      style={{ backgroundColor: timingEndAmPm === 'AM' ? colors.primary : 'transparent', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => setTimingEndAmPm('AM')}>
                      <Text style={{ color: timingEndAmPm === 'AM' ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: timingEndAmPm === 'PM' ? colors.primary : 'transparent', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => setTimingEndAmPm('PM')}>
                      <Text style={{ color: timingEndAmPm === 'PM' ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>PM</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}

          {businessType === 'library' && (
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: spacing.s }}>
                <TouchableOpacity onPress={() => setShowSeatModal(true)}>
                  <ModernInput
                    label="Seat Number"
                    value={allocatedSeat}
                    editable={false}
                    placeholder="Select Seat"
                    icon={<FontAwesome name="bookmark" size={14} color={colors.textSecondary} />}
                  />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.s }}>
                <TouchableOpacity onPress={() => setShowWifiModal(true)}>
                  <ModernInput
                    label="Wi-Fi Details"
                    value={wifiDetails.split(' Password')[0]}
                    editable={false}
                    placeholder="Select Network"
                    icon={<FontAwesome name="wifi" size={14} color={colors.textSecondary} />}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ModernInput label="Phone Number *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10 digit mobile number" maxLength={10} icon={<FontAwesome name="phone" size={16} color={colors.textSecondary} />} />

          <View>
            <TouchableOpacity onPress={() => { setDatePickerType('joining'); setShowDatePicker(true); }}>
              <ModernInput
                label="Joining Date *"
                value={joiningDate.split('-').reverse().join('/')}
                editable={false}
                placeholder="Select Date"
                icon={<FontAwesome name="calendar" size={16} color={colors.primary} />}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setDatePickerType('expiry'); setShowDatePicker(true); }}>
              <ModernInput
                label="Expiry Date *"
                value={expiryDate.split('-').reverse().join('/')}
                editable={false}
                placeholder="Select Date"
                icon={<FontAwesome name="calendar" size={16} color={colors.primary} />}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.datePresetsRow}>
            <Text style={styles.presetsLabel}>QUICK PLAN PRESETS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsBtnGroup}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((val) => (
                <TouchableOpacity
                  key={`preset-${val}`}
                  style={styles.datePresetBtn}
                  onPress={() => {
                    const d = new Date(joiningDate);
                    d.setMonth(d.getMonth() + val);
                    setExpiryDate(d.toISOString().split('T')[0]);
                  }}
                >
                  <Text style={styles.datePresetBtnText}>{val}M</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {(() => {
            const getDurationInDays = (start: string, end: string) => {
              const s = new Date(start);
              const e = new Date(end);
              const diff = e.getTime() - s.getTime();
              return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
            };
            const durationDays = getDurationInDays(joiningDate, expiryDate);
            return (
              <View style={styles.durationDisplay}>
                <FontAwesome name="info-circle" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.durationDisplayText}>
                  Calculated Duration: <Text style={{ color: colors.primary, fontWeight: '800' }}>{durationDays} Days</Text>
                </Text>
              </View>
            );
          })()}

          <DatePickerModal
            visible={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            onSelect={(date) => {
              if (datePickerType === 'joining') {
                setJoiningDate(date);
                const d = new Date(date);
                d.setMonth(d.getMonth() + 1);
                setExpiryDate(d.toISOString().split('T')[0]);
              } else {
                if (new Date(date) < new Date(joiningDate)) {
                  showCustomAlert('Invalid Expiry Date', 'To Date cannot be before From Date', 'error');
                } else {
                  setExpiryDate(date);
                }
              }
            }}
            initialDate={datePickerType === 'joining' ? joiningDate : expiryDate}
            title={datePickerType === 'joining' ? 'Select From Date' : 'Select To Date'}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <ModernInput
                label="Total Plan Amount (₹) *"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                icon={<FontAwesome name="money" size={16} color={colors.textSecondary} />}
              />
            </View>
          </View>

          {/* Partial Payment Box */}
          <View style={[styles.partialPayBox, { borderColor: `${colors.accent}30`, backgroundColor: `${colors.accent}08` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <FontAwesome name="money" size={13} color={colors.accent} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>Partial Payment (Optional)</Text>
            </View>
            <ModernInput
              label="Amount Paid Now (₹)"
              value={amountPaid}
              onChangeText={setAmountPaid}
              keyboardType="numeric"
              placeholder={amount ? `Leave blank if full ₹${amount} paid` : 'Enter total amount first'}
              icon={<FontAwesome name="rupee" size={14} color={colors.accent} />}
            />
            {amountPaid && parseFloat(amountPaid) > 0 && parseFloat(amount) > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Total: <Text style={{ fontWeight: '700', color: colors.text }}>₹{amount}</Text>
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Paid: <Text style={{ fontWeight: '700', color: colors.success }}>₹{amountPaid}</Text>
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Due: <Text style={{ fontWeight: '700', color: colors.error }}>₹{Math.max(0, parseFloat(amount) - parseFloat(amountPaid)).toFixed(0)}</Text>
                </Text>
              </View>
            )}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: spacing.s }}>
              <ModernInput label="Age" value={age} onChangeText={setAge} keyboardType="numeric" placeholder="25" />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.s }}>
              <ModernInput label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="70" />
            </View>
          </View>

          <Selector label="Payment Mode" options={['Cash', 'UPI', 'Card']} selected={paymentMode} onSelect={setPaymentMode} />

          <Selector label="Gender" options={['Male', 'Female', 'Other']} selected={gender} onSelect={setGender} />

          {businessType !== 'library' && (
            <ModernInput label="Trainer Assigned" value={trainer} onChangeText={setTrainer} placeholder="General / Personal Trainer Name" icon={<FontAwesome name="id-badge" size={16} color={colors.textSecondary} />} />
          )}

          <ModernInput label="Address" value={address} onChangeText={setAddress} placeholder="Area/City" icon={<FontAwesome name="map-marker" size={16} color={colors.textSecondary} />} />
          <ModernInput label="Aadhaar Number (Optional)" value={aadhaar} onChangeText={setAadhaar} keyboardType="numeric" placeholder="12 digit Aadhaar number" maxLength={12} icon={<FontAwesome name="id-card" size={16} color={colors.textSecondary} />} />

          <ModernInput label="Notes" value={notes} onChangeText={setNotes} placeholder="Any notes..." multiline numberOfLines={3} icon={<FontAwesome name="pencil" size={16} color={colors.textSecondary} />} />

          <View style={{ marginTop: spacing.l }}>
            <GradientButton title={isLoading ? "Processing..." : isManual ? "Add Manually" : "Enroll & Send Receipt"} onPress={handleEnroll} disabled={isLoading} />
          </View>
        </GlassCard>
      </ScrollView>

      <DropdownModal
        visible={showSeatModal}
        title="Select Seat"
        items={availableSeats}
        onClose={() => setShowSeatModal(false)}
        onSelect={(seat) => setAllocatedSeat(seat.seat_number)}
        renderItem={(item) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Seat {item.seat_number}</Text>
            <Text style={{ color: item.status === 'Available' ? colors.success : colors.warning, fontSize: 14 }}>
              {item.status}
            </Text>
          </View>
        )}
      />

      <DropdownModal
        visible={showWifiModal}
        title="Select WiFi Network"
        items={wifiOptions}
        onClose={() => setShowWifiModal(false)}
        onSelect={(wifi) => setWifiDetails(`${wifi.name} (Password: ${wifi.password})`)}
        renderItem={(item) => (
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
        )}
      />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.m, paddingBottom: 100 },
  header: { marginBottom: spacing.l, marginTop: spacing.xl },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 4 },
  card: { padding: spacing.l },
  row: { flexDirection: 'row' },
  manualRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceLight, padding: 12, borderRadius: borderRadius.m, marginBottom: spacing.l },
  manualTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  manualSub: { color: colors.textSecondary, fontSize: 12 },
  selectorContainer: { marginBottom: spacing.m },
  selectorLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectorBtn: { minWidth: 55, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.s, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  selectorBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectorText: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
  selectorTextActive: { color: 'white' },
  customAlertOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  customAlertBox: { backgroundColor: colors.surface, padding: spacing.xl, borderRadius: borderRadius.l, width: '100%', alignItems: 'center', ...shadows.premium },
  alertIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.m },
  alertTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.s, textAlign: 'center' },
  alertMessage: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: spacing.l, lineHeight: 20 },
  alertBtn: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: borderRadius.m, width: '100%', alignItems: 'center' },
  alertBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  emptyContainer: { marginTop: 100, alignItems: 'center', gap: 12 },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  datePresetsRow: {
    marginBottom: spacing.m,
    marginTop: -spacing.xs,
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  presetsBtnGroup: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 20,
  },
  datePresetBtn: {
    width: 60,
    backgroundColor: colors.surfaceLight,
    paddingVertical: 8,
    borderRadius: borderRadius.s,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  datePresetBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
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
  partialPayBox: {
    borderRadius: borderRadius.m,
    borderWidth: 1,
    padding: spacing.m,
    marginBottom: spacing.m,
  },
});
