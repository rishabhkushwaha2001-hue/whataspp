import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export const LoginScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [step, setStep] = useState(1); // 1 = Phone Verification, 2 = Activation Code / Admin ID
  const [phone, setPhone] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [isAdminSession, setIsAdminSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const router = useRouter();

  const handlePhoneVerification = async () => {
    if (!phone || phone.trim().length < 10) {
      setAlertConfig({
        visible: true,
        title: 'Bhai Suno!',
        message: 'Please enter a valid 10-digit mobile number.',
        type: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-phone', { phone: phone.trim() });
      setLoading(false);
      
      const isAdm = res.data.is_admin === true;
      setIsAdminSession(isAdm);

      setAlertConfig({
        visible: true,
        title: 'Verification Success',
        message: isAdm 
          ? 'Super Admin phone number recognized! Click Continue to enter your Security Admin ID.'
          : `Bhai, ${res.data.owner_name} verified for ${res.data.gym_name}!\n\nNow enter your 12-digit activation code.`,
        type: 'success',
        onConfirm: () => {
          setAlertConfig({ visible: false });
          setStep(2);
        }
      });
    } catch (error: any) {
      setLoading(false);
      const msg = error.response?.data?.detail || 'Phone number verification failed. Please try again.';
      setAlertConfig({
        visible: true,
        title: 'Verification Failed',
        message: msg,
        type: 'error'
      });
    }
  };

  const handleActivation = async () => {
    if (!activationCode || activationCode.trim().length === 0) {
      setAlertConfig({
        visible: true,
        title: 'Attention',
        message: isAdminSession ? 'Please enter your Security Admin ID.' : 'Please enter your unique activation code.',
        type: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/activate', {
        phone: phone.trim(),
        activation_code: activationCode.trim()
      });
      
      if (res.data.is_admin === true) {
        // ✅ Clear ALL previous session data first
        await AsyncStorage.clear();
        
        // Save Super Admin session
        await AsyncStorage.setItem('gymId', 'super_admin');
        await AsyncStorage.setItem('gymName', 'Super Admin Control Panel');
        await AsyncStorage.setItem('ownerName', 'Kush');
        await AsyncStorage.setItem('isAdmin', 'true');

        setLoading(false);
        setAlertConfig({
          visible: true,
          title: 'Super Access Granted 👑',
          message: 'Welcome Kush. Opening Master Control Dashboard.',
          type: 'success',
          onConfirm: () => {
            setAlertConfig({ visible: false });
            router.replace('/super-admin');
          }
        });
      } else {
        // ✅ Clear ALL previous session data first
        await AsyncStorage.clear();

        // Save Gym Owner session
        await AsyncStorage.setItem('gymId', res.data.gym_id);
        await AsyncStorage.setItem('gymName', res.data.gym_name);
        await AsyncStorage.setItem('ownerName', res.data.owner_name);
        await AsyncStorage.setItem('isAdmin', 'false');

        setLoading(false);
        setAlertConfig({
          visible: true,
          title: 'Welcome! 🎉',
          message: `Gym ${res.data.gym_name} activated successfully!\nLet's grow your fitness club.`,
          type: 'success',
          onConfirm: () => {
            setAlertConfig({ visible: false });
            router.replace('/(tabs)');
          }
        });
      }
    } catch (error: any) {
      setLoading(false);
      const msg = error.response?.data?.detail || (isAdminSession ? 'Invalid Super Admin Security ID.' : 'Invalid Activation Code or Activation failed.');
      setAlertConfig({
        visible: true,
        title: 'Authentication Denied',
        message: msg,
        type: 'error'
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <CustomAlert
          {...alertConfig}
          onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
        />

        <View style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <FontAwesome name="flash" size={42} color={colors.primary} />
          </View>
          <Text style={styles.brandTitle}>KGM</Text>
          <Text style={styles.brandSubtitle}>Professional</Text>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>
            {step === 1 ? 'Owner Verification' : isAdminSession ? 'Super Admin Security' : 'Activation Code'}
          </Text>
          <Text style={styles.cardSubtitle}>
            {step === 1
              ? 'Step 1: Enter your registered mobile number'
              : isAdminSession
              ? 'Step 2: Enter master administrative security ID'
              : 'Step 2: Enter your isolated database activation code'}
          </Text>

          {step === 1 ? (
            // Unified Login Step 1: Phone Verification
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>REGISTERED PHONE NUMBER / ADMIN PHONE</Text>
                <View style={styles.inputWrapper}>
                  <FontAwesome name="phone" size={16} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 10-digit mobile number..."
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={phone}
                    maxLength={10}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handlePhoneVerification}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Verify Mobile 🚀</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // Unified Login Step 2: Code Verification
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {isAdminSession ? 'SUPER ADMIN SECURITY ID' : 'ACTIVATION CODE'}
                </Text>
                <View style={styles.inputWrapper}>
                  <FontAwesome 
                    name={isAdminSession ? "lock" : "key"} 
                    size={16} 
                    color={colors.textMuted} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={isAdminSession ? "Enter admin ID..." : "e.g. KGM-ACT-92X7"}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={isAdminSession && !showPassword}
                    autoCapitalize={isAdminSession ? "none" : "characters"}
                    value={activationCode}
                    onChangeText={setActivationCode}
                  />
                  {isAdminSession && (
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ paddingHorizontal: spacing.s, paddingVertical: spacing.xs }}
                    >
                      <FontAwesome
                        name={showPassword ? "eye" : "eye-slash"}
                        size={16}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleActivation}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>
                    {isAdminSession ? 'Open Control Panel 🔑' : 'Activate & Connect DB ⚡'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setStep(1);
                  setActivationCode('');
                }}
              >
                <Text style={styles.backBtnText}>← Back to Number Verification</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.l },
  headerSection: { alignItems: 'center', marginBottom: spacing.xl },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.l,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    marginBottom: spacing.m,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 2,
    textShadowColor: 'rgba(139, 92, 246, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  brandSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, fontWeight: '600' },
  card: { padding: spacing.xl, borderRadius: borderRadius.l },
  cardTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: spacing.l },
  form: { gap: spacing.m },
  inputGroup: {},
  label: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.m,
    paddingHorizontal: spacing.m,
    height: 50,
  },
  inputIcon: { marginRight: spacing.s },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  primaryBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.s,
    ...shadows.premium,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  backBtn: { alignItems: 'center', marginTop: spacing.s },
  backBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
