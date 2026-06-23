import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTheme, spacing, borderRadius } from '../../src/theme/theme';
import { GlassCard } from '../../src/components/GlassCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function StudentDashboard() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [gymName, setGymName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [memberData, setMemberData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    const n = await AsyncStorage.getItem('memberName');
    const g = await AsyncStorage.getItem('gymName');
    const b = await AsyncStorage.getItem('businessType');
    const phone = await AsyncStorage.getItem('memberPhone');
    if (n) setName(n);
    if (g) setGymName(g);
    if (b) setBusinessType(b);
    
    if (phone) {
      try {
        const { api } = require('../../src/services/api');
        const res = await api.get(`/members/${phone}`);
        setMemberData(res.data);
        if (res.data.payment_history) {
          setPayments(res.data.payment_history.reverse());
        }
      } catch (e) {
        console.warn('Failed to load member data in dashboard');
      }
    }
    
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
    >
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
        <Text style={[styles.name, { color: colors.text }]}>{name || 'Student'}</Text>
      </View>

      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <FontAwesome name={businessType === 'library' ? 'book' : 'building'} size={24} color={colors.primary} />
          <View style={styles.textWrap}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{gymName}</Text>
            <Text style={{ color: colors.textSecondary }}>Active Membership</Text>
          </View>
        </View>
      </GlassCard>

      {businessType === 'library' && (
        <>
          <GlassCard style={styles.card}>
            <View style={styles.row}>
              <FontAwesome name="bookmark" size={24} color={colors.secondary || '#8b5cf6'} />
              <View style={styles.textWrap}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Your Seat</Text>
                <Text style={{ color: colors.textSecondary }}>{memberData?.allocated_seat || 'Unassigned'}</Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.card}>
            <View style={styles.row}>
              <FontAwesome name="clock-o" size={24} color={colors.accent || '#10b981'} />
              <View style={styles.textWrap}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Timings</Text>
                <Text style={{ color: colors.textSecondary }}>{memberData?.timing || 'N/A'}</Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.card}>
            <View style={styles.row}>
              <FontAwesome name="wifi" size={24} color={colors.primary} />
              <View style={styles.textWrap}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Wi-Fi Access</Text>
                <Text style={{ color: colors.textSecondary }}>{memberData?.wifi_details || 'N/A'}</Text>
              </View>
            </View>
          </GlassCard>
        </>
      )}

      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <FontAwesome name="calendar" size={24} color="#f59e0b" />
          <View style={styles.textWrap}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Plan Expiry</Text>
            <Text style={{ color: colors.textSecondary }}>Valid till: {memberData?.next_due_date ? new Date(memberData.next_due_date).toLocaleDateString() : 'N/A'}</Text>
          </View>
        </View>
      </GlassCard>

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.l }]}>Payment History</Text>
      {payments.length > 0 ? payments.map((p, index) => (
        <GlassCard key={index} style={[styles.card, { padding: spacing.m, marginBottom: spacing.s }] as any}>
          <View style={styles.historyRow}>
            <View>
              <Text style={[styles.historyType, { color: colors.text }]}>{p.type || 'Payment'}</Text>
              <Text style={styles.historyDate}>{new Date(p.date).toLocaleDateString()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.historyAmount, { color: colors.success }]}>₹{p.amount}</Text>
              <Text style={styles.historyMode}>{p.payment_mode}</Text>
            </View>
          </View>
        </GlassCard>
      )) : (
        <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.m }}>No payment history available.</Text>
      )}
      
      <View style={{ height: 100 }} />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.l,
    paddingTop: 60,
  },
  header: {
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '600',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  card: {
    padding: spacing.l,
    marginBottom: spacing.m,
    borderRadius: borderRadius.l,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  textWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.m,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyType: {
    fontSize: 15,
    fontWeight: '700',
  },
  historyDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  historyMode: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  }
});
