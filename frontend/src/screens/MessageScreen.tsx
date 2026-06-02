import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Linking, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { ModernInput } from '../components/ModernInput';
import { DatePickerModal } from '../components/DatePickerModal';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { sendWhatsAppMessage } from '../services/whatsapp';

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
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [trainer, setTrainer] = useState('General');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(getNextMonthDate(new Date().toISOString().split('T')[0]));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'joining' | 'expiry'>('joining');
  const [isManual, setIsManual] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [gymName, setGymName] = useState('Gym');

  const [alertConfig, setAlertConfig] = useState<{visible: boolean, title: string, message: string, type: 'success' | 'error'}>({
    visible: false, title: '', message: '', type: 'success'
  });

  useEffect(() => {
    const loadGymName = async () => {
      try {
        const storedName = await AsyncStorage.getItem('gymName');
        if (storedName) {
          setGymName(storedName);
        }
      } catch (e) {
        console.log('Failed to load gymName', e);
      }
    };
    loadGymName();
  }, []);

  const showCustomAlert = (title: string, message: string, type: 'success' | 'error' = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
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

      const finalPhone = formattedPhone; // No longer adding '91' prefix
      
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
        notes: notes || '',
        category: isManual ? "Manual" : "New"
      };

      const response = await api.post('/members/', enrollmentData);
      const member = response.data;

      if (!isManual) {
        const isRenewal = member.category === "Renewal";
        const finalExpiryStr = new Date(member.next_due_date).toLocaleDateString();
        
        const welcomeMsg = isRenewal 
          ? `*${gymName.toUpperCase()} - MEMBERSHIP RENEWED* 🔄\n\n` +
            `Hello *${name}*, thank you for continuing your journey with us! 💪\n\n` +
            `*RENEWAL DETAILS:*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🗓️ *Plan Duration:* ${durationDays} Days\n` +
            `💰 *Amount Paid:* ₹${amount}\n` +
            `🗓️ *New Expiry:* ${finalExpiryStr}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Let's push your limits again!* 🚀`
          : `*${gymName.toUpperCase()} - WELCOME KIT* 🧾\n\n` +
            `Hello *${name}*, welcome to ${gymName}! 💪\n\n` +
            `*MEMBERSHIP DETAILS:*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📱 *Phone:* ${finalPhone}\n` +
            `🗓️ *Joining Date:* ${new Date(joiningDate).toLocaleDateString()}\n` +
            `🗓️ *Plan Duration:* ${durationDays} Days\n` +
            `💰 *Amount Paid:* ₹${amount}\n` +
            `🗓️ *Expiry Date:* ${finalExpiryStr}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Stay Strong & Crush Your Goals!* 🚀`;

        try {
          await api.post('/messages/log', {
            recipient_phone: finalPhone,
            message_body: welcomeMsg,
            status: "sent"
          });
        } catch (e) { console.warn('Log failed'); }

        showCustomAlert(
          isRenewal ? 'Renewal Successful' : 'Enrollment Successful',
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
      console.error('Enroll error', error.response?.data || error.message);
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
    setName(''); setPhone(''); setAmount(''); setAge(''); setWeight('');
    setAddress(''); setNotes(''); setTrainer('General');
    setGender('Male');        // Reset gender
    setPaymentMode('Cash');   // Reset payment mode
    setIsManual(false);       // Reset manual toggle
    const todayStr = new Date().toISOString().split('T')[0];
    setJoiningDate(todayStr); // Reset to today
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
              <Text style={[styles.selectorText, isSelected && styles.selectorTextActive]}>
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
          
          <ModernInput label="Phone Number *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10 digit mobile number" maxLength={10} icon={<FontAwesome name="phone" size={16} color={colors.textSecondary} />} />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: spacing.s }}>
              <TouchableOpacity onPress={() => { setDatePickerType('joining'); setShowDatePicker(true); }}>
                <ModernInput 
                  label="From Date (Joining) *" 
                  value={joiningDate} 
                  editable={false} 
                  placeholder="Select Date" 
                  icon={<FontAwesome name="calendar" size={16} color={colors.primary} />} 
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
                  icon={<FontAwesome name="calendar" size={16} color={colors.primary} />} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Date Presets Row */}
          <View style={styles.datePresetsRow}>
            <Text style={styles.presetsLabel}>QUICK PLAN PRESETS</Text>
            <View style={styles.presetsBtnGroup}>
              {[{ label: '1M', val: 1 }, { label: '2M', val: 2 }, { label: '3M', val: 3 }, { label: '6M', val: 6 }, { label: '12M', val: 12 }].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.datePresetBtn}
                  onPress={() => {
                    const d = new Date(joiningDate);
                    d.setMonth(d.getMonth() + item.val);
                    setExpiryDate(d.toISOString().split('T')[0]);
                  }}
                >
                  <Text style={styles.datePresetBtnText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Real-time Duration Display */}
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
                // Shift expiry date to maintain 1 month default spacing
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

          <ModernInput 
            label="Amount (₹) *" 
            value={amount} 
            onChangeText={setAmount} 
            keyboardType="numeric" 
            placeholder="0" 
            icon={<FontAwesome name="money" size={16} color={colors.textSecondary} />} 
          />

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

          <ModernInput label="Trainer Assigned" value={trainer} onChangeText={setTrainer} placeholder="General / Personal Trainer Name" icon={<FontAwesome name="id-badge" size={16} color={colors.textSecondary} />} />

          <ModernInput label="Address" value={address} onChangeText={setAddress} placeholder="Area/City" icon={<FontAwesome name="map-marker" size={16} color={colors.textSecondary} />} />

          <ModernInput label="Notes" value={notes} onChangeText={setNotes} placeholder="Medical conditions or goals" multiline numberOfLines={3} icon={<FontAwesome name="pencil" size={16} color={colors.textSecondary} />} />

          <View style={{ marginTop: spacing.l }}>
            <GradientButton title={isLoading ? "Processing..." : isManual ? "Add Manually" : "Enroll & Send Receipt"} onPress={handleEnroll} disabled={isLoading} />
          </View>
        </GlassCard>
      </ScrollView>
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
    justifyContent: 'space-between',
    gap: 6,
  },
  datePresetBtn: {
    flex: 1,
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
});
