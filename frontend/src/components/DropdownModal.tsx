import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '../theme/theme';

interface DropdownModalProps {
  visible: boolean;
  title: string;
  items: any[];
  onSelect: (item: any) => void;
  onClose: () => void;
  renderItem?: (item: any) => React.ReactNode;
}

export const DropdownModal = ({ visible, title, items, onSelect, onClose, renderItem }: DropdownModalProps) => {
  const { colors } = useTheme();
  
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: colors.surfaceLight, borderRadius: 20 }}>
              <FontAwesome name="times" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {items.length === 0 ? (
            <Text style={{ textAlign: 'center', color: colors.textMuted, padding: 20 }}>No options available.</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item, idx) => item.id ? item.id : String(idx)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => { onSelect(item); onClose(); }}
                >
                  {renderItem ? renderItem(item) : (
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                      {typeof item === 'string' ? item : item.label || item.name}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};
