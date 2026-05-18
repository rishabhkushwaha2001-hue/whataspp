import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Linking, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export const RemindersScreen = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [gymName, setGymName] = useState('MBUDDY GYM');
  const router = useRouter();

  const applyFilters = useCallback((data: any[], searchText: string) => {
    let filtered = data;
    if (searchText) {
      filtered = filtered.filter(m => 
        m.full_name.toLowerCase().includes(searchText.toLowerCase()) || 
        m.phone.includes(searchText) ||
        m.member_id?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    setFilteredMembers(filtered);
  }, []);

  const fetchDueMembers = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/members/status/due?days_ahead=5');
      setMembers(res.data);
      
      // Apply filters locally on fresh data
      let filtered = res.data;
      if (search) {
        filtered = res.data.filter((m: any) => 
          m.full_name.toLowerCase().includes(search.toLowerCase()) || 
          m.phone.includes(search) ||
          m.member_id?.toLowerCase().includes(search.toLowerCase())
        );
      }
      setFilteredMembers(filtered);
    } catch (error) {
      console.warn('Reminders fetch failed');
    } finally {
      setRefreshing(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      fetchDueMembers();

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

      // Auto-refresh every 60 seconds while focused
      const interval = setInterval(fetchDueMembers, 60000);

      return () => clearInterval(interval);
    }, [fetchDueMembers])
  );

  const handleSearch = (text: string) => {
    setSearch(text);
    applyFilters(members, text);
  };

  const sendReminder = async (member: any) => {
    const dueDate = new Date(member.next_due_date).toLocaleDateString();
    const message = 
      `*${gymName.toUpperCase()} - RENEWAL REMINDER* 🔔\n\n` +
      `Hello *${member.full_name}* 💪,\n\n` +
      `We hope you're crushing your fitness goals! This is a friendly reminder that your membership is due for renewal.\n\n` +
      `*DUE DATE:* ${dueDate} 📅\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*Don't break the momentum!* Secure your spot and continue your transformation journey today. 🚀\n\n` +
      `See you at the gym! 🏋️‍♂️`;
    const whatsappPhone = member.phone.length === 10 ? '91' + member.phone : member.phone;
    const url = `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(message)}`;
    
    try {
      await api.post('/messages/log', {
        recipient_phone: member.phone,
        message_body: message,
        status: 'sent'
      });
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        setAlertConfig({ visible: true, title: 'WhatsApp Error', message: 'WhatsApp app not found on this device. Please install it first.', type: 'error' });
      }
    } catch (error: any) {
      console.error('Log or Link failed', error);
      setAlertConfig({
        visible: true,
        title: 'Warning',
        message: 'Could not complete the action. The number might be invalid or WhatsApp is not responding.',
        type: 'warning',
        showCancel: true,
        cancelText: 'Cancel',
        confirmText: 'Try Anyway',
        onConfirm: () => {
          setAlertConfig({ visible: false });
          setTimeout(() => {
            Linking.openURL(url).catch(() => {
              setAlertConfig({ visible: true, title: 'Error', message: 'Invalid WhatsApp Number or Link', type: 'error' });
            });
          }, 500);
        }
      });
    }
  };

  const [renewalDuration, setRenewalDuration] = useState('1');

  const handleRenew = (member: any) => {
    const initialDuration = member.plan_duration_months?.toString() || '1';
    setRenewalDuration(initialDuration);

    const amountPerMonth = (member.monthly_fees || 0) / (member.plan_duration_months || 1);

    const confirmRenewal = (selectedDur: string) => {
      const finalAmount = amountPerMonth * parseInt(selectedDur);
      
      setAlertConfig({
        visible: true,
        title: "Renew Membership",
        message: `Renew ${member.full_name} for ${selectedDur} month(s)?\n\nTotal Amount: ₹${finalAmount}`,
        type: "info",
        showCancel: true,
        confirmText: "Yes, Renew",
        onConfirm: async () => {
          setAlertConfig({ visible: false });
          try {
            const res = await api.post(`/members/${member.id || member._id}/renew`, {
              plan_duration_months: parseInt(selectedDur),
              amount: finalAmount,
              payment_mode: "Cash"
            });
            
            fetchDueMembers();
            
            const nextDue = new Date(res.data.new_due_date).toLocaleDateString();
            const msg = `Hi ${member.full_name} 💪\n\nThank you for renewing your membership at ${gymName}! 🎉\n\nPayment Received: ₹${finalAmount}\nNew Expiry Date: ${nextDue}\n\nKeep crushing your goals! 🚀`;
            const whatsappPhone = member.phone.length === 10 ? '91' + member.phone : member.phone;
            const url = `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(msg)}`;
            
            setAlertConfig({
                visible: true, 
                title: "Success", 
                message: "Membership renewed successfully!", 
                type: "success",
                confirmText: "Send Receipt",
                onConfirm: () => {
                  setAlertConfig({ visible: false });
                  setTimeout(() => {
                    Linking.openURL(url).catch(() => console.log('WhatsApp error'));
                  }, 100);
                },
                onClose: () => setAlertConfig({ visible: false })
            });
          } catch (error) {
            setAlertConfig({ visible: true, title: "Error", message: "Failed to renew membership", type: "error" });
          }
        }
      });
    };

    setAlertConfig({
      visible: true,
      title: "Select Duration",
      message: `Bhai, kitne mahine ke liye renew karna hai?`,
      type: "info",
      showCancel: true,
      confirmText: "Continue",
      isRenewalPicker: true,
      renewalDuration: initialDuration,
      onConfirm: () => confirmRenewal(renewalDuration),
      onDurationSelect: (dur: string) => {
        setRenewalDuration(dur);
        // Update onConfirm reference with latest dur so picker button works
        setAlertConfig((prev: any) => ({
          ...prev,
          onConfirm: () => confirmRenewal(dur)
        }));
      }
    });
  };

  return (
    <View style={styles.container}>
      <CustomAlert 
        {...alertConfig} 
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      >
        {alertConfig.isRenewalPicker && (
          <View style={{ width: '100%', marginBottom: 20 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8, fontWeight: '700' }}>CHOOSE DURATION</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {['1', '2', '3', '6', '12'].map(dur => (
                <TouchableOpacity 
                  key={dur}
                  onPress={() => {
                    if (alertConfig.onDurationSelect) {
                      alertConfig.onDurationSelect(dur);
                    } else {
                      setRenewalDuration(dur);
                    }
                  }}
                  style={{
                    backgroundColor: renewalDuration === dur ? colors.primary : 'rgba(255,255,255,0.05)',
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    minWidth: 45,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: renewalDuration === dur ? '#fff' : 'rgba(255,255,255,0.7)', fontWeight: '700' }}>{dur}M</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </CustomAlert>
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id || item._id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDueMembers} tintColor={colors.primary} />}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={styles.title}>Due Reminders</Text>
            <Text style={styles.subtitle}>1-click reminders for upcoming renewals (5 days left)</Text>
            <View style={styles.searchBar}>
              <FontAwesome name="search" size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Search name, phone or ID..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                value={search}
                onChangeText={handleSearch}
              />
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/members/${item.id || item._id}`)}>
            <GlassCard style={styles.memberCard}>
              <View style={styles.infoContainer}>
                <View style={styles.mainInfo}>
                  <Text style={styles.memberName}>{item.full_name}</Text>
                  <View style={[styles.badge, { backgroundColor: item.remaining_days <= 0 ? `${colors.error}20` : `${colors.warning}20` }]}>
                    <Text style={[styles.badgeText, { color: item.remaining_days <= 0 ? colors.error : colors.warning }]}>
                      {item.remaining_days <= 0 ? 'EXPIRED' : `${item.remaining_days} DAYS LEFT`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.memberPhone}>{item.phone}</Text>
                <View style={styles.dueRow}>
                  <FontAwesome name="calendar" size={12} color={colors.textMuted} />
                  <Text style={styles.memberDue}>Expires: {new Date(item.next_due_date).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.dueRow, { marginTop: 4 }]}>
                  <FontAwesome name="money" size={12} color={colors.accent} />
                  <Text style={[styles.memberDue, { color: colors.text, fontWeight: '600' }]}>Rs. {item.monthly_fees} ({item.plan_duration_months}M)</Text>
                </View>
              </View>
              
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => sendReminder(item)}>
                  <FontAwesome name="whatsapp" size={20} color={colors.success} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]} 
                  onPress={() => handleRenew(item)}
                >
                  <FontAwesome name="refresh" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

            </GlassCard>
          </TouchableOpacity>
        )}

        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <FontAwesome name="check-circle" size={48} color={colors.accent} />
            </View>
            <Text style={styles.emptyText}>All members are up to date!</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingTop: 60, paddingBottom: 100 },
  header: { marginBottom: spacing.xl },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLight, borderRadius: borderRadius.m, paddingHorizontal: spacing.m, height: 44, borderWidth: 1, borderColor: colors.border, marginTop: spacing.m },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  memberCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.m, padding: spacing.m },
  infoContainer: { flex: 1 },
  mainInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  memberName: { fontSize: 18, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  memberPhone: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberDue: { fontSize: 12, color: colors.textMuted },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  emptyContainer: { marginTop: 80, alignItems: 'center' },
  emptyIcon: { marginBottom: spacing.m, opacity: 0.5 },
  emptyText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
});
