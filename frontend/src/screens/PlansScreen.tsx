import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  Switch, ActivityIndicator, Platform, RefreshControl, TextInput, Dimensions
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme, shadows } from "../theme/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { api } from "../services/api";
import { useAppAlert } from "../hooks/useAppAlert";
import { LinearGradient } from "expo-linear-gradient";
import { ModernInput } from "../components/ModernInput";
import { GradientButton } from "../components/GradientButton";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

const { width } = Dimensions.get("window");

const ICONS = ["crown", "star", "user", "heart", "star-o", "bolt", "diamond", "fire"];
const COLORS = ["#FFB020", "#6366F1", "#A855F7", "#EC4899", "#3B82F6", "#10B981", "#F43F5E", "#8B5CF6"];
const DURATION_PRESETS = [
  { label: "1 Month", days: "30" },
  { label: "2 Months", days: "60" },
  { label: "3 Months", days: "90" },
  { label: "4 Months", days: "120" },
  { label: "5 Months", days: "150" },
  { label: "6 Months", days: "180" },
  { label: "7 Months", days: "210" },
  { label: "8 Months", days: "240" },
  { label: "9 Months", days: "270" },
  { label: "10 Months", days: "300" },
  { label: "11 Months", days: "330" },
  { label: "1 Year", days: "365" },
];

