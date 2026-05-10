import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Linking, Alert, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { api } from '../services/api';

export const RemindersScreen = () => {
  const [dueMembers, setDueMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDueMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/members/status/due?days_ahead=30');
      setDueMembers(res.data);
    } catch (error) {
      console.error('Fetch error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDueMembers(); }, []);

  const sendReminder = async (member: any) => {
    const message = `Hello ${member.full_name}, your membership is due soon. Please renew!`;
    const url = `whatsapp://send?phone=${member.phone}&text=${encodeURIComponent(message)}`;
    await Linking.openURL(url);
  };

  const renderItem = ({ item }: { item: any }) => (
    <GlassCard style={styles.card}>
      <View style={{flex: 1}}>
        <Text style={styles.name}>{item.full_name}</Text>
        <Text style={styles.due}>Due: {new Date(item.next_due_date).toLocaleDateString()}</Text>
      </View>
      <View style={{width: 80}}><GradientButton title="Send" onPress={() => sendReminder(item)} /></View>
    </GlassCard>
  );

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Reminders</Text>
        {loading ? <ActivityIndicator size="large" color={colors.primary} /> : (
          <FlatList data={dueMembers} keyExtractor={(m) => m._id} renderItem={renderItem} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 20 },
  card: { padding: 15, marginBottom: 15, flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  due: { fontSize: 14, color: '#f87171' },
});
