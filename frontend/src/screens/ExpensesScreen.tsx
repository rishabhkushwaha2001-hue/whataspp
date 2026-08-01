import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../services/api';
import { DatePickerModal } from '../components/DatePickerModal';
import { DropdownModal } from '../components/DropdownModal';

const CATEGORY_COLORS: Record<string, string> = {
  'Rent': '#6366F1',
  'Electricity': '#F59E0B',
  'Water': '#3B82F6',
  'Maintenance': '#10B981',
  'Salary': '#8B5CF6',
  'Equipment': '#EC4899',
  'Supplies': '#14B8A6',
  'Other': '#6B7280'
};

const CATEGORY_ICONS: Record<string, any> = {
  'Rent': 'home',
  'Electricity': 'bolt',
  'Water': 'tint',
  'Maintenance': 'wrench',
  'Salary': 'money',
  'Equipment': 'dumbbell',
  'Supplies': 'shopping-cart',
  'Other': 'tag'
};

const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other'];
const getCategoryIcon = (cat: string) => CATEGORY_ICONS[cat] || CATEGORY_ICONS['Other'];

export const ExpensesScreen = () => {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const styles = getStyles(colors, isDark);

  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [filterMode, setFilterMode] = useState<'month' | 'year'>('month');

  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, [month, year, filterMode]);

  const totalExpense = useMemo(() => (expenses || []).reduce((sum, e) => sum + e.amount, 0), [expenses]);
  
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    (expenses || []).forEach(e => {
      breakdown[e.category] = (breakdown[e.category] || 0) + e.amount;
    });
    return Object.entries(breakdown)
      .map(([cat, val]) => ({ category: cat, amount: val, percentage: totalExpense ? (val / totalExpense) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totalExpense]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = filterMode === 'year'
        ? `/expenses/?year=${year}`
        : `/expenses/?month=${month}&year=${year}`;
      const [expRes, catRes] = await Promise.all([
        api.get(endpoint),
        api.get('/expenses/categories')
      ]);
      const expData = expRes?.data || [];
      const catData = catRes?.data || [];
      
      setExpenses(Array.isArray(expData) ? expData : []);
      setCategories(Array.isArray(catData) ? catData : []);
      
      if (Array.isArray(catData) && catData.length > 0 && !selectedCategory) {
        setSelectedCategory(catData[0]);
      }
    } catch (e) {
      console.log('Error fetching expenses', e);
    }
    setLoading(false);
  };

  const handleAddExpense = async () => {
    if (!amount || !selectedCategory) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    setIsSaving(true);
    try {
      await api.post('/expenses/', {
        amount: parseFloat(amount),
        category: selectedCategory,
        date: new Date(date).toISOString(),
        notes: notes || ''
      });
      setShowAddModal(false);
      setAmount('');
      setNotes('');
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'Failed to add expense');
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/expenses/${id}`);
          fetchData();
        } catch (e) {
          Alert.alert('Error', 'Failed to delete expense');
        }
      }}
    ]);
  };

  const changeMonth = (delta: number) => {
    let newM = month + delta;
    let newY = year;
    if (newM > 12) { newM = 1; newY++; }
    else if (newM < 1) { newM = 12; newY--; }
    setMonth(newM);
    setYear(newY);
  };

  const changeYear = (delta: number) => {
    setYear(year + delta);
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="angle-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        
        {/* Mode Switcher: Month vs Year */}
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeTab, filterMode === 'month' && styles.modeTabActive]}
            onPress={() => setFilterMode('month')}
          >
            <FontAwesome name="calendar" size={13} color={filterMode === 'month' ? '#fff' : colors.textMuted} />
            <Text style={[styles.modeTabText, filterMode === 'month' && { color: '#fff' }]}>Month-wise</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, filterMode === 'year' && styles.modeTabActive]}
            onPress={() => setFilterMode('year')}
          >
            <FontAwesome name="calendar-o" size={13} color={filterMode === 'year' ? '#fff' : colors.textMuted} />
            <Text style={[styles.modeTabText, filterMode === 'year' && { color: '#fff' }]}>Year-wise</Text>
          </TouchableOpacity>
        </View>

        {/* Period Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity
            onPress={() => (filterMode === 'month' ? changeMonth(-1) : changeYear(-1))}
            style={styles.monthBtn}
          >
            <FontAwesome name="chevron-left" size={14} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {filterMode === 'month' ? `${monthNames[month - 1]} ${year}` : `Year ${year}`}
          </Text>
          <TouchableOpacity
            onPress={() => (filterMode === 'month' ? changeMonth(1) : changeYear(1))}
            style={styles.monthBtn}
          >
            <FontAwesome name="chevron-right" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Total Card */}
        <LinearGradient
          colors={isDark ? ['#374151', '#1F2937'] : ['#1E293B', '#0F172A']}
          style={styles.totalCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Text style={styles.totalLabel}>Total {filterMode === 'month' ? 'Monthly' : 'Yearly'} Expenses</Text>
          <Text style={styles.totalValue}>₹{totalExpense.toLocaleString()}</Text>
          <FontAwesome name="bar-chart" size={60} color="rgba(255,255,255,0.05)" style={{ position: 'absolute', right: -10, bottom: -10 }} />
        </LinearGradient>

        {/* Categories Breakdown */}
        {categoryBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            <View style={styles.breakdownCard}>
              {categoryBreakdown.map((item, idx) => (
                <View key={item.category} style={styles.breakdownRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[styles.catIconWrap, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
                      <FontAwesome name={getCategoryIcon(item.category)} size={12} color={getCategoryColor(item.category)} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={styles.catName}>{item.category}</Text>
                        <Text style={styles.catAmount}>₹{item.amount.toLocaleString()}</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${item.percentage}%`, backgroundColor: getCategoryColor(item.category) }]} />
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Expenses List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (expenses || []).length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome name="file-text-o" size={40} color={colors.border} />
              <Text style={styles.emptyText}>No expenses recorded for this {filterMode === 'month' ? 'month' : 'year'}</Text>
            </View>
          ) : (
            (expenses || []).map(expense => (
              <View key={expense._id} style={styles.expenseItem}>
                <View style={[styles.expIcon, { backgroundColor: getCategoryColor(expense.category) + '15' }]}>
                  <FontAwesome name={getCategoryIcon(expense.category)} size={16} color={getCategoryColor(expense.category)} />
                </View>
                <View style={styles.expDetails}>
                  <Text style={styles.expCategory}>{expense.category}</Text>
                  <Text style={styles.expDate}>{new Date(expense.date).toLocaleDateString()} {expense.notes ? `• ${expense.notes}` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.expAmount}>₹{expense.amount}</Text>
                  <TouchableOpacity onPress={() => handleDelete(expense._id)} style={{ padding: 4 }}>
                    <FontAwesome name="trash-o" size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.fabGradient}>
          <FontAwesome name="plus" size={20} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <FontAwesome name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="e.g. 5000"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowCategoryPicker(true)}>
                <Text style={styles.selectorText}>{selectedCategory || 'Select Category'}</Text>
                <FontAwesome name="angle-down" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.selectorText}>{new Date(date).toDateString()}</Text>
                <FontAwesome name="calendar" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Brief description..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddExpense} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Expense</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DropdownModal
        visible={showCategoryPicker}
        items={(categories || []).map(c => ({ label: c, value: c }))}
        onSelect={(item) => { setSelectedCategory(item.value); setShowCategoryPicker(false); }}
        onClose={() => setShowCategoryPicker(false)}
        title="Select Category"
      />
      <DatePickerModal
        visible={showDatePicker}
        initialDate={date}
        onSelect={(d) => { setDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: colors.surface },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.m,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.s,
  },
  modeTabActive: {
    backgroundColor: colors.primary,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  monthSelector: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  monthBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  monthText: { fontSize: 16, fontWeight: '700', color: colors.text, marginHorizontal: 20, width: 100, textAlign: 'center' },
  totalCard: { padding: 24, borderRadius: 24, marginBottom: 24, overflow: 'hidden' },
  totalLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 8 },
  totalValue: { fontSize: 36, color: '#fff', fontWeight: '900' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 },
  breakdownCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border },
  breakdownRow: { marginBottom: 16 },
  catIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  catName: { fontSize: 13, fontWeight: '600', color: colors.text },
  catAmount: { fontSize: 13, fontWeight: '800', color: colors.text },
  progressBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  emptyText: { marginTop: 12, fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  expenseItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  expIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  expDetails: { flex: 1 },
  expCategory: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  expDate: { fontSize: 12, color: colors.textSecondary },
  expAmount: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 },
  fab: { position: 'absolute', bottom: 30, right: 30, ...shadows.medium },
  fabGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, fontSize: 16, color: colors.text },
  selectorBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectorText: { fontSize: 16, color: colors.text },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 10, ...shadows.medium },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
