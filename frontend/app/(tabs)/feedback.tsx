import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useTheme, spacing, borderRadius } from '../../src/theme/theme';
import { api } from '../../src/services/api';
import { useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface Feedback {
  _id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Complaint': 'exclamation-circle',
  'Suggestion': 'lightbulb-o',
  'Appreciation': 'heart',
  'Bug': 'bug',
  'Other': 'comment',
};

export default function FeedbackScreen() {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeedbacks = async () => {
    try {
      const res = await api.get('/feedback');
      setFeedbacks(res.data);
    } catch (e) {
      console.log('Error fetching feedback', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFeedbacks();
    }, [])
  );

  const getStatusColor = (status: string) => {
    if (status === 'Resolved') return colors.success;
    if (status === 'In Progress') return colors.warning;
    return colors.primary;
  };

  const renderItem = ({ item }: { item: Feedback }) => {
    const iconName = (CATEGORY_ICONS[item.category] || 'comment') as any;
    const statusColor = getStatusColor(item.status);
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.cardAccent, { backgroundColor: statusColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
                <FontAwesome name={iconName} size={14} color={colors.primary} />
              </View>
              <Text style={[styles.category, { color: colors.text }]}>{item.category}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}15` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
            </View>
          </View>

          <Text style={[styles.message, { color: colors.textSecondary }]}>{item.message}</Text>

          {item.created_at && (
            <View style={styles.dateRow}>
              <FontAwesome name="clock-o" size={10} color={colors.textMuted} />
              <Text style={[styles.dateText, { color: colors.textMuted }]}>
                {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Feedback</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {feedbacks.length} submission{feedbacks.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>Loading feedback...</Text>
        </View>
      ) : (
        <FlatList
          data={feedbacks}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchFeedbacks(); }}
              tintColor={colors.primary}
            />
          }
          renderItem={renderItem}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
                <FontAwesome name="comments-o" size={32} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No feedback yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Member submissions will appear here
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.m,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 3 },
  listContent: { padding: spacing.m, paddingBottom: 100 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Card
  card: {
    flexDirection: 'row',
    borderRadius: borderRadius.l,
    marginBottom: spacing.m,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: spacing.m },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  category: { fontSize: 15, fontWeight: '700' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  message: { fontSize: 14, lineHeight: 20, marginBottom: spacing.s },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 11 },

  // Empty
  emptyContainer: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySubtitle: { fontSize: 13 },
});
