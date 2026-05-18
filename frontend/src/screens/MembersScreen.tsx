import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, Linking, Alert, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export const MembersScreen = () => {
  const router = useRouter();
  const [members, setMembers] = useState<any[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [renewalDuration, setRenewalDuration] = useState('1');
  const [gymName, setGymName] = useState('MBUDDY GYM');

  const fetchMembers = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/members/');
      setMembers(res.data);
      applyFilters(res.data, search, activeTab);
    } catch (error) {
      console.warn('Fetch members failed');
    } finally {
      setRefreshing(false);
    }
  }, [search, activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
      
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
    }, [fetchMembers])
  );

  const applyFilters = (data: any[], searchText: string, tab: string) => {
    let filtered = data;
    
    if (searchText) {
      filtered = filtered.filter(m => 
        m.full_name.toLowerCase().includes(searchText.toLowerCase()) || 
        m.phone.includes(searchText) ||
        m.member_id?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (tab === 'Active') {
      filtered = filtered.filter(m => m.status === 'active' && new Date(m.next_due_date) > new Date());
    } else if (tab === 'Expired') {
      filtered = filtered.filter(m => m.status === 'expired' || new Date(m.next_due_date) < new Date());
    } else if (tab === 'Manual') {
      filtered = filtered.filter(m => m.category === 'Manual');
    }

    setFilteredMembers(filtered);
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    applyFilters(members, text, activeTab);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    applyFilters(members, search, tab);
  };

  const handleRenew = (member: any) => {
    const initialDuration = member.plan_duration_months?.toString() || '1';
    setRenewalDuration(initialDuration);

    const amountPerMonth = (member.monthly_fees || 0) / (member.plan_duration_months || 1);
    const expiry = new Date(member.next_due_date);
    const daysRemaining = Math.ceil((expiry.getTime() - new Date().getTime()) / (1000 * 3600 * 24));

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
            
            fetchMembers();
            
            const nextDue = new Date(res.data.new_due_date).toLocaleDateString();
            const msg = 
              `*${gymName.toUpperCase()} - MEMBERSHIP RENEWED* 🔄\n\n` +
              `Hello *${member.full_name}*, thank you for continuing your journey with us! 💪\n\n` +
              `*RENEWAL DETAILS:*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🗓️ *New Plan:* ${selectedDur} Month(s)\n` +
              `💰 *Amount Paid:* ₹${finalAmount}\n` +
              `📅 *New Expiry:* ${nextDue}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n\n` +
              `*Let's push your limits again!* 🚀`;
            const whatsappPhone = member.phone.length === 10 ? '91' + member.phone : member.phone;
            const url = `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(msg)}`;
            
            setAlertConfig({
                visible: true, 
                title: "Success", 
                message: "Membership has been renewed successfully!", 
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

    const showRenewalPicker = () => {
      setAlertConfig({
        visible: true,
        title: "Select Duration",
        message: `Bhai, kitne mahine ke liye renew karna hai?`,
        type: "info",
        showCancel: true,
        confirmText: "Continue",
        isRenewalPicker: true,
        renewalDuration,
        setRenewalDuration,
        onConfirm: () => confirmRenewal(renewalDuration)
      });
    };

    if (daysRemaining > 10) {
      setAlertConfig({
        visible: true,
        title: "Already Active!",
        message: `Bhai, is user ka plan pehle se hi ${expiry.toLocaleDateString()} tak active hai (${daysRemaining} days left).\n\nKya aap sach mein renew karna chahte hain?`,
        type: "warning",
        showCancel: true,
        cancelText: "Nahi (Cancel)",
        confirmText: "Haan, continue",
        onConfirm: () => {
          setAlertConfig({ visible: false });
          setTimeout(showRenewalPicker, 200);
        }
      });
    } else {
      showRenewalPicker();
    }
  };

  const renderMember = ({ item }: { item: any }) => {
    const isExpired = new Date(item.next_due_date) < new Date();
    const memberId = item.id || item._id;
    
    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => router.push({
          pathname: `/members/${memberId}` as any,
          params: { 
            name: item.full_name, 
            mid: item.member_id, 
            cat: item.category || 'New'
          }
        })}
      >
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.memberAvatar, { backgroundColor: item.category === 'Renewal' ? `${colors.primary}20` : `${colors.accent}20` }]}>
              <Text style={[styles.avatarText, { color: item.category === 'Renewal' ? colors.primary : colors.accent }]}>
                {item.full_name.substring(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{item.full_name}</Text>
              <Text style={styles.memberId}>{item.member_id} • {item.category || 'New'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isExpired ? `${colors.error}20` : `${colors.success}20` }]}>
              <Text style={[styles.statusText, { color: isExpired ? colors.error : colors.success }]}>
                {isExpired ? 'EXPIRED' : 'ACTIVE'}
              </Text>
            </View>
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.detailItem}>
              <FontAwesome name="money" size={12} color={colors.accent} />
              <Text style={styles.detailText}>₹{item.monthly_fees}</Text>
            </View>
            <View style={styles.detailItem}>
              <FontAwesome name="clock-o" size={12} color={colors.primary} />
              <Text style={styles.detailText}>Due: {new Date(item.next_due_date).toLocaleDateString()}</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {
              const callPhone = item.phone.length > 10 && item.phone.startsWith('91') ? item.phone.substring(2) : item.phone;
              Linking.openURL(`tel:${callPhone}`);
            }}>
              <FontAwesome name="phone" size={14} color={colors.primary} />
              <Text style={styles.actionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {
              const whatsappPhone = item.phone.length === 10 ? '91' + item.phone : item.phone;
              Linking.openURL(`whatsapp://send?phone=${whatsappPhone}`);
            }}>
              <FontAwesome name="whatsapp" size={14} color={colors.success} />
              <Text style={styles.actionText}>WhatsApp</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: `${colors.primary}15`, paddingHorizontal: 12, borderRadius: 20 }]} 
              onPress={() => handleRenew(item)}
            >
              <FontAwesome name="refresh" size={12} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary, fontWeight: '700' }]}>Renew</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };


  return (
    <View style={styles.container}>
      <CustomAlert 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        showCancel={alertConfig.showCancel}
        cancelText={alertConfig.cancelText}
        confirmText={alertConfig.confirmText}
        onClose={alertConfig.onClose || (() => setAlertConfig({ ...alertConfig, visible: false }))}
        onConfirm={alertConfig.onConfirm}
      >
        {alertConfig.isRenewalPicker && (
          <View style={{ width: '100%', marginBottom: 15, marginTop: -10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 10, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 }}>CHOOSE DURATION</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {['1', '2', '3', '6', '12'].map(dur => (
                <TouchableOpacity 
                  key={dur}
                  onPress={() => {
                    setRenewalDuration(dur);
                    setAlertConfig({ ...alertConfig, onConfirm: () => confirmRenewal(dur) });
                  }}
                  style={{
                    backgroundColor: renewalDuration === dur ? colors.primary : 'rgba(255,255,255,0.06)',
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    minWidth: 44,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: renewalDuration === dur ? colors.primary : 'rgba(255,255,255,0.1)'
                  }}
                >
                  <Text style={{ color: renewalDuration === dur ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800' }}>{dur}M</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </CustomAlert>
      <View style={styles.header}>
        <Text style={styles.title}>Members List</Text>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          {['All', 'Active', 'Expired', 'Manual'].map(tab => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tab, activeTab === tab && styles.activeTab]} 
              onPress={() => handleTabChange(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredMembers}
        renderItem={renderMember}
        keyExtractor={item => item.id || item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchMembers} tintColor={colors.primary} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <FontAwesome name="users" size={48} color={colors.surfaceLight} />
            <Text style={styles.emptyText}>No members match your filter.</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.l, paddingTop: 60, backgroundColor: colors.surface },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.m },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLight, borderRadius: borderRadius.m, paddingHorizontal: spacing.m, height: 44, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.m },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  tabsContainer: { flexDirection: 'row', marginBottom: -spacing.l / 2 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: borderRadius.full, backgroundColor: colors.surfaceLight },
  activeTab: { backgroundColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  activeTabText: { color: 'white' },
  listContent: { padding: spacing.m, paddingBottom: 100 },
  card: { padding: spacing.m, marginBottom: spacing.m },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.m },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: 'bold' },
  memberName: { fontSize: 18, fontWeight: '700', color: colors.text },
  memberId: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  cardDetails: { flexDirection: 'row', gap: 20, marginBottom: spacing.m, paddingBottom: spacing.m, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  emptyContainer: { marginTop: 100, alignItems: 'center', gap: 12 },
  emptyText: { color: colors.textMuted, fontSize: 16 },
});
