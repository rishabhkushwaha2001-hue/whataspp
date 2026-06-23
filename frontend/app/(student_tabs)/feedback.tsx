import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTheme, spacing, borderRadius, shadows } from '../../src/theme/theme';
import { api } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassCard } from '../../src/components/GlassCard';

export default function StudentFeedback() {
  const { colors } = useTheme();
  const [category, setCategory] = useState('General');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberId, setMemberId] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('memberId').then(id => {
      if(id) setMemberId(id);
    });
  }, []);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setLoading(true);
    try {
      await api.post('/feedback', {
        member_id: memberId,
        category: category,
        message: message.trim()
      });
      Alert.alert('Success', 'Feedback submitted to Admin!');
      setMessage('');
    } catch (e: any) {
      Alert.alert('Error', 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>Submit Feedback</Text>
      
      <GlassCard style={styles.card}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Select Category</Text>
        <View style={styles.chipRow}>
          {['Cleanliness', 'Internet/AC', 'Noise', 'General'].map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.chip, category === cat && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setCategory(cat)}
            >
              <Text style={{ color: category === cat ? '#fff' : colors.text }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Your Message</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Describe your issue..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          value={message}
          onChangeText={setMessage}
        />

        <TouchableOpacity 
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit Feedback</Text>}
        </TouchableOpacity>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.l, paddingTop: 60 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: spacing.l },
  card: { padding: spacing.l, borderRadius: borderRadius.l },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: spacing.s, marginTop: spacing.m },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc' },
  input: { borderWidth: 1, borderRadius: borderRadius.m, padding: spacing.m, minHeight: 100, textAlignVertical: 'top', marginTop: 8 },
  btn: { padding: 15, borderRadius: borderRadius.m, alignItems: 'center', marginTop: spacing.xl, ...shadows.premium },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
