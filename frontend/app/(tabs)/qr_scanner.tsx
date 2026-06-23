import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme, spacing, borderRadius } from '../../src/theme/theme';
import { GlassCard } from '../../src/components/GlassCard';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function QRScannerScreen() {
  const { colors } = useTheme();
  const [gymId, setGymId] = useState('');
  const [gymName, setGymName] = useState('');

  useEffect(() => {
    const fetchInfo = async () => {
      const id = await AsyncStorage.getItem('gymId');
      const name = await AsyncStorage.getItem('gymName');
      if (id) setGymId(id);
      if (name) setGymName(name);
    };
    fetchInfo();
  }, []);

  const qrData = JSON.stringify({
    gym_id: gymId,
    action: 'check_in',
    timestamp: new Date().getTime()
  });

  const exportPDF = async () => {
    try {
      const html = `
        <html>
          <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center;">
            <h1>${gymName}</h1>
            <h2>Scan to Mark Attendance</h2>
            <div style="padding: 20px; border: 2px solid #000; border-radius: 10px; display:inline-block;">
               <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}" />
            </div>
            <p>Powered by Aetheron Technologies</p>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>Attendance QR</Text>
      
      <GlassCard style={styles.card}>
        <View style={styles.qrWrapper}>
          {gymId ? (
            <QRCode
              value={qrData}
              size={200}
              color={colors.text}
              backgroundColor="transparent"
            />
          ) : (
             <FontAwesome name="qrcode" size={100} color={colors.primary} />
          )}
        </View>

        <Text style={[styles.text, { color: colors.textSecondary, marginBottom: 20 }]}>
          Print and paste this QR at your entrance. Students will scan this to mark their daily attendance.
        </Text>
        
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border }]} onPress={exportPDF}>
            <FontAwesome name="print" size={16} color={colors.text} style={{marginRight: 8}} />
            <Text style={[styles.btnText, { color: colors.text }]}>Print / Download PDF</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.l,
    paddingTop: 60,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.l,
  },
  card: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  qrWrapper: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: borderRadius.m,
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'column',
    gap: 15,
    width: '100%',
  },
  btn: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
