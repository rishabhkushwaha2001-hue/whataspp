import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Dimensions, TextInput,
  Animated, Vibration
} from 'react-native';
import { useTheme, spacing, borderRadius } from '../../src/theme/theme';
import { api } from '../../src/services/api';
import { useFocusEffect, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAppAlert } from '../../src/hooks/useAppAlert';

const { width } = Dimensions.get('window');
const SEAT_SIZE = (width - spacing.l * 2 - spacing.m * 3) / 4;

interface SeatMember {
  _id: string;
  member_id: string;
  name: string;
  phone: string;
  timing: string;
  shift_active: boolean;
}

interface Seat {
  _id: string;
  seat_number: string;
  category: string;
  status: string;
  live_status?: string;
  allotted_members?: SeatMember[];
}

// Single animated seat component to handle wiggle per-seat
function AnimatedSeat({
  seat,
  isEditing,
  isSelected,
  onPress,
  onLongPress,
  onToggleSelect,
  colors,
}: {
  seat: Seat;
  isEditing: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onToggleSelect: () => void;
  colors: any;
}) {
  const wiggle = useRef(new Animated.Value(0)).current;
  // Prevents onPress firing immediately after a long press
  const longPressJustFired = useRef(false);

  useEffect(() => {
    if (isEditing) {
      const delay = Math.random() * 100;
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(wiggle, { toValue: 1.5, duration: 90, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: -1.5, duration: 90, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 0, duration: 90, useNativeDriver: true }),
        ])
      );
      const timeout = setTimeout(() => anim.start(), delay);
      return () => {
        clearTimeout(timeout);
        anim.stop();
        wiggle.setValue(0);
      };
    } else {
      wiggle.setValue(0);
    }
  }, [isEditing]);

  const members = seat.allotted_members || [];
  const hasActive = members.some((m: any) => m.shift_active);
  const seatColor = members.length === 0
    ? '#4ade80'
    : hasActive ? '#f87171' : '#fbbf24';

  const memberCount = members.length;

  return (
    <Animated.View
      style={{
        transform: [{ rotate: wiggle.interpolate({ inputRange: [-1.5, 1.5], outputRange: ['-1.5deg', '1.5deg'] }) }],
        position: 'relative',
      }}
    >
      <TouchableOpacity
        style={[
          styles.seatBox,
          { backgroundColor: seatColor },
          isSelected && styles.seatBoxSelected,
        ]}
        onPress={() => {
          // Block onPress if long press just fired (prevents modal opening)
          if (longPressJustFired.current) {
            longPressJustFired.current = false;
            return;
          }
          if (isEditing) {
            onToggleSelect();
          } else {
            onPress();
          }
        }}
        onLongPress={() => {
          longPressJustFired.current = true;
          onLongPress();
        }}
        delayLongPress={350}
        activeOpacity={1}
      >
        <Text style={styles.seatText}>{seat.seat_number}</Text>
        {memberCount > 0 && !isEditing && (
          <View style={styles.seatBadge}>
            <Text style={styles.seatBadgeText}>{memberCount}</Text>
          </View>
        )}
        {isEditing && isSelected && (
          <View style={styles.checkMark}>
            <FontAwesome name="check" size={9} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      {/* Cross button — appears in edit mode on top-left */}
      {isEditing && (
        <TouchableOpacity
          style={styles.crossBtn}
          onPress={onToggleSelect}
          activeOpacity={1}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <FontAwesome name={isSelected ? 'minus-circle' : 'times-circle'} size={18} color={isSelected ? '#ef4444' : '#94a3b8'} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// Wrap in memo — re-renders ONLY when isSelected or isEditing changes for this seat
const AnimatedSeatMemo = memo(AnimatedSeat, (prev, next) => {
  return (
    prev.isEditing === next.isEditing &&
    prev.isSelected === next.isSelected &&
    prev.seat._id === next.seat._id
  );
});

export default function SeatsScreen() {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const { showError, showConfirm, AlertModal } = useAppAlert();

  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSavingDelete, setIsSavingDelete] = useState(false);

  // Detail modal
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);

  // Add seats modal
  const [addSeatModalVisible, setAddSeatModalVisible] = useState(false);
  const [newSeatPrefix, setNewSeatPrefix] = useState('S-');
  const [newSeatStartNumber, setNewSeatStartNumber] = useState('1');
  const [newSeatQuantity, setNewSeatQuantity] = useState('1');

  // Edit seat modal
  const [editSeatModalVisible, setEditSeatModalVisible] = useState(false);
  const [seatToEdit, setSeatToEdit] = useState<Seat | null>(null);
  const [editedSeatName, setEditedSeatName] = useState('');

  const fetchSeats = useCallback(async () => {
    try {
      const res = await api.get(`/seats/?t=${new Date().getTime()}`);
      setSeats(res.data);
    } catch (e) {
      console.log('Error fetching seats', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchSeats();
      // Auto-refresh every 30 seconds while on this tab
      const interval = setInterval(fetchSeats, 30000);
      // Exit edit mode on screen blur
      return () => {
        clearInterval(interval);
        setIsEditing(false);
        setSelectedIds(new Set());
      };
    }, [])
  );

  const enterEditMode = useCallback(() => {
    Vibration.vibrate(40);
    setIsEditing(true);
    setSelectedIds(new Set());
  }, []);

  const exitEditMode = useCallback(() => {
    setIsEditing(false);
    setSelectedIds(new Set());
  }, []);

  // Stable reference so AnimatedSeatMemo doesn't re-render all seats
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) {
      exitEditMode();
      return;
    }
    showConfirm(
      `Delete ${selectedIds.size} Seat${selectedIds.size > 1 ? 's' : ''}?`,
      `${selectedIds.size} seat${selectedIds.size > 1 ? 's' : ''} will be permanently removed. This cannot be undone.`,
      async () => {
        setIsSavingDelete(true);
        try {
          await api.post('/seats/batch-delete', { seat_ids: Array.from(selectedIds) });
          exitEditMode();
          fetchSeats();
        } catch (e: any) {
          showError('Delete Failed', e.response?.data?.detail || 'Failed to delete seats');
        } finally {
          setIsSavingDelete(false);
        }
      },
      `Delete ${selectedIds.size}`,
      true,
    );
  };

  // Auto-detect next seat number from backend
  const handleOpenAddModal = async () => {
    setAddSeatModalVisible(true);
    try {
      const res = await api.get(`/seats/next-number?prefix=${encodeURIComponent(newSeatPrefix)}`);
      setNewSeatStartNumber(String(res.data.next_number));
    } catch {
      // fallback — scan locally
      const maxNum = seats.reduce((max, s) => {
        if (s.seat_number.startsWith(newSeatPrefix)) {
          const match = s.seat_number.slice(newSeatPrefix.length).match(/^\d+/);
          if (match) return Math.max(max, parseInt(match[0]));
        }
        return max;
      }, 0);
      setNewSeatStartNumber(String(maxNum + 1));
    }
  };

  const handlePrefixChange = async (prefix: string) => {
    setNewSeatPrefix(prefix);
    if (prefix.length === 0) return;
    try {
      const res = await api.get(`/seats/next-number?prefix=${encodeURIComponent(prefix)}`);
      setNewSeatStartNumber(String(res.data.next_number));
    } catch {
      setNewSeatStartNumber('1');
    }
  };

  const handleAddSeat = async () => {
    const qty = parseInt(newSeatQuantity);
    const start = parseInt(newSeatStartNumber);
    if (isNaN(qty) || qty <= 0 || isNaN(start)) {
      return showError('Invalid Input', 'Please enter a valid quantity and start number');
    }
    try {
      const payload = Array.from({ length: qty }, (_, i) => ({
        seat_number: `${newSeatPrefix}${start + i}`,
        category: 'Standard',
        status: 'Available'
      }));
      await api.post('/seats/batch', payload);
      setAddSeatModalVisible(false);
      setNewSeatQuantity('1');
      fetchSeats();
    } catch (e: any) {
      showError('Add Failed', e.response?.data?.detail || 'Failed to add seats');
    }
  };

  const handleSaveEdit = async () => {
    if (!seatToEdit || !editedSeatName.trim()) return;
    try {
      await api.put(`/seats/${seatToEdit._id}/rename`, { new_seat_number: editedSeatName.trim() });
      setEditSeatModalVisible(false);
      fetchSeats();
    } catch (e: any) {
      showError('Rename Failed', e.response?.data?.detail || 'Failed to rename seat');
    }
  };

  const handleDeleteSingleSeat = () => {
    if (!seatToEdit) return;
    showConfirm(
      'Delete Seat',
      `Are you sure you want to delete seat "${seatToEdit.seat_number}"? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/seats/${seatToEdit._id}`);
          setEditSeatModalVisible(false);
          fetchSeats();
        } catch (e: any) {
          showError('Delete Failed', e.response?.data?.detail || 'Failed to delete seat');
        }
      },
      'Delete Seat',
      true,
    );
  };

  // Stats
  const freeCount = seats.filter(s => (s.allotted_members || []).length === 0).length;
  const occupiedCount = seats.filter(s => (s.allotted_members || []).some((m: any) => m.shift_active)).length;
  const reservedCount = seats.filter(s => {
    const ms = s.allotted_members || [];
    return ms.length > 0 && !ms.some((m: any) => m.shift_active);
  }).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.header, { color: colors.text }]}>Seat Layout</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {seats.length} seats total
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.editActionBtn, { backgroundColor: `${colors.error}15`, borderColor: `${colors.error}30` }]}
                onPress={exitEditMode}
              >
                <Text style={{ color: colors.error, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editActionBtn, {
                  backgroundColor: selectedIds.size > 0 ? colors.error : colors.primary,
                  borderColor: 'transparent',
                  opacity: isSavingDelete ? 0.6 : 1,
                }]}
                onPress={handleDeleteSelected}
                disabled={isSavingDelete}
              >
                {isSavingDelete ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {selectedIds.size > 0 ? `Delete (${selectedIds.size})` : 'Done'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: `${colors.primary}15` }]}
                onPress={handleOpenAddModal}
              >
                <FontAwesome name="plus" size={15} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Stats Bar */}
      <View style={[styles.statsBar, { backgroundColor: isDark ? colors.surface : '#F9FAFB', borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#4ade80' }]} />
          <Text style={[styles.statNum, { color: colors.text }]}>{freeCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Free</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#f87171' }]} />
          <Text style={[styles.statNum, { color: colors.text }]}>{occupiedCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>In Session</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#fbbf24' }]} />
          <Text style={[styles.statNum, { color: colors.text }]}>{reservedCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Reserved</Text>
        </View>
        {isEditing && (
          <>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.statNum, { color: colors.error }]}>{selectedIds.size}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Selected</Text>
            </View>
          </>
        )}
      </View>

      {/* Edit mode hint bar */}
      {isEditing && (
        <View style={[styles.editHint, { backgroundColor: `${colors.error}12`, borderColor: `${colors.error}25` }]}>
          <FontAwesome name="trash" size={12} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600', flex: 1 }}>
            {selectedIds.size === 0
              ? 'Tap ✕ on seats to select them for deletion'
              : `${selectedIds.size} seat${selectedIds.size > 1 ? 's' : ''} selected — tap "Delete" to remove`}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSeats(); }} />}
        >
          {!isEditing && (
            <Text style={{ textAlign: 'center', color: colors.textMuted, marginBottom: 14, fontSize: 11 }}>
              💡 Tap to view details • Long-press to enter edit mode
            </Text>
          )}

          {seats.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <FontAwesome name="th" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 15, fontWeight: '600' }}>No seats configured</Text>
              <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13, textAlign: 'center' }}>
                Tap the + button to add seats
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {seats.map((seat) => (
                <AnimatedSeatMemo
                  key={seat._id}
                  seat={seat}
                  isEditing={isEditing}
                  isSelected={selectedIds.has(seat._id)}
                  colors={colors}
                  onPress={() => setSelectedSeat(seat)}
                  onLongPress={enterEditMode}
                  onToggleSelect={() => toggleSelect(seat._id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Seat Detail Modal */}
      {selectedSeat && !isEditing && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.seatNumberBadge, {
                  backgroundColor: (() => {
                    const ms = selectedSeat.allotted_members || [];
                    if (ms.length === 0) return '#4ade80';
                    return ms.some((m: any) => m.shift_active) ? '#f87171' : '#fbbf24';
                  })()
                }]}>
                  <Text style={styles.seatNumberBadgeText}>{selectedSeat.seat_number}</Text>
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Seat Details</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>
                    {(selectedSeat.allotted_members || []).length} slot(s) booked
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}
                  onPress={() => {
                    setSelectedSeat(null);
                    setSeatToEdit(selectedSeat);
                    setEditedSeatName(selectedSeat.seat_number);
                    setEditSeatModalVisible(true);
                  }}
                >
                  <FontAwesome name="pencil" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedSeat(null)}
                  style={[styles.iconBtn, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}
                >
                  <FontAwesome name="times" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {(!selectedSeat.allotted_members || selectedSeat.allotted_members.length === 0) ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <FontAwesome name="check-circle" size={36} color="#4ade80" />
                  <Text style={{ color: colors.text, marginTop: 12, fontSize: 16, fontWeight: '700' }}>Seat Available</Text>
                  <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>No slots booked on this seat</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.slotHeader, { color: colors.textMuted }]}>BOOKED SLOTS</Text>
                  {selectedSeat.allotted_members!.map((m: any, idx: number) => {
                    const isActiveNow = m.shift_active;
                    return (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.7}
                        style={[
                          styles.memberCard,
                          {
                            backgroundColor: isActiveNow
                              ? (isDark ? '#1a2e1a' : '#f0fdf4')
                              : (isDark ? '#1F2937' : '#F9FAFB'),
                            borderColor: isActiveNow ? '#4ade80' : colors.border,
                          }
                        ]}
                        onPress={() => {
                          setSelectedSeat(null);
                          router.push({
                            pathname: `/members/${m._id || m.member_id}` as any,
                            params: { name: m.name, mid: m.member_id, cat: 'Library' }
                          });
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={[styles.memberAvatar, { backgroundColor: isActiveNow ? '#4ade8020' : `${colors.primary}20` }]}>
                              <FontAwesome name="user" size={14} color={isActiveNow ? '#16a34a' : colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                                {m.name || m.member_id}
                              </Text>
                              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{m.phone}</Text>
                            </View>
                          </View>
                          {isActiveNow ? (
                            <View style={styles.inSessionBadge}>
                              <View style={styles.activeDot} />
                              <Text style={styles.inSessionText}>In Session</Text>
                            </View>
                          ) : (
                            <View style={[styles.reservedBadge, { backgroundColor: `${colors.textMuted}15` }]}>
                              <Text style={[styles.reservedText, { color: colors.textMuted }]}>Reserved</Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.timingRow, {
                          borderTopColor: isDark ? '#ffffff10' : '#00000008',
                          backgroundColor: isActiveNow ? '#4ade8010' : `${colors.primary}08`
                        }]}>
                          <FontAwesome name="clock-o" size={12} color={isActiveNow ? '#16a34a' : colors.primary} />
                          <Text style={[styles.timingText, { color: isActiveNow ? '#16a34a' : colors.primary }]}>
                            {m.timing || 'No timing set'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 6, gap: 3 }}>
                          <Text style={{ color: colors.textMuted, fontSize: 10 }}>View profile</Text>
                          <FontAwesome name="chevron-right" size={8} color={colors.textMuted} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Add Seats Modal */}
      {addSeatModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Seats</Text>
              <TouchableOpacity onPress={() => setAddSeatModalVisible(false)} style={[styles.iconBtn, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
                <FontAwesome name="times" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Seat Prefix</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              value={newSeatPrefix}
              onChangeText={handlePrefixChange}
              placeholder="e.g. S-"
              placeholderTextColor={colors.textMuted}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Start From</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  value={newSeatStartNumber}
                  onChangeText={setNewSeatStartNumber}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>How Many</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  value={newSeatQuantity}
                  onChangeText={setNewSeatQuantity}
                  placeholder="e.g. 10"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Preview */}
            {!isNaN(parseInt(newSeatStartNumber)) && !isNaN(parseInt(newSeatQuantity)) && parseInt(newSeatQuantity) > 0 && (
              <View style={[styles.previewBox, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}25` }]}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                  Will add: {newSeatPrefix}{newSeatStartNumber} → {newSeatPrefix}{parseInt(newSeatStartNumber) + parseInt(newSeatQuantity) - 1}
                  {'  '}({newSeatQuantity} seats)
                </Text>
              </View>
            )}

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 4 }]} onPress={handleAddSeat}>
              <FontAwesome name="plus" size={14} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Add Seats</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Edit / Rename Seat Modal */}
      {editSeatModalVisible && seatToEdit && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Rename Seat</Text>
              <TouchableOpacity onPress={() => setEditSeatModalVisible(false)} style={[styles.iconBtn, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
                <FontAwesome name="times" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>New Seat Name</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              value={editedSeatName}
              onChangeText={setEditedSeatName}
              placeholder="e.g. A-1"
              placeholderTextColor={colors.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: spacing.m }}>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: `${colors.error}15`, borderWidth: 1, borderColor: `${colors.error}40`, flex: 1 }]}
                onPress={handleDeleteSingleSeat}
              >
                <Text style={{ color: colors.error, fontWeight: '700', fontSize: 14 }}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={handleSaveEdit}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Global styled alert modal */}
      <AlertModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.l,
    paddingTop: 56,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.m,
    paddingBottom: spacing.m,
    borderBottomWidth: 1,
  },
  header: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  editActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    borderRadius: borderRadius.m,
    borderWidth: 1,
    marginBottom: spacing.s,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  statDivider: {
    width: 1,
    marginVertical: 8,
  },
  statDot: {
    width: 8, height: 8, borderRadius: 4, marginBottom: 2,
  },
  statNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    marginBottom: spacing.m,
  },
  scrollContent: {
    paddingBottom: 100,
    paddingTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
  },
  seatBox: {
    width: SEAT_SIZE,
    height: SEAT_SIZE,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  seatBoxSelected: {
    opacity: 0.6,
    borderWidth: 2.5,
    borderColor: '#ef4444',
  },
  seatText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  seatBadge: {
    position: 'absolute',
    top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  seatBadgeText: {
    color: '#fff', fontSize: 9, fontWeight: '800',
  },
  checkMark: {
    position: 'absolute',
    bottom: 4, right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 8, width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  crossBtn: {
    position: 'absolute',
    top: -6, left: -6,
    zIndex: 10,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  // Modal
  modalOverlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000
  },
  modalContent: {
    width: '90%', borderRadius: borderRadius.l, padding: spacing.l,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.m, borderBottomWidth: 1, paddingBottom: spacing.m,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  seatNumberBadge: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  seatNumberBadgeText: {
    color: '#fff', fontWeight: '900', fontSize: 12,
  },
  slotHeader: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    marginBottom: 8, marginTop: 4,
  },
  memberCard: {
    borderRadius: borderRadius.m, marginBottom: spacing.s,
    borderWidth: 1, overflow: 'hidden', padding: spacing.m,
  },
  memberAvatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  memberName: { fontSize: 14, fontWeight: '700' },
  inSessionBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#dcfce7', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4, gap: 4,
  },
  activeDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a',
  },
  inSessionText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },
  reservedBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  reservedText: { fontSize: 10, fontWeight: '700' },
  timingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 6,
    borderTopWidth: 1, borderRadius: 6, marginHorizontal: -4,
  },
  timingText: { fontSize: 12, fontWeight: '600' },
  inputLabel: {
    fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 2,
  },
  input: {
    borderWidth: 1, borderRadius: borderRadius.m,
    padding: spacing.m, fontSize: 15, marginBottom: spacing.m
  },
  previewBox: {
    borderWidth: 1, borderRadius: borderRadius.m,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: spacing.m,
  },
  submitBtn: {
    padding: spacing.m, borderRadius: borderRadius.m,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
});
