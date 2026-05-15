import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { ModernInput } from '../components/ModernInput';
import { GradientButton } from '../components/GradientButton';
import { api } from '../services/api';

export const SettingsScreen = () => {
  const [gymName, setGymName] = useState('MBUDDY GYM');
  const [address, setAddress] = useState('Premium Health Club');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings/');
      setGymName(response.data.gym_name);
      setAddress(response.data.address);
      setPhone(response.data.phone || '');
      setLogoUrl(response.data.logo_url || '');
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await api.post('/settings/', {
        gym_name: gymName,
        address: address,
        phone: phone,
        logo_url: logoUrl,
      });
      Alert.alert('Success', 'Gym Profile updated successfully!');
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.background, '#1a103c']} style={StyleSheet.absoluteFill} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Gym Profile</Text>
          <Text style={styles.subtitle}>Customize your brand</Text>
        </View>

        <GlassCard style={styles.card}>
          <ModernInput
            label="Gym Name"
            placeholder="e.g. MBUDDY GYM"
            value={gymName}
            onChangeText={setGymName}
          />

          <ModernInput
            label="Business Address"
            placeholder="e.g. 123 Fitness St, City"
            value={address}
            onChangeText={setAddress}
            multiline
          />

          <ModernInput
            label="Contact Number"
            placeholder="e.g. +91 9876543210"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <ModernInput
            label="Logo URL"
            placeholder="https://example.com/logo.png"
            value={logoUrl}
            onChangeText={setLogoUrl}
          />

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Note: This information will appear on all your receipts and WhatsApp messages.
            </Text>
          </View>

          <GradientButton
            title="Save Profile"
            onPress={handleSave}
            isLoading={isLoading}
          />
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.l,
    paddingTop: 60,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    padding: spacing.l,
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.m,
    borderRadius: borderRadius.m,
    marginBottom: spacing.l,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
