import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, Modal, ScrollView, ActivityIndicator, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { DatePickerModal } from '../components/DatePickerModal';

const formatLogDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return dateStr;
  }
};

export const SuperAdminScreen = () => {
  const { theme, colors, toggleTheme } = useTheme();
  const styles = getStyles(colors);
  const [gyms, setGyms] = useState<any[]>([]);
  const [filteredGyms, setFilteredGyms] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const router = useRouter();

  // Stats State
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    expiring: 0,
    revenue: 0,
  });

  // Modal States
  const [registerModal, setRegisterModal] = useState(false);
  const [renewModal, setRenewModal] = useState(false);
  const [whatsappModal, setWhatsappModal] = useState(false);
  const [logsModal, setLogsModal] = useState(false);

  // Form States
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [gymName, setGymName] = useState('');
  const [address, setAddress] = useState('');
  const [duration, setDuration] = useState('1');
  const [price, setPrice] = useState('1500');
  const [planExpiry, setPlanExpiry] = useState('');

  const [selectedGym, setSelectedGym] = useState<any>(null);
  const [renewDuration, setRenewDuration] = useState('1');
  const [renewPrice, setRenewPrice] = useState('1500');
  const [renewPlanExpiry, setRenewPlanExpiry] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'register' | 'renew'>('register');

  const [customMsg, setCustomMsg] = useState('');
  const [whatsappLogs, setWhatsappLogs] = useState<any[]>([]);

  const fetchGyms = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/super-admin/gyms');
      setGyms(res.data);
      setFilteredGyms(res.data);

      // Compute stats
      let activeCount = 0;
      let inactiveCount = 0;
      let expiringCount = 0;
      let totalRevenue = 0;

      res.data.forEach((gym: any) => {
        if (gym.status === 'active' && !gym.is_expired) {
          activeCount++;
        } else {
          inactiveCount++;
        }
        if (gym.days_remaining >= 0 && gym.days_remaining <= 7) {
          expiringCount++;
        }
        totalRevenue += gym.plan_price || 0;
      });

      setStats({
        total: res.data.length,
        active: activeCount,
        inactive: inactiveCount,
        expiring: expiringCount,
        revenue: totalRevenue,
      });
    } catch (error) {
      console.warn('Super Admin: Failed to fetch gyms');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGyms();
  }, []);

  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text) {
      setFilteredGyms(gyms);
      return;
    }
    const filtered = gyms.filter(gym => 
      gym.gym_name.toLowerCase().includes(text.toLowerCase()) ||
      gym.owner_name.toLowerCase().includes(text.toLowerCase()) ||
      gym.phone.includes(text) ||
      gym.address.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredGyms(filtered);
  };

  const handleRegisterGym = async () => {
    if (!ownerName || !phone || !gymName || !address) {
      setAlertConfig({ visible: true, title: 'Validation Error', message: 'All registration fields are required!', type: 'warning' });
      return;
    }

    try {
      const res = await api.post('/super-admin/gyms', {
        owner_name: ownerName,
        phone: phone.trim(),
        gym_name: gymName,
        address: address,
        plan_duration_months: parseInt(duration),
        plan_price: parseFloat(price),
        plan_expiry: planExpiry || undefined
      });

      setRegisterModal(false);
      // Reset form
      setOwnerName('');
      setPhone('');
      setGymName('');
      setAddress('');
      setDuration('1');
      setPrice('1500');
      setPlanExpiry('');

      fetchGyms();

      // Ask to send the activation details on WhatsApp
      const actMsg = res.data.notifications.activation;

      setAlertConfig({
        visible: true,
        title: 'Gym Registered! 🎉',
        message: `Database and activation code generated successfully for ${res.data.gym.gym_name}.\n\nClick "Send WhatsApp" to forward credentials.`,
        type: 'success',
        confirmText: 'Send WhatsApp',
        onConfirm: async () => {
          setAlertConfig({ visible: false });
          const success = await sendWhatsAppMessage(phone, actMsg);
          if (!success) {
            Alert.alert('Error', 'WhatsApp could not be launched on this device.');
          }
        }
      });
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to register gym. Check details.';
      setAlertConfig({ visible: true, title: 'Registration Failed', message: msg, type: 'error' });
    }
  };

  const handleToggleStatus = (gym: any) => {
    const nextStatus = gym.status === 'active' ? 'suspended' : 'active';
    setAlertConfig({
      visible: true,
      title: `${nextStatus === 'active' ? 'Activate' : 'Suspend'} Gym?`,
      message: `Are you sure you want to set status of ${gym.gym_name} to ${nextStatus.toUpperCase()}?`,
      type: 'info',
      showCancel: true,
      onConfirm: async () => {
        setAlertConfig({ visible: false });
        try {
          await api.post(`/super-admin/gyms/${gym.gym_id}/status`, { status: nextStatus });
          fetchGyms();
        } catch (error) {
          setAlertConfig({ visible: true, title: 'Error', message: 'Failed to update status', type: 'error' });
        }
      }
    });
  };

  const handleRenewSubmit = async () => {
    try {
      const res = await api.post(`/super-admin/gyms/${selectedGym.gym_id}/renew`, {
        plan_duration_months: parseInt(renewDuration),
        plan_price: parseFloat(renewPrice),
        plan_expiry: renewPlanExpiry || undefined
      });
      setRenewModal(false);
      setRenewPlanExpiry('');
      fetchGyms();

      // Prompt to send renewal receipt
      const receiptMsg = res.data.notification;

      setAlertConfig({
        visible: true,
        title: 'Subscription Renewed!',
        message: `Plan extended successfully until ${new Date(res.data.new_expiry).toLocaleDateString()}.`,
        type: 'success',
        confirmText: 'WhatsApp Notification',
        onConfirm: async () => {
          setAlertConfig({ visible: false });
          await sendWhatsAppMessage(selectedGym.phone, receiptMsg);
        }
      });
    } catch (error) {
      setAlertConfig({ visible: true, title: 'Error', message: 'Renewal failed', type: 'error' });
    }
  };

  const handleDeleteGym = (gym: any) => {
    setAlertConfig({
      visible: true,
      title: '⚠️ CRITICAL ACTION',
      message: `Aap sach mein "${gym.gym_name}" ka isolated database aur registeration delete karna chahte hain?\n\nThis will completely WIPE their database and cannot be undone!`,
      type: 'error',
      showCancel: true,
      confirmText: 'YES, WIPE DATA',
      onConfirm: async () => {
        setAlertConfig({ visible: false });
        try {
          await api.delete(`/super-admin/gyms/${gym.gym_id}`);
          fetchGyms();
          setAlertConfig({ visible: true, title: 'Data Wiped', message: `Gym ${gym.gym_name} and database deleted successfully.`, type: 'success' });
        } catch (error) {
          setAlertConfig({ visible: true, title: 'Error', message: 'Failed to delete gym.', type: 'error' });
        }
      }
    });
  };

  const handleSendCustomMessage = async () => {
    if (!customMsg) return;
    try {
      const res = await api.post('/super-admin/send-message', {
        phone: selectedGym.phone,
        message: customMsg
      });
      setWhatsappModal(false);
      setCustomMsg('');

      const success = await sendWhatsAppMessage(selectedGym.phone, res.data.message_body);
      if (!success) {
        Alert.alert('Log Success', 'WhatsApp log recorded but could not launch WhatsApp on this device.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to log custom message');
    }
  };

  const fetchWhatsappLogs = async () => {
    try {
      const res = await api.get('/super-admin/whatsapp-logs');
      setWhatsappLogs(res.data);
      setLogsModal(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to retrieve logs');
    }
  };

  const handleLogout = async () => {
    setAlertConfig({
      visible: true,
      title: 'Logout',
      message: 'Sure to logout from Master Admin Control Panel?',
      type: 'warning',
      showCancel: true,
      onConfirm: async () => {
        setAlertConfig({ visible: false });
        await AsyncStorage.clear();
        router.replace('/login');
      }
    });
  };

  return (
    <View style={styles.container}>
      <CustomAlert {...alertConfig} onClose={() => setAlertConfig({ ...alertConfig, visible: false })} />

      {/* Header Section */}
      <View style={styles.header}>
        {/* Left: title, shrinks to fit */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <View style={styles.badgeIcon}>
            <FontAwesome name="shield" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">Master Admin</Text>
            <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">Super Control Panel</Text>
          </View>
        </View>

        {/* Right: fixed-width button row — NEVER clips */}
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme === 'dark' ? 'rgba(251,191,36,0.18)' : 'rgba(109,40,217,0.14)',
                borderColor: theme === 'dark' ? '#FBBF24' : '#7C3AED',
              }
            ]}
            onPress={toggleTheme}
          >
            <FontAwesome
              name={theme === 'dark' ? 'sun-o' : 'moon-o'}
              size={15}
              color={theme === 'dark' ? '#FBBF24' : '#7C3AED'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={fetchWhatsappLogs}>
            <FontAwesome name="history" size={14} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.error }]} onPress={handleLogout}>
            <FontAwesome name="sign-out" size={14} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main FlatList Container */}
      <FlatList
        data={filteredGyms}
        keyExtractor={(item) => item.gym_id}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchGyms} tintColor={colors.primary} />}
        ListHeaderComponent={() => (
          <View>
            {/* Stats Panel */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
              <GlassCard style={styles.statsCard}>
                <Text style={styles.statsNum}>{stats.total}</Text>
                <Text style={styles.statsLabel}>Total Gyms</Text>
              </GlassCard>

              <GlassCard style={{ ...styles.statsCard, borderLeftColor: colors.accent, borderLeftWidth: 3 }}>
                <Text style={[styles.statsNum, { color: colors.accent }]}>{stats.active}</Text>
                <Text style={styles.statsLabel}>Active</Text>
              </GlassCard>

              <GlassCard style={{ ...styles.statsCard, borderLeftColor: colors.error, borderLeftWidth: 3 }}>
                <Text style={[styles.statsNum, { color: colors.error }]}>{stats.inactive}</Text>
                <Text style={styles.statsLabel}>Inactive / Suspended</Text>
              </GlassCard>

              <GlassCard style={{ ...styles.statsCard, borderLeftColor: colors.warning, borderLeftWidth: 3 }}>
                <Text style={[styles.statsNum, { color: colors.warning }]}>{stats.expiring}</Text>
                <Text style={styles.statsLabel}>Expiring Soon</Text>
              </GlassCard>

              <GlassCard style={{ ...styles.statsCard, borderLeftColor: colors.primary, borderLeftWidth: 3 }}>
                <Text style={[styles.statsNum, { color: colors.primary }]}>₹{stats.revenue}</Text>
                <Text style={styles.statsLabel}>Total Billings</Text>
              </GlassCard>
            </ScrollView>

            {/* Actions Bar */}
            <View style={styles.actionBar}>
              <View style={styles.searchBar}>
                <FontAwesome name="search" size={14} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search Gym, Owner, Phone or Address..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  value={search}
                  onChangeText={handleSearch}
                />
              </View>
              <TouchableOpacity style={styles.registerBtn} onPress={() => { setPlanExpiry(''); setRegisterModal(true); }}>
                <FontAwesome name="plus" size={14} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.registerBtnText}>Add Gym</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Registered Gym Partners</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isExp = item.is_expired;
          const statusColor = item.status === 'active' && !isExp ? colors.accent : colors.error;

          return (
            <GlassCard style={styles.gymCard}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.gymName}>{item.gym_name}</Text>
                  <Text style={styles.ownerText}>Owner: {item.owner_name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {item.status === 'active' ? (isExp ? 'EXPIRED' : 'ACTIVE') : item.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Security Activation details block */}
              <View style={styles.securityBlock}>
                <View style={styles.securityRow}>
                  <Text style={styles.securityLabel}>🔑 Activation Code: </Text>
                  <Text style={styles.securityVal}>{item.activation_code}</Text>
                </View>
                <View style={styles.securityRow}>
                  <Text style={styles.securityLabel}>📍 Gym Tenant ID: </Text>
                  <Text style={styles.securityVal}>{item.gym_id}</Text>
                </View>
                <View style={styles.securityRow}>
                  <Text style={styles.securityLabel}>📂 Isolated DB: </Text>
                  <Text style={[styles.securityVal, { color: colors.primary }]}>gym_{item.gym_id}</Text>
                </View>
              </View>

              {/* Gym Metadata */}
              <View style={styles.metaBlock}>
                <Text style={styles.metaText}>
                  <FontAwesome name="phone" color={colors.textSecondary} /> {item.phone}
                </Text>
                <Text style={styles.metaText}>
                  <FontAwesome name="map-marker" color={colors.textSecondary} /> {item.address}
                </Text>
                <Text style={[styles.metaText, { fontWeight: '600', color: isExp ? colors.error : colors.textSecondary }]}>
                  <FontAwesome name="calendar" color={isExp ? colors.error : colors.textSecondary} /> Expiry:{' '}
                  {new Date(item.plan_expiry).toLocaleDateString()} ({item.days_remaining >= 0 ? `${item.days_remaining}d left` : 'Expired'})
                </Text>
                <Text style={styles.metaText}>
                  <FontAwesome name="money" color={colors.textSecondary} /> Plan Price: ₹{item.plan_price} ({item.plan_duration_months} Month)
                </Text>
              </View>

              {/* Actions Grid */}
              <View style={styles.actionGrid}>
                {/* Send Notification Custom */}
                <TouchableOpacity 
                  style={styles.cardActionBtn} 
                  onPress={() => {
                    setSelectedGym(item);
                    setWhatsappModal(true);
                  }}
                >
                  <FontAwesome name="whatsapp" size={14} color={colors.accent} />
                  <Text style={[styles.cardActionText, { color: colors.accent }]}>Send Msg</Text>
                </TouchableOpacity>

                {/* Status Toggle */}
                <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleToggleStatus(item)}>
                  <FontAwesome name={item.status === 'active' ? "pause" : "play"} size={12} color={colors.warning} />
                  <Text style={[styles.cardActionText, { color: colors.warning }]}>
                    {item.status === 'active' ? 'Suspend' : 'Activate'}
                  </Text>
                </TouchableOpacity>

                {/* Renew plan */}
                <TouchableOpacity 
                  style={styles.cardActionBtn} 
                  onPress={() => {
                    setSelectedGym(item);
                    setRenewDuration(item.plan_duration_months?.toString() || '1');
                    setRenewPrice(item.plan_price?.toString() || '1500');
                    setRenewPlanExpiry('');
                    setRenewModal(true);
                  }}
                >
                  <FontAwesome name="refresh" size={13} color={colors.primary} />
                  <Text style={[styles.cardActionText, { color: colors.primary }]}>Renew Plan</Text>
                </TouchableOpacity>

                {/* Wipe database completely */}
                <TouchableOpacity style={[styles.cardActionBtn, { borderColor: `${colors.error}30` }]} onPress={() => handleDeleteGym(item)}>
                  <FontAwesome name="trash" size={13} color={colors.error} />
                  <Text style={[styles.cardActionText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <FontAwesome name="folder-open" size={42} color={colors.textMuted} />
            <Text style={styles.emptyText}>No registered gyms found.</Text>
          </View>
        )}
      />

      {/* REGISTER NEW GYM MODAL */}
      <Modal visible={registerModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Partner Gym 🏋️‍♂️</Text>
              <TouchableOpacity onPress={() => setRegisterModal(false)}>
                <FontAwesome name="times-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>OWNER FULL NAME</Text>
                <TextInput style={styles.modalInput} value={ownerName} onChangeText={setOwnerName} placeholder="Enter owner name..." placeholderTextColor={colors.textMuted} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>OWNER MOBILE (10 DIGITS)</Text>
                <TextInput style={styles.modalInput} value={phone} keyboardType="phone-pad" onChangeText={setPhone} placeholder="Enter mobile number..." placeholderTextColor={colors.textMuted} maxLength={10} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>GYM NAME</Text>
                <TextInput style={styles.modalInput} value={gymName} onChangeText={setGymName} placeholder="Enter gym name..." placeholderTextColor={colors.textMuted} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>GYM ADDRESS</Text>
                <TextInput style={styles.modalInput} value={address} onChangeText={setAddress} placeholder="Enter full address..." placeholderTextColor={colors.textMuted} />
              </View>

              <View style={{ flexDirection: 'row', gap: 15 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>PLAN MONTHS</Text>
                  <TextInput style={styles.modalInput} value={duration} keyboardType="number-pad" onChangeText={setDuration} placeholder="e.g. 1, 3, 12" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>BILLING AMOUNT (₹)</Text>
                  <TextInput style={styles.modalInput} value={price} keyboardType="numeric" onChangeText={setPrice} placeholder="e.g. 1500" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>CUSTOM EXPIRY DATE (OPTIONAL)</Text>
                <TouchableOpacity 
                  onPress={() => { setDatePickerType('register'); setShowDatePicker(true); }}
                  style={[styles.modalInput, { justifyContent: 'center' }]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: planExpiry ? colors.text : colors.textMuted }}>
                      {planExpiry || 'Select custom date (Overrides months)...'}
                    </Text>
                    <FontAwesome name="calendar" size={16} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleRegisterGym}>
                <Text style={styles.submitBtnText}>Create Separate Gym Database 🚀</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* RENEW SUBSCRIPTION PLAN MODAL */}
      <Modal visible={renewModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Renew Gym Subscription 📅</Text>
              <TouchableOpacity onPress={() => setRenewModal(false)}>
                <FontAwesome name="times-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 5 }}>
                Renew subscription for: <Text style={{ fontWeight: '700', color: colors.text }}>{selectedGym?.gym_name}</Text>
              </Text>

              <View style={{ flexDirection: 'row', gap: 15, marginBottom: 10 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>PLAN DURATION (MONTHS)</Text>
                  <TextInput style={styles.modalInput} value={renewDuration} keyboardType="number-pad" onChangeText={setRenewDuration} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>RENEWAL PRICE (₹)</Text>
                  <TextInput style={styles.modalInput} value={renewPrice} keyboardType="numeric" onChangeText={setRenewPrice} />
                </View>
              </View>

              <View style={[styles.inputGroup, { marginBottom: 10 }]}>
                <Text style={styles.label}>CUSTOM EXPIRY DATE (OPTIONAL)</Text>
                <TouchableOpacity 
                  onPress={() => { setDatePickerType('renew'); setShowDatePicker(true); }}
                  style={[styles.modalInput, { justifyContent: 'center' }]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: renewPlanExpiry ? colors.text : colors.textMuted }}>
                      {renewPlanExpiry || 'Select custom date (Overrides months)...'}
                    </Text>
                    <FontAwesome name="calendar" size={16} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleRenewSubmit}>
                <Text style={styles.submitBtnText}>Confirm Subscription Extension ✅</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* WHATSAPP CUSTOM MESSAGE MODAL */}
      <Modal visible={whatsappModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send WhatsApp Notice 💬</Text>
              <TouchableOpacity onPress={() => setWhatsappModal(false)}>
                <FontAwesome name="times-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 5 }}>
                Recipient: <Text style={{ fontWeight: '700', color: colors.text }}>{selectedGym?.owner_name} ({selectedGym?.gym_name})</Text>
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>CUSTOM MESSAGE BODY</Text>
                <TextInput 
                  style={[styles.modalInput, { height: 120, textAlignVertical: 'top' }]} 
                  value={customMsg} 
                  onChangeText={setCustomMsg} 
                  multiline 
                  placeholder="Bhai, message yahan type karein..." 
                  placeholderTextColor={colors.textMuted} 
                />
              </View>

              <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: colors.accent }]} onPress={handleSendCustomMessage}>
                <Text style={styles.submitBtnText}>Log & Send Notice 🚀</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* WHATSAPP LOGS VIEW MODAL */}
      <Modal visible={logsModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { maxHeight: '80%', padding: spacing.m }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Global Message Logs 📂</Text>
              <TouchableOpacity onPress={() => setLogsModal(false)}>
                <FontAwesome name="times-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={whatsappLogs}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
              renderItem={({ item }) => (
                <View style={styles.logCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
                        {item.gym_name && item.gym_name !== 'N/A' ? `${item.gym_name} (${item.owner_name})` : 'Unknown Gym'}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 1 }}>
                        {item.phone} • {item.type?.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 9 }}>{formatLogDate(item.logged_at)}</Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16 }} numberOfLines={3}>{item.message}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8 }}>
                    <TouchableOpacity 
                      style={[styles.smallBtn, { backgroundColor: item.sent ? 'rgba(16,185,129,0.15)' : colors.primary }]}
                      onPress={async () => {
                        try {
                          await api.post(`/super-admin/whatsapp-logs/${item._id}/sent`);
                          await sendWhatsAppMessage(item.phone, item.message);
                          // Refresh logs
                          const freshRes = await api.get('/super-admin/whatsapp-logs');
                          setWhatsappLogs(freshRes.data);
                        } catch (e) {
                          console.log('Failed to mark log sent', e);
                        }
                      }}
                    >
                      <Text style={{ color: item.sent ? colors.accent : '#fff', fontSize: 9, fontWeight: '700' }}>
                        {item.sent ? '✓ SENT AGAIN' : '➤ SEND VIA WHATSAPP'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={() => (
                <Text style={{ color: colors.textMuted, textAlign: 'center', marginVertical: 30 }}>No messages logged yet.</Text>
              )}
            />
          </View>
        </View>
      </Modal>

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(date) => {
          if (datePickerType === 'register') {
            setPlanExpiry(date);
          } else {
            setRenewPlanExpiry(date);
          }
        }}
        initialDate={datePickerType === 'register' ? (planExpiry || new Date().toISOString().split('T')[0]) : (renewPlanExpiry || new Date().toISOString().split('T')[0])}
        title="Select Expiry Date"
      />

    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inputGroup: {},
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    paddingTop: 56, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border 
  },
  badgeIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.m,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)'
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 10, color: colors.textMuted },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,   // NEVER compress — always show all 3 buttons
    marginLeft: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight
  },
  scrollContent: { padding: spacing.m, paddingBottom: 60 },
  statsScroll: { gap: 10, paddingBottom: 10 },
  statsCard: {
    width: 140,
    padding: spacing.m,
    borderRadius: borderRadius.m,
    minHeight: 80,
    justifyContent: 'center'
  },
  statsNum: { fontSize: 24, fontWeight: '800', color: colors.text },
  statsLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  actionBar: { 
    flexDirection: 'row', 
    gap: 10, 
    alignItems: 'center', 
    marginTop: spacing.m, 
    marginBottom: spacing.l 
  },
  searchBar: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.surfaceLight, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: borderRadius.m, 
    paddingHorizontal: spacing.s, 
    height: 42 
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13 },
  registerBtn: { 
    backgroundColor: colors.primary, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingHorizontal: spacing.m, 
    height: 42, 
    borderRadius: borderRadius.m,
    ...shadows.premium 
  },
  registerBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: spacing.m, letterSpacing: 0.5 },
  gymCard: { padding: spacing.m, marginBottom: spacing.m },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 },
  gymName: { fontSize: 18, fontWeight: '800', color: colors.text },
  ownerText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  securityBlock: { backgroundColor: colors.surfaceLight, padding: 10, borderRadius: borderRadius.s, borderLeftColor: colors.primary, borderLeftWidth: 2, marginVertical: spacing.s, gap: 4 },
  securityRow: { flexDirection: 'row', alignItems: 'center' },
  securityLabel: { color: colors.textSecondary, fontSize: 11 },
  securityVal: { color: colors.text, fontSize: 11, fontWeight: '700' },
  metaBlock: { gap: 6, marginVertical: spacing.s },
  metaText: { fontSize: 12, color: colors.textSecondary },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 5 },
  cardActionBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 4, 
    paddingVertical: 8, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 8,
    marginHorizontal: 3,
    backgroundColor: colors.surfaceLight
  },
  cardActionText: { fontSize: 10, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.l },
  modalContent: { 
    backgroundColor: colors.surface, 
    borderWidth: 1, 
    borderColor: colors.border, 
    padding: spacing.l, 
    borderRadius: borderRadius.l 
  },
  label: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: colors.textSecondary, 
    marginBottom: 8, 
    letterSpacing: 0.5 
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12, marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  formContent: { gap: spacing.m },
  modalInput: { backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.m, color: colors.text, paddingHorizontal: spacing.m, height: 44, fontSize: 14 },
  modalSubmitBtn: { backgroundColor: colors.primary, height: 46, borderRadius: borderRadius.m, alignItems: 'center', justifyContent: 'center', marginTop: 10, ...shadows.premium },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  logCard: { backgroundColor: colors.surface, padding: 10, borderRadius: borderRadius.s, borderWidth: 1, borderColor: colors.border },
  smallBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
});
