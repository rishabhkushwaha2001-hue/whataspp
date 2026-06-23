import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme, spacing, borderRadius } from '../../src/theme/theme';
import { api } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function QRScanner() {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [gymId, setGymId] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('memberId').then(id => {
      if(id) setMemberId(id);
    });
    AsyncStorage.getItem('gymId').then(id => {
      if(id) setGymId(id);
    });
  }, []);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>We need your permission to show the camera</Text>
        <TouchableOpacity onPress={requestPermission} style={{ backgroundColor: colors.primary, padding: 15, borderRadius: borderRadius.m }}>
          <Text style={{ color: 'white', textAlign: 'center' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }: any) => {
    setScanned(true);
    try {
      const qrPayload = JSON.parse(data);
      if (qrPayload.action === 'check_in') {
        if (qrPayload.gym_id && qrPayload.gym_id !== gymId) {
          Alert.alert('Invalid QR', 'This QR code belongs to a different gym/library.', [
            { text: 'OK', onPress: () => setScanned(false) }
          ]);
          return;
        }

        await api.post('/attendance', {
          member_id: memberId,
          check_in_time: new Date().toISOString()
        });
        Alert.alert('Success', 'Attendance marked successfully! Your time has started.', [
          { text: 'OK', onPress: () => setScanned(false) }
        ]);
      } else {
        Alert.alert('Invalid QR', 'This QR code is not recognized.', [
          { text: 'OK', onPress: () => setScanned(false) }
        ]);
      }
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to mark attendance.';
      Alert.alert('Error', msg, [
        { text: 'OK', onPress: () => setScanned(false) }
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.scanBox} />
          <Text style={styles.scanText}>Point your camera at the QR code</Text>
        </View>
      </CameraView>
      
      {scanned && (
        <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
          <Text style={{ color: '#fff' }}>Tap to Scan Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#4ade80',
    backgroundColor: 'transparent',
    marginBottom: 20,
  },
  scanText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rescanBtn: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: '#000',
    padding: 15,
    borderRadius: borderRadius.m,
  }
});
