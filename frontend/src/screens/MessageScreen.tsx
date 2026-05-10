import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { colors, spacing } from '../theme/theme';
import { ModernInput } from '../components/ModernInput';
import { GradientButton } from '../components/GradientButton';
import { GlassCard } from '../components/GlassCard';
import { api } from '../services/api';

export const MessageScreen = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('9696310260');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('1');

  const enrollMember = async () => {
    if (!name || !phone || !amount) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    try {
      const formattedPhone = phone.replace(/[^0-9]/g, '');
      const finalPhone = formattedPhone.length === 10 ? '91' + formattedPhone : formattedPhone;
      const message = `Hello ${name}, you are enrolled for ${duration} month(s). Amount: Rs. ${amount}. Thank you!`;

      await api.post('/members/', {
        full_name: name,
        phone: finalPhone,
        address: 'Gym Member',
        joining_date: new Date().toISOString(),
        monthly_fees: parseFloat(amount),
        plan_duration_months: parseInt(duration),
        gender: 'Not specified',
      });

      const url = `whatsapp://send?phone=${finalPhone}&text=${encodeURIComponent(message)}`;
      await Linking.openURL(url);
      Alert.alert('Success', 'Member saved and WhatsApp opened!');
    } catch (error: any) {
      Alert.alert('Error', 'Connection failed. Please check IP and WiFi.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New Enrollment</Text>
        <GlassCard style={styles.card}>
          <ModernInput label="Name" value={name} onChangeText={setName} />
          <ModernInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <View style={{flexDirection: 'row', gap: 10}}>
            <View style={{flex: 1}}><ModernInput label="Months" value={duration} onChangeText={setDuration} keyboardType="number-pad" /></View>
            <View style={{flex: 1}}><ModernInput label="Amount" value={amount} onChangeText={setAmount} keyboardType="number-pad" /></View>
          </View>
          <View style={{marginTop: 20}}><GradientButton title="Enroll & Send WhatsApp" onPress={enrollMember} /></View>
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 60 },
  title: { fontSize: 30, fontWeight: 'bold', color: colors.text, marginBottom: 20 },
  card: { padding: 20 },
});
