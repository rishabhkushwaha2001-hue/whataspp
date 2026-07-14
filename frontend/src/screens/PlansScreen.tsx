import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Switch, ActivityIndicator, Platform, RefreshControl, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { api } from '../services/api';
import { useAppAlert } from '../hooks/useAppAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { ModernInput } from '../components/ModernInput';
import { GradientButton } from '../components/GradientButton';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const ICONS = ['crown', 'star', 'user', 'heart', 'star-o', 'bolt', 'diamond', 'fire'];
const COLORS = ['#FFB020', '#6366F1', '#A855F7', '#EC4899', '#3B82F6', '#10B981', '#F43F5E', '#8B5CF6'];

export const PlansScreen = () => {
  const router = useRouter();
  const { theme, colors } = useTheme();
  const styles = getStyles(colors);
  const { showSuccess, showError, AlertModal } = useAppAlert();
  
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All'); // All, Active, Inactive
  
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [planType, setPlanType] = useState('Individual');
  const [durationDays, setDurationDays] = useState('30');
  const [price, setPrice] = useState('');
  const [actualPrice, setActualPrice] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [isActive, setIsActive] = useState(true);
  const [features, setFeatures] = useState<string[]>(['Gym Access', 'Trainer Support']);
  const [newFeature, setNewFeature] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    try {
      const res = await api.get('/plans/');
      setPlans(res.data);
    } catch (e: any) {
      showError('Failed to fetch', e.response?.data?.detail || 'Could not load plans.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPlans();
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setName('');
    setDescription('');
    setPlanType('Individual');
    setDurationDays('30');
    setPrice('');
    setActualPrice('');
    setIcon(ICONS[0]);
    setColor(COLORS[0]);
    setIsActive(true);
    setFeatures(['Gym Access', 'Trainer Support']);
    setShowModal(true);
  };

  const openEditModal = (plan: any) => {
    setEditingPlan(plan);
    setName(plan.name);
    setDescription(plan.description || '');
    setPlanType(plan.type || 'Individual');
    setDurationDays(plan.duration_days.toString());
    setPrice(plan.price.toString());
    setActualPrice(plan.actual_price ? plan.actual_price.toString() : '');
    setIcon(plan.icon || ICONS[0]);
    setColor(plan.color || COLORS[0]);
    setIsActive(plan.is_active);
    setFeatures(plan.features || []);
    setShowModal(true);
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    const f = [...features];
    f.splice(index, 1);
    setFeatures(f);
  };

  const savePlan = async () => {
    if (!name || !durationDays || !price) {
      showError('Missing Fields', 'Name, duration, and price are required.');
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        type: planType,
        duration_days: parseInt(durationDays) || 30,
        price: parseFloat(price) || 0,
        actual_price: actualPrice ? parseFloat(actualPrice) : null,
        icon,
        color,
        features,
        is_active: isActive
      };
      
      if (editingPlan) {
        await api.put(`/plans/${editingPlan._id}`, payload);
        showSuccess('Saved', 'Plan updated successfully!');
      } else {
        await api.post('/plans/', payload);
        showSuccess('Created', 'New plan added successfully!');
      }
      setShowModal(false);
      fetchPlans();
    } catch (e: any) {
      showError('Error', e.response?.data?.detail || 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  const filteredPlans = plans.filter(p => {
    if (filter === 'Active') return p.is_active;
    if (filter === 'Inactive') return !p.is_active;
    return true;
  });

  const activePlansCount = plans.filter(p => p.is_active).length;

  return (
    <View style={styles.container}>
      <AlertModal />
      
      <LinearGradient colors={[colors.background, theme === 'dark' ? '#1a103c' : '#ede9fe']} style={StyleSheet.absoluteFill} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="arrow-left" size={16} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Membership Plans</Text>
            <Text style={styles.subtitle}>Create and manage membership plans</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={openCreateModal}>
          <FontAwesome name="plus" size={14} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.createBtnText}>Create New Plan</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#F3E8FF' }]}>
              <FontAwesome name="check-square-o" size={16} color="#A855F7" />
            </View>
            <View>
              <Text style={styles.statLabel}>Total Plans</Text>
              <Text style={styles.statValue}>{plans.length}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
              <FontAwesome name="check" size={16} color="#10B981" />
            </View>
            <View>
              <Text style={styles.statLabel}>Active Plans</Text>
              <Text style={styles.statValue}>{activePlansCount}</Text>
            </View>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          {['All', 'Active', 'Inactive'].map(f => (
            <TouchableOpacity 
              key={f} 
              style={[styles.filterBtn, filter === f && styles.filterBtnActive, filter === f && { borderColor: colors.primary }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : filteredPlans.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="tags" size={48} color={colors.textMuted} style={{ opacity: 0.5, marginBottom: 16 }} />
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>No plans found in this category.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredPlans.map(plan => {
              const savePercent = plan.actual_price && plan.actual_price > plan.price 
                ? Math.round(((plan.actual_price - plan.price) / plan.actual_price) * 100) 
                : 0;

              return (
                <View key={plan._id} style={[styles.planCard, { borderColor: `${plan.color || colors.primary}40` }]}>
                  {savePercent > 0 && (
                    <LinearGradient colors={['#ECFDF5', '#D1FAE5']} style={styles.discountBadge}>
                      <Text style={styles.discountText}>Save {savePercent}%</Text>
                    </LinearGradient>
                  )}
                  {plan.type === 'Corporate' && (
                    <LinearGradient colors={['#F3E8FF', '#E9D5FF']} style={[styles.discountBadge, { right: savePercent > 0 ? 80 : 16 }]}>
                      <Text style={[styles.discountText, { color: '#7C3AED' }]}>Corporate</Text>
                    </LinearGradient>
                  )}
                  
                  <View style={styles.planCardHeader}>
                    <View style={[styles.planIconBox, { backgroundColor: `${plan.color || colors.primary}15` }]}>
                      <FontAwesome name={plan.icon || 'star'} size={24} color={plan.color || colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                        <Text style={styles.planPrice}>₹{plan.price}</Text>
                        <Text style={styles.planDuration}>/ {plan.duration_days} Days</Text>
                      </View>
                      {plan.actual_price && (
                        <Text style={styles.actualPrice}>₹{plan.actual_price}</Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.featuresList}>
                    {plan.features.map((feat: string, i: number) => (
                      <View key={i} style={styles.featureItem}>
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: `${plan.color || colors.primary}15`, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                          <FontAwesome name="check" size={8} color={plan.color || colors.primary} />
                        </View>
                        <Text style={styles.featureText}>{feat}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.planFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.statusDot, { backgroundColor: plan.is_active ? '#10B981' : '#EF4444' }]} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: plan.is_active ? '#10B981' : '#EF4444' }}>
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(plan)}>
                      <FontAwesome name="pencil" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ flex: 1 }} enableOnAndroid extraScrollHeight={20}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                  <FontAwesome name="times" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</Text>
                <TouchableOpacity onPress={savePlan} disabled={saving} style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalContent}>
                <ModernInput label="Plan Name *" value={name} onChangeText={setName} placeholder="e.g. Gold Monthly" />
                <ModernInput label="Short Description" value={description} onChangeText={setDescription} placeholder="Brief description of the plan" />
                
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Duration (Days) *</Text>
                    <View style={styles.inputBox}>
                      <TextInput style={styles.inputText} keyboardType="numeric" value={durationDays} onChangeText={setDurationDays} placeholder="30" placeholderTextColor={colors.textMuted} />
                      <Text style={styles.inputSuffix}>Days</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Price (₹) *</Text>
                    <View style={styles.inputBox}>
                      <Text style={styles.inputPrefix}>₹</Text>
                      <TextInput style={styles.inputText} keyboardType="numeric" value={price} onChangeText={setPrice} placeholder="1500" placeholderTextColor={colors.textMuted} />
                    </View>
                  </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                  <Text style={styles.label}>Actual Price (Optional)</Text>
                  <View style={styles.inputBox}>
                    <Text style={styles.inputPrefix}>₹</Text>
                    <TextInput style={styles.inputText} keyboardType="numeric" value={actualPrice} onChangeText={setActualPrice} placeholder="Strike-through price" placeholderTextColor={colors.textMuted} />
                  </View>
                </View>
                
                <Text style={styles.sectionTitle}>Plan Icon</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                  {ICONS.map(i => (
                    <TouchableOpacity key={i} onPress={() => setIcon(i)} style={[styles.iconSelect, icon === i && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` }]}>
                      <FontAwesome name={i as any} size={20} color={icon === i ? colors.primary : colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.sectionTitle}>Plan Color</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                  {COLORS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setColor(c)} style={[styles.colorSelect, { backgroundColor: c }, color === c && styles.colorSelectActive]}>
                      {color === c && <FontAwesome name="check" size={12} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.sectionTitle}>Inclusions (Features)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TextInput 
                    style={[styles.inputBox, { flex: 1, marginBottom: 0 }]} 
                    value={newFeature} 
                    onChangeText={setNewFeature} 
                    placeholder="e.g. Gym Access" 
                    placeholderTextColor={colors.textMuted}
                    onSubmitEditing={addFeature}
                  />
                  <TouchableOpacity style={styles.addFeatureBtn} onPress={addFeature}>
                    <FontAwesome name="plus" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={{ marginBottom: 24 }}>
                  {features.map((feat, idx) => (
                    <View key={idx} style={styles.featurePill}>
                      <Text style={styles.featurePillText}>{feat}</Text>
                      <TouchableOpacity onPress={() => removeFeature(idx)} style={{ padding: 4 }}>
                        <FontAwesome name="times" size={12} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 40, padding: 16, backgroundColor: colors.surfaceLight, borderRadius: 12 }}>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Plan Status</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Inactive plans won't show in enrollment</Text>
                  </View>
                  <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
                </View>
                
              </View>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </Modal>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary },
  createBtn: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  
  content: { padding: 20, paddingBottom: 100 },
  
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: colors.surface, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, ...shadows.light },
  statIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  
  filtersContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: `${colors.primary}10`, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.primary },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  
  listContainer: { gap: 16 },
  planCard: { width: '100%', backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 8, ...shadows.card },
  discountBadge: { position: 'absolute', top: 16, right: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  discountText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  planIconBox: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  planName: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  planPrice: { fontSize: 28, fontWeight: '800', color: colors.text },
  planDuration: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  actualPrice: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textDecorationLine: 'line-through', marginTop: 2 },
  featuresList: { marginBottom: 20 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureText: { fontSize: 14, color: colors.textSecondary, flex: 1, fontWeight: '500' },
  
  planFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: `${colors.primary}15`, borderRadius: 16 },
  editBtnText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalContent: { padding: 20 },
  
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, height: 50, paddingHorizontal: 16, marginBottom: 16 },
  inputText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  inputPrefix: { color: colors.textMuted, fontSize: 15, fontWeight: '700', marginRight: 8 },
  inputSuffix: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginLeft: 8 },
  
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8, marginBottom: 12 },
  iconSelect: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: colors.border },
  colorSelect: { width: 40, height: 40, borderRadius: 20, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  colorSelectActive: { borderWidth: 3, borderColor: '#fff' },
  
  addFeatureBtn: { width: 50, height: 50, backgroundColor: colors.primary, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  featurePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 8, justifyContent: 'space-between' },
  featurePillText: { fontSize: 13, color: colors.text, fontWeight: '500' },
});
