import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Switch, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { api } from '../services/api';
import { useAppAlert } from '../hooks/useAppAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { ModernInput } from '../components/ModernInput';
import { GradientButton } from '../components/GradientButton';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { DatePickerModal } from '../components/DatePickerModal';

const COLORS = ['#FFB020', '#EC4899', '#6366F1', '#10B981', '#F43F5E', '#8B5CF6'];

export const OffersScreen = () => {
  const router = useRouter();
  const { theme, colors } = useTheme();
  const styles = getStyles(colors);
  const { showSuccess, showError, showConfirm, AlertModal } = useAppAlert();
  
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState('Percentage'); // Percentage, Flat
  const [discountValue, setDiscountValue] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchOffers = async () => {
    try {
      const res = await api.get('/offers/');
      setOffers(res.data);
    } catch (e: any) {
      showError('Failed to fetch', e.response?.data?.detail || 'Could not load offers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOffers();
  };

  const openCreateModal = () => {
    setEditingOffer(null);
    setName('');
    setDescription('');
    setDiscountType('Percentage');
    setDiscountValue('');
    setValidUntil('');
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (offer: any) => {
    setEditingOffer(offer);
    setName(offer.name);
    setDescription(offer.description || '');
    setDiscountType(offer.discount_type || 'Percentage');
    setDiscountValue(offer.discount_value.toString());
    setValidUntil(offer.valid_until ? new Date(offer.valid_until).toISOString().split('T')[0] : '');
    setIsActive(offer.is_active);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !discountValue.trim()) {
      showError('Required Fields', 'Please enter offer name and discount value.');
      return;
    }
    
    setSaving(true);
    try {
      const payload: any = {
        name,
        description,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        is_active: isActive
      };
      
      if (validUntil) {
        payload.valid_until = new Date(validUntil).toISOString();
      }

      setShowModal(false);
      fetchOffers();
      setTimeout(() => {
        if (editingOffer) {
          showSuccess('Offer Updated', 'The offer has been updated successfully.');
        } else {
          showSuccess('Offer Created', 'New offer has been created successfully.');
        }
      }, 350);
    } catch (e: any) {
      showError('Error', e.response?.data?.detail || 'Failed to save offer.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/offers/${id}`);
      showSuccess('Deleted', 'Offer has been deleted.');
      fetchOffers();
    } catch (e: any) {
      showError('Error', e.response?.data?.detail || 'Failed to delete offer.');
    }
  };

  const confirmDelete = (id: string) => {
    showConfirm(
      'Delete Offer',
      'Are you sure you want to delete this offer? This cannot be undone.',
      () => handleDelete(id),
      'Delete',
      true
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <FontAwesome name="angle-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offers & Schemes</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <FontAwesome name="plus" size={16} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.heroContainer}>
          <LinearGradient colors={['#EC4899', '#F43F5E']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.heroBanner}>
             <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>Boost Sales with Offers! 🎉</Text>
                <Text style={styles.heroDesc}>Create exclusive discounts, schemes, and festival offers to attract more enrollments and fast renewals.</Text>
             </View>
             <FontAwesome name="gift" size={50} color="rgba(255,255,255,0.2)" style={styles.heroIcon} />
          </LinearGradient>
        </View>

        {offers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{fontSize: 48, marginBottom: 16}}>🎁</Text>
            <Text style={styles.emptyTitle}>No Offers Yet</Text>
            <Text style={styles.emptySub}>Create your first promotional offer to show to your members.</Text>
            <TouchableOpacity style={styles.createFirstBtn} onPress={openCreateModal}>
              <Text style={styles.createFirstBtnText}>Create Offer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          offers.map((offer, idx) => {
            const color = COLORS[idx % COLORS.length];
            return (
              <TouchableOpacity key={offer._id} style={styles.offerCard} onPress={() => openEditModal(offer)}>
                <View style={[styles.offerIconContainer, { backgroundColor: `${color}15` }]}>
                  <FontAwesome name="tag" size={24} color={color} />
                </View>
                <View style={styles.offerInfo}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <Text style={styles.offerName}>{offer.name}</Text>
                    {!offer.is_active && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveText}>Inactive</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.offerDesc}>{offer.description || 'No description provided.'}</Text>
                  
                  <View style={styles.offerMeta}>
                    <View style={styles.metaBadge}>
                      <FontAwesome name="percent" size={10} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{offer.discount_value}{offer.discount_type === 'Percentage' ? '%' : ' flat'} off</Text>
                    </View>
                    {offer.valid_until && (
                      <View style={[styles.metaBadge, {backgroundColor: 'rgba(239, 68, 68, 0.1)'}]}>
                        <FontAwesome name="clock-o" size={12} color="#EF4444" />
                        <Text style={[styles.metaText, {color: '#EF4444'}]}>Ends {new Date(offer.valid_until).toLocaleDateString()}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(offer._id)}>
                  <FontAwesome name="trash-o" size={18} color={colors.error} />
                </TouchableOpacity>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingOffer ? 'Edit Offer' : 'Create Offer'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeModalBtn}>
                <FontAwesome name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <KeyboardAwareScrollView style={styles.modalBody}>
              <ModernInput label="Offer Name *" value={name} onChangeText={setName} placeholder="e.g. Diwali Dhamaka" />
              <ModernInput label="Description (Optional)" value={description} onChangeText={setDescription} placeholder="Short details about the offer" multiline />
              
              <View style={styles.row}>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Discount Type</Text>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity 
                      style={[styles.typeBtn, discountType === 'Percentage' && { backgroundColor: colors.primary }]}
                      onPress={() => setDiscountType('Percentage')}
                    >
                      <Text style={[styles.typeBtnText, discountType === 'Percentage' && { color: 'white' }]}>% Percent</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.typeBtn, discountType === 'Flat' && { backgroundColor: colors.primary }]}
                      onPress={() => setDiscountType('Flat')}
                    >
                      <Text style={[styles.typeBtnText, discountType === 'Flat' && { color: 'white' }]}>₹ Flat</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{flex: 1, paddingLeft: spacing.m}}>
                  <ModernInput 
                    label="Value *" 
                    value={discountValue} 
                    onChangeText={setDiscountValue} 
                    placeholder={discountType === 'Percentage' ? "e.g. 20" : "e.g. 500"} 
                    keyboardType="numeric" 
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Valid Until (Optional)</Text>
              <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
                <Text style={{color: validUntil ? colors.text : colors.textMuted}}>
                  {validUntil ? new Date(validUntil).toLocaleDateString() : 'No Expiry (Lifetime)'}
                </Text>
                <FontAwesome name="calendar" size={16} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active Status</Text>
                <Switch 
                  value={isActive} 
                  onValueChange={setIsActive}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="white"
                />
              </View>
              
              <View style={{height: 100}} />
            </KeyboardAwareScrollView>
            
            <View style={styles.modalFooter}>
              <GradientButton title={saving ? "Saving..." : "Save Offer"} onPress={handleSave} disabled={saving} />
            </View>
          </View>
        </View>
      </Modal>
      
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(date) => setValidUntil(date)}
      />
      <AlertModal />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: colors.surface, ...shadows.light },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', ...shadows.medium },
  content: { padding: spacing.l, paddingBottom: 100 },
  heroContainer: { marginBottom: spacing.xl },
  heroBanner: { borderRadius: borderRadius.xl, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  heroTextContainer: { flex: 1, zIndex: 2 },
  heroTitle: { color: 'white', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  heroDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 20 },
  heroIcon: { position: 'absolute', right: 10, bottom: -5, zIndex: 1 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 40, marginBottom: 24, lineHeight: 20 },
  createFirstBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  createFirstBtnText: { color: 'white', fontWeight: '700' },
  offerCard: { backgroundColor: colors.surface, borderRadius: borderRadius.l, padding: spacing.l, marginBottom: spacing.m, flexDirection: 'row', alignItems: 'center', ...shadows.light, borderWidth: 1, borderColor: colors.border },
  offerIconContainer: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: spacing.m },
  offerInfo: { flex: 1 },
  offerName: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  inactiveBadge: { backgroundColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  inactiveText: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
  offerDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  offerMeta: { flexDirection: 'row', gap: 8 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  deleteBtn: { padding: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  closeModalBtn: { padding: 4 },
  modalBody: { padding: 24 },
  row: { flexDirection: 'row' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  typeSelector: { flexDirection: 'row', backgroundColor: colors.surfaceLight, borderRadius: borderRadius.m, padding: 4, borderWidth: 1, borderColor: colors.border, minHeight: 52, alignItems: 'center' },
  typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.s },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
  dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.m, paddingHorizontal: 16, minHeight: 52, backgroundColor: colors.surfaceLight },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, backgroundColor: colors.background, padding: 16, borderRadius: borderRadius.m },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  modalFooter: { padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
