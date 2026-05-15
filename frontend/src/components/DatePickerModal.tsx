import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { colors, spacing, borderRadius } from '../theme/theme';
import { GlassCard } from './GlassCard';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { height } = Dimensions.get('window');

interface DatePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  initialDate?: string;
}

export const DatePickerModal = ({ visible, onClose, onSelect, initialDate }: DatePickerProps) => {
  const current = initialDate ? new Date(initialDate) : new Date();
  const [year, setYear] = useState(current.getFullYear());
  const [month, setMonth] = useState(current.getMonth());
  const [day, setDay] = useState(current.getDate());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  const handleConfirm = () => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onSelect(formattedDate);
    onClose();
  };

  const renderDays = () => {
    const totalDays = daysInMonth(year, month);
    const dayElements = [];
    for (let i = 1; i <= totalDays; i++) {
      const isSelected = i === day;
      dayElements.push(
        <TouchableOpacity
          key={i}
          onPress={() => setDay(i)}
          style={[styles.dayItem, isSelected && styles.activeItem]}
        >
          <Text style={[styles.dayText, isSelected && styles.activeText]}>{i}</Text>
        </TouchableOpacity>
      );
    }
    return dayElements;
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <GlassCard style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Joining Date</Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="times" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Year Selector */}
          <View style={styles.selectorRow}>
            <TouchableOpacity onPress={() => setYear(year - 1)} style={styles.navBtn}>
              <FontAwesome name="chevron-left" size={14} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.selectorValue}>{year}</Text>
            <TouchableOpacity onPress={() => setYear(year + 1)} style={styles.navBtn}>
              <FontAwesome name="chevron-right" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Month Selector */}
          <View style={styles.selectorRow}>
            <TouchableOpacity onPress={() => setMonth(month === 0 ? 11 : month - 1)} style={styles.navBtn}>
              <FontAwesome name="chevron-left" size={14} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.selectorValue}>{months[month]}</Text>
            <TouchableOpacity onPress={() => setMonth(month === 11 ? 0 : month + 1)} style={styles.navBtn}>
              <FontAwesome name="chevron-right" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Days Grid */}
          <ScrollView contentContainerStyle={styles.daysGrid}>
            {renderDays()}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirm Date</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxHeight: height * 0.7, padding: spacing.l },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.l },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  selectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: borderRadius.m, marginBottom: spacing.s },
  navBtn: { padding: 10 },
  selectorValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: spacing.m, justifyContent: 'center' },
  dayItem: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  activeItem: { backgroundColor: colors.primary },
  dayText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  activeText: { color: 'white' },
  footer: { flexDirection: 'row', gap: 12, marginTop: spacing.l },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  confirmBtn: { flex: 2, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: borderRadius.m, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  confirmText: { color: 'white', fontWeight: '800' },
});
