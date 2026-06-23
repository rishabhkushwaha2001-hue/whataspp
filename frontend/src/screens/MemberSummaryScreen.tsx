import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomAlert } from '../components/CustomAlert';
import { EditMemberModal } from '../components/EditMemberModal';
import { api } from '../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export const MemberSummaryScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

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

  const { id, name, mid, cat } = useLocalSearchParams<{ id: string, name?: string, mid?: string, cat?: string }>();
  const router = useRouter();
  
  // Initialize with params if available to show data instantly
  const [member, setMember] = useState<any>(name ? {
    full_name: name,
    member_id: mid,
    category: cat,
    _id: id
  } : null);
  
  const [loading, setLoading] = useState(!name);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [businessType, setBusinessType] = useState('gym');
  const [editModalVisible, setEditModalVisible] = useState(false);

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
    
    AsyncStorage.getItem('businessType').then(type => {
      if (type) setBusinessType(type);
    });
  }, [id]);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
  if (!member) return <View style={styles.container}><Text style={styles.text}>Member not found</Text></View>;

  const expiryDate = member?.next_due_date ? new Date(member.next_due_date) : null;
  const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 0;
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
        <TouchableOpacity onPress={() => setEditModalVisible(true)} style={{ padding: 8, marginRight: 4 }}>
          <FontAwesome name="pencil" size={18} color={colors.primary} />
        </TouchableOpacity>
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

        <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: spacing.l, paddingTop: spacing.m, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Joining Date</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              {member.joining_date ? new Date(member.joining_date).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Plan Ending</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: isExpired ? colors.error : colors.text }}>
              {expiryDate ? expiryDate.toLocaleDateString() : 'N/A'}
            </Text>
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
        <DetailItem icon="phone" label="Phone" value={member.phone || 'N/A'} />
        <DetailItem icon="map-marker" label="Address" value={member.address || 'N/A'} />
        <DetailItem icon="calendar" label="Joining Date" value={member.joining_date ? new Date(member.joining_date).toLocaleDateString() : 'N/A'} />
        {businessType !== 'library' && (
          <DetailItem icon="user" label="Trainer" value={member.trainer_assigned || 'General'} />
        )}
        <View style={styles.row}>
          <DetailItem icon="birthday-cake" label="Age" value={member.age || 'N/A'} half />
          <DetailItem icon="balance-scale" label="Weight" value={member.weight ? `${member.weight} kg` : 'N/A'} half />
        </View>
        {(member.daily_hours || member.timing) && (
          <View style={styles.row}>
            {member.daily_hours && <DetailItem icon="clock-o" label="Daily Hours" value={`${member.daily_hours} Hrs`} half={true} />}
            {member.timing && <DetailItem icon="sun-o" label="Timing" value={member.timing} half={true} />}
          </View>
        )}
        {/* Seat Info */}
        {member.allocated_seat && (
          <View style={[styles.seatWifiBanner, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
                <FontAwesome name="map-pin" size={14} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.bannerLabel, { color: colors.textMuted }]}>Allocated Seat</Text>
                <Text style={[styles.bannerValue, { color: colors.primary }]}>{member.allocated_seat}</Text>
              </View>
            </View>
          </View>
        )}
        {/* WiFi Info */}
        {member.wifi_details && (
          <View style={[styles.seatWifiBanner, { backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}30`, marginTop: spacing.s }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.accent}20` }]}>
                <FontAwesome name="wifi" size={14} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bannerLabel, { color: colors.textMuted }]}>WiFi Details</Text>
                <Text style={[styles.bannerValue, { color: colors.accent }]} numberOfLines={2}>{member.wifi_details}</Text>
              </View>
            </View>
          </View>
        )}
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

    {/* Edit Member Modal */}
    <EditMemberModal
      visible={editModalVisible}
      member={member}
      onClose={() => setEditModalVisible(false)}
      onSaved={(updated) => {
        setMember({ ...member, ...updated });
        setEditModalVisible(false);
      }}
    />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
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
  text: { color: colors.text, textAlign: 'center', marginTop: 100 },
  seatWifiBanner: {
    borderRadius: borderRadius.m,
    borderWidth: 1,
    padding: spacing.m,
    marginTop: spacing.m,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bannerValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
});
