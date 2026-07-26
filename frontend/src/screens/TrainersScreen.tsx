import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator, Platform, RefreshControl, TextInput, Dimensions, Linking
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme, shadows, spacing, borderRadius } from "../theme/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { api } from "../services/api";
import { useAppAlert } from "../hooks/useAppAlert";
import { LinearGradient } from "expo-linear-gradient";
import { ModernInput } from "../components/ModernInput";
import { GradientButton } from "../components/GradientButton";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { sendWhatsAppMessage } from "../services/whatsapp";

const { width } = Dimensions.get("window");

const SPECIALIZATIONS = [
  "General Coach",
  "Personal Trainer (PT)",
  "Strength & Conditioning",
  "Cardio & Zumba",
  "CrossFit",
  "Yoga & Flexibility",
  "Diet & Nutrition"
];

const SHIFTS = [
  "Full Day (6 AM - 10 PM)",
  "Morning Shift (6 AM - 12 PM)",
  "Evening Shift (4 PM - 10 PM)",
  "Custom"
];

const AVATAR_COLORS = ["#FFB020", "#6366F1", "#A855F7", "#EC4899", "#3B82F6", "#10B981", "#F43F5E", "#8B5CF6"];

export const TrainersScreen = () => {
  const router = useRouter();
  const { theme, colors } = useTheme();
  const isDark = theme === "dark";
  const styles = getStyles(colors, isDark);
  const { showSuccess, showError, showConfirm, AlertModal } = useAppAlert();

  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<any>(null);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialization, setSpecialization] = useState("General Coach");
  const [shiftTiming, setShiftTiming] = useState("Full Day (6 AM - 10 PM)");
  const [salary, setSalary] = useState("");
  const [experienceYears, setExperienceYears] = useState("1");
  const [saving, setSaving] = useState(false);

  const fetchTrainers = async () => {
    try {
      const res = await api.get("/trainers/");
      setTrainers(res.data || []);
    } catch (e: any) {
      showError("Error", "Could not load trainers list.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrainers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrainers();
  };

  const openAddModal = () => {
    setEditingTrainer(null);
    setName("");
    setPhone("");
    setSpecialization("General Coach");
    setShiftTiming("Full Day (6 AM - 10 PM)");
    setSalary("");
    setExperienceYears("1");
    setShowModal(true);
  };

  const openEditModal = (t: any) => {
    setEditingTrainer(t);
    setName(t.name || "");
    setPhone(t.phone || "");
    setSpecialization(t.specialization || "General Coach");
    setShiftTiming(t.shift_timing || "Full Day (6 AM - 10 PM)");
    setSalary(t.salary ? String(t.salary) : "");
    setExperienceYears(t.experience_years ? String(t.experience_years) : "1");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showError("Required", "Trainer name is required.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      showError("Invalid Phone", "Please enter a valid 10-digit phone number.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        specialization,
        shift_timing: shiftTiming,
        salary: salary ? parseFloat(salary) : 0,
        experience_years: experienceYears ? parseInt(experienceYears) : 1,
      };

      setShowModal(false);
      fetchTrainers();
      setTimeout(() => {
        if (editingTrainer) {
          showSuccess("Updated", "Trainer details updated successfully!");
        } else {
          showSuccess("Created", "New trainer added successfully!");
        }
      }, 350);
    } catch (e: any) {
      showError("Save Failed", e?.response?.data?.detail || "Failed to save trainer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (t: any) => {
    showConfirm(
      "Delete Trainer",
      `Are you sure you want to remove ${t.name}?`,
      async () => {
        try {
          await api.delete(`/trainers/${t._id}`);
          showSuccess("Deleted", "Trainer removed successfully.");
          fetchTrainers();
        } catch (e: any) {
          showError("Delete Failed", e?.response?.data?.detail || "Failed to delete trainer.");
        }
      },
      "Delete",
      true
    );
  };

  const filteredTrainers = trainers.filter((t) => {
    const q = search.toLowerCase();
    return (
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.phone && t.phone.includes(q)) ||
      (t.specialization && t.specialization.toLowerCase().includes(q))
    );
  });

  const totalMembersAssigned = trainers.reduce((sum, t) => sum + (t.assigned_members_count || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="arrow-left" size={16} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Trainers Manager</Text>
            <Text style={styles.subtitle}>{trainers.length} Trainers • {totalMembersAssigned} Assigned Members</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <LinearGradient
            colors={[colors.primary, colors.secondary || colors.primary]}
            style={styles.addBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <FontAwesome name="plus" size={12} color="#fff" />
            <Text style={styles.addBtnText}>Add Trainer</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <FontAwesome name="search" size={14} color={colors.textMuted} />
        <TextInput
          placeholder="Search trainers by name, phone or spec..."
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <FontAwesome name="times-circle" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.textSecondary }}>Loading trainers...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {filteredTrainers.length === 0 ? (
            <View style={styles.emptyBox}>
              <FontAwesome name="users" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No trainers found</Text>
              <Text style={styles.emptySub}>Add your gym trainers and coaches to manage schedules and assignments.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAddModal}>
                <Text style={styles.emptyBtnText}>+ Add First Trainer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredTrainers.map((t, idx) => {
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const initials = (t.name || "T")
                .split(" ")
                .map((w: string) => w[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

              return (
                <View key={t._id} style={styles.cardWrapper}>
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                        <View style={[styles.avatar, { backgroundColor: `${avatarColor}20`, borderColor: `${avatarColor}40` }]}>
                          <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardName} numberOfLines={1}>{t.name}</Text>
                          <View style={styles.specBadgeRow}>
                            <View style={[styles.specBadge, { backgroundColor: `${colors.primary}15` }]}>
                              <FontAwesome name="star" size={10} color={colors.primary} />
                              <Text style={[styles.specText, { color: colors.primary }]}>{t.specialization || "Coach"}</Text>
                            </View>
                            {t.experience_years ? (
                              <Text style={styles.expText}>• {t.experience_years}y Exp</Text>
                            ) : null}
                          </View>
                        </View>
                      </View>
                      <View style={[styles.assignedBadge, { backgroundColor: t.assigned_members_count > 0 ? "#10B98118" : `${colors.border}` }]}>
                        <FontAwesome name="user" size={11} color={t.assigned_members_count > 0 ? "#10B981" : colors.textMuted} />
                        <Text style={[styles.assignedText, { color: t.assigned_members_count > 0 ? "#10B981" : colors.textMuted }]}>
                          {t.assigned_members_count || 0} Members
                        </Text>
                      </View>
                    </View>

                    {/* Details Row */}
                    <View style={styles.cardDetailsRow}>
                      <View style={styles.detailItem}>
                        <FontAwesome name="clock-o" size={13} color={colors.textSecondary} />
                        <Text style={styles.detailText}>{t.shift_timing || "Full Day"}</Text>
                      </View>
                      {t.salary ? (
                        <View style={styles.detailItem}>
                          <FontAwesome name="money" size={13} color={colors.success} />
                          <Text style={[styles.detailText, { color: colors.success, fontWeight: "700" }]}>₹{t.salary}/mo</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Divider */}
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    {/* Actions Row */}
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: colors.border }]}
                        onPress={() => Linking.openURL(`tel:${t.phone}`)}
                      >
                        <FontAwesome name="phone" size={13} color={colors.primary} />
                        <Text style={[styles.actionText, { color: colors.textSecondary }]}>Call</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: colors.border }]}
                        onPress={() => sendWhatsAppMessage(t.phone)}
                      >
                        <FontAwesome name="whatsapp" size={14} color="#25D366" />
                        <Text style={[styles.actionText, { color: colors.textSecondary }]}>WhatsApp</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: colors.border }]}
                        onPress={() => openEditModal(t)}
                      >
                        <FontAwesome name="edit" size={13} color={colors.primary} />
                        <Text style={[styles.actionText, { color: colors.textSecondary }]}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: "#EF444430", backgroundColor: "#FEE2E2" }]}
                        onPress={() => handleDelete(t)}
                      >
                        <FontAwesome name="trash" size={13} color="#EF4444" />
                        <Text style={[styles.actionText, { color: "#EF4444" }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add / Edit Trainer Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTrainer ? "Edit Trainer" : "Add New Trainer"}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
                <FontAwesome name="times" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <ModernInput
                label="Trainer Full Name *"
                placeholder="e.g. Vikram Singh"
                value={name}
                onChangeText={setName}
                icon={<FontAwesome name="user" size={16} color={colors.primary} />}
              />
              <ModernInput
                label="Contact Phone *"
                placeholder="e.g. 9876543210"
                value={phone}
                onChangeText={setPhone}
                icon={<FontAwesome name="phone" size={16} color={colors.primary} />}
                keyboardType="phone-pad"
                maxLength={10}
              />

              <Text style={styles.label}>Specialization</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.m }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {SPECIALIZATIONS.map((spec) => {
                    const active = specialization === spec;
                    return (
                      <TouchableOpacity
                        key={spec}
                        style={[
                          styles.chip,
                          { backgroundColor: active ? colors.primary : `${colors.border}40`, borderColor: active ? colors.primary : colors.border },
                        ]}
                        onPress={() => setSpecialization(spec)}
                      >
                        <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>{spec}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={styles.label}>Shift Timing</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.m }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {SHIFTS.map((sh) => {
                    const active = shiftTiming === sh;
                    return (
                      <TouchableOpacity
                        key={sh}
                        style={[
                          styles.chip,
                          { backgroundColor: active ? colors.primary : `${colors.border}40`, borderColor: active ? colors.primary : colors.border },
                        ]}
                        onPress={() => setShiftTiming(sh)}
                      >
                        <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>{sh}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <ModernInput
                    label="Monthly Salary / Fee (₹)"
                    placeholder="e.g. 15000"
                    value={salary}
                    onChangeText={setSalary}
                    icon={<FontAwesome name="money" size={16} color={colors.primary} />}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ModernInput
                    label="Experience (Years)"
                    placeholder="e.g. 3"
                    value={experienceYears}
                    onChangeText={setExperienceYears}
                    icon={<FontAwesome name="briefcase" size={16} color={colors.primary} />}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={{ height: 24 }} />

              <GradientButton
                title={saving ? "Saving Trainer..." : editingTrainer ? "Update Trainer" : "Add Trainer"}
                onPress={handleSave}
                disabled={saving}
              />
              <View style={{ height: 20 }} />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      <AlertModal />
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.l,
      paddingTop: Platform.OS === "android" ? 44 : 16,
      paddingBottom: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { padding: 8 },
    title: { fontSize: 20, fontWeight: "700", color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    addBtn: { borderRadius: 20, overflow: "hidden" },
    addBtnGrad: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      marginHorizontal: spacing.l,
      marginTop: spacing.m,
      paddingHorizontal: spacing.m,
      height: 44,
      borderRadius: borderRadius.l,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    searchInput: { flex: 1, fontSize: 14 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { flex: 1, paddingHorizontal: spacing.l, paddingTop: spacing.m },
    emptyBox: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      marginTop: 40,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 16 },
    emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 18 },
    emptyBtn: {
      marginTop: 20,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: borderRadius.l,
    },
    emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    cardWrapper: {
      marginBottom: spacing.m,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.medium,
    },
    card: { padding: spacing.m },
    cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 16, fontWeight: "700" },
    cardName: { fontSize: 16, fontWeight: "700", color: colors.text },
    specBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    specBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    specText: { fontSize: 11, fontWeight: "600" },
    expText: { fontSize: 12, color: colors.textSecondary },
    assignedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    assignedText: { fontSize: 12, fontWeight: "700" },
    cardDetailsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    detailItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    detailText: { fontSize: 13, color: colors.textSecondary },
    divider: { height: 1, marginVertical: 12 },
    actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
    },
    actionText: { fontSize: 12, fontWeight: "600" },
    modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    modalBox: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "85%",
      paddingTop: spacing.m,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.l,
      paddingBottom: spacing.m,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    modalClose: { padding: 4 },
    modalScroll: { paddingHorizontal: spacing.l, paddingTop: spacing.m },
    label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    chipText: { fontSize: 13, fontWeight: "600" },
  });
