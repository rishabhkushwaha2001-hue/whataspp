import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export const MemberSummaryScreen = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  useEffect(() => {
    const fetchMember = async () => {
      const cleanId = Array.isArray(id) ? id[0] : id;
      if (!cleanId || cleanId === 'undefined') {
        console.error('Invalid ID passed to Summary:', cleanId);
        setLoading(false);
        return;
      }

      console.log(`📡 Fetching member details from: /members/${cleanId}`);
      try {
        const res = await api.get(`/members/${cleanId}`);
        setMember(res.data);
      } catch (error: any) {
        console.error('❌ Member details fetch failed:', error.response?.data || error.message);
        setAlertConfig({ visible: true, title: "Error", message: `Could not load details for ID: ${cleanId}`, type: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchMember();
  }, [id]);

  if (loading) return <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />;
  if (!member) return <View style={styles.container}><Text style={styles.text}>Member not found</Text></View>;

  const expiryDate = new Date(member.next_due_date);
  const daysRemaining = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
  const isExpired = daysRemaining < 0;

  const handleDelete = () => {
    setAlertConfig({
      visible: true,
      title: "Delete Member",
      message: `Are you sure you want to permanently delete ${member?.full_name}?\n\nThis will remove all their payment history and data.`,
      type: "warning",
      showCancel: true,
      confirmText: "Delete",
      onConfirm: async () => {
        setAlertConfig({ visible: false });
        try {
          await api.delete(`/members/${member._id}`);
          setTimeout(() => {
            setAlertConfig({ 
              visible: true, title: "Deleted", message: "Member has been deleted.", type: "success", 
              onClose: () => { setAlertConfig({visible: false}); router.back(); }
            });
          }, 500);
        } catch (error) {
          setTimeout(() => {
            setAlertConfig({ visible: true, title: "Error", message: "Could not delete member.", type: "error" });
          }, 500);
        }
      }
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <CustomAlert 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        showCancel={alertConfig.showCancel}
        confirmText={alertConfig.confirmText}
        onClose={alertConfig.onClose || (() => setAlertConfig({ ...alertConfig, visible: false }))}
        onConfirm={alertConfig.onConfirm}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="chevron-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { flex: 1 }]}>Member Summary</Text>
        <TouchableOpacity onPress={handleDelete} style={{ padding: 8 }}>
          <FontAwesome name="trash" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <GlassCard style={styles.profileCard}>
        <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{member.full_name.charAt(0)}</Text>
        </LinearGradient>
        <Text style={styles.name}>{member.full_name}</Text>
        <Text style={styles.idText}>{member.member_id} • {member.category}</Text>
        
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: isExpired ? `${colors.error}20` : `${colors.success}20` }]}>
            <Text style={[styles.badgeText, { color: isExpired ? colors.error : colors.success }]}>
              {isExpired ? 'Expired' : 'Active'}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{member.plan_duration_months} Month Plan</Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.row}>
        <GlassCard style={styles.infoBox}>
          <Text style={styles.infoLabel}>Days Remaining</Text>
          <Text style={[styles.infoValue, { color: daysRemaining < 5 ? colors.error : colors.text }]}>
            {daysRemaining > 0 ? daysRemaining : 0}
          </Text>
        </GlassCard>
        <GlassCard style={styles.infoBox}>
          <Text style={styles.infoLabel}>Total Spent</Text>
          <Text style={[styles.infoValue, { color: colors.accent }]}>
            ₹{member.payment_history?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0}
          </Text>
        </GlassCard>
      </View>

      <Text style={styles.sectionTitle}>Personal Details</Text>
      <GlassCard style={styles.detailsCard}>
        <DetailItem icon="phone" label="Phone" value={member.phone} />
        <DetailItem icon="map-marker" label="Address" value={member.address} />
        <DetailItem icon="calendar" label="Joining Date" value={new Date(member.joining_date).toLocaleDateString()} />
        <DetailItem icon="user" label="Trainer" value={member.trainer_assigned || 'General'} />
        <View style={styles.row}>
          <DetailItem icon="birthday-cake" label="Age" value={member.age || 'N/A'} half />
          <DetailItem icon="balance-scale" label="Weight" value={member.weight ? `${member.weight} kg` : 'N/A'} half />
        </View>
      </GlassCard>

      <Text style={styles.sectionTitle}>Payment History</Text>
      <View style={styles.timeline}>
        {member.payment_history?.slice().reverse().map((payment: any, index: number) => (
          <View key={index} style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            <GlassCard style={styles.timelineCard}>
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineAmount}>₹{payment.amount}</Text>
                <Text style={styles.timelineDate}>{new Date(payment.date).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.timelineText}>{payment.plan_months} Month Plan • {payment.payment_mode}</Text>
            </GlassCard>
          </View>
        ))}
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
    </View>
  );
};

const DetailItem = ({ icon, label, value, half }: any) => (
  <View style={[styles.detailItem, half && { flex: 1 }]}>
    <View style={styles.detailIcon}>
      <FontAwesome name={icon} size={14} color={colors.primary} />
    </View>
    <View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.m, paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.l },
  backBtn: { padding: 8, marginRight: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  profileCard: { padding: spacing.l, alignItems: 'center', marginBottom: spacing.m },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.m },
  avatarText: { color: 'white', fontSize: 32, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  idText: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.m },
  badgeContainer: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.full },
  badgeText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.m, marginBottom: spacing.m },
  infoBox: { flex: 1, padding: spacing.m, alignItems: 'center' },
  infoLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  infoValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginVertical: spacing.m },
  detailsCard: { padding: spacing.m },
  detailItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.m },
  detailIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  detailLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' },
  detailValue: { fontSize: 15, color: colors.text, fontWeight: '600' },
  timeline: { paddingLeft: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: spacing.m },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 20, marginRight: 16, zIndex: 1 },
  timelineCard: { flex: 1, padding: spacing.m },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  timelineAmount: { fontSize: 16, fontWeight: '800', color: colors.text },
  timelineDate: { fontSize: 12, color: colors.textSecondary },
  timelineText: { fontSize: 13, color: colors.textMuted },
  text: { color: colors.text, textAlign: 'center', marginTop: 100 }
});
