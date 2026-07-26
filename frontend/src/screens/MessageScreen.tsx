import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Animated, ActivityIndicator, Linking, Switch, Image, Platform, Modal, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';

// Utilities for time formatting
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
      if (parseInt(p[0]) > 1) val = p[0] + ':' + p.substring(1);
      else if (p.length === 3) val = p.substring(0, 2) + ':' + p.substring(2);
      else if (p.length > 3) val = p.substring(0, 2) + ':' + p.substring(2, 4);
    }
  }
  parts = val.split(':');
  if (parts.length > 1) {
    let h = parts[0], m = parts[1];
    if (h.length === 2 && parseInt(h) > 12) val = h[0] + ':' + h[1] + m;
    parts = val.split(':');
    h = parts[0]; m = parts[1];
    if (m && m.length >= 2) {
      if (parseInt(m.substring(0, 2)) > 59) m = '59';
      else m = m.substring(0, 2);
    }
    val = h + ':' + m;
  } else {
    let h = parts[0];
    if (h.length === 2 && parseInt(h) > 12) val = h[0] + ':' + h[1];
  }
  return val;
};

export const MessageScreen = () => {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const styles = getStyles(colors, isDark);

  const getNextMonthDate = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  };

  // State
  const [step, setStep] = useState(1); // 1: Plan, 2: Details, 3: Payment, 4: Success
  const [searchPlan, setSearchPlan] = useState('');
  
  // Member Details State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [address, setAddress] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [notes, setNotes] = useState('');
  const [gender, setGender] = useState('Male');

  // Payment State
  const [amount, setAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Paid'); // 'Paid' | 'Partial' | 'Pending'
  const [paymentMode, setPaymentMode] = useState('Cash'); // 'Cash' | 'UPI' | 'Card' | 'Bank Transfer'
  const [discount, setDiscount] = useState('');
  const [sendReceipt, setSendReceipt] = useState(true);

  // Business / Library Options
  const [dailyHours, setDailyHours] = useState('');
  const [timingStartHour, setTimingStartHour] = useState('');
  const [timingStartAmPm, setTimingStartAmPm] = useState('AM');
  const [timingEndHour, setTimingEndHour] = useState('');
  const [timingEndAmPm, setTimingEndAmPm] = useState('PM');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(getNextMonthDate(new Date().toISOString().split('T')[0]));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'joining' | 'expiry' | 'dob'>('joining');
  const [dateOfBirth, setDateOfBirth] = useState('');
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
  const [welcomeMsgFinal, setWelcomeMsgFinal] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);
  
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('custom');

  const [offers, setOffers] = useState<any[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [baseAmount, setBaseAmount] = useState('');
  const [trainers, setTrainers] = useState<any[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<string>('General Coach');
  const [showPlanTooltip, setShowPlanTooltip] = useState(false);

  const [alertConfig, setAlertConfig] = useState<{ visible: boolean, title: string, message: string, type: 'success' | 'error' }>({
    visible: false, title: '', message: '', type: 'success'
  });
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      if (typeof scrollRef.current.scrollToPosition === 'function') {
        scrollRef.current.scrollToPosition(0, 0, false);
      } else if (typeof scrollRef.current.scrollTo === 'function') {
        scrollRef.current.scrollTo({ x: 0, y: 0, animated: false });
      }
    }
  }, [step]);

  const getDurationInDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  };
  const durationDays = getDurationInDays(joiningDate, expiryDate);

  useEffect(() => {
    if (dailyHours && timingStartHour && timingStartAmPm) {
      const hours = parseInt(dailyHours);
      if (!isNaN(hours) && hours > 0) {
        let startH = parseInt(timingStartHour.split(':')[0] || timingStartHour);
        if (isNaN(startH)) return;
        if (timingStartAmPm === 'PM' && startH !== 12) startH += 12;
        if (timingStartAmPm === 'AM' && startH === 12) startH = 0;
        let endH = (startH + hours) % 24;
        let endAmPm = 'AM';
        let formattedEndH = endH;
        if (endH >= 12) {
          endAmPm = 'PM';
          if (endH > 12) formattedEndH = endH - 12;
        } else if (endH === 0) formattedEndH = 12;
        let minPart = timingStartHour.includes(':') ? ':' + (timingStartHour.split(':')[1] || '').padEnd(2, '0') : ':00';
        setTimingEndHour(`${formattedEndH.toString().padStart(2, '0')}${minPart}`);
        setTimingEndAmPm(endAmPm);
      }
    }
  }, [dailyHours, timingStartHour, timingStartAmPm]);

  const fetchPlans = async () => {
    try {
      const res = await api.get('/plans/');
      setPlans(res.data.filter((p: any) => p.is_active));
    } catch (e) {
      console.log('Failed to fetch plans', e);
    }
  };

  const fetchOffers = async () => {
    try {
      const res = await api.get('/offers/');
      setOffers(res.data.filter((o: any) => o.is_active));
    } catch (e) {
      console.log('Failed to fetch offers', e);
    }
  };

  const fetchTrainers = async () => {
    try {
      const res = await api.get('/trainers/');
      setTrainers(res.data || []);
    } catch (e) {
      console.log('Failed to fetch trainers', e);
    }
  };

  const applyOffer = (offer: any, baseAmtStr: string) => {
    setSelectedOffer(offer);
    if (!baseAmtStr || isNaN(parseFloat(baseAmtStr))) {
      setAmount('');
      return;
    }
    
    const base = parseFloat(baseAmtStr);
    let finalAmt = base;
    if (offer) {
      if (offer.discount_type === 'Percentage') {
        finalAmt = base - (base * (offer.discount_value / 100));
      } else {
        finalAmt = Math.max(0, base - offer.discount_value);
      }
    }
    setAmount(finalAmt.toString());
  };

  const selectPredefinedPlan = (plan: any) => {
    setSelectedPlanId(plan._id);
    setBaseAmount(plan.price.toString());
    applyOffer(selectedOffer, plan.price.toString());
    const d = new Date(joiningDate);
    d.setDate(d.getDate() + (plan.duration_days || 30));
    setExpiryDate(d.toISOString().split('T')[0]);
  };

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
          if (dbTemplate && typeof dbTemplate === 'string' && dbTemplate.trim()) setJoiningMsgTemplate(dbTemplate);
          else setJoiningMsgTemplate(null);
          
          if (templates.businessType === 'library') {
            try {
              const seatsRes = await api.get('/seats/');
              setAvailableSeats(Array.isArray(seatsRes.data) ? seatsRes.data : seatsRes.data?.seats || []);
            } catch (err) {}
            setWifiOptions(templates.wifiNetworks || []);
          }
          
          await fetchPlans();
          await fetchOffers();
          await fetchTrainers();

          try {
            const memRes = await api.get('/members/?skip=0&limit=5');
            if (memRes.data && Array.isArray(memRes.data)) {
              setRecentMembers(memRes.data);
            } else if (memRes.data && Array.isArray(memRes.data.members)) {
              setRecentMembers(memRes.data.members);
            }
          } catch (err) { console.log('Failed to load recent members', err); }
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
    const timeToMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
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

  const validateStep1 = () => {
    if (!amount) {
      showCustomAlert('Missing Details', 'Please enter a valid amount.', 'error');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!name || !phone) {
      showCustomAlert('Missing Details', 'Please fill in Name and Phone.', 'error');
      return false;
    }
    const formattedPhone = phone.replace(/[^0-9]/g, '');
    if (formattedPhone.length !== 10) {
      showCustomAlert('Invalid Phone', 'Please enter a valid 10-digit mobile number.', 'error');
      return false;
    }
    return true;
  };

  const handleEnroll = async () => {
    setIsLoading(true);
    try {
      const parsedAmount = parseFloat(amount) || 0;
      const finalPhone = phone.replace(/[^0-9]/g, '');
      
      let timingStr = '';
      if (enableHours && dailyHours && timingStartHour && timingEndHour) {
        const s = timingStartHour.includes(':') ? timingStartHour : `${timingStartHour}:00`;
        const e = timingEndHour.includes(':') ? timingEndHour : `${timingEndHour}:00`;
        timingStr = `${s} ${timingStartAmPm} to ${e} ${timingEndAmPm}`;
        
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
                      if (existingStart && existingEnd) return checkTimeOverlap(newStart, newEnd, existingStart, existingEnd);
                    }
                  }
                }
                return false;
              });
              if (overlappingMember) {
                showCustomAlert('Seat Unavailable', `Seat ${allocatedSeat} is occupied by ${overlappingMember.name} during this time (${overlappingMember.timing})!`, 'error');
                setIsLoading(false);
                return;
              }
            }
          }
        }
      }

      let welcomeMsg = '';
      if (!isManual) {
        const parsedAmountPaid = paymentStatus === 'Partial' && amountPaid && parseFloat(amountPaid) > 0 ? parseFloat(amountPaid) : undefined;
        welcomeMsg = buildJoiningMessage(joiningMsgTemplate, businessType, {
          name, phone: finalPhone, date: new Date(expiryDate).toLocaleDateString(),
          joining_date: new Date(joiningDate).toLocaleDateString(), fees: amount, amountPaid: parsedAmountPaid,
          hours: (enableHours && dailyHours) ? parseInt(dailyHours) : undefined, timing: timingStr,
          gym: gymName, durationDays, seat: businessType === 'library' ? allocatedSeat : undefined,
          wifi: businessType === 'library' ? wifiDetails : undefined,
          plan_name: plans.find(p => p._id === selectedPlanId)?.name || 'Custom',
        });
        setWelcomeMsgFinal(welcomeMsg);
      }

      const enrollmentData = {
        full_name: name,
        phone: finalPhone,
        address: address || 'Not provided',
        joining_date: new Date(joiningDate).toISOString(),
        next_due_date: new Date(expiryDate).toISOString(),
        monthly_fees: parsedAmount,
        plan_duration_months: Math.max(1, Math.round(durationDays / 30.0)),
        gender,
        age: age && !isNaN(parseInt(age)) ? parseInt(age) : undefined,
        weight: weight && !isNaN(parseFloat(weight)) ? parseFloat(weight) : undefined,
        date_of_birth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
        payment_mode: paymentMode,
        amount_paid: paymentStatus === 'Partial' && amountPaid && parseFloat(amountPaid) > 0 ? parseFloat(amountPaid) : (paymentStatus === 'Pending' ? 0 : parsedAmount),
        notes: notes || '',
        category: isManual ? "Manual" : "New",
        daily_hours: (enableHours && dailyHours) ? parseInt(dailyHours) : undefined,
        timing: timingStr,
        allocated_seat: businessType === 'library' ? allocatedSeat : undefined,
        wifi_details: businessType === 'library' ? wifiDetails : undefined,
        aadhaar_number: aadhaar ? aadhaar.trim() : undefined,
        plan_name: plans.find(p => p._id === selectedPlanId)?.name || 'Custom',
        applied_offer_name: selectedOffer?.name || null,
        trainer_assigned: selectedTrainer || "General Coach",
      };

      await api.post('/members/', enrollmentData);
      invalidateCache('members', 'dashboard_month', 'dashboard_all');

      if (!isManual && sendReceipt) {
        try {
          await api.post('/messages/log', { recipient_phone: finalPhone, message_body: welcomeMsg, status: "sent" });
        } catch (e) {}
      }

      setStep(4); // Success Step

    } catch (error: any) {
      let errMsg = error.message;
      if (error.response?.data?.detail) {
        errMsg = typeof error.response.data.detail === 'string' ? error.response.data.detail : JSON.stringify(error.response.data.detail);
      }
      showCustomAlert('Enrollment Failed', errMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const clearForm = () => {
    setName(''); setPhone(''); setAmount(''); setAmountPaid(''); setAge(''); setWeight('');
    setAddress(''); setDateOfBirth('');
    setAadhaar(''); setNotes(''); 
    setDailyHours(''); 
    setTimingStartHour(''); setTimingStartAmPm('AM'); setTimingEndHour(''); setTimingEndAmPm('PM');
    setAllocatedSeat(''); setWifiDetails(''); setGender('Male'); setPaymentMode('Cash'); setPaymentStatus('Paid');
    setIsManual(false); setStep(1); setDiscount(''); setSendReceipt(true);
    const todayStr = new Date().toISOString().split('T')[0];
    setJoiningDate(todayStr); setExpiryDate(getNextMonthDate(todayStr));
    setWelcomeMsgFinal('');
  };

  // UI Components
  const StepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      {['Plan', 'Details', 'Payment'].map((label, idx) => {
        const isActive = step === idx + 1;
        const isPassed = step > idx + 1;
        return (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', flex: idx < 2 ? 1 : 0 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={[styles.stepCircle, isActive ? styles.stepCircleActive : isPassed ? styles.stepCirclePassed : {}]}>
                {isPassed ? <FontAwesome name="check" size={10} color="#fff" /> : <Text style={[styles.stepCircleText, (isActive || isPassed) && { color: '#fff' }]}>{idx + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{label}</Text>
            </View>
            {idx < 2 && <View style={[styles.stepLine, isPassed && styles.stepLinePassed]} />}
          </View>
        );
      })}
    </View>
  );

  const renderStep0 = () => (
    <View style={{ flex: 1 }}>
      <View style={[styles.headerBar, { borderBottomWidth: 0, paddingBottom: 0 }]}>
        <View style={{ width: 32 }} />
        <Text style={styles.headerTitle}>Enroll Member</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAwareScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }} enableOnAndroid={true} extraScrollHeight={20}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)}>
          <LinearGradient colors={['#7C3AED', '#4F46E5']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={{ borderRadius: 20, padding: 24, marginBottom: 24, overflow: 'hidden' }}>
            <View style={{ width: '65%' }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8, lineHeight: 30 }}>Start a New Membership</Text>
              <Text style={{ color: '#E0E7FF', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>Fill in the details to enroll a new member</Text>
            </View>
            <View style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.2 }}>
              <FontAwesome name="user-plus" size={120} color="#fff" />
            </View>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', position: 'absolute', right: 24, top: '40%' }}>
              <FontAwesome name="plus" size={16} color="#fff" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 }}>Why Members Choose Us</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }}>
          {[
            { icon: 'handshake-o', color: '#8B5CF6', label: 'Expert Trainers' },
            { icon: 'cogs', color: '#3B82F6', label: 'Latest Equipment' },
            { icon: 'user', color: '#A855F7', label: 'Personalized Plans' },
            { icon: 'apple', color: '#10B981', label: 'Nutrition Guide' }
          ].map((feat, i) => (
            <View key={i} style={{ alignItems: 'center', width: '22%' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${feat.color}15`, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <FontAwesome name={feat.icon as any} size={20} color={feat.color} />
              </View>
              <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', fontWeight: '500' }}>{feat.label}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 }}>Quick Add</Text>
        <TouchableOpacity style={{ backgroundColor: colors.surfaceLight, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 32, borderWidth: 1, borderColor: colors.border }} onPress={() => setStep(1)}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}15`, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
            <FontAwesome name="user-plus" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 }}>Quick Enroll</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>Name, Phone & Plan</Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Recent Members</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/members')}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>View All</Text></TouchableOpacity>
        </View>

        {recentMembers.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>No recent members</Text>
        ) : (
          recentMembers.slice(0, 5).map((rm, i) => {
            const isDueSoon = rm.payment_status === 'Partial' || (rm.next_due_date && new Date(rm.next_due_date) <= new Date(Date.now() + 7 * 86400000));
            return (
              <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border }} onPress={() => router.push({ pathname: '/members/summary' as any, params: { id: rm._id } })}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.primary}20`, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>{rm.full_name?.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 }}>{rm.full_name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>{rm.member_id || 'N/A'}</Text>
                </View>
                <View style={{ backgroundColor: isDueSoon ? '#FEF3C7' : '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isDueSoon ? '#D97706' : '#059669' }}>{isDueSoon ? 'Due Soon' : 'Active'}</Text>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </KeyboardAwareScrollView>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Membership Details</Text>
      <Text style={styles.stepSubtitle}>Enter membership amount and dates</Text>

      <View style={{ marginTop: 16, backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
        {plans.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Select Membership Plan</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', paddingBottom: 8 }}>
               <TouchableOpacity 
                 activeOpacity={0.8}
                 style={[{ width: 120, height: 95, padding: 12, borderRadius: 16, borderWidth: 1, marginRight: 12, justifyContent: 'center', alignItems: 'center' }, selectedPlanId === 'custom' ? { backgroundColor: colors.surface, borderColor: colors.primary, ...(!isDark ? shadows.light : {}) } : { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}
                 onPress={() => setSelectedPlanId('custom')}
               >
                 <FontAwesome name="pencil-square-o" size={24} color={selectedPlanId === 'custom' ? colors.primary : colors.textMuted} style={{ marginBottom: 6 }} />
                 <Text style={{ fontSize: 13, fontWeight: selectedPlanId === 'custom' ? '700' : '500', color: selectedPlanId === 'custom' ? colors.primary : colors.textSecondary }}>Custom Plan</Text>
               </TouchableOpacity>
               {plans.map(plan => {
                 const isSelected = selectedPlanId === plan._id;
                 return (
                   <TouchableOpacity activeOpacity={0.9} key={plan._id} onPress={() => selectPredefinedPlan(plan)} style={{ marginRight: 12 }}>
                     <LinearGradient
                       colors={isSelected ? (isDark ? ['#10B981', '#059669'] : ['#34D399', '#10B981']) : (isDark ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'] : ['#F9FAFB', '#F3F4F6'])}
                       start={{x:0, y:0}} end={{x:1, y:1}}
                       style={{ width: 150, height: 95, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: isSelected ? 'transparent' : colors.border, justifyContent: 'space-between', ...(!isDark && isSelected ? shadows.light : {}) }}
                     >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${colors.primary}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: isSelected ? '#fff' : colors.primary }}>
                              ₹{plan.price}
                            </Text>
                          </View>
                          {isSelected ? <FontAwesome name="check-circle" size={18} color="#fff" /> : <FontAwesome name={plan.icon || 'star'} size={16} color={plan.color || colors.textMuted} />}
                        </View>
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: isSelected ? '#fff' : colors.text }} numberOfLines={1}>{plan.name}</Text>
                          <Text style={{ fontSize: 10, color: isSelected ? 'rgba(255,255,255,0.9)' : colors.textMuted, marginTop: 2, fontWeight: '600' }} numberOfLines={1}>{plan.duration_days} Days</Text>
                        </View>
                     </LinearGradient>
                   </TouchableOpacity>
                 );
               })}
            </ScrollView>
          </View>
        )}


        <ModernInput 
          label="Base Plan Amount (₹) *" 
          value={baseAmount} 
          onChangeText={(val) => { 
            setBaseAmount(val); 
            setSelectedPlanId('custom'); 
            applyOffer(selectedOffer, val);
          }} 
          keyboardType="numeric" 
          placeholder="e.g. 1500" 
          icon={<FontAwesome name="money" size={16} color={colors.primary} />} 
        />
        
        {offers.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Apply Promotional Offer</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 8, paddingBottom: 8 }}>
               <TouchableOpacity 
                 activeOpacity={0.8}
                 style={[{ width: 120, height: 85, padding: 12, borderRadius: 16, borderWidth: 1, marginRight: 12, justifyContent: 'center', alignItems: 'center' }, !selectedOffer ? { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' } : { backgroundColor: colors.surface, borderColor: colors.border }]}
                 onPress={() => applyOffer(null, baseAmount)}
               >
                 <FontAwesome name="times-circle" size={24} color={!selectedOffer ? colors.textSecondary : colors.textMuted} style={{ marginBottom: 6 }} />
                 <Text style={{ fontSize: 13, fontWeight: !selectedOffer ? '700' : '500', color: !selectedOffer ? colors.text : colors.textSecondary }}>No Offer</Text>
               </TouchableOpacity>
               {offers.map(offer => {
                 const isSelected = selectedOffer?._id === offer._id;
                 return (
                   <TouchableOpacity activeOpacity={0.9} key={offer._id} onPress={() => applyOffer(offer, baseAmount)} style={{ marginRight: 12 }}>
                     <LinearGradient
                       colors={isSelected ? (isDark ? ['#7C3AED', '#4F46E5'] : ['#8B5CF6', '#6366F1']) : (isDark ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'] : ['#F9FAFB', '#F3F4F6'])}
                       start={{x:0, y:0}} end={{x:1, y:1}}
                       style={{ width: 160, height: 85, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: isSelected ? 'transparent' : colors.border, justifyContent: 'space-between', ...(!isDark && isSelected ? shadows.light : {}) }}
                     >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${colors.primary}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: isSelected ? '#fff' : colors.primary }}>
                              {offer.discount_type === 'Percentage' ? `${offer.discount_value}% OFF` : `₹${offer.discount_value} OFF`}
                            </Text>
                          </View>
                          {isSelected ? <FontAwesome name="check-circle" size={18} color="#fff" /> : <FontAwesome name="gift" size={16} color={colors.textMuted} />}
                        </View>
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: isSelected ? '#fff' : colors.text }} numberOfLines={1}>{offer.name}</Text>
                          {offer.description ? <Text style={{ fontSize: 10, color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textMuted, marginTop: 2 }} numberOfLines={1}>{offer.description}</Text> : null}
                        </View>
                     </LinearGradient>
                   </TouchableOpacity>
                 );
               })}
            </ScrollView>
            
            {selectedOffer && (
              <View style={{ marginTop: 8, padding: 12, backgroundColor: '#ECFDF5', borderRadius: 8, borderWidth: 1, borderColor: '#10B981', flexDirection: 'row', justifyContent: 'space-between' }}>
                 <Text style={{ color: '#059669', fontWeight: '600', fontSize: 13 }}>Final Amount after Discount:</Text>
                 <Text style={{ color: '#059669', fontWeight: '800', fontSize: 14 }}>₹{amount}</Text>
              </View>
            )}
          </View>
        )}

        {/* Assign Trainer Selector */}
        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>ASSIGN TRAINER / COACH</Text>
            <TouchableOpacity onPress={() => router.push('/trainers' as any)}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>+ Manage Trainers</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['General Coach', ...trainers.map(t => t.name)].map((trName) => {
              const active = selectedTrainer === trName;
              return (
                <TouchableOpacity
                  key={trName}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 16,
                    borderWidth: 1,
                    marginRight: 10,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6
                  }}
                  onPress={() => setSelectedTrainer(trName)}
                >
                  <FontAwesome name="user-circle-o" size={14} color={active ? '#fff' : colors.textSecondary} />
                  <Text style={{ fontSize: 13, fontWeight: active ? '700' : '600', color: active ? '#fff' : colors.text }}>{trName}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => { setDatePickerType('joining'); setShowDatePicker(true); }}>
              <ModernInput label="Joining Date *" value={joiningDate.split('-').reverse().join('/')} editable={false} placeholder="Select Date" icon={<FontAwesome name="calendar" size={16} color={colors.primary} />} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => { setDatePickerType('expiry'); setShowDatePicker(true); setSelectedPlanId('custom'); }}>
              <ModernInput label="End Date *" value={expiryDate.split('-').reverse().join('/')} editable={false} placeholder="Select Date" icon={<FontAwesome name="calendar-check-o" size={16} color={colors.primary} />} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.datePresetsRow, { marginTop: 16 }]}>
          <Text style={[styles.presetsLabel, { color: colors.textSecondary }]}>QUICK PRESETS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsBtnGroup}>
            {[1, 2, 3, 4, 5, 6, 12].map((val) => (
              <TouchableOpacity key={`preset-${val}`} style={[styles.datePresetBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]} onPress={() => { const d = new Date(joiningDate); d.setMonth(d.getMonth() + val); setExpiryDate(d.toISOString().split('T')[0]); }}>
                <Text style={[styles.datePresetBtnText, { color: colors.text }]}>{val}M</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.durationDisplay, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6', borderColor: colors.border, marginTop: 16 }]}>
          <FontAwesome name="info-circle" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
          <Text style={[styles.durationDisplayText, { color: colors.text }]}>Calculated Duration: <Text style={{ fontWeight: '800' }}>{durationDays} Days</Text></Text>
        </View>
      </View>

      {/* Global Add-ons: Timing, Seat, WiFi */}
      {enableHours && (
        <View style={{ marginTop: 16 }}>
          <ModernInput 
            label={businessType === 'library' ? "Study Hours ⏰ (Max 24)" : "Daily Hours ⏰ (Max 24)"} 
            value={dailyHours} 
            onChangeText={(val) => {
              const num = parseInt(val);
              if (!isNaN(num) && num > 24) setDailyHours('24');
              else setDailyHours(val);
            }} 
            keyboardType="numeric" 
            maxLength={2}
            placeholder="e.g. 8" 
            icon={<FontAwesome name="clock-o" size={16} color={colors.primary} />} 
          />
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8, marginTop: 4, fontWeight: '600' }}>Timing Slot 🌞</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 2 }}>
              <View style={styles.timeInputBox}>
                <TextInput style={styles.timeInputText} placeholder="10:00" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={timingStartHour} onChangeText={(t) => setTimingStartHour(formatTimeInput(t))} />
                <TouchableOpacity style={timingStartAmPm === 'AM' ? styles.amPmBtnActive : styles.amPmBtn} onPress={() => setTimingStartAmPm('AM')}><Text style={timingStartAmPm === 'AM' ? styles.amPmTextActive : styles.amPmText}>AM</Text></TouchableOpacity>
                <TouchableOpacity style={timingStartAmPm === 'PM' ? styles.amPmBtnActive : styles.amPmBtn} onPress={() => setTimingStartAmPm('PM')}><Text style={timingStartAmPm === 'PM' ? styles.amPmTextActive : styles.amPmText}>PM</Text></TouchableOpacity>
              </View>
            </View>
            <Text style={styles.timeToText}>TO</Text>
            <View style={{ flex: 1, marginLeft: 2 }}>
              <View style={styles.timeInputBox}>
                <TextInput style={styles.timeInputText} placeholder="05:00" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={timingEndHour} onChangeText={(t) => setTimingEndHour(formatTimeInput(t))} />
                <TouchableOpacity style={timingEndAmPm === 'AM' ? styles.amPmBtnActive : styles.amPmBtn} onPress={() => setTimingEndAmPm('AM')}><Text style={timingEndAmPm === 'AM' ? styles.amPmTextActive : styles.amPmText}>AM</Text></TouchableOpacity>
                <TouchableOpacity style={timingEndAmPm === 'PM' ? styles.amPmBtnActive : styles.amPmBtn} onPress={() => setTimingEndAmPm('PM')}><Text style={timingEndAmPm === 'PM' ? styles.amPmTextActive : styles.amPmText}>PM</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {businessType === 'library' && (
        <View style={[styles.row, { marginTop: 16 }]}>
          <View style={{ flex: 1, marginRight: spacing.s }}>
            <TouchableOpacity onPress={() => setShowSeatModal(true)}>
              <ModernInput label="Seat Number" value={allocatedSeat} editable={false} placeholder="Select Seat" icon={<FontAwesome name="bookmark" size={14} color={colors.textSecondary} />} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.s }}>
            <TouchableOpacity onPress={() => setShowWifiModal(true)}>
              <ModernInput label="Wi-Fi Details" value={wifiDetails.split(' Password')[0]} editable={false} placeholder="Select Network" icon={<FontAwesome name="wifi" size={14} color={colors.textSecondary} />} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={{ marginTop: 24 }}>
        <GradientButton title="Continue ➔" onPress={() => { if (validateStep1()) setStep(2); }} />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={styles.stepTitle}>Member Information</Text>
        <View style={{ backgroundColor: `${colors.primary}15`, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Step 2 of 3</Text>
        </View>
      </View>
      <Text style={styles.stepSubtitle}>Personal details and contact info</Text>

      <GlassCard style={{ ...(styles.card as any), padding: 20 }}>
        <ModernInput label="Full Name *" value={name} onChangeText={setName} placeholder="e.g. Rahul Sharma" icon={<FontAwesome name="user-o" size={16} color={colors.textSecondary} />} />
        
        <ModernInput label="Phone Number *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10 digit mobile" maxLength={10} icon={<FontAwesome name="phone" size={16} color={colors.textSecondary} />} />
        
        <View style={[styles.selectorContainer, { marginTop: 12, marginBottom: 16 }]}>
          <Text style={styles.selectorLabel}>Gender</Text>
          <View style={styles.selectorRow}>
            {['Male', 'Female', 'Other'].map((opt) => {
              const isActive = gender === opt;
              return (
                <TouchableOpacity key={opt} onPress={() => setGender(opt)} style={{ flex: 1 }}>
                  <LinearGradient
                    colors={isActive ? ['#7C3AED', '#4F46E5'] : [colors.surfaceLight, colors.surfaceLight]}
                    start={{x:0,y:0}} end={{x:1,y:1}}
                    style={[{ paddingVertical: 10, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: isActive ? 'transparent' : colors.border }]}
                  >
                    <Text style={[{ fontSize: 13, fontWeight: '700' }, isActive ? { color: '#fff' } : { color: colors.textSecondary }]}>{opt}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}><ModernInput label="Age" value={age} onChangeText={setAge} keyboardType="numeric" placeholder="25" /></View>
          <View style={{ flex: 1 }}><ModernInput label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="175" /></View>
          <View style={{ flex: 1 }}><ModernInput label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="70" /></View>
        </View>

        {/* Date of Birth */}
        <TouchableOpacity
          onPress={() => { setDatePickerType('dob'); setShowDatePicker(true); }}
          style={[{ marginTop: 8, borderWidth: 1, borderRadius: borderRadius.m, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, { borderColor: dateOfBirth ? '#EC4899' : colors.border, backgroundColor: colors.surfaceLight }]}
        >
          <FontAwesome name="birthday-cake" size={16} color={dateOfBirth ? '#EC4899' : colors.textMuted} />
          <Text style={{ color: dateOfBirth ? colors.text : colors.textMuted, flex: 1 }}>
            {dateOfBirth ? `DOB: ${dateOfBirth.split('-').reverse().join(' / ')}` : '🎂 Date of Birth (Optional)'}
          </Text>
          {dateOfBirth ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {(() => {
                const today = new Date();
                const dob = new Date(dateOfBirth);
                let calcAge = today.getFullYear() - dob.getFullYear();
                const mo = today.getMonth() - dob.getMonth();
                if (mo < 0 || (mo === 0 && today.getDate() < dob.getDate())) calcAge--;
                const isToday = dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
                return <Text style={{ color: '#EC4899', fontSize: 12, fontWeight: '700' }}>{calcAge}y{isToday ? ' 🎉' : ''}</Text>;
              })()}
              <TouchableOpacity onPress={() => setDateOfBirth('')}>
                <FontAwesome name="times-circle" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />

        <ModernInput label="Address" value={address} onChangeText={setAddress} placeholder="Street/Area" icon={<FontAwesome name="map-marker" size={16} color={colors.textSecondary} />} />

        <ModernInput label="Aadhaar Number" value={aadhaar} onChangeText={setAadhaar} keyboardType="numeric" placeholder="12 digit number" maxLength={12} icon={<FontAwesome name="id-card-o" size={16} color={colors.textSecondary} />} />
        
        <ModernInput label="Additional Notes" value={notes} onChangeText={setNotes} placeholder="Any other notes..." multiline numberOfLines={2} icon={<FontAwesome name="pencil" size={16} color={colors.textSecondary} />} />
      </GlassCard>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => setStep(1)}>
          <FontAwesome name="arrow-left" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <GradientButton title="Continue ➔" onPress={() => { if (validateStep2()) setStep(3); }} />
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      {/* Top Title & Step Badge */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={styles.stepTitle}>Review & Checkout</Text>
        <View style={{ backgroundColor: `${colors.primary}15`, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: `${colors.primary}30` }}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>FINAL STEP</Text>
        </View>
      </View>
      <Text style={[styles.stepSubtitle, { marginBottom: 20 }]}>Verify membership details and collect fee payment</Text>

      {/* ULTRA-PREMIUM INVOICE VOUCHER CARD */}
      <View style={{ marginBottom: 24 }}>
        <LinearGradient
          colors={isDark ? ['#1e1b4b', '#111827'] : ['#4F46E5', '#312E81']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            padding: 22,
            shadowColor: '#4F46E5',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 15,
            elevation: 8,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            overflow: 'hidden'
          }}
        >
          {/* Header row: Member profile summary */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>NEW ENROLLMENT</Text>
                </View>
                {gender ? (
                  <View style={{ backgroundColor: 'rgba(250,204,21,0.25)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: '#FDE047', fontSize: 10, fontWeight: '800' }}>{gender.toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }} numberOfLines={1}>
                {name || 'New Member'}
              </Text>
              <Text style={{ fontSize: 13, color: '#E0E7FF', marginTop: 2, fontWeight: '500' }}>
                📞 +91 {phone || 'N/A'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: '#C4B5FD', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }}>NET PAYABLE</Text>
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#34D399' }}>
                ₹{amount || '0'}
              </Text>
            </View>
          </View>

          {/* Ticket punch dashed line */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 14 }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.background, marginLeft: -29 }} />
            <View style={{ flex: 1, height: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'dashed', marginHorizontal: 8 }} />
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.background, marginRight: -29 }} />
          </View>

          {/* Summary Grid Details */}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                  <FontAwesome name="star" size={13} color="#FDE047" />
                </View>
                <Text style={{ fontSize: 13, color: '#E0E7FF', fontWeight: '600' }}>Selected Plan</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 16, alignItems: 'flex-end', position: 'relative', zIndex: 10 }}>
                <TouchableOpacity 
                  activeOpacity={0.75} 
                  onPress={() => setShowPlanTooltip(!showPlanTooltip)}
                  style={{ width: '100%', alignItems: 'flex-end' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', textAlign: 'right' }} numberOfLines={1}>
                    {selectedPlanId === 'custom' ? 'Custom Plan' : plans.find(p => p._id === selectedPlanId)?.name || 'Membership Plan'}
                  </Text>
                </TouchableOpacity>
                {showPlanTooltip && (
                  <View style={{
                    position: 'absolute',
                    top: 22,
                    right: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.15)',
                    zIndex: 999,
                    width: 280,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 5
                  }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                      {selectedPlanId === 'custom' ? 'Custom Plan' : plans.find(p => p._id === selectedPlanId)?.name || 'Membership Plan'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                  <FontAwesome name="calendar" size={13} color="#60A5FA" />
                </View>
                <Text style={{ fontSize: 13, color: '#E0E7FF', fontWeight: '600' }}>Validity Period</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
                  {joiningDate ? new Date(joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''} ➔ {expiryDate ? new Date(expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                </Text>
                <Text style={{ fontSize: 11, color: '#A7F3D0', fontWeight: '700', marginTop: 1 }}>{durationDays} Days Total</Text>
              </View>
            </View>

            {enableHours && dailyHours ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                    <FontAwesome name="clock-o" size={14} color="#F472B6" />
                  </View>
                  <Text style={{ fontSize: 13, color: '#E0E7FF', fontWeight: '600' }}>Study Hours & Slot</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
                  {dailyHours} Hrs • {timingStartHour ? `${timingStartHour} ${timingStartAmPm} - ${timingEndHour} ${timingEndAmPm}` : 'Anytime'}
                </Text>
              </View>
            ) : null}

            {selectedTrainer && selectedTrainer !== 'General' && selectedTrainer !== 'General Coach' ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                    <FontAwesome name="user-circle" size={13} color="#C084FC" />
                  </View>
                  <Text style={{ fontSize: 13, color: '#E0E7FF', fontWeight: '600' }}>Assigned Coach</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#E9D5FF' }}>
                  {selectedTrainer}
                </Text>
              </View>
            ) : null}

            {selectedOffer ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(52, 211, 153, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FontAwesome name="tag" size={12} color="#34D399" />
                  <Text style={{ fontSize: 12, color: '#A7F3D0', fontWeight: '700' }}>{selectedOffer.name || 'Special Offer'}</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#34D399' }}>Discount Applied ✨</Text>
              </View>
            ) : null}
          </View>

          {/* Edit Button in invoice card */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => setStep(2)}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.25)'
              }}
            >
              <FontAwesome name="pencil" size={11} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Modify Plan Details</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* SECTION 2: PAYMENT METHOD (Fintech Grid) */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Select Payment Mode</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>Choose Collection Method</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(['Cash', 'UPI', 'Card', 'Bank Transfer'] as const).map(mode => {
            const isSelected = paymentMode === mode;
            const modeDetails: Record<string, { color: string, sub: string, icon: any }> = {
              Cash: { color: '#10B981', sub: 'Instant Cash Receipt', icon: 'money' },
              UPI: { color: '#8B5CF6', sub: 'GPay / PhonePe / Paytm', icon: 'mobile-phone' },
              Card: { color: '#3B82F6', sub: 'POS / Debit / Credit', icon: 'credit-card' },
              'Bank Transfer': { color: '#F59E0B', sub: 'NEFT / IMPS / NetBank', icon: 'bank' }
            };
            const item = modeDetails[mode];
            return (
              <TouchableOpacity
                key={mode}
                activeOpacity={0.85}
                onPress={() => setPaymentMode(mode)}
                style={[{
                  width: '48%',
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: isSelected ? item.color : colors.border,
                  backgroundColor: isSelected ? (isDark ? `${item.color}20` : `${item.color}10`) : (isDark ? 'rgba(255,255,255,0.03)' : '#fff'),
                  shadowOpacity: 0,
                  elevation: 0
                }]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 12,
                    backgroundColor: isSelected ? item.color : (isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6'),
                    justifyContent: 'center', alignItems: 'center'
                  }}>
                    <FontAwesome name={item.icon} size={17} color={isSelected ? '#fff' : colors.textSecondary} />
                  </View>
                  {isSelected && (
                    <View style={{
                      width: 20, height: 20, borderRadius: 10,
                      backgroundColor: item.color,
                      justifyContent: 'center', alignItems: 'center'
                    }}>
                      <FontAwesome name="check" size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: isSelected ? item.color : colors.text, marginBottom: 2 }}>{mode}</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '500' }}>{item.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SECTION 3: PAYMENT STATUS & SETTLEMENT */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 }}>Payment Settlement Status</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: paymentStatus === 'Partial' ? 16 : 0 }}>
          {[
            { id: 'Paid', label: 'Paid in Full', icon: 'check-circle', color: '#10B981', bg: '#D1FAE5', darkBg: '#064E3B' },
            { id: 'Partial', label: 'Partial Pay', icon: 'clock-o', color: '#F59E0B', bg: '#FEF3C7', darkBg: '#78350F' },
            { id: 'Pending', label: 'Pending Due', icon: 'exclamation-circle', color: '#EF4444', bg: '#FEE2E2', darkBg: '#7F1D1D' }
          ].map(statusItem => {
            const isActive = paymentStatus === statusItem.id;
            return (
              <TouchableOpacity
                key={statusItem.id}
                activeOpacity={0.85}
                onPress={() => setPaymentStatus(statusItem.id)}
                style={[{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: isActive ? statusItem.color : colors.border,
                  backgroundColor: isActive ? (isDark ? statusItem.darkBg : statusItem.bg) : (isDark ? 'rgba(255,255,255,0.03)' : '#fff'),
                  alignItems: 'center',
                  justifyContent: 'center'
                }]}
              >
                <FontAwesome name={statusItem.icon as any} size={18} color={isActive ? statusItem.color : colors.textMuted} style={{ marginBottom: 6 }} />
                <Text style={{ fontWeight: '800', fontSize: 13, color: isActive ? statusItem.color : colors.textSecondary }}>
                  {statusItem.id}
                </Text>
                <Text style={{ fontSize: 10, color: isActive ? statusItem.color : colors.textMuted, marginTop: 2, fontWeight: '600' }}>
                  {statusItem.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* PARTIAL SETTLEMENT CALCULATOR BOX */}
        {paymentStatus === 'Partial' && (
          <View style={{
            padding: 16,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: `${colors.warning || '#F59E0B'}60`,
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB'
          }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.warning || '#D97706', marginBottom: 12 }}>
              ⚡ PARTIAL PAYMENT CALCULATOR
            </Text>
            <ModernInput
              label="Amount Collected Now (₹)"
              value={amountPaid}
              onChangeText={setAmountPaid}
              keyboardType="numeric"
              placeholder={`Total fee is ₹${amount}`}
              icon={<FontAwesome name="rupee" size={15} color={colors.warning || '#F59E0B'} />}
            />
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 6,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: `${colors.warning || '#F59E0B'}30`
            }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Remaining Balance Due:</Text>
              <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#EF4444' }}>
                  ₹{Math.max(0, parseFloat(amount || '0') - parseFloat(amountPaid || '0')).toFixed(0)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* SECTION 4: WHATSAPP RECEIPT TOGGLE */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(16,185,129,0.3)' : '#A7F3D0',
        backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ECFDF5',
        marginBottom: 28
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' }}>
            <FontAwesome name="whatsapp" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#6EE7B7' : '#065F46' }}>
              Send Instant WhatsApp Receipt
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#A7F3D0' : '#047857', marginTop: 2 }}>
              Notify member with digital welcome invoice
            </Text>
          </View>
        </View>
        <Switch
          value={sendReceipt}
          onValueChange={(val) => setSendReceipt(val)}
          trackColor={{ false: colors.border, true: '#10B981' }}
          thumbColor={sendReceipt ? '#fff' : '#f4f3f4'}
        />
      </View>

      {/* BOTTOM ACTION BUTTONS */}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <TouchableOpacity
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center'
          }}
          onPress={() => setStep(2)}
        >
          <FontAwesome name="arrow-left" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <GradientButton
            title={isLoading ? "Processing Enrollment..." : `✓ Confirm Enrollment • ₹${paymentStatus === 'Partial' && amountPaid ? amountPaid : paymentStatus === 'Pending' ? '0' : amount}`}
            onPress={handleEnroll}
            disabled={isLoading}
          />
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <Modal visible={step === 4} animationType="fade" transparent={true}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 100, alignItems: 'center', flexGrow: 1 }}>
          <LinearGradient colors={['#10B981', '#059669']} style={{ width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 32, shadowColor: '#10B981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 }}>
            <FontAwesome name="check" size={50} color="#fff" />
          </LinearGradient>
          
          <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' }}>Success!</Text>
          <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 40 }}>{name} has been enrolled successfully.</Text>

          <View style={{ backgroundColor: colors.surfaceLight, borderRadius: 24, padding: 24, width: '100%', marginBottom: 32, borderWidth: 1, borderColor: colors.border, ...shadows.light }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                  <Text style={{ fontSize: 20 }}>👑</Text>
                </View>
                <View style={{ flex: 1, position: 'relative', zIndex: 20 }}>
                  <TouchableOpacity 
                    activeOpacity={0.75} 
                    onPress={() => setShowPlanTooltip(!showPlanTooltip)}
                    style={{ width: '100%' }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                      {selectedPlanId === 'custom' ? 'Custom Plan' : plans.find(p => p._id === selectedPlanId)?.name}
                    </Text>
                  </TouchableOpacity>
                  {showPlanTooltip && (
                    <View style={{
                      position: 'absolute',
                      top: 22,
                      left: 0,
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.15)',
                      zIndex: 999,
                      width: 200,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      elevation: 5
                    }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                        {selectedPlanId === 'custom' ? 'Custom Plan' : plans.find(p => p._id === selectedPlanId)?.name}
                      </Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{durationDays} Days</Text>
                </View>
              </View>
              <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ color: '#059669', fontWeight: '700', fontSize: 12 }}>Active</Text>
              </View>
            </View>
            <View style={styles.summaryRow}><Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Member ID</Text><Text style={{ color: colors.text, fontWeight: '800' }}>Assigned via SMS</Text></View>
            <View style={styles.summaryRow}><Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Start Date</Text><Text style={{ color: colors.text, fontWeight: '800' }}>{new Date(joiningDate).toLocaleDateString()}</Text></View>
            <View style={styles.summaryRow}><Text style={{ color: colors.textSecondary, fontWeight: '600' }}>End Date</Text><Text style={{ color: colors.text, fontWeight: '800' }}>{new Date(expiryDate).toLocaleDateString()}</Text></View>
            <View style={styles.summaryRow}><Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Amount Paid</Text><Text style={{ color: colors.success, fontWeight: '800', fontSize: 16 }}>₹{paymentStatus === 'Partial' && amountPaid ? amountPaid : (paymentStatus === 'Pending' ? 0 : amount)}</Text></View>
            <View style={[styles.summaryRow, { marginBottom: 0 }]}><Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Payment Method</Text><Text style={{ color: colors.text, fontWeight: '800' }}>{paymentMode}</Text></View>
          </View>

          <View style={{ width: '100%', gap: 16 }}>
            {!isManual && sendReceipt && (
              <TouchableOpacity 
                style={{ backgroundColor: '#25D366', width: '100%', paddingVertical: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...shadows.light }}
                onPress={() => sendWhatsAppMessage(phone, welcomeMsgFinal)}
              >
                <FontAwesome name="whatsapp" size={24} color="#fff" style={{ marginRight: 12 }} />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Share Receipt</Text>
              </TouchableOpacity>
            )}


            <TouchableOpacity 
              style={{ backgroundColor: 'transparent', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
              onPress={() => { clearForm(); setStep(1); }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '700' }}>Start New Enrollment</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );



  return (
    <View style={styles.container}>
      <CustomAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, visible: false })} />
      <DatePickerModal visible={showDatePicker} onClose={() => setShowDatePicker(false)} onSelect={(date) => {
        if (datePickerType === 'joining') {
          setJoiningDate(date);
          const selectedPlan = plans.find((p: any) => p._id === selectedPlanId);
          const d = new Date(date);
          if (selectedPlan && selectedPlan.duration_days) {
            d.setDate(d.getDate() + selectedPlan.duration_days);
          } else {
            d.setMonth(d.getMonth() + 1);
          }
          setExpiryDate(d.toISOString().split('T')[0]);
        } else if (datePickerType === 'dob') {
          setDateOfBirth(date);
        } else {
          if (new Date(date) < new Date(joiningDate)) showCustomAlert('Invalid Date', 'End Date cannot be before Start Date', 'error');
          else setExpiryDate(date);
        }
      }} initialDate={datePickerType === 'joining' ? joiningDate : datePickerType === 'dob' ? dateOfBirth : expiryDate} title={datePickerType === 'joining' ? 'Select Start Date' : datePickerType === 'dob' ? '🎂 Select Date of Birth' : 'Select End Date'} />
      <DropdownModal visible={showSeatModal} title="Select Seat" items={availableSeats} onClose={() => setShowSeatModal(false)} onSelect={(seat) => setAllocatedSeat(seat.seat_number)} renderItem={(item) => ( <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}><Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Seat {item.seat_number}</Text><Text style={{ color: item.status === 'Available' ? colors.success : colors.warning, fontSize: 14 }}>{item.status}</Text></View> )} />
      <DropdownModal visible={showWifiModal} title="Select WiFi Network" items={wifiOptions} onClose={() => setShowWifiModal(false)} onSelect={(wifi) => setWifiDetails(`${wifi.name} (Password: ${wifi.password})`)} renderItem={(item) => ( <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{item.name}</Text> )} />

      {step > 0 && step < 4 && (
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : setStep(0)} style={styles.iconBtn}>
            <FontAwesome name="arrow-left" size={16} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Enroll Member</Text>
          <View style={{ width: 32 }} />
        </View>
      )}

      {step > 0 && step < 4 && <StepIndicator />}

      {step === 0 ? renderStep0() : (
        <KeyboardAwareScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" enableOnAndroid={true} extraScrollHeight={20}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </KeyboardAwareScrollView>
      )}

      {renderStep4()}
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 16, backgroundColor: colors.surface },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  
  stepIndicatorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingVertical: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  stepCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepCirclePassed: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepCircleText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  stepLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  stepLabelActive: { color: colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 8, marginTop: -14 },
  stepLinePassed: { backgroundColor: colors.primary },

  content: { padding: spacing.l, paddingBottom: 100 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  
  card: { padding: spacing.l },
  row: { flexDirection: 'row' },
  
  planCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  planCardDisabled: { opacity: 0.6 },
  planCardActive: { borderColor: 'transparent', backgroundColor: 'transparent' },
  planCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  planIconBox: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  planCardTitle: { fontSize: 18, fontWeight: '800' },
  planCardPrice: { fontSize: 32, fontWeight: '800', marginBottom: 12 },
  planCardDuration: { fontSize: 15, fontWeight: '600' },
  radioCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  disabledBadge: { position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.surfaceLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  featuresList: { marginTop: 8 },
  featureItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  featureText: { fontSize: 13, flex: 1, fontWeight: '500' },

  datePresetsRow: { marginBottom: spacing.m, marginTop: spacing.m },
  presetsLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 },
  presetsBtnGroup: { flexDirection: 'row', gap: 10, paddingRight: 20 },
  datePresetBtn: { width: 60, backgroundColor: colors.surfaceLight, paddingVertical: 8, borderRadius: borderRadius.s, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  datePresetBtnText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  
  durationDisplay: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(139, 92, 246, 0.05)', padding: 12, borderRadius: borderRadius.m, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.15)', marginBottom: spacing.m },
  durationDisplayText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  timeInputBox: { flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.m, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6 },
  timeInputText: { flex: 1, color: colors.text, fontSize: 13, marginLeft: 4 },
  timeToText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', alignSelf: 'center', marginHorizontal: 4 },
  amPmBtn: { paddingHorizontal: 6, paddingVertical: 6, borderRadius: 6 },
  amPmBtnActive: { backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 6 },
  amPmText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  amPmTextActive: { color: '#fff', fontSize: 11, fontWeight: '700' },

  selectorContainer: { marginBottom: spacing.m },
  selectorLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectorBtn: { minWidth: 60, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.m, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  selectorBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectorText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  selectorTextActive: { color: 'white' },

  summaryBox: { backgroundColor: colors.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 24, ...shadows.light },
  summaryGradientBox: { padding: 24, borderRadius: 24, marginBottom: 24, ...shadows.light },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  summaryLabel: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  summaryValue: { color: colors.text, fontSize: 15, fontWeight: '800' },

  payModeBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18, paddingHorizontal: 8, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, ...shadows.light },
  payModeText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },

  statusToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 6 },
  partialPayBox: { borderRadius: borderRadius.m, borderWidth: 1, padding: spacing.m, marginBottom: spacing.l },

  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceLight, padding: 16, borderRadius: 12, marginBottom: 24 },

  manualRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 24 },
  manualTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  manualSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  
  backBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
