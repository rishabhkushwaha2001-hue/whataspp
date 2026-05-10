import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, borderRadius, spacing } from '../theme/theme';

interface ModernInputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export const ModernInput: React.FC<ModernInputProps> = ({
  label,
  error,
  icon,
  value,
  onChangeText,
  ...props
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <TextInput
          style={[styles.input, props.multiline && { textAlignVertical: 'top' }]}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: spacing.m },
  label: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.xs, fontWeight: '500' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.m, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.m, minHeight: 56 },
  inputError: { borderColor: colors.error },
  iconContainer: { marginRight: spacing.s },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: spacing.m },
  errorText: { color: colors.error, fontSize: 12, marginTop: spacing.xs },
});
