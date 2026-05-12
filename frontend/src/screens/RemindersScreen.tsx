import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Linking, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export const RemindersScreen = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDueMembers = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/members/status/due?days_ahead=30');
      setMembers(res.data);
    } catch (error) {
      console.warn('Reminders fetch failed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDueMembers();

      // Auto-refresh every 60 seconds while focused
      const interval = setInterval(fetchDueMembers, 60000);

      return () => clearInterval(interval);
    }, [fetchDueMembers])
  );

  const sendReminder = async (member: any) => {
    const message = `Hello ${member.full_name} 💪\n\nThis is a gentle reminder from Fitness Hub that your membership is due for renewal on ${new Date(member.next_due_date).toLocaleDateString()}.\n\nPlease renew to continue your transformation journey! 🚀`;
    const url = `whatsapp://send?phone=${member.phone}&text=${encodeURIComponent(message)}`;
    
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
        Alert.alert('WhatsApp Error', 'WhatsApp app not found on this device. Please install it first.');
      }
    } catch (error: any) {
      console.error('Log or Link failed', error);
      Alert.alert(
        'Warning',
        'Could not complete the action. The number might be invalid or WhatsApp is not responding.',
        [{ text: 'Try Anyway', onPress: () => Linking.openURL(url).catch(() => Alert.alert('Error', 'Invalid WhatsApp Number or Link')) }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={members}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDueMembers} tintColor={colors.primary} />}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={styles.title}>Due Reminders</Text>
            <Text style={styles.subtitle}>1-click reminders for upcoming renewals</Text>
          </View>
        )}
        renderItem={({ item }) => (
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
            <TouchableOpacity style={styles.actionBtn} onPress={() => sendReminder(item)}>
              <FontAwesome name="whatsapp" size={20} color={colors.success} />
            </TouchableOpacity>
          </GlassCard>
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
