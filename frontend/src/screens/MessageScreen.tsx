import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { ModernInput } from '../components/ModernInput';
import { GradientButton } from '../components/GradientButton';
import { GlassCard } from '../components/GlassCard';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const DURATIONS = [
  { label: '1 M', value: '1' },
  { label: '3 M', value: '3' },
  { label: '6 M', value: '6' },
  { label: '12 M', value: '12' },
];

const GENDERS = ['Male', 'Female', 'Other'];

export const MessageScreen = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('1');
  const [gender, setGender] = useState('Male');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const enrollMember = async () => {
    if (!name || !phone || !amount) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = phone.replace(/[^0-9]/g, '');
      const finalPhone = formattedPhone.length === 10 ? '91' + formattedPhone : formattedPhone;
      
      const welcomeMsg = `*FITNESS HUB - OFFICIAL RECEIPT* 🧾\n\n` +
        `Hello *${name}*, welcome to the elite club! 💪\n\n` +
        `*MEMBERSHIP DETAILS:*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Member:* ${name}\n` +
        `📱 *Phone:* ${finalPhone}\n` +
        `🗓️ *Plan:* ${duration} Month(s)\n` +
        `💰 *Amount Paid:* Rs. ${amount}\n` +
        `📅 *Expiry Date:* ${expiryDate.toLocaleDateString()}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `*Stay Strong & Let's Crush Your Goals!* 🚀`;

      // API Call - Enroll Member
      await api.post('/members/', {
        full_name: name,
        phone: finalPhone,
        address: address || 'Not provided',
        joining_date: new Date().toISOString(),
        monthly_fees: parseFloat(amount),
        plan_duration_months: parseInt(duration),
        gender: gender,
        notes: notes,
        plan_type: parseInt(duration) === 1 ? 'Monthly' : parseInt(duration) === 3 ? 'Quarterly' : 'Yearly'
      });

      // Log the message
      try {
        await api.post('/messages/log', {
          recipient_phone: finalPhone,
          message_body: welcomeMsg,
          status: "sent"
        });
      } catch (logError) {
        console.error('Log failed', logError);
        Alert.alert('Database Warning', 'Member enrolled but message history could not be saved. Check server status.');
      }

      const whatsappUrl = `whatsapp://send?phone=${finalPhone}&text=${encodeURIComponent(welcomeMsg)}`;
      const supported = await Linking.canOpenURL(whatsappUrl);
      
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert('Success', 'Member enrolled! (WhatsApp not found)');
      }

      // Reset form
      setName('');
      setPhone('');
      setAmount('');
      setAddress('');
      setNotes('');
      
    } catch (error: any) {
      console.error('Enroll error', error);
      Alert.alert('Error', 'Enrollment failed. Please check connection.');
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
            placeholder="10-digit number"
            icon={<FontAwesome name="whatsapp" size={16} color={colors.textSecondary} />}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Selector 
                label="Gender" 
                options={GENDERS} 
                selected={gender} 
                onSelect={setGender} 
              />
            </View>
          </View>

          <Selector 
            label="Membership Duration" 
            options={DURATIONS} 
            selected={duration} 
            onSelect={setDuration} 
          />

          <ModernInput 
            label="Fees Amount (Total) *" 
            value={amount} 
            onChangeText={setAmount} 
            keyboardType="number-pad"
            placeholder="e.g. 1500"
            icon={<FontAwesome name="money" size={16} color={colors.textSecondary} />}
          />

          <ModernInput 
            label="Address" 
            value={address} 
            onChangeText={setAddress} 
            placeholder="City, State"
            icon={<FontAwesome name="map-marker" size={16} color={colors.textSecondary} />}
          />

          <ModernInput 
            label="Notes" 
            value={notes} 
            onChangeText={setNotes} 
            placeholder="Any special medical conditions?"
            multiline
            numberOfLines={3}
          />

          <View style={{ marginTop: spacing.m }}>
            <GradientButton 
              title="Confirm & Send Welcome" 
              onPress={enrollMember} 
              isLoading={isLoading}
            />
          </View>
        </GlassCard>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingTop: 60 },
  header: { marginBottom: spacing.xl },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  card: { padding: spacing.l },
  row: { flexDirection: 'row', gap: spacing.m },
  selectorContainer: { marginBottom: spacing.m },
  selectorLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: spacing.s, letterSpacing: 0.5 },
  selectorRow: { flexDirection: 'row', gap: 8 },
  selectorBtn: { 
    flex: 1, 
    paddingVertical: 10, 
    borderRadius: borderRadius.m, 
    backgroundColor: colors.surfaceLight, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  selectorBtnActive: { 
    backgroundColor: colors.primary + '20', 
    borderColor: colors.primary 
  },
  selectorText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  selectorTextActive: { color: colors.primary },
});
