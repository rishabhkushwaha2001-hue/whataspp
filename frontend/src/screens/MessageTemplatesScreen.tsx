import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius } from '../theme/theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { api } from '../services/api';
import { getDefaultTemplates } from '../services/messageTemplates';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAppAlert } from '../hooks/useAppAlert';

export const MessageTemplatesScreen = () => {
  const router = useRouter();
  const { theme, colors } = useTheme();
  const styles = getStyles(colors);
  const { showSuccess, showError, AlertModal } = useAppAlert();
  
  const [isLoading, setIsLoading] = useState(false);
  const [businessType, setBusinessType] = useState('gym');
  const [enableHours, setEnableHours] = useState(false);
  const [joiningTemplate, setJoiningTemplate] = useState('');
  const [renewalTemplate, setRenewalTemplate] = useState('');
  const [reminderTemplate, setReminderTemplate] = useState('');
  const [defaultTemplates, setDefaultTemplates] = useState<any>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings/');
      const bType = response.data.business_type || 'gym';
      setBusinessType(bType);
      setEnableHours(response.data.enable_hours_feature || false);
      
      const systemDefaults = getDefaultTemplates(bType);
      setDefaultTemplates(systemDefaults);

      // Use DB template if it's a non-empty string, otherwise use system default
      const dbJoining = response.data.joining_msg_template;
      const dbRenewal = response.data.renewal_msg_template;
      const dbReminder = response.data.reminder_msg_template;

      const normalizeTemplateKey = (templateStr: string, currentBType: string) => {
        if (!templateStr) return templateStr;
        const targetKey = currentBType === 'library' ? '{library_name}' : currentBType === 'general' ? '{business_name}' : '{gym_name}';
        return templateStr.replace(/\{gym\}|\{library_name\}|\{business_name\}|\{gym_name\}/g, targetKey);
      };

      const normJoining = normalizeTemplateKey((dbJoining && dbJoining.trim()) ? dbJoining : systemDefaults.joining, bType);
      const normRenewal = normalizeTemplateKey((dbRenewal && dbRenewal.trim()) ? dbRenewal : systemDefaults.renewal, bType);
      const normReminder = normalizeTemplateKey((dbReminder && dbReminder.trim()) ? dbReminder : systemDefaults.reminder, bType);

      setJoiningTemplate(normJoining);
      setRenewalTemplate(normRenewal);
      setReminderTemplate(normReminder);
    } catch (error) {
      console.error('Error fetching settings:', error);
      // On error, load defaults based on stored business type
      const bType = 'gym';
      const systemDefaults = getDefaultTemplates(bType);
      setDefaultTemplates(systemDefaults);
      setJoiningTemplate(systemDefaults.joining);
      setRenewalTemplate(systemDefaults.renewal);
      setReminderTemplate(systemDefaults.reminder);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Fetch current settings first to avoid overriding fields we aren't modifying here
      const response = await api.get('/settings/');
      const currentSettings = response.data;

      await api.post('/settings/', {
        ...currentSettings,
        enable_hours_feature: enableHours,
        joining_msg_template: joiningTemplate,
        renewal_msg_template: renewalTemplate,
        reminder_msg_template: reminderTemplate,
      });
      showSuccess('Saved!', 'Message templates updated successfully.');
    } catch (error) {
      console.error('Error updating settings:', error);
      showError('Save Failed', 'Failed to update templates');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.background, theme === 'dark' ? '#1a103c' : '#ede9fe']} style={StyleSheet.absoluteFill} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Customize Messages</Text>
            <Text style={styles.subtitle}>Manage your WhatsApp templates</Text>
          </View>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>💬 WhatsApp Message Templates</Text>
          <Text style={styles.sectionSub}>
            Customize messages for Joining, Renewal & Reminders.{`\n`}
            Variables: <Text style={{ color: colors.primary, fontWeight: '700' }}>{`{name} {phone} {date} {joining_date} {fees} {hours} ${businessType === 'library' ? '{library_name}' : businessType === 'general' ? '{business_name}' : '{gym_name}'}`}</Text>
          </Text>

          {/* Hours + Timing toggle — Available for ALL business types */}
          <View style={[styles.themeButton, { marginBottom: spacing.m, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0, fontSize: 14 }]}>⏰ Hours + Timing Feature</Text>
              <Text style={styles.sectionSub}>📚/🏋️ Show daily study/gym hours & timing in forms</Text>
            </View>
            <TouchableOpacity
              onPress={() => setEnableHours(!enableHours)}
              style={{
                width: 52, height: 28, borderRadius: 14,
                backgroundColor: enableHours ? colors.primary : colors.surfaceLight,
                justifyContent: 'center',
                alignItems: enableHours ? 'flex-end' : 'flex-start',
                paddingHorizontal: 3,
                borderWidth: 1,
                borderColor: enableHours ? colors.primary : colors.border,
              }}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'white' }} />
            </TouchableOpacity>
          </View>

          {/* Joining Message Template */}
          <Text style={[styles.sectionSub, { fontWeight: '700', color: colors.accent, marginBottom: 4 }]}>JOINING / ENROLLMENT</Text>
          <View style={styles.templateBox}>
            <TextInput
              style={[styles.templateInput, { color: colors.text }]}
              value={joiningTemplate}
              onChangeText={setJoiningTemplate}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder="Joining message template..."
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => setJoiningTemplate(defaultTemplates.joining || '')}
          >
            <Text style={styles.resetBtnText}>↺ Reset to Default</Text>
          </TouchableOpacity>

          {/* Renewal Message Template */}
          <Text style={[styles.sectionSub, { fontWeight: '700', color: colors.primary, marginBottom: 4, marginTop: spacing.m }]}>RENEWAL</Text>
          <View style={styles.templateBox}>
            <TextInput
              style={[styles.templateInput, { color: colors.text }]}
              value={renewalTemplate}
              onChangeText={setRenewalTemplate}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder="Renewal message template..."
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => setRenewalTemplate(defaultTemplates.renewal || '')}
          >
            <Text style={styles.resetBtnText}>↺ Reset to Default</Text>
          </TouchableOpacity>

          {/* Reminder Message Template */}
          <Text style={[styles.sectionSub, { fontWeight: '700', color: colors.warning, marginBottom: 4, marginTop: spacing.m }]}>REMINDER</Text>
          <View style={styles.templateBox}>
            <TextInput
              style={[styles.templateInput, { color: colors.text }]}
              value={reminderTemplate}
              onChangeText={setReminderTemplate}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder="Reminder message template..."
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => setReminderTemplate(defaultTemplates.reminder || '')}
          >
            <Text style={styles.resetBtnText}>↺ Reset to Default</Text>
          </TouchableOpacity>

          <View style={[styles.infoBox, { marginTop: spacing.m, marginBottom: spacing.l }]}>
            <Text style={styles.infoText}>
              These templates will be used when sending WhatsApp messages to members. If time & hours feature is enabled, you can use the {'{hours}'} variable.
            </Text>
          </View>

          <GradientButton
            title="Save Messages"
            onPress={handleSave}
            isLoading={isLoading}
          />
        </GlassCard>
      </ScrollView>
      <AlertModal />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.l, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  backBtn: { marginRight: spacing.m, padding: spacing.xs },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: 2 },
  card: { padding: spacing.l },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sectionSub: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.m },
  themeButton: {
    flexDirection: 'row',
    height: 60,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
  },
  templateBox: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.m,
    marginBottom: 6,
    minHeight: 120,
  },
  templateInput: { fontSize: 13, lineHeight: 20, minHeight: 100 },
  resetBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.s,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetBtnText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  infoBox: {
    backgroundColor: colors.surfaceLight,
    padding: spacing.m,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