export const PlansScreen = () => {
  const router = useRouter();
  const { theme, colors } = useTheme();
  const isDark = theme === "dark";
  const styles = getStyles(colors, isDark);
  const { showSuccess, showError, showConfirm, AlertModal } = useAppAlert();

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [price, setPrice] = useState("");
  const [actualPrice, setActualPrice] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [isActive, setIsActive] = useState(true);
  const [features, setFeatures] = useState<string[]>(["Gym Access", "Trainer Support"]);
  const [newFeature, setNewFeature] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    try {
      const res = await api.get("/plans/");
      setPlans(res.data);
    } catch (e: any) {
      showError("Failed", e.response?.data?.detail || "Could not load plans.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreateModal = () => {
    setEditingPlan(null);
    setName(""); setDescription(""); setDurationDays("30");
    setPrice(""); setActualPrice("");
    setIcon(ICONS[0]); setColor(COLORS[0]);
    setIsActive(true);
    setFeatures(["Gym Access", "Trainer Support"]);
    setShowModal(true);
  };

  const openEditModal = (plan: any) => {
    setEditingPlan(plan);
    setName(plan.name); setDescription(plan.description || "");
    setDurationDays(plan.duration_days.toString());
    setPrice(plan.price.toString());
    setActualPrice(plan.actual_price ? plan.actual_price.toString() : "");
    setIcon(plan.icon || ICONS[0]); setColor(plan.color || COLORS[0]);
    setIsActive(plan.is_active);
    setFeatures(plan.features || []);
    setShowModal(true);
  };

  const addFeature = () => {
    if (newFeature.trim()) { setFeatures([...features, newFeature.trim()]); setNewFeature(""); }
  };

  const removeFeature = (index: number) => {
    const f = [...features]; f.splice(index, 1); setFeatures(f);
  };

  const savePlan = async () => {
    if (!name || !durationDays || !price) {
      showError("Missing Fields", "Name, duration, and price are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name, description, type: "Individual",
        duration_days: parseInt(durationDays) || 30,
        price: parseFloat(price) || 0,
        actual_price: actualPrice ? parseFloat(actualPrice) : null,
        icon, color, features, is_active: isActive
      };
      if (editingPlan) {
        await api.put(`/plans/${editingPlan._id}`, payload);
      } else {
        await api.post('/plans/', payload);
      }
      setShowModal(false);
      fetchPlans();
      setTimeout(() => {
        if (editingPlan) {
          showSuccess("Saved", "Plan updated!");
        } else {
          showSuccess("Created", "New plan added!");
        }
      }, 350);
    } catch (e: any) {
      showError("Error", e.response?.data?.detail || "Failed to save plan.");
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = (plan: any, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    showConfirm(
      "Delete Plan",
      `Are you sure you want to delete "${plan.name}"? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/plans/${plan._id}`);
          showSuccess("Deleted", `${plan.name} has been removed.`);
          if (editingPlan && editingPlan._id === plan._id) {
            setShowModal(false);
          }
          fetchPlans();
        } catch (err: any) {
          showError("Error", err.response?.data?.detail || "Could not delete plan.");
        }
      },
      "Delete",
      true
    );
  };

  const filteredPlans = plans.filter(p => {
    if (filter === "Active") return p.is_active;
    if (filter === "Inactive") return !p.is_active;
    return true;
  });

  const activePlansCount = plans.filter(p => p.is_active).length;

  return (
    <View style={styles.container}>
      <AlertModal />

      <LinearGradient
        colors={isDark ? ["#1a1a2e", "#16213e"] : ["#ffffff", "#F8F7FF"]}
        style={styles.headerGrad}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="arrow-left" size={16} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Membership Plans</Text>
            <Text style={styles.subtitle}>{activePlansCount} active · {plans.length} total</Text>
          </View>
          <TouchableOpacity onPress={openCreateModal}>
            <LinearGradient colors={["#7C3AED", "#4F46E5"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.addBtnGrad}>
              <FontAwesome name="plus" size={13} color="#fff" />
              <Text style={styles.addBtnText}>New Plan</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          {["All", "Active", "Inactive"].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPlans(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        ) : filteredPlans.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <FontAwesome name="tags" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No plans yet</Text>
            <Text style={styles.emptyDesc}>Tap "New Plan" to create your first membership plan</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openCreateModal}>
              <Text style={styles.emptyBtnText}>+ Create First Plan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredPlans.map(plan => {
            const savePercent = plan.actual_price && plan.actual_price > plan.price
              ? Math.round(((plan.actual_price - plan.price) / plan.actual_price) * 100)
              : 0;
            const accentColor = plan.color || colors.primary;
            const durationLabel = plan.duration_days >= 365
              ? `${Math.round(plan.duration_days / 365)}Y`
              : plan.duration_days >= 28
              ? `${Math.round(plan.duration_days / 30)}M`
              : `${plan.duration_days}D`;
            const durationFull = plan.duration_days >= 365
              ? `${Math.round(plan.duration_days / 365)} Year`
              : plan.duration_days >= 28
              ? `${Math.round(plan.duration_days / 30)} Month${Math.round(plan.duration_days / 30) > 1 ? "s" : ""}`
              : `${plan.duration_days} Days`;

            return (
              <TouchableOpacity
                key={plan._id}
                style={styles.planCard}
                activeOpacity={0.92}
                onPress={() => openEditModal(plan)}
              >
                <View style={[styles.planAccent, { backgroundColor: accentColor }]} />

                <View style={styles.planBody}>
                  <View style={styles.planTop}>
                    <View style={[styles.planIconCircle, { backgroundColor: `${accentColor}18` }]}>
                      <FontAwesome name={plan.icon || "star"} size={18} color={accentColor} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.planName} numberOfLines={1}>{plan.name}</Text>
                      {plan.description ? <Text style={styles.planDesc} numberOfLines={1}>{plan.description}</Text> : null}
                    </View>
                    <View style={[styles.durationPill, { backgroundColor: `${accentColor}18` }]}>
                      <Text style={[styles.durationPillText, { color: accentColor }]}>{durationFull}</Text>
                    </View>
                  </View>

                  <View style={styles.priceRow}>
                    <Text style={styles.priceText}>₹{plan.price}</Text>
                    {plan.actual_price ? <Text style={styles.strikePrice}>₹{plan.actual_price}</Text> : null}
                    {savePercent > 0 ? (
                      <View style={styles.saveBadge}>
                        <Text style={styles.saveBadgeText}>{savePercent}% OFF</Text>
                      </View>
                    ) : null}
                  </View>

                  {plan.features && plan.features.length > 0 && (
                    <View style={styles.chipRow}>
                      {plan.features.slice(0, 4).map((feat: string, i: number) => (
                        <View key={i} style={styles.chip}>
                          <FontAwesome name="check" size={8} color={accentColor} style={{ marginRight: 4 }} />
                          <Text style={styles.chipText}>{feat}</Text>
                        </View>
                      ))}
                      {plan.features.length > 4 && (
                        <View style={styles.chip}>
                          <Text style={styles.chipText}>+{plan.features.length - 4} more</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.planFooter}>
                    <View style={[styles.statusBadge, { backgroundColor: plan.is_active ? "#ECFDF5" : "#FEF2F2" }]}>
                      <View style={[styles.statusDot, { backgroundColor: plan.is_active ? "#10B981" : "#EF4444" }]} />
                      <Text style={[styles.statusText, { color: plan.is_active ? "#059669" : "#DC2626" }]}>
                        {plan.is_active ? "Active" : "Inactive"}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={styles.editHint}>
                        <Text style={styles.editHintText}>Tap to edit</Text>
                        <FontAwesome name="pencil" size={11} color={colors.textMuted} />
                      </View>
                      <TouchableOpacity
                        onPress={(e) => deletePlan(plan, e)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: isDark ? '#3B181E' : '#FEE2E2',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <FontAwesome name="trash-o" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreateModal} activeOpacity={0.88}>
        <LinearGradient colors={["#7C3AED", "#4F46E5"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.fabGrad}>
          <FontAwesome name="plus" size={20} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingPlan ? "Edit Plan" : "Create New Plan"}</Text>
                <Text style={styles.modalSubtitle}>{editingPlan ? "Update plan details" : "Add a new membership plan"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeBtn}>
                <FontAwesome name="times" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              enableOnAndroid
              extraScrollHeight={20}
              keyboardShouldPersistTaps="handled"
            >
              <ModernInput label="Plan Name *" value={name} onChangeText={setName} placeholder="e.g. Gold Monthly" />
              <ModernInput label="Short Description" value={description} onChangeText={setDescription} placeholder="Brief description" />

              <Text style={styles.sectionLabel}>Duration</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {DURATION_PRESETS.map(preset => (
                  <TouchableOpacity
                    key={preset.days}
                    onPress={() => setDurationDays(preset.days)}
                    style={[styles.presetPill, durationDays === preset.days && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.presetText, durationDays === preset.days && { color: "#fff" }]}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.inputBox}>
                <TextInput style={styles.inputText} keyboardType="numeric" value={durationDays} onChangeText={setDurationDays} placeholder="Custom days" placeholderTextColor={colors.textMuted} />
                <Text style={styles.inputSuffix}>Days</Text>
              </View>

              <Text style={styles.sectionLabel}>Pricing</Text>
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Price (₹) *</Text>
                  <View style={styles.inputBox}>
                    <Text style={styles.inputPrefix}>₹</Text>
                    <TextInput style={styles.inputText} keyboardType="numeric" value={price} onChangeText={setPrice} placeholder="1500" placeholderTextColor={colors.textMuted} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>MRP (Optional)</Text>
                  <View style={styles.inputBox}>
                    <Text style={styles.inputPrefix}>₹</Text>
                    <TextInput style={styles.inputText} keyboardType="numeric" value={actualPrice} onChangeText={setActualPrice} placeholder="2000" placeholderTextColor={colors.textMuted} />
                  </View>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {ICONS.map(i => (
                  <TouchableOpacity key={i} onPress={() => setIcon(i)} style={[styles.iconPill, icon === i && { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }]}>
                    <FontAwesome name={i as any} size={18} color={icon === i ? colors.primary : colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>Plan Color</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {COLORS.map(c => (
                  <TouchableOpacity key={c} onPress={() => setColor(c)} style={[styles.colorCircle, { backgroundColor: c }, color === c && styles.colorSelected]}>
                    {color === c && <FontAwesome name="check" size={12} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>Inclusions</Text>
              <View style={styles.featureInputRow}>
                <TextInput style={styles.featureInput} value={newFeature} onChangeText={setNewFeature} placeholder="e.g. Gym Access" placeholderTextColor={colors.textMuted} onSubmitEditing={addFeature} returnKeyType="done" />
                <TouchableOpacity style={styles.featureAddBtn} onPress={addFeature}>
                  <FontAwesome name="plus" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.chipsWrap}>
                {features.map((feat, idx) => (
                  <View key={idx} style={styles.featChip}>
                    <Text style={styles.featChipText}>{feat}</Text>
                    <TouchableOpacity onPress={() => removeFeature(idx)} style={{ marginLeft: 6 }}>
                      <FontAwesome name="times" size={10} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>Plan Active</Text>
                  <Text style={styles.toggleSub}>Inactive plans won't appear during enrollment</Text>
                </View>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
              </View>

              <View style={{ marginTop: 8, marginBottom: 40 }}>
                <GradientButton title={saving ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"} onPress={savePlan} isLoading={saving} />
                {editingPlan && (
                  <TouchableOpacity
                    style={{
                      marginTop: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 12,
                      borderRadius: 16,
                      backgroundColor: isDark ? '#3B181E' : '#FEE2E2',
                      borderWidth: 1,
                      borderColor: '#EF4444',
                    }}
                    onPress={() => deletePlan(editingPlan)}
                  >
                    <FontAwesome name="trash-o" size={16} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700' }}>
                      Delete This Plan
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#0F1117" : "#F7F8FC" },
  headerGrad: { paddingTop: Platform.OS === "android" ? 44 : 20, borderBottomWidth: 1, borderBottomColor: isDark ? "#1E2030" : "#EEEBFF" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? "#1E2030" : "#F1F0FF", justifyContent: "center", alignItems: "center", marginRight: 12 },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  addBtnGrad: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 14 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: isDark ? "#1E2030" : "#EEEBFF" },
  filterTabActive: { backgroundColor: colors.primary },
  filterTabText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  filterTabTextActive: { color: "#fff" },
  content: { padding: 16, paddingTop: 20 },
  planCard: { flexDirection: "row", backgroundColor: isDark ? "#171A22" : "#fff", borderRadius: 20, marginBottom: 14, overflow: "hidden", borderWidth: 1, borderColor: isDark ? "#2A2D3A" : "#EFEFEF", ...shadows.medium },
  planAccent: { width: 5 },
  planBody: { flex: 1, padding: 16 },
  planTop: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  planIconCircle: { width: 40, height: 40, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  planName: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 2 },
  planDesc: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  durationPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  durationPillText: { fontSize: 12, fontWeight: "700" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 12 },
  priceText: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  strikePrice: { fontSize: 14, fontWeight: "600", color: colors.textMuted, textDecorationLine: "line-through" },
  saveBadge: { backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  saveBadgeText: { fontSize: 11, fontWeight: "800", color: "#059669" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: isDark ? "#1E2030" : "#F5F3FF", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: "600", color: isDark ? colors.textSecondary : "#374151" },
  planFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  editHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  editHintText: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: isDark ? "#1E2030" : "#F1F0FF", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  fab: { position: "absolute", bottom: 28, right: 20, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  fabGrad: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: isDark ? "#171A22" : "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", minHeight: "70%" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? "#2A2D3A" : "#E5E7EB", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: isDark ? "#2A2D3A" : "#F3F4F6" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  modalSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? "#2A2D3A" : "#F3F4F6", justifyContent: "center", alignItems: "center" },
  modalContent: { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, marginBottom: 6 },
  presetPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: isDark ? "#2A2D3A" : "#E5E7EB", backgroundColor: isDark ? "#1E2030" : "#F9FAFB" },
  presetText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: isDark ? "#1E2030" : "#F9FAFB", borderWidth: 1, borderColor: isDark ? "#2A2D3A" : "#E5E7EB", borderRadius: 12, height: 48, paddingHorizontal: 14, marginBottom: 16 },
  inputText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  inputPrefix: { color: colors.textMuted, fontSize: 16, fontWeight: "700", marginRight: 6 },
  inputSuffix: { color: colors.textMuted, fontSize: 13, fontWeight: "600", marginLeft: 6 },
  iconPill: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 10, borderWidth: 1, borderColor: isDark ? "#2A2D3A" : "#E5E7EB", backgroundColor: isDark ? "#1E2030" : "#F9FAFB" },
  colorCircle: { width: 38, height: 38, borderRadius: 19, marginRight: 10, justifyContent: "center", alignItems: "center" },
  colorSelected: { borderWidth: 3, borderColor: "#fff" },
  featureInputRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  featureInput: { flex: 1, height: 44, backgroundColor: isDark ? "#1E2030" : "#F9FAFB", borderWidth: 1, borderColor: isDark ? "#2A2D3A" : "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, color: colors.text, fontSize: 14, fontWeight: "500" },
  featureAddBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  featChip: { flexDirection: "row", alignItems: "center", backgroundColor: isDark ? "#1E2030" : "#F1F0FF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: isDark ? "#2A2D3A" : "#DDD6FE" },
  featChipText: { fontSize: 12, fontWeight: "600", color: colors.text },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: isDark ? "#1E2030" : "#F9FAFB", padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? "#2A2D3A" : "#E5E7EB" },
  toggleLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  toggleSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, maxWidth: 220 },
});
