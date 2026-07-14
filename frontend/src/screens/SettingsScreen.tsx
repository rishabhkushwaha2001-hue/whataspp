import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Linking, TouchableOpacity, Image, TextInput, Switch, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { invalidateCache } from '../hooks/useDataStore';
import { ModernInput } from '../components/ModernInput';
import { GradientButton } from '../components/GradientButton';
import { api } from '../services/api';
import * as DocumentPicker from 'expo-document-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAppAlert } from '../hooks/useAppAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export const SettingsScreen = () => {
  const router = useRouter();
  const { theme, colors, toggleTheme } = useTheme();
  const styles = getStyles(colors);
  const [gymName, setGymName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [businessType, setBusinessType] = useState('');
  const [hideRevenue, setHideRevenue] = useState(false);
  const [planDaysLeft, setPlanDaysLeft] = useState<number | null>(null);
  const [wifiNetworks, setWifiNetworks] = useState<{name: string, password: string}[]>([]);
  const { showSuccess, showError, showConfirm, AlertModal } = useAppAlert();

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
      if (response.data.plan_days_left !== undefined) {
        setPlanDaysLeft(response.data.plan_days_left);
      }
      if (response.data.wifi_networks) {
        setWifiNetworks(response.data.wifi_networks);
      }
      
      // Fallback: Fetch plan days from super-admin gyms list
      if (response.data.plan_days_left === undefined || response.data.plan_days_left === null) {
        const gymId = await AsyncStorage.getItem('gymId');
        if (gymId) {
          try {
            const saRes = await api.get('/super-admin/gyms');
            const gyms = saRes.data.gyms || [];
            const myGym = gyms.find((g: any) => g.gym_id === gymId);
            if (myGym && myGym.days_remaining !== undefined) {
              setPlanDaysLeft(myGym.days_remaining);
            }
          } catch (e) {
            console.log('Could not fetch from super-admin/gyms', e);
          }
        }
      }

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
        showError('Image Too Large', 'Please select a logo image smaller than 2MB.');
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
        showError('Error', 'Failed to read image file');
        setIsLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Logo selection failed:', error);
      showError('Error', 'Failed to select image');
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Fetch current settings to prevent stale state from overwriting message templates
      const res = await api.get('/settings/');
      const currentSettings = res.data;

      await api.post('/settings/', {
        ...currentSettings,
        gym_name: gymName,
        address: address,
        phone: phone,
        logo_url: logoUrl,
        business_type: businessType,
        wifi_networks: wifiNetworks
      });
      // BUG FIX: Update AsyncStorage cache so Dashboard reflects new name instantly
      await AsyncStorage.setItem('gymName', gymName);
      await AsyncStorage.setItem('gymAddress', address);
      await AsyncStorage.setItem('businessType', businessType);
      showSuccess('Success', 'Profile saved successfully!');
    } catch (error) {
      console.error('Error updating settings:', error);
      showError('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      // ✅ Use api instance so X-Tenant-ID header is included automatically
      const gymId = await AsyncStorage.getItem('gymId');
      if (!gymId) {
        showError('Error', 'Not logged in. Please restart the app.');
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
        showError('Error', 'Unable to open export URL. Try from a browser.');
      }
    } catch (error) {
      showError('Export Failed', 'Unable to export members data.');
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

      invalidateCache('members', 'dashboard_month', 'dashboard_all');
      showSuccess('Import Success', response.data.message);
    } catch (error: any) {
      console.error('Import Error:', error.response?.data || error.message);
      showError('Import Failed', error.response?.data?.detail || 'Make sure the CSV format is correct.');
    } finally {
      setIsLoading(false);
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);

  const renderEditModal = () => (
    <Modal visible={showEditModal} animationType="slide" transparent={true}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
            <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled" enableOnAndroid={true} extraScrollHeight={20}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.l }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Edit Business Info</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)} style={{ padding: 8 }}>
                  <FontAwesome name="times" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ModernInput
                label={businessType === 'library' ? 'Library Name' : businessType === 'gym' ? 'Gym Name' : 'Business Name'}
                placeholder="e.g. FitZone Gym"
                value={gymName}
                onChangeText={setGymName}
              />
              <ModernInput
                label="Contact Number"
                placeholder="+91 98765 43210"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <ModernInput
                label="Business Address"
                placeholder="Full Address"
                value={address}
                onChangeText={setAddress}
                multiline
              />
              <View style={{ marginTop: spacing.l }}>
                <GradientButton title="Save Changes" onPress={() => { setShowEditModal(false); handleSave(); }} isLoading={isLoading} />
              </View>
              <View style={{ height: 20 }} />
            </KeyboardAwareScrollView>
          </View>
        </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.background, theme === 'dark' ? '#1a103c' : '#ede9fe']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage your business and app preferences</Text>
        </View>
        <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}15`, justifyContent: 'center', alignItems: 'center' }}>
          <FontAwesome name="bell-o" size={20} color={colors.primary} />
          <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error }} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Business Card */}
        <LinearGradient colors={['#4F46E5', '#7C3AED']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.premiumCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.logoContainer}>
                {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoImage} /> : <FontAwesome name="building" size={24} color="#fff" />}
              </View>
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={styles.businessNameText} numberOfLines={1} adjustsFontSizeToFit>{gymName || 'Business Name'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>Admin</Text></View>
                </View>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#E0E7FF', fontSize: 12 }}>Business ID</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{gymName?.substring(0, 3).toUpperCase() || 'BUS'}-1234</Text> 
                <TouchableOpacity style={{ marginLeft: 8 }}><FontAwesome name="copy" size={14} color="#E0E7FF" /></TouchableOpacity>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ backgroundColor: '#22C55E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Active System</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FontAwesome name="calendar-check-o" size={12} color="#E0E7FF" style={{ marginRight: 4 }} />
                <Text style={{ color: '#E0E7FF', fontSize: 12, fontWeight: '600' }}>
                  Plan: <Text style={{ color: '#34D399', fontWeight: '800' }}>{planDaysLeft !== null ? `${planDaysLeft} Days` : 'N/A'}</Text>
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <Text style={styles.sectionHeading}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.actionGridItem} onPress={handleLogoSelect}>
            <View style={[styles.actionGridIcon, { backgroundColor: '#F3E8FF' }]}>
              <FontAwesome name="image" size={20} color="#9333EA" />
            </View>
            <Text style={styles.actionGridText}>Change Logo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionGridItem} onPress={() => router.push('/custom-messages')}>
            <View style={[styles.actionGridIcon, { backgroundColor: '#FEE2E2' }]}>
              <FontAwesome name="envelope" size={20} color="#DC2626" />
            </View>
            <Text style={styles.actionGridText}>Templates</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionGridItem} onPress={handleExport}>
            <View style={[styles.actionGridIcon, { backgroundColor: '#E0E7FF' }]}>
              <FontAwesome name="file-excel-o" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.actionGridText}>Export Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionGridItem} onPress={handleImport}>
            <View style={[styles.actionGridIcon, { backgroundColor: '#DCFCE7' }]}>
              <FontAwesome name="upload" size={20} color="#16A34A" />
            </View>
            <Text style={styles.actionGridText}>Restore Data</Text>
          </TouchableOpacity>
        </View>

        {/* Business Information */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Business Information</Text>
          <TouchableOpacity onPress={() => setShowEditModal(true)}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.listContainer}>
          <View style={styles.listItem}>
            <View style={[styles.listIcon, { backgroundColor: `${colors.primary}15` }]}><FontAwesome name="building-o" size={16} color={colors.primary} /></View>
            <View style={styles.listContent}>
              <Text style={styles.listLabel}>Business Name</Text>
              <Text style={styles.listValue}>{gymName || 'Not Set'}</Text>
            </View>
          </View>
          <View style={styles.listItem}>
            <View style={[styles.listIcon, { backgroundColor: `${colors.primary}15` }]}><FontAwesome name="phone" size={16} color={colors.primary} /></View>
            <View style={styles.listContent}>
              <Text style={styles.listLabel}>Phone Number</Text>
              <Text style={styles.listValue}>{phone || 'Not Set'}</Text>
            </View>
          </View>
          <View style={[styles.listItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.listIcon, { backgroundColor: `${colors.primary}15` }]}><FontAwesome name="map-marker" size={16} color={colors.primary} /></View>
            <View style={styles.listContent}>
              <Text style={styles.listLabel}>Business Address</Text>
              <Text style={styles.listValue}>{address || 'Not Set'}</Text>
            </View>
          </View>
        </View>

        {/* App Preferences */}
        <Text style={[styles.sectionHeading, { marginTop: 24 }]}>App Preferences</Text>
        <View style={styles.listContainer}>
          <View style={[styles.listItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.listIcon, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}><FontAwesome name={theme === 'dark' ? 'moon-o' : 'sun-o'} size={16} color={colors.text} /></View>
            <View style={styles.listContent}>
              <Text style={styles.listLabel}>Appearance</Text>
              <Text style={styles.listValue}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              thumbColor={'white'}
            />
          </View>
        </View>

        {/* Business Operations */}
        <Text style={[styles.sectionHeading, { marginTop: 24 }]}>Business Operations</Text>
        <View style={styles.listContainer}>
          <View style={[styles.listItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.listIcon, { backgroundColor: '#ECFDF5' }]}><FontAwesome name="shield" size={16} color="#10B981" /></View>
            <View style={styles.listContent}>
              <Text style={styles.listLabel}>Hide Revenue</Text>
              <Text style={styles.listValue}>Hide all revenue on dashboard</Text>
            </View>
            <Switch
              value={hideRevenue}
              onValueChange={toggleHideRevenue}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              thumbColor={hideRevenue ? 'white' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* WhatsApp Settings */}
        <Text style={[styles.sectionHeading, { marginTop: 24 }]}>WhatsApp Settings</Text>
        <View style={styles.listContainer}>
          <TouchableOpacity style={[styles.listItem, { borderBottomWidth: 0 }]} onPress={() => router.push('/custom-messages')}>
            <View style={[styles.listIcon, { backgroundColor: '#DCFCE7' }]}><FontAwesome name="whatsapp" size={18} color="#22C55E" /></View>
            <View style={styles.listContent}>
              <Text style={styles.listLabel}>Message Templates</Text>
              <Text style={styles.listValue}>Manage templates for reminders</Text>
            </View>
            <FontAwesome name="angle-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Data Management */}
        <Text style={[styles.sectionHeading, { marginTop: 24 }]}>Data Management</Text>
        <View style={styles.listContainer}>
          <TouchableOpacity style={styles.listItem} onPress={handleExport}>
            <View style={[styles.listIcon, { backgroundColor: '#FFF7ED' }]}><FontAwesome name="file-excel-o" size={16} color="#F97316" /></View>
            <View style={styles.listContent}>
              <Text style={styles.listLabel}>Export Data (Excel)</Text>
              <Text style={styles.listValue}>Download all data in Excel</Text>
            </View>
            <FontAwesome name="angle-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.listItem, { borderBottomWidth: 0 }]} onPress={handleImport}>
            <View style={[styles.listIcon, { backgroundColor: '#ECFEFF' }]}><FontAwesome name="cloud-upload" size={16} color="#06B6D4" /></View>
            <View style={styles.listContent}>
              <Text style={styles.listLabel}>Restore Data</Text>
              <Text style={styles.listValue}>Restore from backup file</Text>
            </View>
            <FontAwesome name="angle-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* WiFi Settings (Library Only) */}
        {businessType === 'library' && (
          <>
            <Text style={[styles.sectionHeading, { marginTop: 24 }]}>Library WiFi Settings</Text>
            <View style={styles.listContainer}>
              {wifiNetworks.map((wifi, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={[styles.listIcon, { backgroundColor: '#F3E8FF' }]}><FontAwesome name="wifi" size={16} color="#A855F7" /></View>
                  <View style={styles.listContent}>
                    <Text style={styles.listLabel}>{wifi.name}</Text>
                    <Text style={styles.listValue}>Configured</Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    const newNets = wifiNetworks.filter((_, i) => i !== index);
                    setWifiNetworks(newNets);
                    handleSave();
                  }}>
                    <FontAwesome name="trash" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={[styles.listItem, { borderBottomWidth: 0, paddingVertical: 8 }]}>
                <ModernInput
                  label="Add WiFi Network"
                  placeholder="Network Name"
                  value={''}
                  onChangeText={() => {}} // simplified for UI, editing can be complex inline
                />
                {/* To keep it clean, we just show a button that would normally open a modal */}
                <TouchableOpacity onPress={() => showSuccess('Coming Soon', 'Full WiFi editing modal')} style={{ marginLeft: 16 }}>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Manage</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 24 }} />

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={() => {
            showConfirm(
              'Logout',
              'Are you sure you want to log out and disconnect?',
              async () => {
                await AsyncStorage.clear();
                router.replace('/login');
              },
              'Logout',
              true
            );
          }}
        >
          <FontAwesome name="sign-out" size={16} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Logout / Disconnect</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      {renderEditModal()}
      <AlertModal />
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
  },
  header: {
    paddingHorizontal: spacing.l,
    paddingTop: 56,
    paddingBottom: spacing.m,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  premiumCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  businessNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  adminBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  planCirclePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: '#34D399',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionGridItem: {
    width: '23%',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionGridIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionGridText: {
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  listContainer: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  listContent: {
    flex: 1,
  },
  listLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  listValue: {
    fontSize: 13,
    color: colors.textMuted,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
  }
});
