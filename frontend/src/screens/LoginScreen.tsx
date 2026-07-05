import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
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
  
  const [loginMode, setLoginMode] = useState<'admin' | 'student'>('admin');
  const [step, setStep] = useState(1); // For admin: 1 = Phone, 2 = Code. For student: 1 = Credentials, 2 = Select Portal
  
  const [phone, setPhone] = useState('');
  const [activationCode, setActivationCode] = useState(''); // Admin Code or Student PIN
  const [isAdminSession, setIsAdminSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [memberships, setMemberships] = useState<any[]>([]);

  const router = useRouter();

  // --- ADMIN LOGIN LOGIC ---
  const handleAdminPhoneVerification = async () => {
    if (!phone || phone.trim().length < 10) {
      setAlertConfig({ visible: true, title: 'Attention!', message: 'Please enter a valid 10-digit mobile number.', type: 'warning' });
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
        message: isAdm ? 'Super Admin recognized! Enter Security ID.' : `Welcome ${res.data.owner_name}! Verified for ${res.data.gym_name}.\nEnter activation code.`,
        type: 'success',
        onConfirm: () => { setAlertConfig({ visible: false }); setStep(2); }
      });
    } catch (error: any) {
      setLoading(false);
      setAlertConfig({ visible: true, title: 'Verification Failed', message: error.response?.data?.detail || 'Verification failed.', type: 'error' });
    }
  };

  const handleAdminActivation = async () => {
    if (!activationCode.trim()) {
      setAlertConfig({ visible: true, title: 'Attention', message: 'Enter activation code.', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const finalCode = isAdminSession ? activationCode.trim() : activationCode.trim().toUpperCase();
      const res = await api.post('/auth/activate', { phone: phone.trim(), activation_code: finalCode });
      await AsyncStorage.clear();
      
      if (res.data.is_admin === true) {
        await AsyncStorage.multiSet([
          ['gymId', 'super_admin'], ['gymName', 'Super Admin Control Panel'],
          ['ownerName', 'Kush'], ['isAdmin', 'true'], ['role', 'super_admin']
        ]);
        setLoading(false);
        router.replace('/super-admin');
      } else {
        await AsyncStorage.multiSet([
          ['gymId', res.data.gym_id], ['gymName', res.data.gym_name],
          ['ownerName', res.data.owner_name], ['isAdmin', 'false'],
          ['businessType', res.data.business_type || 'gym'], ['role', 'admin']
        ]);
        setLoading(false);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      setLoading(false);
      setAlertConfig({ visible: true, title: 'Denied', message: error.response?.data?.detail || 'Invalid code.', type: 'error' });
    }
  };

  // --- STUDENT LOGIN LOGIC ---
  const handleStudentLogin = async () => {
    if (!phone || phone.trim().length < 10) {
      setAlertConfig({ visible: true, title: 'Attention!', message: 'Please enter a valid 10-digit mobile number.', type: 'warning' });
      return;
    }
    if (!activationCode.trim()) {
      setAlertConfig({ visible: true, title: 'Attention!', message: 'Please enter your 4-digit PIN.', type: 'warning' });
      return;
    }
    
    setLoading(true);
    try {
      const res = await api.post('/student/login', { phone: phone.trim(), pin: activationCode.trim() });
      setLoading(false);
      
      const foundMemberships = res.data.memberships;
      
      if (foundMemberships.length === 1) {
        // Direct login
        selectStudentPortal(foundMemberships[0]);
      } else {
        // Show selection screen
        setMemberships(foundMemberships);
        setStep(2);
      }
    } catch (error: any) {
      setLoading(false);
      setAlertConfig({ visible: true, title: 'Login Failed', message: error.response?.data?.detail || 'Invalid number or PIN.', type: 'error' });
    }
  };

  const selectStudentPortal = async (membership: any) => {
    await AsyncStorage.clear();
    await AsyncStorage.multiSet([
      ['gymId', membership.gym_id],
      ['gymName', membership.gym_name],
      ['businessType', membership.business_type || 'gym'],
      ['role', 'student'],
      ['memberId', membership.member_id],
      ['memberName', membership.name]
    ]);
      router.replace('/(student_tabs)/dashboard' as any);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <CustomAlert {...alertConfig} onClose={() => setAlertConfig({ ...alertConfig, visible: false })} />

        <View style={styles.headerSection}>
          <Image source={require('../../assets/kgm_logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        {/* MODE TOGGLE (Hidden) */}


        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>
            {loginMode === 'admin' 
              ? (step === 1 ? 'Owner Verification' : 'Activation Code') 
              : (step === 1 ? 'Student Portal' : 'Select Portal')}
          </Text>
          <Text style={styles.cardSubtitle}>
            {loginMode === 'admin'
              ? (step === 1 ? 'Step 1: Enter your registered mobile number' : 'Step 2: Enter your isolated database activation code')
              : (step === 1 ? 'Login with your registered number and PIN' : 'You have multiple active memberships')}
          </Text>

          {loginMode === 'admin' ? (
            // --- ADMIN VIEW ---
            <View style={styles.form}>
              {step === 1 ? (
                <View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>REGISTERED PHONE NUMBER</Text>
                    <View style={styles.inputWrapper}>
                      <FontAwesome name="phone" size={16} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="Enter 10-digit mobile number..." placeholderTextColor={colors.textMuted} keyboardType="phone-pad" value={phone} maxLength={10} onChangeText={setPhone} />
                    </View>
                  </View>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleAdminPhoneVerification} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify Mobile 🚀</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{isAdminSession ? 'SUPER ADMIN ID' : 'ACTIVATION CODE'}</Text>
                    <View style={styles.inputWrapper}>
                      <FontAwesome name="key" size={16} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="e.g. KGM-ACT-92X7" placeholderTextColor={colors.textMuted} secureTextEntry={!showPassword} value={activationCode} onChangeText={setActivationCode} />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
                        <FontAwesome name={showPassword ? "eye" : "eye-slash"} size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleAdminActivation} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Activate & Connect DB ⚡</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.backBtn} onPress={() => { setStep(1); setActivationCode(''); }}>
                    <Text style={styles.backBtnText}>← Back to Verification</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            // --- STUDENT VIEW ---
            <View style={styles.form}>
              {step === 1 ? (
                <View style={{ gap: spacing.m }}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>MOBILE NUMBER</Text>
                    <View style={styles.inputWrapper}>
                      <FontAwesome name="phone" size={16} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="10-digit mobile number" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" value={phone} maxLength={10} onChangeText={setPhone} />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>4-DIGIT PIN (Default: Last 4 digits of phone)</Text>
                    <View style={styles.inputWrapper}>
                      <FontAwesome name="lock" size={16} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="Enter PIN" placeholderTextColor={colors.textMuted} secureTextEntry={!showPassword} keyboardType="numeric" maxLength={4} value={activationCode} onChangeText={setActivationCode} />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
                        <FontAwesome name={showPassword ? "eye" : "eye-slash"} size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleStudentLogin} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login to Portal 🎓</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                // Multi-Membership Selector
                <View style={{ gap: spacing.m }}>
                  {memberships.map((m, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={[styles.portalBtn, { borderColor: m.business_type === 'library' ? '#8b5cf6' : colors.primary }]}
                      onPress={() => selectStudentPortal(m)}
                    >
                      <FontAwesome name={m.business_type === 'library' ? "book" : "star"} size={24} color={m.business_type === 'library' ? '#8b5cf6' : colors.primary} />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{m.gym_name}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{m.business_type.toUpperCase()} PORTAL</Text>
                      </View>
                      <FontAwesome name="chevron-right" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.backBtn} onPress={() => { setStep(1); }}>
                    <Text style={styles.backBtnText}>← Back to Login</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </GlassCard>

        <View style={styles.footerSection}>
          <Text style={styles.poweredByText}>Powered by Aetheron Technologies</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContainer: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: spacing.l, paddingTop: 40, paddingBottom: spacing.l },
  headerSection: { alignItems: 'center', marginBottom: spacing.m },
  logo: { width: 260, height: 260, marginBottom: 0 },
  toggleContainer: { flexDirection: 'row', backgroundColor: colors.surfaceLight, borderRadius: borderRadius.l, padding: 4, marginBottom: spacing.l, borderWidth: 1, borderColor: colors.border },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.m },
  toggleBtnActive: { backgroundColor: colors.primary, ...shadows.premium },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  card: { padding: spacing.xl, borderRadius: borderRadius.l },
  cardTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: spacing.l },
  form: { gap: spacing.m },
  inputGroup: {},
  label: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.m, paddingHorizontal: spacing.m, height: 50 },
  inputIcon: { marginRight: spacing.s },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  primaryBtn: { backgroundColor: colors.primary, height: 50, borderRadius: borderRadius.m, alignItems: 'center', justifyContent: 'center', marginTop: spacing.s, ...shadows.premium },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  backBtn: { alignItems: 'center', marginTop: spacing.s },
  backBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  portalBtn: { flexDirection: 'row', alignItems: 'center', padding: spacing.m, borderWidth: 2, borderRadius: borderRadius.m, backgroundColor: colors.surfaceLight, ...shadows.premium },
  footerSection: { alignItems: 'center', marginTop: 'auto', paddingTop: spacing.xl },
  poweredByText: { color: colors.textMuted, fontSize: 12, fontWeight: '500', letterSpacing: 0.5 },
});
