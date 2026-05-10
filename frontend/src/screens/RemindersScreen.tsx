import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Linking, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, borderRadius } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export const RemindersScreen = () => {
  const [members, setMembers] = useState([]);
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
    }, [fetchDueMembers])
  );

  const sendReminder = async (member: any) => {
    const message = `Hi ${member.full_name}, your gym fee is due on ${new Date(member.next_due_date).toLocaleDateString()}. Please pay to continue your workout!`;
    const url = `whatsapp://send?phone=${member.phone}&text=${encodeURIComponent(message)}`;
    
    try {
      await api.post('/messages/log', {
        recipient_phone: member.phone,
        message_body: message,
      });
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Could not log message to DB, but opening WhatsApp...');
      await Linking.openURL(url);
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
            <Text style={styles.title}>Fee Reminders</Text>
            <Text style={styles.subtitle}>Members with fees due in next 30 days</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <GlassCard style={styles.memberCard}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.full_name}</Text>
              <Text style={styles.memberDue}>Due: {new Date(item.next_due_date).toLocaleDateString()}</Text>
              <Text style={styles.memberPhone}>{item.phone}</Text>
            </View>
            <TouchableOpacity style={styles.whatsappButton} onPress={() => sendReminder(item)}>
              <FontAwesome name="whatsapp" size={24} color={colors.text} />
              <Text style={styles.buttonText}>Remind</Text>
            </TouchableOpacity>
          </GlassCard>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pending reminders found.</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingTop: 60 },
  header: { marginBottom: spacing.xl },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  memberCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.m, padding: spacing.m },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  memberDue: { fontSize: 12, color: colors.error, marginTop: 2 },
  memberPhone: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  whatsappButton: { backgroundColor: colors.success, flexDirection: 'row', alignItems: 'center', padding: spacing.s, paddingHorizontal: spacing.m, borderRadius: borderRadius.m, gap: 8 },
  buttonText: { color: colors.text, fontWeight: 'bold' },
  emptyContainer: { marginTop: 40, alignItems: 'center' },
  emptyText: { color: colors.textMuted },
});
