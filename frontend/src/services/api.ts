import axios from 'axios';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// ✅ RENDER PRODUCTION URL (Active)
const RENDER_URL = 'https://whataspp-0u22.onrender.com/api/v1';

// 🏠 LOCAL TESTING (Use this for local dev — change to true only when testing on same WiFi)
const LOCAL_URL = 'http://192.168.1.38:8000/api/v1';

// ⚠️ PRODUCTION: Keep false. Set to true ONLY for local dev testing.
const USE_LOCAL = false; // 🚀 PRODUCTION MODE

const API_URL = USE_LOCAL ? LOCAL_URL : RENDER_URL;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // Increased to 60s for Render cold starts
});

// Request interceptor to automatically attach the tenant ID header
api.interceptors.request.use(
  async (config) => {
    try {
      const gymId = await AsyncStorage.getItem('gymId');
      if (gymId) {
        config.headers['X-Tenant-ID'] = gymId;
      }
    } catch (e) {
      console.warn('Failed to fetch gymId from storage', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === 'ECONNABORTED') {
      console.warn('API Timeout - Server might be sleeping');
    }

    // Auto logout if account is suspended, deleted, or unauthorized (401 or 403 status)
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const configUrl = error.config?.url || '';
      const isAuthRoute = configUrl.includes('/auth/verify-phone') ||
        configUrl.includes('/auth/activate') ||
        configUrl.includes('/super-admin/login');

      if (!isAuthRoute) {
        const errorMsg = error.response.data?.detail || 'Your session has expired or your account has been suspended.';

        try {
          // Clear session data
          await AsyncStorage.clear();

          // Show alert and redirect on OK click
          Alert.alert(
            'Session Terminated',
            errorMsg,
            [
              {
                text: 'OK',
                onPress: () => {
                  router.replace('/login');
                }
              }
            ],
            { cancelable: false }
          );
        } catch (e) {
          console.error('Failed to log out user automatically', e);
        }
      }
    }

    return Promise.reject(error);
  }
);

