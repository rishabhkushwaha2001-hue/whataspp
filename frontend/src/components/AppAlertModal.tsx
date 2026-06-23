import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme, borderRadius, spacing } from '../theme/theme';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertConfig {
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AppAlertModalProps extends AppAlertConfig {
  visible: boolean;
  onClose: () => void;
}

const TYPE_CONFIG: Record<AlertType, { icon: string; color: string; bg: string }> = {
  success: { icon: 'check-circle',        color: '#16a34a', bg: '#f0fdf4' },
  error:   { icon: 'times-circle',        color: '#dc2626', bg: '#fef2f2' },
  warning: { icon: 'exclamation-triangle', color: '#d97706', bg: '#fffbeb' },
  info:    { icon: 'info-circle',          color: '#2563eb', bg: '#eff6ff' },
  confirm: { icon: 'trash',               color: '#dc2626', bg: '#fef2f2' },
};

export function AppAlertModal({
  visible, onClose,
  type = 'info', title, message, buttons,
}: AppAlertModalProps) {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const cfg = TYPE_CONFIG[type];

  const defaultButtons: AlertButton[] = buttons ?? [
    { text: 'OK', style: 'default', onPress: onClose },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.card,
          { backgroundColor: isDark ? colors.surface : '#fff' }
        ]}>
          {/* Icon circle */}
          <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
            <FontAwesome name={cfg.icon as any} size={32} color={cfg.color} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {/* Message */}
          {!!message && (
            <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
          )}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Buttons */}
          <View style={[
            styles.btnRow,
            defaultButtons.length === 1 && { justifyContent: 'center' },
          ]}>
            {defaultButtons.map((btn, idx) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isOnly = defaultButtons.length === 1;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.btn,
                    isOnly && { flex: 0, paddingHorizontal: 40 },
                    !isOnly && { flex: 1 },
                    isDestructive && { backgroundColor: '#dc2626' },
                    isCancel && {
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                    !isDestructive && !isCancel && { backgroundColor: cfg.color },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    onClose();
                    btn.onPress?.();
                  }}
                >
                  <Text style={[
                    styles.btnText,
                    isCancel && { color: colors.textSecondary },
                    (isDestructive || (!isCancel)) && { color: '#fff' },
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    borderRadius: borderRadius.l + 4,
    alignItems: 'center',
    paddingTop: spacing.l + 4,
    paddingBottom: spacing.m,
    paddingHorizontal: spacing.l,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.m,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  message: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.m,
  },
  divider: {
    height: 1, width: '100%', marginBottom: spacing.m,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.s,
    width: '100%',
  },
  btn: {
    paddingVertical: 12,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
