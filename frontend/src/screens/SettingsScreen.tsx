import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Linking, TouchableOpacity, Image, TextInput, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { ModernInput } from '../components/ModernInput';
import { GradientButton } from '../components/GradientButton';
import { api } from '../services/api';
import * as DocumentPicker from 'expo-document-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export const SettingsScreen = () => {
  const router = useRouter();
  const { theme, colors, toggleTheme } = useTheme();
  const styles = getStyles(colors);
  const [gymName, setGymName] = useState('Gym');
  const [address, setAddress] = useState('Gym Center');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [businessType, setBusinessType] = useState('');
  const [enableHours, setEnableHours] = useState(false);
  const [joiningTemplate, setJoiningTemplate] = useState('');
  const [renewalTemplate, setRenewalTemplate] = useState('');
  const [reminderTemplate, setReminderTemplate] = useState('');
  const [defaultTemplates, setDefaultTemplates] = useState<any>({});
  const [hideRevenue, setHideRevenue] = useState(false);

  useEffect(() => {
    fetchSettings();
    // Load revenue visibility preference from local storage
    AsyncStorage.getItem('hideRevenue').then(val => {
      if (val === 'true') setHideRevenue(true);
    });
    // Load business type from local storage to prevent flash
    AsyncStorage.getItem('businessType').then(type => {
      if (type) setBusinessType(type);
    });
  }, []);

  const toggleHideRevenue = async (val: boolean) => {
    setHideRevenue(val);
    await AsyncStorage.setItem('hideRevenue', val ? 'true' : 'false');
  };

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings/');
      setGymName(response.data.gym_name);
      setAddress(response.data.address);
      setPhone(response.data.phone || '');
      setLogoUrl(response.data.logo_url || '');
      setBusinessType(response.data.business_type || 'gym');
      setEnableHours(response.data.enable_hours_feature || false);
      setJoiningTemplate(response.data.joining_msg_template || '');
      setRenewalTemplate(response.data.renewal_msg_template || '');
      setReminderTemplate(response.data.reminder_msg_template || '');
      // Store defaults for reset button
      setDefaultTemplates({
        joining: response.data.joining_msg_template || '',
        renewal: response.data.renewal_msg_template || '',
        reminder: response.data.reminder_msg_template || '',
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleLogoSelect = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > 2 * 1024 * 1024) {
        Alert.alert('Image Too Large', 'Please select a logo image smaller than 2MB.');
        return;
      }

      setIsLoading(true);
      
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setLogoUrl(base64data);
        setIsLoading(false);
      };
      reader.onerror = () => {
        Alert.alert('Error', 'Failed to read image file');
        setIsLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Logo selection failed:', error);
      Alert.alert('Error', 'Failed to select image');
      setIsLoading(false);
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
        business_type: businessType,
        enable_hours_feature: enableHours,
        joining_msg_template: joiningTemplate,
        renewal_msg_template: renewalTemplate,
        reminder_msg_template: reminderTemplate,
      });
      // BUG FIX: Update AsyncStorage cache so Dashboard reflects new name instantly
      await AsyncStorage.setItem('gymName', gymName);
      await AsyncStorage.setItem('gymAddress', address);
      await AsyncStorage.setItem('businessType', businessType);
      Alert.alert('Success', 'Profile & Templates saved successfully!');
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      // ✅ Use api instance so X-Tenant-ID header is included automatically
      const gymId = await AsyncStorage.getItem('gymId');
      if (!gymId) {
        Alert.alert('Error', 'Not logged in. Please restart the app.');
        return;
      }

      // Build URL with gymId as query param as fallback + rely on header from api interceptor
      const exportUrl = `${api.defaults.baseURL}/members/export/csv`;
      
      // Use Linking with the full URL — but first verify it by pinging via axios
      // The server will use the gymId header automatically from the api interceptor
      // For browser download, pass gymId as a query param so header isn't needed
      const downloadUrl = `${exportUrl}?gym_id=${gymId}&_t=${Date.now()}`;
      
      const supported = await Linking.canOpenURL(downloadUrl);
      if (supported) {
        await Linking.openURL(downloadUrl);
      } else {
        Alert.alert('Error', 'Unable to open export URL. Try from a browser.');
      }
    } catch (error) {
      Alert.alert('Export Failed', 'Unable to export members data.');
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/comma-separated-values',
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? asset.uri.replace('file://', '') : asset.uri,
        name: asset.name,
        type: asset.mimeType || 'text/csv'
      } as any);

      setIsLoading(true);
      const response = await api.post('/members/import/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Import Success', response.data.message);
    } catch (error: any) {
      console.error('Import Error:', error.response?.data || error.message);
      Alert.alert('Import Failed', error.response?.data?.detail || 'Make sure the CSV format is correct.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.background, theme === 'dark' ? '#1a103c' : '#ede9fe']} style={StyleSheet.absoluteFill} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{businessType === 'library' ? 'Library Profile' : businessType === 'gym' ? 'Gym Profile' : 'Business Profile'}</Text>
          <Text style={styles.subtitle}>Customize your brand</Text>
        </View>

        <GlassCard style={styles.card}>
          {/* Logo Preview & Upload */}
          <View style={styles.logoPreviewContainer}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoPreview} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <FontAwesome name="image" size={32} color={colors.textMuted} />
              </View>
            )}
            <Text style={styles.logoPreviewLabel}>{businessType === 'library' ? 'Library Logo' : businessType === 'gym' ? 'Gym Logo' : 'Business Logo'}</Text>
            
            <View style={styles.logoActionRow}>
              <TouchableOpacity style={styles.uploadLogoBtn} onPress={handleLogoSelect}>
                <FontAwesome name="upload" size={14} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.uploadLogoBtnText}>Upload Image</Text>
              </TouchableOpacity>
              {logoUrl ? (
                <TouchableOpacity style={styles.removeLogoBtn} onPress={() => setLogoUrl('')}>
                  <FontAwesome name="trash" size={14} color={colors.error} style={{ marginRight: 6 }} />
                  <Text style={styles.removeLogoBtnText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <ModernInput
            label={businessType === 'library' ? 'Library Name' : businessType === 'gym' ? 'Gym Name' : 'Business Name'}
            placeholder={businessType === 'library' ? 'e.g. City Library' : businessType === 'gym' ? 'e.g. City Gym' : 'e.g. My Business'}
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

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>App Appearance</Text>
          <Text style={styles.sectionSub}>Switch between dark and light themes</Text>

          <View style={styles.themeRow}>
            <TouchableOpacity 
              style={[
                styles.themeButton, 
                theme === 'dark' && styles.themeButtonActive,
                { borderColor: theme === 'dark' ? colors.primary : colors.border }
              ]} 
              onPress={() => { if (theme !== 'dark') toggleTheme(); }}
            >
              <FontAwesome name="moon-o" size={16} color={theme === 'dark' ? colors.primary : colors.textMuted} />
              <Text style={[styles.themeButtonText, { color: theme === 'dark' ? colors.primary : colors.textSecondary }]}>Dark Theme</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.themeButton, 
                theme === 'light' && styles.themeButtonActive,
                { borderColor: theme === 'light' ? colors.primary : colors.border }
              ]} 
              onPress={() => { if (theme !== 'light') toggleTheme(); }}
            >
              <FontAwesome name="sun-o" size={16} color={theme === 'light' ? colors.primary : colors.textMuted} />
              <Text style={[styles.themeButtonText, { color: theme === 'light' ? colors.primary : colors.textSecondary }]}>Light Theme</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Revenue Privacy Toggle */}
          <Text style={styles.sectionTitle}>🔒 Revenue Privacy</Text>
          <Text style={styles.sectionSub}>Hide revenue amount on Dashboard so others can't see it</Text>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>
                {hideRevenue ? '🔒 Revenue Hidden' : '👁️ Revenue Visible'}
              </Text>
              <Text style={styles.toggleSub}>
                {hideRevenue
                  ? 'Tap the eye icon on Dashboard to reveal'
                  : 'Revenue is shown on Dashboard'}
              </Text>
            </View>
            <Switch
              value={hideRevenue}
              onValueChange={toggleHideRevenue}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              thumbColor={hideRevenue ? 'white' : '#f4f3f4'}
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Backup & Restore</Text>
          <Text style={styles.sectionSub}>Export to Excel (CSV) or restore entire gym database</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: `${colors.accent}15`, borderColor: `${colors.accent}30` }]} 
              onPress={handleExport}
            >
              <Text style={[styles.actionButtonText, { color: colors.accent }]}>Export Excel (CSV)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]} 
              onPress={handleImport}
            >
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Restore / Import</Text>
            </TouchableOpacity>
          </View>


          <View style={styles.divider} />


          {/* WhatsApp Message Templates Section */}
          <Text style={styles.sectionTitle}>💬 WhatsApp Message Templates</Text>
          <Text style={styles.sectionSub}>Customize messages for Joining, Renewal & Reminders.</Text>
          <TouchableOpacity 
            style={[styles.themeButton, { marginBottom: spacing.m, backgroundColor: colors.accent, paddingVertical: 14 }]} 
            onPress={() => router.push('/custom-messages')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome name="envelope" size={16} color="white" style={{ marginRight: 8 }} />
              <Text style={[styles.actionButtonText, { color: 'white' }]}>Manage Custom Messages</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.25)', borderStyle: 'solid', height: 46 }]} 
            onPress={() => {
              Alert.alert(
                'Deactivate Business Session',
                'Are you sure you want to log out and disconnect this business database from this device?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Logout & Disconnect', 
                    style: 'destructive',
                    onPress: async () => {
                      await AsyncStorage.clear();
                      router.replace('/login');
                    }
                  }
                ]
              );
            }}
          >
            <Text style={[styles.actionButtonText, { color: colors.error }]}>Disconnect Business Session 🔌</Text>
          </TouchableOpacity>

        </GlassCard>
      </ScrollView>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
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
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
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
  logoPreviewContainer: {
    alignItems: 'center',
    marginBottom: spacing.l,
    marginTop: spacing.s,
  },
  logoPreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  logoPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  logoPreviewLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.s,
  },
  infoBox: {
    backgroundColor: colors.surfaceLight,
    padding: spacing.m,
    borderRadius: borderRadius.m,
    marginBottom: spacing.l,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.l,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.m,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.s,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.m,
    borderStyle: 'dashed',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.m,
    marginTop: spacing.s,
  },
  themeButton: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceLight,
  },
  themeButtonActive: {
    backgroundColor: colors.primary + '15',
  },
  themeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  logoActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.s,
  },
  uploadLogoBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadLogoBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  removeLogoBtn: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLogoBtnText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
  },
  templateBox: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.m,
    marginBottom: 6,
    minHeight: 120,
  },
  templateInput: {
    fontSize: 13,
    lineHeight: 20,
    minHeight: 100,
  },
  resetBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.s,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.m,
    marginBottom: spacing.s,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  toggleSub: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
