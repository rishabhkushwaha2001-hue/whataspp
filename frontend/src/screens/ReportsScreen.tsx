import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Modal, Linking,
} from 'react-native';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useCachedParallelFetch } from '../hooks/useDataStore';
import { Skeleton } from '../components/Skeleton';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CHART_W = width - spacing.l * 2 - 32;

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
  n >= 1000   ? `₹${(n / 1000).toFixed(1)}k`   : `₹${Math.round(n)}`;

const fmtDate = (d: Date) =>
  `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayNames   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── Pure-JS Calendar Picker Modal ───────────────────────────────────────────
const CalendarPicker = ({ visible, title, selected, onSelect, onClose }: {
  visible: boolean; title: string; selected: Date | null;
  onSelect: (d: Date) => void; onClose: () => void;
}) => {
  const { colors } = useTheme();
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(selected?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth()     ?? today.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const isSel   = (d: number) => selected?.getFullYear() === viewYear && selected?.getMonth() === viewMonth && selected?.getDate() === d;
  const isTod   = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} activeOpacity={1} />
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: spacing.l, width: width - 40 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{title}</Text>
            <TouchableOpacity onPress={onClose}><FontAwesome name="times" size={18} color={colors.textMuted} /></TouchableOpacity>
          </View>
          {/* Month nav */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <TouchableOpacity onPress={prevMonth} style={{ padding: 10, borderRadius: 20, backgroundColor: `${colors.primary}15` }}>
              <FontAwesome name="chevron-left" size={14} color={colors.primary} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{monthNames[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={{ padding: 10, borderRadius: 20, backgroundColor: `${colors.primary}15` }}>
              <FontAwesome name="chevron-right" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {/* Day headers */}
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {dayNames.map(d => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>{d}</Text>
            ))}
          </View>
          {/* Day grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', marginBottom: 4 }}>
              {row.map((day, ci) => (
                <TouchableOpacity
                  key={ci} disabled={!day}
                  style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999,
                    backgroundColor: day && isSel(day) ? colors.primary : day && isTod(day) ? `${colors.primary}20` : 'transparent' }}
                  onPress={() => { if (day) { onSelect(new Date(viewYear, viewMonth, day)); onClose(); } }}
                >
                  {day ? (
                    <Text style={{ fontSize: 14, fontWeight: isSel(day) || isTod(day) ? '700' : '400',
                      color: isSel(day) ? '#fff' : isTod(day) ? colors.primary : colors.text }}>{day}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {/* Today shortcut */}
          <TouchableOpacity
            style={{ marginTop: 12, alignItems: 'center', padding: 10, borderRadius: borderRadius.s,
              backgroundColor: `${colors.primary}15`, borderWidth: 1, borderColor: `${colors.primary}30` }}
            onPress={() => { onSelect(new Date()); onClose(); }}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, accent }: any) => {
  const { colors } = useTheme();
  return (
    <View style={[kpiStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[kpiStyles.iconBox, { backgroundColor: `${accent}20` }]}>
        <FontAwesome name={icon} size={16} color={accent} />
      </View>
      <Text style={[kpiStyles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[kpiStyles.label, { color: colors.textMuted }]}>{label}</Text>
      {sub ? <Text style={[kpiStyles.sub, { color: sub.startsWith('+') ? '#10B981' : '#EF4444' }]}>{sub}</Text> : null}
    </View>
  );
};
const kpiStyles = StyleSheet.create({
  card: { width: (width - spacing.l * 2 - spacing.m) / 2, padding: spacing.m, borderRadius: borderRadius.l, borderWidth: 1, marginBottom: spacing.m },
  iconBox: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  sub:   { fontSize: 11, fontWeight: '700', marginTop: 4 },
});

const SectionTitle = ({ children, color }: any) => (
  <Text style={{ fontSize: 16, fontWeight: '800', color, marginBottom: spacing.m, marginTop: spacing.l }}>{children}</Text>
);

const Card = ({ children, style, colors }: any) => (
  <View style={[{ backgroundColor: colors.surface, borderRadius: borderRadius.l, padding: spacing.m, borderWidth: 1, borderColor: colors.border, ...shadows.light }, style]}>
    {children}
  </View>
);

// ── Date range picker (uses pure-JS CalendarPicker) ─────────────────────────
const DateRangePicker = ({ startDate, endDate, onStart, onEnd }: any) => {
  const { colors } = useTheme();
  const [showStart, setShowStart] = useState(false);
  const [showEnd,   setShowEnd]   = useState(false);

  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.s,
            padding: 12, borderWidth: 1, borderColor: showStart ? colors.primary : colors.border,
            flexDirection: 'row', alignItems: 'center', gap: 8 }}
          onPress={() => { setShowEnd(false); setShowStart(true); }}
        >
          <Text style={{ fontSize: 14 }}>📅</Text>
          <Text style={{ color: startDate ? colors.text : colors.textMuted, fontSize: 13 }}>
            {startDate ? fmtDate(startDate) : 'Start Date'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.s,
            padding: 12, borderWidth: 1, borderColor: showEnd ? colors.primary : colors.border,
            flexDirection: 'row', alignItems: 'center', gap: 8 }}
          onPress={() => { setShowStart(false); setShowEnd(true); }}
        >
          <Text style={{ fontSize: 14 }}>📅</Text>
          <Text style={{ color: endDate ? colors.text : colors.textMuted, fontSize: 13 }}>
            {endDate ? fmtDate(endDate) : 'End Date'}
          </Text>
        </TouchableOpacity>
      </View>

      <CalendarPicker visible={showStart} title="Select Start Date"
        selected={startDate} onSelect={onStart} onClose={() => setShowStart(false)} />
      <CalendarPicker visible={showEnd} title="Select End Date"
        selected={endDate} onSelect={onEnd} onClose={() => setShowEnd(false)} />
    </View>
  );
};

// ── Payment Method Donut (custom, no extra lib) ────────────────────────────
const PaymentMethodBar = ({ data, colors }: any) => {
  const COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#EC4899'];
  const total = data.reduce((s: number, d: any) => s + d.total, 0);
  if (!total) return null;
  return (
    <View>
      <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
        {data.map((d: any, i: number) => (
          <View key={i} style={{ flex: d.total / total, backgroundColor: COLORS[i % COLORS.length] }} />
        ))}
      </View>
      {data.map((d: any, i: number) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS[i % COLORS.length] }} />
            <Text style={{ color: colors.text, fontSize: 13 }}>{d.method}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>({d.count} txns)</Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{fmt(d.total)}</Text>
        </View>
      ))}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════
type TabKey = 'Overview' | 'Revenue' | 'Members' | 'Attendance' | 'Finance' | 'AI' | 'Activity' | 'Retention';

export const ReportsScreen = () => {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
  const [revPeriod, setRevPeriod] = useState<'month' | 'yearly' | 'custom'>('month');
  const [startDateObj, setStartDateObj] = useState<Date | null>(null);
  const [endDateObj,   setEndDateObj]   = useState<Date | null>(null);
  const [expiryDays, setExpiryDays] = useState(30);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const now    = new Date();
  // Selected month state — default = current month
  const [selMonth, setSelMonth] = useState(now.getMonth()); // 0-indexed
  const [selYear,  setSelYear]  = useState(now.getFullYear());

  const curMo = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`;
  const curYr = now.getFullYear();
  const sd = startDateObj ? startDateObj.toISOString().split('T')[0] : '';
  const ed = endDateObj   ? endDateObj.toISOString().split('T')[0]   : '';

  // Key changes when dates/month change → forces a fresh fetch
  const dailyKey = revPeriod === 'custom' && sd && ed
    ? `an_daily_${sd}_${ed}`
    : `an_daily_${curMo}`;

  const fetchConfig = useMemo(() => [
    { key: 'an_status',      endpoint: '/analytics/status-counts' },
    { key: 'an_summary',     endpoint: '/analytics/summary' },
    { key: dailyKey,         endpoint: revPeriod === 'custom' && sd && ed
        ? `/analytics/revenue/daily?start_date=${sd}&end_date=${ed}`
        : `/analytics/revenue/daily?month=${curMo}` },
    { key: `an_monthly_${curYr}`,   endpoint: `/analytics/revenue/monthly?year=${curYr}` },
    { key: `an_methods_${curMo}`,   endpoint: `/analytics/payment-methods?month=${curMo}` },
    { key: `an_growth_${curYr}`,    endpoint: `/analytics/member-growth?year=${curYr}` },
    { key: `an_expiry_${expiryDays}`, endpoint: `/analytics/expiry-alerts?days=${expiryDays}` },
    { key: `an_att_${curMo}`,       endpoint: `/analytics/attendance-stats?month=${curMo}` },
    { key: `an_plan_${curMo}`,      endpoint: `/analytics/plan-breakdown?month=${curMo}` },
    { key: `an_pl_${curYr}`,        endpoint: `/analytics/profit-loss?year=${curYr}` },
    { key: 'an_insights',           endpoint: '/analytics/insights' },
    { key: `an_activity_${curMo}`,  endpoint: `/analytics/member-activity?month=${curMo}` },
  ], [curMo, curYr, revPeriod, sd, ed, expiryDays, dailyKey]);

  const { results, loading, refresh } = useCachedParallelFetch(fetchConfig);

  // Month picker modal helper
  const MonthPickerModal = () => {
    const years = [curYr - 2, curYr - 1, curYr];
    if (!showMonthPicker) return null;
    return (
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999,
        justifyContent: 'flex-end',
      }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowMonthPicker(false)} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.l }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.m }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Select Month</Text>
            <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
              <FontAwesome name="times" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {/* Year row */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.m }}>
            {years.map(y => (
              <TouchableOpacity
                key={y}
                style={{ flex: 1, paddingVertical: 8, borderRadius: borderRadius.s, alignItems: 'center',
                  backgroundColor: selYear === y ? colors.primary : colors.background,
                  borderWidth: 1, borderColor: selYear === y ? colors.primary : colors.border }}
                onPress={() => setSelYear(y)}
              >
                <Text style={{ color: selYear === y ? '#fff' : colors.text, fontWeight: '700' }}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Month grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {monthNames.map((mn, i) => {
              const isActive = selMonth === i && selYear === selYear;
              return (
                <TouchableOpacity
                  key={i}
                  style={{ width: (width - spacing.l * 2 - 8 * 3) / 4, paddingVertical: 12,
                    borderRadius: borderRadius.s, alignItems: 'center',
                    backgroundColor: selMonth === i ? colors.primary : colors.background,
                    borderWidth: 1, borderColor: selMonth === i ? colors.primary : colors.border }}
                  onPress={() => {
                    setSelMonth(i);
                    setRevPeriod('month');
                    setShowMonthPicker(false);
                  }}
                >
                  <Text style={{ color: selMonth === i ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>{mn}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  // ── Skeleton ──────────────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <View style={{ gap: spacing.m }}>
      <View style={{ flexDirection: 'row', gap: spacing.m }}>
        <Skeleton width={(width - spacing.l * 2 - spacing.m) / 2} height={110} borderRadius={borderRadius.l} />
        <Skeleton width={(width - spacing.l * 2 - spacing.m) / 2} height={110} borderRadius={borderRadius.l} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.m }}>
        <Skeleton width={(width - spacing.l * 2 - spacing.m) / 2} height={110} borderRadius={borderRadius.l} />
        <Skeleton width={(width - spacing.l * 2 - spacing.m) / 2} height={110} borderRadius={borderRadius.l} />
      </View>
      <Skeleton width="100%" height={220} borderRadius={borderRadius.l} />
      <Skeleton width="100%" height={160} borderRadius={borderRadius.l} />
    </View>
  );

  // ── TAB: Overview ─────────────────────────────────────────────────────────
  const renderOverview = () => {
    const s  = results?.an_summary  || {};
    const st = results?.an_status   || {};
    const pl = results?.[`an_pl_${curYr}`] || results?.an_pl || [];

    const revChg = s.rev_change_pct || 0;
    const revSub = revChg !== 0 ? `${revChg > 0 ? '+' : ''}${revChg}% vs last month` : undefined;

    // Profit / Loss bar data for current year
    const plData = pl.map((r: any) => ({
      value: Math.max(r.profit, 0),
      negativeValue: Math.max(-r.profit, 0),
      label: r.label,
      frontColor: r.profit >= 0 ? '#10B981' : '#EF4444',
    }));

    return (
      <>
        {/* KPI Cards */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m }}>
          <KpiCard icon="rupee"        label="Revenue This Month"  value={fmt(s.cur_revenue || 0)}  sub={revSub}  accent="#8B5CF6" />
          <KpiCard icon="users"        label="Active Members"       value={st.active || 0}            accent="#10B981" />
          <KpiCard icon="user-plus"    label="New This Month"       value={s.new_members || 0}        accent="#3B82F6" />
          <KpiCard icon="line-chart"   label="Net Profit"           value={fmt(s.net_profit || 0)}    accent={s.net_profit >= 0 ? '#10B981' : '#EF4444'} />
        </View>

        {/* Member status mini-row */}
        <Card colors={colors} style={{ marginBottom: spacing.s }}>
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 12 }}>Member Snapshot</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[
              { label: 'Active',    value: st.active    || 0, color: '#10B981' },
              { label: 'Expired',   value: st.expired   || 0, color: '#EF4444' },
              { label: 'Inactive',  value: st.inactive  || 0, color: '#9CA3AF' },
              { label: 'Due Soon',  value: st.expiring_soon || 0, color: '#F59E0B' },
            ].map((item, i) => (
              <View key={i} style={{ alignItems: 'center' }}>
                <Text style={{ color: item.color, fontSize: 22, fontWeight: '800' }}>{item.value}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Monthly P&L Chart */}
        <SectionTitle color={colors.text}>Profit & Loss — {curYr}</SectionTitle>
        <Card colors={colors}>
          {plData.length > 0 ? (
            <BarChart
              data={plData}
              width={CHART_W}
              height={180}
              barWidth={18}
              spacing={8}
              noOfSections={4}
              xAxisColor={colors.border}
              yAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              isAnimated
              renderTooltip={(item: any) => (
                <View style={{ backgroundColor: colors.surface, padding: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.text, fontSize: 11 }}>{fmt(item.value || 0)}</Text>
                </View>
              )}
            />
          ) : (
            <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted }}>No data yet</Text>
            </View>
          )}
        </Card>
      </>
    );
  };

  // ── TAB: Revenue ──────────────────────────────────────────────────────────
  const renderRevenue = () => {
    const daily   = results?.[dailyKey]           || [];
    const monthly = results?.[`an_monthly_${curYr}`] || [];
    const methods = results?.[`an_methods_${curMo}`] || [];
    const plans   = results?.[`an_plan_${curMo}`]    || [];
    const summary = results?.['an_summary']          || {};

    // Chart data
    let chartData: any[] = [];
    if (revPeriod === 'month' || revPeriod === 'custom') {
      const map: Record<string, number> = {};
      daily.forEach((p: any) => {
        const d = (p.payment_date || '').split('T')[0];
        map[d] = (map[d] || 0) + p.amount;
      });
      Object.keys(map).sort().forEach(d => {
        chartData.push({ value: map[d], label: d.substring(8, 10) });
      });
    } else {
      chartData = monthly.map((m: any) => ({ value: m.total, label: monthNames[m.month - 1] }));
    }

    // Ensure chart renders beautifully even with 1 data point
    if (chartData.length === 1) {
      chartData = [
        { value: 0, label: 'Start' },
        ...chartData
      ];
    }

    const totalRevenue = daily.reduce((s: number, p: any) => s + p.amount, 0);
    const txCount = daily.length;
    const avgTicket = txCount > 0 ? Math.round(totalRevenue / txCount) : 0;
    const selectedMonthLabel = `${monthNames[selMonth]} ${selYear}`;

    const revChangePct = summary.rev_change_pct ?? 0;
    const revTrend = revChangePct >= 0 ? 'up' : 'down';
    const revChangeStr = revChangePct >= 0 ? `+${revChangePct}%` : `${revChangePct}%`;

    return (
      <>
        {/* Period Selector Bar */}
        <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.l, padding: 6,
          flexDirection: 'row', gap: 6, marginBottom: spacing.m,
          borderWidth: 1, borderColor: colors.border }}>
          {/* Month button */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              paddingVertical: 10, borderRadius: borderRadius.m,
              backgroundColor: revPeriod === 'month' ? colors.primary : 'transparent' }}
            onPress={() => { setRevPeriod('month'); setShowMonthPicker(true); }}
          >
            <FontAwesome name="calendar" size={12} color={revPeriod === 'month' ? '#fff' : colors.textMuted} />
            <Text style={{ color: revPeriod === 'month' ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '700' }}>
              {revPeriod === 'month' ? selectedMonthLabel : 'Month'}
            </Text>
            <FontAwesome name="caret-down" size={10} color={revPeriod === 'month' ? '#fff' : colors.textMuted} />
          </TouchableOpacity>

          {/* Yearly button */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              paddingVertical: 10, borderRadius: borderRadius.m,
              backgroundColor: revPeriod === 'yearly' ? colors.primary : 'transparent' }}
            onPress={() => setRevPeriod('yearly')}
          >
            <FontAwesome name="bar-chart" size={12} color={revPeriod === 'yearly' ? '#fff' : colors.textMuted} />
            <Text style={{ color: revPeriod === 'yearly' ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '700' }}>Yearly</Text>
          </TouchableOpacity>

          {/* Custom button */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              paddingVertical: 10, borderRadius: borderRadius.m,
              backgroundColor: revPeriod === 'custom' ? colors.primary : 'transparent' }}
            onPress={() => setRevPeriod('custom')}
          >
            <FontAwesome name="sliders" size={12} color={revPeriod === 'custom' ? '#fff' : colors.textMuted} />
            <Text style={{ color: revPeriod === 'custom' ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '700' }}>Custom</Text>
          </TouchableOpacity>
        </View>

        {/* Custom date range pickers */}
        {revPeriod === 'custom' && (
          <DateRangePicker
            startDate={startDateObj} endDate={endDateObj}
            onStart={setStartDateObj} onEnd={setEndDateObj}
          />
        )}

        {/* Hero Revenue Summary Card with Growth Arrow */}
        <LinearGradient
          colors={isDark ? ['#1E1B4B', '#312E81'] : ['#EEF2FF', '#E0E7FF']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{
            borderRadius: borderRadius.l,
            padding: spacing.l,
            marginBottom: spacing.l,
            borderWidth: 1,
            borderColor: isDark ? '#4338CA' : '#C7D2FE',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 13, color: isDark ? '#A5B4FC' : '#4F46E5', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {revPeriod === 'month' ? `Total Collected (${selectedMonthLabel})` : revPeriod === 'yearly' ? `Total Collected (${curYr})` : 'Total Collected'}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '900', color: isDark ? '#FFF' : '#1E1B4B', marginTop: 4 }}>
                {fmt(totalRevenue)}
              </Text>
            </View>
            {revPeriod === 'month' && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: revTrend === 'up' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 20,
                gap: 4
              }}>
                <FontAwesome name={revTrend === 'up' ? 'arrow-up' : 'arrow-down'} size={12} color={revTrend === 'up' ? '#10B981' : '#EF4444'} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: revTrend === 'up' ? '#10B981' : '#EF4444' }}>
                  {revChangeStr}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', paddingTop: 10 }}>
            <View>
              <Text style={{ fontSize: 11, color: isDark ? '#A5B4FC' : '#6366F1' }}>Transactions</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#FFF' : '#1E1B4B' }}>{txCount}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: isDark ? '#A5B4FC' : '#6366F1' }}>Avg Ticket Size</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#FFF' : '#1E1B4B' }}>{fmt(avgTicket)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Revenue Trend Chart */}
        <SectionTitle color={colors.text}>
          {revPeriod === 'month' ? `Daily Collection Chart` :
           revPeriod === 'custom' && sd && ed ? `Revenue — ${sd} to ${ed}` :
           `Monthly Revenue Trend (${curYr})`}
        </SectionTitle>
        <Card colors={colors}>
          {chartData.length > 0 ? (
            <LineChart
              data={chartData}
              width={CHART_W - 20}
              height={200}
              color={colors.primary}
              thickness={3}
              curved
              initialSpacing={20}
              endSpacing={20}
              dataPointsColor={colors.primary}
              dataPointsRadius={4}
              startFillColor={`${colors.primary}60`}
              endFillColor={`${colors.primary}00`}
              areaChart
              xAxisColor={colors.border}
              yAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              isAnimated
            />
          ) : (
            <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted }}>No payment data for this period</Text>
            </View>
          )}
          {totalRevenue > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12,
              paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Total Collected</Text>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>{fmt(totalRevenue)}</Text>
            </View>
          )}
        </Card>

        {/* Payment Method Breakdown */}
        {methods.length > 0 && (
          <>
            <SectionTitle color={colors.text}>Payment Method Breakdown</SectionTitle>
            <Card colors={colors}>
              <PaymentMethodBar data={methods} colors={colors} />
            </Card>
          </>
        )}

        {/* Plan-wise Revenue */}
        {plans.length > 0 && (
          <>
            <SectionTitle color={colors.text}>Plan-wise Revenue</SectionTitle>
            <Card colors={colors}>
              {plans.map((p: any, i: number) => {
                const planLabel = p.plan_months === 1 ? '1 Month' :
                                  p.plan_months === 3 ? '3 Months' :
                                  p.plan_months === 6 ? '6 Months' :
                                  p.plan_months === 12 ? '1 Year' : `${p.plan_months} Months`;
                const planTotal = plans.reduce((s: number, x: any) => s + x.total, 0);
                const pct = planTotal > 0 ? Math.round((p.total / planTotal) * 100) : 0;
                return (
                  <View key={i} style={{ marginBottom: i < plans.length - 1 ? 14 : 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{planLabel}</Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{fmt(p.total)} <Text style={{ color: colors.textMuted, fontWeight: '400' }}>({p.count} members)</Text></Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: colors.background, borderRadius: 3 }}>
                      <View style={{ width: `${pct}%`, height: 6, backgroundColor: colors.primary, borderRadius: 3 }} />
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Date-wise Grouped Payment History */}
        {(revPeriod === 'month' || revPeriod === 'custom') && (() => {
          if (!daily.length) return (
            <Card colors={colors} style={{ marginTop: spacing.s }}>
              <SectionTitle color={colors.text}>Payment History</SectionTitle>
              <Text style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.m }}>No payments in this period</Text>
            </Card>
          );

          // Group by date
          const grouped: Record<string, any[]> = {};
          daily.forEach((p: any) => {
            const dateKey = (p.payment_date || '').split('T')[0];
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(p);
          });
          const sortedDates = Object.keys(grouped).sort().reverse(); // newest first

          const METHOD_COLORS: Record<string, string> = {
            'cash': '#10B981', 'upi': '#8B5CF6', 'online': '#3B82F6',
            'card': '#F59E0B', 'bank transfer': '#EC4899',
          };
          const methodColor = (m: string) => METHOD_COLORS[(m || '').toLowerCase()] || '#9CA3AF';

          return (
            <>
              <SectionTitle color={colors.text}>Day-wise Payment History</SectionTitle>
              {sortedDates.map(dateKey => {
                const payments = grouped[dateKey];
                const dayTotal = payments.reduce((s: number, p: any) => s + p.amount, 0);
                const date = new Date(dateKey);
                const dayLabel = date.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' });
                return (
                  <View key={dateKey} style={{ marginBottom: spacing.m }}>
                    {/* Date header */}
                    <View style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingHorizontal: spacing.s, paddingVertical: 6, marginBottom: 4,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 3, height: 16, backgroundColor: colors.primary, borderRadius: 2 }} />
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>{dayLabel}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ backgroundColor: `${colors.primary}15`, borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>{payments.length} payments</Text>
                        </View>
                        <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 14 }}>+{fmt(dayTotal)}</Text>
                      </View>
                    </View>

                    {/* Members list for this date */}
                    <Card colors={colors} style={{ padding: 0 }}>
                      {payments.map((p: any, i: number) => (
                        <View key={i} style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingHorizontal: spacing.m, paddingVertical: 14,
                          borderBottomWidth: i < payments.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                        }}>
                          {/* Avatar initial */}
                          <View style={{
                            width: 40, height: 40, borderRadius: 20, marginRight: 12,
                            backgroundColor: `${colors.primary}20`,
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>
                              {(p.member_name || '?')[0].toUpperCase()}
                            </Text>
                          </View>

                          {/* Name + phone */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                              {p.member_name || 'Unknown'}
                            </Text>
                            {p.member_phone ? (
                              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                                📞 {p.member_phone}
                              </Text>
                            ) : null}
                          </View>

                          {/* Method badge + amount */}
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 15 }}>
                              +₹{p.amount}
                            </Text>
                            {p.payment_method ? (
                              <View style={{
                                backgroundColor: `${methodColor(p.payment_method)}20`,
                                borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2,
                              }}>
                                <Text style={{ color: methodColor(p.payment_method), fontWeight: '700', fontSize: 10, textTransform: 'uppercase' }}>
                                  {p.payment_method}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </Card>
                  </View>
                );
              })}
            </>
          );
        })()}
      </>
    );
  };

  // ── TAB: Members ──────────────────────────────────────────────────────────
  const renderMembers = () => {
    const st     = results?.an_status  || {};
    const growth = results?.[`an_growth_${curYr}`] || results?.an_growth || [];
    const expiry = results?.[`an_expiry_${expiryDays}`] || results?.an_expiry || [];

    const growthChart = growth.map((g: any) => ({
      stacks: [
        { value: g.new,     color: '#8B5CF6' },
        { value: g.renewal, color: '#10B981' },
      ],
      label: monthNames[g.month - 1].substring(0, 1),
    }));

    return (
      <>
        {/* Status Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m }}>
          {[
            { label: 'Active',   value: st.active,         color: '#10B981', icon: 'check-circle' },
            { label: 'Expired',  value: st.expired,        color: '#EF4444', icon: 'times-circle' },
            { label: 'Inactive', value: st.inactive,       color: '#9CA3AF', icon: 'minus-circle' },
            { label: 'Due Soon', value: st.expiring_soon,  color: '#F59E0B', icon: 'clock-o' },
          ].map((s, i) => (
            <View key={i} style={[kpiStyles.card, { backgroundColor: colors.surface, borderColor: `${s.color}30` }]}>
              <View style={[kpiStyles.iconBox, { backgroundColor: `${s.color}15` }]}>
                <FontAwesome name={s.icon as any} size={16} color={s.color} />
              </View>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>{s.value || 0}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* New vs Renewal Chart */}
        <SectionTitle color={colors.text}>New vs Renewal — {curYr}</SectionTitle>
        <Card colors={colors}>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#8B5CF6' }} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>New</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' }} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Renewal</Text>
            </View>
          </View>
          {growthChart.some((g: any) => g.stacks.some((s: any) => s.value > 0)) ? (
            <BarChart
              stackData={growthChart}
              width={CHART_W}
              height={160}
              barWidth={18}
              spacing={8}
              xAxisColor={colors.border}
              yAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              isAnimated
            />
          ) : (
            <View style={{ height: 160, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted }}>No data yet</Text>
            </View>
          )}
        </Card>

        {/* Expiry Alerts */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.l }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Expiry Alerts</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[7, 15, 30].map(d => (
              <TouchableOpacity
                key={d}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full,
                  backgroundColor: expiryDays === d ? '#F59E0B20' : colors.surface,
                  borderWidth: 1, borderColor: expiryDays === d ? '#F59E0B' : colors.border }}
                onPress={() => setExpiryDays(d)}
              >
                <Text style={{ color: expiryDays === d ? '#F59E0B' : colors.textMuted, fontSize: 11, fontWeight: '700' }}>{d}d</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Card colors={colors} style={{ marginTop: spacing.s, padding: 0 }}>
          {expiry.length > 0 ? expiry.map((m: any, i: number) => {
            const isRed = m.days_left <= 3;
            return (
              <View key={`${m._id || m.id || 'exp'}_${i}`} style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingHorizontal: spacing.m, paddingVertical: 14,
                borderBottomWidth: i < expiry.length - 1 ? 1 : 0, borderBottomColor: colors.border,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{m.full_name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{m.phone}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ backgroundColor: isRed ? '#EF444420' : '#F59E0B20', borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ color: isRed ? '#EF4444' : '#F59E0B', fontWeight: '700', fontSize: 12 }}>
                      {m.days_left < 0 ? `Expired ${Math.abs(m.days_left)}d ago` : m.days_left === 0 ? 'Today!' : `${m.days_left}d left`}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                    {new Date(m.next_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
              </View>
            );
          }) : (
            <Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.l }}>
              No members expiring in next {expiryDays} days 🎉
            </Text>
          )}
        </Card>
      </>
    );
  };

  // ── TAB: Attendance ───────────────────────────────────────────────────────
  const renderAttendance = () => {
    const att = results?.[`an_att_${curMo}`] || [];
    const chartData = att.map((a: any) => ({
      value: a.count,
      label: a.date ? a.date.substring(8, 10) : '',
      frontColor: '#8B5CF6',
    }));
    const totalVisits = att.reduce((s: number, a: any) => s + a.count, 0);
    const peakDay = att.reduce((max: any, a: any) => (!max || a.count > max.count) ? a : max, null);
    const avgVisits = att.length > 0 ? (totalVisits / att.length).toFixed(1) : '0';

    return (
      <>
        {/* Summary KPIs */}
        <View style={{ flexDirection: 'row', gap: spacing.m }}>
          <View style={[kpiStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[kpiStyles.iconBox, { backgroundColor: '#8B5CF620' }]}>
              <FontAwesome name="calendar-check-o" size={16} color="#8B5CF6" />
            </View>
            <Text style={[kpiStyles.value, { color: colors.text }]}>{totalVisits}</Text>
            <Text style={[kpiStyles.label, { color: colors.textMuted }]}>Total Visits</Text>
          </View>
          <View style={[kpiStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[kpiStyles.iconBox, { backgroundColor: '#10B98120' }]}>
              <FontAwesome name="bar-chart" size={16} color="#10B981" />
            </View>
            <Text style={[kpiStyles.value, { color: colors.text }]}>{avgVisits}/day</Text>
            <Text style={[kpiStyles.label, { color: colors.textMuted }]}>Daily Average</Text>
          </View>
        </View>

        {peakDay && (
          <Card colors={colors} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s }}>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Peak Day This Month</Text>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 2 }}>
                {peakDay.date ? new Date(peakDay.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
              </Text>
            </View>
            <View style={{ backgroundColor: '#8B5CF620', borderRadius: borderRadius.full, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: '#8B5CF6', fontWeight: '800', fontSize: 16 }}>{peakDay.count} visits</Text>
            </View>
          </Card>
        )}

        <SectionTitle color={colors.text}>Daily Visit Count — {monthNames[now.getMonth()]} {curYr}</SectionTitle>
        <Card colors={colors}>
          {chartData.length > 0 ? (
            <BarChart
              data={chartData}
              width={CHART_W}
              height={200}
              barWidth={12}
              spacing={6}
              noOfSections={4}
              xAxisColor={colors.border}
              yAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              isAnimated
            />
          ) : (
            <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted }}>No attendance data this month</Text>
            </View>
          )}
        </Card>
      </>
    );
  };

  // ── TAB: Finance ──────────────────────────────────────────────────────────
  const renderFinance = () => {
    const pl  = results?.[`an_pl_${curYr}`]  || [];
    const s   = results?.an_summary || {};

    const totalRev = pl.reduce((x: number, r: any) => x + r.revenue, 0);
    const totalExp = pl.reduce((x: number, r: any) => x + r.expense, 0);
    const totalPro = totalRev - totalExp;

    const revData = pl.map((r: any) => ({ value: r.revenue, label: r.label, frontColor: '#8B5CF6' }));
    const expData = pl.map((r: any) => ({ value: r.expense, label: r.label, frontColor: '#EF4444' }));
    const combined = pl.map((r: any, i: number) => ({
      stacks: [
        { value: r.revenue, color: '#8B5CF6' },
        { value: r.expense, color: '#EF4444' },
      ],
      label: r.label.substring(0, 1),
    }));

    return (
      <>
        {/* Finance Summary */}
        <View style={{ flexDirection: 'row', gap: spacing.m }}>
          <KpiCard icon="rupee"       label="Total Revenue"  value={fmt(totalRev)} accent="#8B5CF6" />
          <KpiCard icon="money"       label="Total Expense"  value={fmt(totalExp)} accent="#EF4444" />
        </View>
        <Card colors={colors} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.m }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Net Profit — {curYr}</Text>
          <Text style={{ fontWeight: '800', fontSize: 20, color: totalPro >= 0 ? '#10B981' : '#EF4444' }}>
            {totalPro >= 0 ? '+' : ''}{fmt(totalPro)}
          </Text>
        </Card>

        {/* Revenue vs Expense chart */}
        <SectionTitle color={colors.text}>Revenue vs Expense</SectionTitle>
        <Card colors={colors}>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#8B5CF6' }} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Revenue</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' }} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Expense</Text>
            </View>
          </View>
          {combined.some((c: any) => c.stacks.some((s: any) => s.value > 0)) ? (
            <BarChart
              stackData={combined}
              width={CHART_W}
              height={200}
              barWidth={18}
              spacing={8}
              xAxisColor={colors.border}
              yAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              isAnimated
            />
          ) : (
            <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted }}>No data yet for {curYr}</Text>
            </View>
          )}
        </Card>

        {/* Month-wise P&L Table */}
        <SectionTitle color={colors.text}>Monthly Breakdown</SectionTitle>
        <Card colors={colors} style={{ padding: 0 }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: spacing.m, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ flex: 1, color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>Month</Text>
            <Text style={{ width: 70, color: '#8B5CF6', fontSize: 12, fontWeight: '700', textAlign: 'right' }}>Revenue</Text>
            <Text style={{ width: 70, color: '#EF4444', fontSize: 12, fontWeight: '700', textAlign: 'right' }}>Expense</Text>
            <Text style={{ width: 70, color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'right' }}>Profit</Text>
          </View>
          {pl.map((r: any, i: number) => (
            <View key={i} style={{
              flexDirection: 'row', paddingHorizontal: spacing.m, paddingVertical: 12,
              borderBottomWidth: i < pl.length - 1 ? 1 : 0, borderBottomColor: colors.border,
              opacity: r.revenue === 0 && r.expense === 0 ? 0.4 : 1,
            }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: 13 }}>{r.label}</Text>
              <Text style={{ width: 70, color: '#8B5CF6', fontSize: 13, fontWeight: '600', textAlign: 'right' }}>{fmt(r.revenue)}</Text>
              <Text style={{ width: 70, color: '#EF4444', fontSize: 13, fontWeight: '600', textAlign: 'right' }}>{fmt(r.expense)}</Text>
              <Text style={{ width: 70, fontSize: 13, fontWeight: '700', textAlign: 'right', color: r.profit >= 0 ? '#10B981' : '#EF4444' }}>{fmt(r.profit)}</Text>
            </View>
          ))}
        </Card>
      </>
    );
  };

  // ── TAB: AI Insights ──────────────────────────────────────────────────────
  const renderAI = () => {
    const ai = results?.an_insights || {};
    const insights: any[]    = ai.insights    || [];
    const churnRisk: any[]   = ai.churn_risk  || [];
    const healthScore: number = ai.health_score ?? 0;
    const forecast: number   = ai.forecast    ?? 0;
    const bestMonth: any     = ai.best_month  || null;
    const peakDay: any       = ai.peak_day    || null;
    const popularPlan: any   = ai.popular_plan|| null;
    const stats: any         = ai.stats       || {};

    // Health Score Ring
    const RING_SIZE = 120;
    const STROKE = 10;
    const R = (RING_SIZE - STROKE) / 2;
    const CIRC = 2 * Math.PI * R;
    const score = Math.min(Math.max(healthScore, 0), 100);
    const dashOffset = CIRC - (score / 100) * CIRC;
    const ringColor = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';
    const scoreLabel = score >= 70 ? 'Excellent' : score >= 40 ? 'Average' : 'Needs Work';

    // Insight type → gradient colors
    const insightStyle = (type: string) => {
      const dark = isDark;
      if (type === 'success') return {
        grad: dark ? ['#064E3B','#065F46'] as any : ['#D1FAE5','#A7F3D0'] as any,
        icon: dark ? '#34D399' : '#059669',
        iconBg: dark ? 'rgba(52,211,153,0.15)' : 'white',
        border: dark ? '#065F46' : '#A7F3D0',
      };
      if (type === 'danger') return {
        grad: dark ? ['#7F1D1D','#991B1B'] as any : ['#FEE2E2','#FECACA'] as any,
        icon: dark ? '#F87171' : '#DC2626',
        iconBg: dark ? 'rgba(248,113,113,0.15)' : 'white',
        border: dark ? '#991B1B' : '#FECACA',
      };
      if (type === 'info') return {
        grad: dark ? ['#1E3A5F','#1E40AF'] as any : ['#DBEAFE','#BFDBFE'] as any,
        icon: dark ? '#60A5FA' : '#2563EB',
        iconBg: dark ? 'rgba(96,165,250,0.15)' : 'white',
        border: dark ? '#1E40AF' : '#BFDBFE',
      };
      if (type === 'tip') return {
        grad: dark ? ['#312E81','#3730A3'] as any : ['#EDE9FE','#DDD6FE'] as any,
        icon: dark ? '#A78BFA' : '#7C3AED',
        iconBg: dark ? 'rgba(167,139,250,0.15)' : 'white',
        border: dark ? '#3730A3' : '#DDD6FE',
      };
      // warning / default
      return {
        grad: dark ? ['#422006','#713F12'] as any : ['#FEF3C7','#FDE68A'] as any,
        icon: dark ? '#FBBF24' : '#D97706',
        iconBg: dark ? 'rgba(251,191,36,0.15)' : 'white',
        border: dark ? '#713F12' : '#FDE68A',
      };
    };

    const fmt = (n: number) =>
      n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
      n >= 1000   ? `₹${(n / 1000).toFixed(1)}k`  : `₹${Math.round(n)}`;

    return (
      <>
        {/* ── Gym Health Score ─────────────────────────────────────────────── */}
        <View style={aiStyles.scoreRow}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            {/* BG ring */}
            <Circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
              stroke={isDark ? '#2A2D3A' : '#E2E8F0'}
              strokeWidth={STROKE} fill="none"
            />
            {/* Progress ring */}
            <Circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
              stroke={ringColor} strokeWidth={STROKE} fill="none"
              strokeDasharray={`${CIRC}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
            />
            <SvgText
              x={RING_SIZE / 2} y={RING_SIZE / 2 - 8}
              textAnchor="middle" fill={ringColor}
              fontSize={28} fontWeight="800"
            >{score}</SvgText>
            <SvgText
              x={RING_SIZE / 2} y={RING_SIZE / 2 + 14}
              textAnchor="middle" fill={isDark ? 'rgba(255,255,255,0.5)' : '#6B7280'}
              fontSize={11} fontWeight="600"
            >{scoreLabel}</SvgText>
          </Svg>

          <View style={aiStyles.scoreStats}>
            <Text style={[aiStyles.scoreTitle, { color: colors.text }]}>Gym Health Score</Text>
            <Text style={[aiStyles.scoreSubtitle, { color: colors.textMuted }]}>Based on 4 factors</Text>
            <View style={{ marginTop: 14, gap: 8 }}>
              {[
                { label: 'Active Ratio',    value: `${stats.active_ratio ?? 0}%`, color: '#10B981' },
                { label: 'Revenue Growth',  value: `${stats.rev_growth_pct ?? 0}%`, color: stats.rev_growth_pct >= 0 ? '#10B981' : '#EF4444' },
                { label: 'Revenue / Mo',   value: fmt(stats.cur_revenue ?? 0),   color: '#8B5CF6' },
                { label: 'Forecast',       value: fmt(stats.forecast ?? 0),      color: '#3B82F6' },
              ].map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{s.label}</Text>
                  <Text style={{ color: s.color, fontSize: 12, fontWeight: '700' }}>{s.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Top Stats ────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: spacing.m, marginBottom: spacing.m }}>
          {bestMonth && (
            <View style={[aiStyles.statChip, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
              <FontAwesome name="trophy" size={14} color="#F59E0B" />
              <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>Best Month</Text>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>{bestMonth.month}</Text>
              <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 11 }}>{fmt(bestMonth.total)}</Text>
            </View>
          )}
          {peakDay && (
            <View style={[aiStyles.statChip, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
              <FontAwesome name="fire" size={14} color="#EF4444" />
              <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>Peak Day</Text>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>{peakDay.day}</Text>
              <Text style={{ color: '#8B5CF6', fontWeight: '700', fontSize: 11 }}>{peakDay.count} visits</Text>
            </View>
          )}
          {popularPlan && (
            <View style={[aiStyles.statChip, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
              <FontAwesome name="star" size={14} color="#8B5CF6" />
              <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>Top Plan</Text>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>{popularPlan.months}Mo</Text>
              <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 11 }}>{popularPlan.count} sold</Text>
            </View>
          )}
        </View>

        {/* ── Insight Cards ─────────────────────────────────────────────────── */}
        <Text style={[aiStyles.sectionHead, { color: colors.text }]}>🤖 Smart Insights</Text>
        {insights.length === 0 ? (
          <View style={[aiStyles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 32 }}>🧠</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>No insights available yet. Add more data!</Text>
          </View>
        ) : (
          insights.map((ins: any, idx: number) => {
            const s = insightStyle(ins.type);
            return (
              <View
                key={idx}
                style={[aiStyles.insightCard, { backgroundColor: isDark ? s.grad[0] : s.grad[0], borderColor: s.border }]}
              >
                <View style={[aiStyles.insightIconBox, { backgroundColor: s.iconBg }]}>
                  <FontAwesome name={(ins.icon as any) || 'magic'} size={16} color={s.icon} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[aiStyles.insightTitle, { color: s.icon }]}>{ins.title}</Text>
                  <Text style={[aiStyles.insightMsg, { color: isDark ? 'rgba(255,255,255,0.75)' : '#374151' }]}>
                    {ins.message}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        {/* ── Churn Risk ───────────────────────────────────────────────────── */}
        {churnRisk.length > 0 && (
          <>
            <Text style={[aiStyles.sectionHead, { color: colors.text, marginTop: spacing.l }]}>🚨 Churn Risk Members</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.m }}>
              Active members who haven't visited in 30+ days
            </Text>
            <View style={[aiStyles.churnCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {churnRisk.map((m: any, i: number) => (
                <View
                  key={`${m._id || m.id || 'churn'}_${i}`}
                  style={[aiStyles.churnRow,
                    { borderBottomColor: colors.border, borderBottomWidth: i < churnRisk.length - 1 ? 1 : 0 }
                  ]}
                >
                  <View style={aiStyles.churnAvatar}>
                    <Text style={[aiStyles.churnAvatarText, { color: colors.primary }]}>
                      {(m.full_name || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[aiStyles.churnName, { color: colors.text }]}>{m.full_name}</Text>
                    <Text style={[aiStyles.churnPhone, { color: colors.textMuted }]}>{m.phone}</Text>
                    {m.days_absent != null && (
                      <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 2, fontWeight: '600' }}>
                        Absent {m.days_absent} days
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={aiStyles.whatsappBtn}
                    onPress={() => {
                      const phone = (m.phone || '').replace(/\D/g, '');
                      const msg = `Hi ${m.full_name}, we miss you at the gym! Come back and crush your goals 💪`;
                      Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
                    }}
                  >
                    <FontAwesome name="whatsapp" size={18} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}
      </>
    );
  };

  // ── TAB: Activity (New Members + Renewals per day) ──────────────────────
  const renderActivity = () => {
    const activityData: any[] = results?.[`an_activity_${curMo}`] || [];
    const monthLabel = `${monthNames[selMonth]} ${selYear}`;

    const totalNew   = activityData.reduce((s: number, d: any) => s + (d.new_members?.length || 0), 0);
    const totalRenew = activityData.reduce((s: number, d: any) => s + (d.renewals?.length || 0), 0);

    // ── Inline Month-Year Picker ──────────────────────────────────────────
    // Last 5 years, oldest first
    const actYears = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 4 + i);

    // Filter state: null = all, 'new' = only new, 'renewal' = only renewals
    const actFilter: 'new' | 'renewal' | null = (expandedSections['__actFilter'] as any) ?? null;
    const setActFilter = (f: 'new' | 'renewal' | null) =>
      setExpandedSections(prev => ({ ...prev, __actFilter: f as any }));

    const MonthYearPicker = () => (
      <View style={{
        backgroundColor: colors.surface, borderRadius: borderRadius.l,
        borderWidth: 1, borderColor: colors.border,
        padding: spacing.m, marginBottom: spacing.m,
      }}>
        {/* Year row — horizontally scrollable (5 years) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingBottom: 2 }}
          style={{ marginBottom: 10 }}
        >
          {actYears.map(y => (
            <TouchableOpacity
              key={y}
              onPress={() => setSelYear(y)}
              style={{
                paddingHorizontal: 18, paddingVertical: 7, borderRadius: borderRadius.s,
                alignItems: 'center',
                backgroundColor: selYear === y ? colors.primary : colors.background,
                borderWidth: 1, borderColor: selYear === y ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: selYear === y ? '#fff' : colors.text, fontWeight: '700', fontSize: 13 }}>{y}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Month grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {monthNames.map((mn, i) => {
            const isActive = selMonth === i;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => { setSelMonth(i); setRevPeriod('month'); }}
                style={{
                  width: '22%', paddingVertical: 8, borderRadius: borderRadius.s,
                  alignItems: 'center',
                  backgroundColor: isActive ? colors.primary : colors.background,
                  borderWidth: 1, borderColor: isActive ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: isActive ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{mn}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );

    // ── Member Row (clickable → member details) ───────────────────────────
    const MemberRow = ({ member, type }: { member: any; type: 'new' | 'renewal' }) => {
      const isNew = type === 'new';
      const color = isNew ? '#8B5CF6' : '#10B981';
      const initials = (member.full_name || '?').substring(0, 2).toUpperCase();
      const timeStr = isNew ? member.joining_time : member.payment_time;
      return (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => router.push(`/members/${member._id}` as any)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingVertical: 10, paddingHorizontal: 12,
            backgroundColor: colors.background,
            borderRadius: 10, marginBottom: 5,
            borderWidth: 1, borderColor: `${color}25`,
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${color}18`, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color, fontWeight: '800', fontSize: 13 }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{member.full_name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{member.phone}</Text>
            {timeStr ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <FontAwesome name="clock-o" size={10} color={color} />
                <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{timeStr}</Text>
              </View>
            ) : null}
          </View>
          {!isNew && member.amount ? (
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={{ color, fontWeight: '800', fontSize: 14 }}>₹{member.amount}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 10 }}>collected</Text>
            </View>
          ) : null}
          <FontAwesome name="chevron-right" size={11} color={colors.textMuted} />
        </TouchableOpacity>
      );
    };


    // ── Collapsible Section (New / Renewal) ──────────────────────────────
    const CollapsibleSection = ({
      label, count, color, icon, members, type, dayKey,
    }: {
      label: string; count: number; color: string; icon: string;
      members: any[]; type: 'new' | 'renewal'; dayKey: string;
    }) => {
      const sectionKey = `${dayKey}_${type}`;
      const isOpen = expandedSections[sectionKey] !== false; // default open
      return (
        <View style={{
          backgroundColor: colors.surface, borderRadius: 12,
          borderWidth: 1, borderColor: `${color}25`,
          marginBottom: 8, overflow: 'hidden',
        }}>
          {/* Section header — tap to toggle */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              setExpandedSections(prev => ({ ...prev, [sectionKey]: !isOpen }))
            }
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingVertical: 10, paddingHorizontal: 12,
              backgroundColor: `${color}10`,
            }}
          >
            <View style={{
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: `${color}20`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <FontAwesome name={icon as any} size={13} color={color} />
            </View>
            <Text style={{ color, fontWeight: '800', fontSize: 13, flex: 1 }}>
              {label}
            </Text>
            <View style={{
              backgroundColor: color, borderRadius: 12,
              paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>{count}</Text>
            </View>
            <FontAwesome
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={11} color={color}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
          {/* Members list */}
          {isOpen && (
            <View style={{ padding: 8, paddingTop: 6 }}>
              {members.map((m: any, idx: number) => (
                <MemberRow key={`${m._id || m.id || 'mem'}_${idx}`} member={m} type={type} />
              ))}
            </View>
          )}
        </View>
      );
    };

    return (
      <>
        {/* Inline Month-Year Picker */}
        <MonthYearPicker />

        {/* ── Clickable Filter Cards ── */}
        <View style={{ flexDirection: 'row', gap: spacing.m, marginBottom: spacing.m }}>
          {/* New Members */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActFilter(actFilter === 'new' ? null : 'new')}
            style={{
              flex: 1, borderRadius: borderRadius.l, padding: spacing.m,
              alignItems: 'center',
              backgroundColor: actFilter === 'new' ? '#8B5CF6' : '#8B5CF610',
              borderWidth: 2,
              borderColor: actFilter === 'new' ? '#8B5CF6' : '#8B5CF630',
            }}
          >
            <Text style={{ color: actFilter === 'new' ? '#fff' : '#8B5CF6', fontSize: 28, fontWeight: '800' }}>{totalNew}</Text>
            <Text style={{ color: actFilter === 'new' ? '#ffffffcc' : colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '600' }}>🆕 New Members</Text>
            <Text style={{ color: actFilter === 'new' ? '#ffffff88' : '#8B5CF680', fontSize: 10, marginTop: 2 }}>
              {actFilter === 'new' ? 'tap to show all' : 'tap to filter'}
            </Text>
          </TouchableOpacity>

          {/* Renewals */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActFilter(actFilter === 'renewal' ? null : 'renewal')}
            style={{
              flex: 1, borderRadius: borderRadius.l, padding: spacing.m,
              alignItems: 'center',
              backgroundColor: actFilter === 'renewal' ? '#10B981' : '#10B98110',
              borderWidth: 2,
              borderColor: actFilter === 'renewal' ? '#10B981' : '#10B98130',
            }}
          >
            <Text style={{ color: actFilter === 'renewal' ? '#fff' : '#10B981', fontSize: 28, fontWeight: '800' }}>{totalRenew}</Text>
            <Text style={{ color: actFilter === 'renewal' ? '#ffffffcc' : colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '600' }}>🔄 Renewals</Text>
            <Text style={{ color: actFilter === 'renewal' ? '#ffffff88' : '#10B98180', fontSize: 10, marginTop: 2 }}>
              {actFilter === 'renewal' ? 'tap to show all' : 'tap to filter'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Month + active filter label */}
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.m, marginLeft: 2 }}>
          {'📅 '}<Text style={{ fontWeight: '700', color: colors.text }}>{monthLabel}</Text>
          {actFilter === 'new' ? <Text style={{ color: '#8B5CF6' }}>{' — new members only'}</Text>
           : actFilter === 'renewal' ? <Text style={{ color: '#10B981' }}>{' — renewals only'}</Text>
           : ''}
        </Text>

        {activityData.length === 0 ? (
          <View style={{
            alignItems: 'center', paddingVertical: 60,
            backgroundColor: colors.surface, borderRadius: borderRadius.l,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{ fontSize: 40 }}>📭</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 12 }}>No Activity</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              No joins or renewals in {monthLabel}
            </Text>
          </View>
        ) : (
          activityData.map((dayItem: any, idx: number) => {
            const newList   = dayItem.new_members || [];
            const renewList = dayItem.renewals    || [];
            // Apply active filter
            const showNew   = actFilter !== 'renewal' && newList.length   > 0;
            const showRenew = actFilter !== 'new'     && renewList.length > 0;
            if (!showNew && !showRenew) return null;

            const dateObj  = new Date(dayItem.date + 'T00:00:00');
            const dayLabel = dateObj.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' });
            const visibleCount = (showNew ? newList.length : 0) + (showRenew ? renewList.length : 0);

            return (
              <View key={`${dayItem.date}_${idx}`} style={{ marginBottom: spacing.m }}>
                {/* Date header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <View style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{dayLabel}</Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {visibleCount} member{visibleCount !== 1 ? 's' : ''}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </View>

                {showNew && (
                  <CollapsibleSection dayKey={dayItem.date} label="New Members" count={newList.length} color="#8B5CF6" icon="user-plus" members={newList} type="new" />
                )}
                {showRenew && (
                  <CollapsibleSection dayKey={dayItem.date} label="Renewals" count={renewList.length} color="#10B981" icon="refresh" members={renewList} type="renewal" />
                )}
              </View>
            );
          })
        )}
      </>
    );
  };

  // ── TAB: Retention & Churn Risk (Gym Owner Intelligence) ─────────────────
  const renderRetention = () => {
    const st         = results?.['an_status'] || {};
    const insights   = results?.['an_insights'] || {};
    const expiryList = results?.[`an_expiry_${expiryDays}`] || [];
    const churnRisk  = insights.churn_risk || [];

    const active   = st.active || 0;
    const expired  = st.expired || 0;
    const totalMem = active + expired;
    const retRate  = totalMem > 0 ? Math.round((active / totalMem) * 100) : 100;
    const due7     = expiryList.filter((m: any) => (m.days_left ?? 99) <= 7);

    return (
      <>
        {/* Pro-Tip Banner */}
        <View style={{
          backgroundColor: '#8B5CF612', borderRadius: borderRadius.l,
          padding: spacing.m, marginBottom: spacing.m,
          borderWidth: 1, borderColor: '#8B5CF630',
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20, backgroundColor: '#8B5CF625',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <FontAwesome name="lightbulb-o" size={18} color="#8B5CF6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#8B5CF6', fontWeight: '800', fontSize: 13 }}>
              Gym Owner Pro-Tip
            </Text>
            <Text style={{ color: colors.text, fontSize: 11, marginTop: 2, lineHeight: 16 }}>
              Members contacted 3 days before expiry are 45% more likely to renew. Tap any member below to open details or message on WhatsApp!
            </Text>
          </View>
        </View>

        {/* KPI Scorecard */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.l }}>
          <View style={{
            flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.m,
            padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{ color: retRate >= 75 ? '#10B981' : '#F59E0B', fontSize: 22, fontWeight: '800' }}>
              {retRate}%
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2, fontWeight: '600' }}>
              Retention Rate
            </Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.m,
            padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{ color: '#EF4444', fontSize: 22, fontWeight: '800' }}>
              {churnRisk.length}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2, fontWeight: '600' }}>
              Ghost (30d+)
            </Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.m,
            padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{ color: '#F59E0B', fontSize: 22, fontWeight: '800' }}>
              {due7.length}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2, fontWeight: '600' }}>
              Due in 7d
            </Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.m,
            padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{ color: '#8B5CF6', fontSize: 22, fontWeight: '800' }}>
              {expired}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2, fontWeight: '600' }}>
              Total Expired
            </Text>
          </View>
        </View>

        {/* SECTION 1: Silent Churners (Active but Absent 30+ Days) */}
        <SectionTitle color={colors.text}>🚨 Ghost Members (Absent 30+ Days)</SectionTitle>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10, marginTop: -4 }}>
          Active memberships with zero gym visits in 30 days. Call or WhatsApp to re-engage!
        </Text>
        {churnRisk.length === 0 ? (
          <View style={{
            padding: spacing.l, borderRadius: borderRadius.l, alignItems: 'center',
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.l,
          }}>
            <Text style={{ fontSize: 28 }}>✨</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginTop: 8 }}>
              Excellent Engagement!
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              All active members are visiting regularly.
            </Text>
          </View>
        ) : (
          <View style={{ marginBottom: spacing.l }}>
            {churnRisk.map((m: any, idx: number) => (
              <TouchableOpacity
                key={`${m._id || m.id || 'churn'}_${idx}`}
                activeOpacity={0.75}
                onPress={() => router.push(`/members/${m._id}` as any)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  padding: 12, backgroundColor: colors.surface,
                  borderRadius: borderRadius.m, marginBottom: 6,
                  borderWidth: 1, borderColor: '#EF444425',
                }}
              >
                <View style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: '#EF444415', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13 }}>
                    {(m.full_name || '?').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                    {m.full_name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>
                    {m.phone}
                  </Text>
                  {m.days_absent != null && (
                    <View style={{
                      alignSelf: 'flex-start', backgroundColor: '#EF444415',
                      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4,
                    }}>
                      <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700' }}>
                        Absent {m.days_absent} days
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={{
                    width: 36, height: 36, borderRadius: 18, backgroundColor: '#25D366',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  onPress={() => {
                    const phone = (m.phone || '').replace(/\D/g, '');
                    const msg = `Hi ${m.full_name}, we miss seeing you at the gym! Come back and crush your fitness goals 💪`;
                    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
                  }}
                >
                  <FontAwesome name="whatsapp" size={18} color="white" />
                </TouchableOpacity>
                <FontAwesome name="chevron-right" size={11} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* SECTION 2: Urgent Renewals (Due within 7 Days) */}
        <SectionTitle color={colors.text}>⏰ Immediate Action: Expiring Within 7 Days</SectionTitle>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10, marginTop: -4 }}>
          Memberships ending soon. Reach out before they expire!
        </Text>
        {due7.length === 0 ? (
          <View style={{
            padding: spacing.l, borderRadius: borderRadius.l, alignItems: 'center',
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.l,
          }}>
            <Text style={{ fontSize: 28 }}>🎉</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginTop: 8 }}>
              No Urgent Expiries
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              No memberships expiring in the next 7 days.
            </Text>
          </View>
        ) : (
          <View style={{ marginBottom: spacing.l }}>
            {due7.map((m: any, idx: number) => {
              const dLeft = m.days_left ?? 0;
              const isOver = dLeft < 0;
              const badgeColor = isOver ? '#EF4444' : '#F59E0B';
              return (
                <TouchableOpacity
                  key={`${m._id || m.id || 'due'}_${idx}`}
                  activeOpacity={0.75}
                  onPress={() => router.push(`/members/${m._id}` as any)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 12, backgroundColor: colors.surface,
                    borderRadius: borderRadius.m, marginBottom: 6,
                    borderWidth: 1, borderColor: `${badgeColor}25`,
                  }}
                >
                  <View style={{
                    width: 38, height: 38, borderRadius: 19,
                    backgroundColor: `${badgeColor}15`, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: badgeColor, fontWeight: '800', fontSize: 13 }}>
                      {(m.full_name || '?').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                      {m.full_name}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>
                      {m.phone}
                    </Text>
                    <View style={{
                      alignSelf: 'flex-start', backgroundColor: `${badgeColor}15`,
                      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4,
                    }}>
                      <Text style={{ color: badgeColor, fontSize: 10, fontWeight: '700' }}>
                        {isOver ? `Expired ${Math.abs(dLeft)}d ago` : dLeft === 0 ? 'Expires Today' : `Expires in ${dLeft}d`}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                      ₹{m.monthly_fees || 0}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 10 }}>fee</Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      width: 36, height: 36, borderRadius: 18, backgroundColor: '#25D366',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                    onPress={() => {
                      const phone = (m.phone || '').replace(/\D/g, '');
                      const msg = `Hi ${m.full_name}, your gym membership ${isOver ? 'has expired' : 'is expiring soon'}. Please renew to keep your fitness journey going strong 💪`;
                      Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
                    }}
                  >
                    <FontAwesome name="whatsapp" size={18} color="white" />
                  </TouchableOpacity>
                  <FontAwesome name="chevron-right" size={11} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </>
    );
  };

  // ── Tab Config ────────────────────────────────────────────────────────────
  const TABS: { key: TabKey; icon: string; label: string }[] = [
    { key: 'Overview',    icon: 'home',        label: 'Overview' },
    { key: 'Revenue',     icon: 'rupee',       label: 'Revenue' },
    { key: 'Members',     icon: 'users',       label: 'Members' },
    { key: 'Activity',    icon: 'user-plus',   label: 'Activity' },
    { key: 'Retention',   icon: 'heartbeat',   label: 'Retention' },
    { key: 'Attendance',  icon: 'calendar',    label: 'Attend.' },
    { key: 'Finance',     icon: 'line-chart',  label: 'Finance' },
    { key: 'AI',          icon: 'magic',       label: 'AI' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <FontAwesome name="angle-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Reports & Analytics</Text>
        <TouchableOpacity style={styles.backBtn} onPress={refresh}>
          <FontAwesome name="refresh" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[
                { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', gap: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
                activeTab === t.key && { borderBottomColor: colors.primary }
              ]}
              onPress={() => setActiveTab(t.key)}
            >
              <FontAwesome name={t.icon as any} size={14} color={activeTab === t.key ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabText, { color: activeTab === t.key ? colors.primary : colors.textMuted,
                fontWeight: activeTab === t.key ? '700' : '500' }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? renderSkeleton() : (
          activeTab === 'Overview'   ? renderOverview()   :
          activeTab === 'Revenue'    ? renderRevenue()    :
          activeTab === 'Members'    ? renderMembers()    :
          activeTab === 'Activity'   ? renderActivity()   :
          activeTab === 'Retention'  ? renderRetention()  :
          activeTab === 'Attendance' ? renderAttendance() :
          activeTab === 'AI'         ? renderAI()         :
          renderFinance()
        )}
      </ScrollView>

      {/* Month Picker Modal — rendered as absolute overlay */}
      <MonthPickerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: spacing.m, paddingHorizontal: spacing.l,
    borderBottomWidth: 1,
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center', gap: 4,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText:     { fontSize: 11, fontWeight: '600' },
  scrollContent: { padding: spacing.l, paddingBottom: 120 },
});

// ── AI Insights styles ────────────────────────────────────────────────────
const aiStyles = StyleSheet.create({
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: 'transparent',
    marginBottom: spacing.l,
    padding: spacing.m,
    borderRadius: borderRadius.l,
  },
  scoreStats: { flex: 1 },
  scoreTitle: { fontSize: 16, fontWeight: '800' },
  scoreSubtitle: { fontSize: 12, marginTop: 2 },

  statChip: {
    padding: spacing.m,
    borderRadius: borderRadius.l,
    alignItems: 'center',
    borderWidth: 1,
  },

  sectionHead: { fontSize: 16, fontWeight: '800', marginBottom: spacing.m },

  emptyBox: {
    padding: spacing.l,
    borderRadius: borderRadius.l,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: spacing.m,
  },

  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  insightIconBox: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  insightTitle: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  insightMsg: { fontSize: 12, lineHeight: 18 },

  churnCard: {
    borderRadius: borderRadius.l,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.m,
  },
  churnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.m,
    gap: 12,
  },
  churnAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(108,77,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  churnAvatarText: { fontSize: 18, fontWeight: '800' },
  churnName: { fontSize: 14, fontWeight: '700' },
  churnPhone: { fontSize: 12, marginTop: 2 },
  whatsappBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#25D366',
    alignItems: 'center', justifyContent: 'center',
  },
});
