import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, borderRadius, spacing } from '../theme/theme';

interface ModernInputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isFocused && { color: colors.primary }]}>{label}</Text>
      <View style={[
        styles.inputContainer, 
        isFocused && styles.inputFocused,
        error ? styles.inputError : null
      ]}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <TextInput
          style={[styles.input, props.multiline && { textAlignVertical: 'top' }]}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.xs, fontWeight: '600', letterSpacing: 0.5 },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.surfaceLight, 
    borderRadius: borderRadius.m, 
    borderWidth: 1, 
    borderColor: colors.border, 
    paddingHorizontal: spacing.m, 
    minHeight: 56 
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.error },
  iconContainer: { marginRight: spacing.s },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: spacing.m },
  errorText: { color: colors.error, fontSize: 12, marginTop: spacing.xs },
});
