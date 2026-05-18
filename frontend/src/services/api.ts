import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ RENDER PRODUCTION URL (Active)
const RENDER_URL = 'https://whataspp-0u22.onrender.com/api/v1';

// 🏠 LOCAL TESTING (Use this for local dev)
const LOCAL_URL = 'http://192.168.1.34:8000/api/v1';

// Switch this to true if you want to test locally
const USE_LOCAL = false; // 🚀 PRODUCTION MODE - Render

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
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.warn('API Timeout - Server might be sleeping');
    }
    return Promise.reject(error);
  }
);

