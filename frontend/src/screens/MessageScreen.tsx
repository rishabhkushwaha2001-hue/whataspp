import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { ModernInput } from '../components/ModernInput';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export const MessageScreen = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('1');
  const [gender, setGender] = useState('Male');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEnroll = async () => {
    if (!name || !phone || !amount) {
      Alert.alert('Error', 'Please fill all required fields (Name, Phone, Amount)');
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = phone.replace(/[^0-9]/g, '');
      const finalPhone = formattedPhone.length === 10 ? '91' + formattedPhone : formattedPhone;
      
      // Calculate Expiry Date for the receipt
      const enrollmentDate = new Date();
      const planMonths = parseInt(duration) || 1;
      const calculatedExpiry = new Date();
      calculatedExpiry.setMonth(calculatedExpiry.getMonth() + planMonths);
      
      const welcomeMsg = `*FITNESS HUB - OFFICIAL RECEIPT* 🧾\n\n` +
        `Hello *${name}*, welcome to the elite club! 💪\n\n` +
        `*MEMBERSHIP DETAILS:*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Member:* ${name}\n` +
        `📱 *Phone:* ${finalPhone}\n` +
        `🗓️ *Plan:* ${planMonths} Month(s)\n` +
        `💰 *Amount Paid:* Rs. ${amount}\n` +
        `📅 *Expiry Date:* ${calculatedExpiry.toLocaleDateString()}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `*Stay Strong & Let's Crush Your Goals!* 🚀`;

      // API Call - Enroll Member
      await api.post('/members/', {
        full_name: name,
        phone: finalPhone,
        address: address || 'Not provided',
        joining_date: enrollmentDate.toISOString(),
        monthly_fees: parseFloat(amount),
        plan_duration_months: planMonths,
        plan_type: planMonths === 1 ? 'Monthly' : 
                   planMonths === 3 ? 'Quarterly' : 
                   planMonths === 6 ? 'Half-Yearly' : 'Yearly',
        gender: gender,
        notes: notes || ''
      });

      // Try to log and open WhatsApp
      try {
        await api.post('/messages/log', {
          recipient_phone: finalPhone,
          message_body: welcomeMsg,
          status: "sent"
        });
      } catch (logErr) {
        console.warn('Receipt log failed, but continuing with WhatsApp');
      }

      Alert.alert(
        'Success',
        'Member enrolled successfully! Opening WhatsApp for receipt...',
        [
          { 
            text: 'OK', 
            onPress: () => {
              const url = `whatsapp://send?phone=${finalPhone}&text=${encodeURIComponent(welcomeMsg)}`;
              Linking.openURL(url).catch(() => Alert.alert('Error', 'WhatsApp not found'));
              // Clear form
              setName('');
              setPhone('');
              setAmount('');
              setAddress('');
              setNotes('');
            } 
          }
        ]
      );

    } catch (error: any) {
      console.error('Enroll error', error);
      Alert.alert('Error', 'Enrollment failed. Please check connection and try again.');
    } finally {
      setIsLoading(false);
    }
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>New Enrollment</Text>
          <Text style={styles.subtitle}>Add a new member to your elite club</Text>
        </View>

        <GlassCard style={styles.card}>
          <ModernInput 
            label="Full Name *" 
            value={name} 
            onChangeText={setName} 
            placeholder="e.g. John Doe"
            icon={<FontAwesome name="user-o" size={16} color={colors.textSecondary} />}
          />
          
          <ModernInput 
            label="Phone Number *" 
            value={phone} 
            onChangeText={setPhone} 
            keyboardType="phone-pad"
            placeholder="10 digit mobile number"
            icon={<FontAwesome name="phone" size={16} color={colors.textSecondary} />}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: spacing.s }}>
              <ModernInput 
                label="Amount Paid (Rs) *" 
                value={amount} 
                onChangeText={setAmount} 
                keyboardType="numeric"
                placeholder="0.00"
                icon={<FontAwesome name="money" size={16} color={colors.textSecondary} />}
              />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.s }}>
              <Selector 
                label="Plan Duration"
                options={[
                  { label: '1M', value: '1' },
                  { label: '3M', value: '3' },
                  { label: '6M', value: '6' },
                  { label: '12M', value: '12' },
                ]}
                selected={duration}
                onSelect={setDuration}
              />
            </View>
          </View>

          <Selector 
            label="Gender"
            options={['Male', 'Female', 'Other']}
            selected={gender}
            onSelect={setGender}
          />

          <ModernInput 
            label="Address" 
            value={address} 
            onChangeText={setAddress} 
            placeholder="Member's area/city"
            icon={<FontAwesome name="map-marker" size={16} color={colors.textSecondary} />}
          />

          <ModernInput 
            label="Notes" 
            value={notes} 
            onChangeText={setNotes} 
            placeholder="Any special medical conditions/goals"
            multiline
            numberOfLines={3}
            icon={<FontAwesome name="pencil" size={16} color={colors.textSecondary} />}
          />

          <View style={{ marginTop: spacing.l }}>
            <GradientButton 
              title={isLoading ? "Enrolling..." : "Complete Enrollment"} 
              onPress={handleEnroll}
              disabled={isLoading}
            />
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.m, paddingBottom: 100 },
  header: { marginBottom: spacing.l, marginTop: spacing.xl },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 4 },
  card: { padding: spacing.l },
  row: { flexDirection: 'row' },
  selectorContainer: { marginBottom: spacing.m },
  selectorLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  selectorRow: { flexDirection: 'row', gap: 8 },
  selectorBtn: { flex: 1, paddingVertical: 10, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.s, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  selectorBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectorText: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
  selectorTextActive: { color: 'white' },
});
