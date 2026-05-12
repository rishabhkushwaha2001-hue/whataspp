import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, Linking, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export const MembersScreen = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchMembers = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/members/');
      setMembers(res.data);
      setFilteredMembers(res.data);
    } catch (error) {
      console.warn('Fetch members failed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();

      // Auto-refresh every 60 seconds while focused
      const interval = setInterval(fetchMembers, 60000);

      return () => clearInterval(interval);
    }, [fetchMembers])
  );

  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text) {
      setFilteredMembers(members);
      return;
    }
    const filtered = members.filter(m => 
      m.full_name.toLowerCase().includes(text.toLowerCase()) || 
      m.phone.includes(text)
    );
    setFilteredMembers(filtered);
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string) => {
    Linking.openURL(`whatsapp://send?phone=${phone}`);
  };

  const renderMember = ({ item }: { item: any }) => (
    <GlassCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.memberAvatar}>
          <Text style={styles.avatarText}>{item.full_name.substring(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>{item.full_name}</Text>
          <Text style={styles.memberPlan}>{item.plan_type || 'Monthly'} • {item.plan_duration_months} Month(s)</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? `${colors.success}20` : `${colors.error}20` }]}>
          <Text style={[styles.statusText, { color: item.status === 'active' ? colors.success : colors.error }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailItem}>
          <FontAwesome name="calendar" size={12} color={colors.textMuted} />
          <Text style={styles.detailText}>Joined: {new Date(item.joining_date).toLocaleDateString()}</Text>
        </View>
        <View style={styles.detailItem}>
          <FontAwesome name="clock-o" size={12} color={colors.textMuted} />
          <Text style={styles.detailText}>Due: {new Date(item.next_due_date).toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleCall(item.phone)}>
          <FontAwesome name="phone" size={16} color={colors.primary} />
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleWhatsApp(item.phone)}>
          <FontAwesome name="whatsapp" size={16} color={colors.success} />
          <Text style={styles.actionText}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Export', 'Exporting member data to PDF...')}>
          <FontAwesome name="download" size={16} color={colors.textSecondary} />
          <Text style={styles.actionText}>PDF</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );

  const handleExport = () => {
    const exportUrl = `${api.defaults.baseURL}/members/export/csv`;
    Linking.openURL(exportUrl).catch(() => {
      Alert.alert('Error', 'Could not open export URL');
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Manage Members</Text>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
            <FontAwesome name="file-excel-o" size={16} color={colors.accent} />
            <Text style={styles.exportBtnText}>Excel</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchBar}>
          <FontAwesome name="search" size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search by name or phone..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      <FlatList
        data={filteredMembers}
        renderItem={renderMember}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchMembers} tintColor={colors.primary} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No members found.</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.l, paddingTop: 60, backgroundColor: colors.surface },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.m },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.s, borderWidth: 1, borderColor: colors.border },
  exportBtnText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.surfaceLight, 
    borderRadius: borderRadius.m, 
    paddingHorizontal: spacing.m, 
    height: 48,
    borderWidth: 1,
    borderColor: colors.border
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  listContent: { padding: spacing.m, paddingBottom: 100 },
  card: { padding: spacing.m, marginBottom: spacing.m },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.m },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: colors.primary, fontSize: 18, fontWeight: 'bold' },
  memberName: { fontSize: 18, fontWeight: '700', color: colors.text },
  memberPlan: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  cardDetails: { flexDirection: 'row', gap: 15, marginBottom: spacing.m, paddingBottom: spacing.m, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 11, color: colors.textSecondary },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  emptyContainer: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 16 },
});
