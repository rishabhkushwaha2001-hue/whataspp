import axios from 'axios';
import { Platform } from 'react-native';

// ✅ RENDER PRODUCTION URL (Active)
const API_URL = 'https://whataspp-0u22.onrender.com/api/v1';

// 🛑 LOCAL TESTING (Disabled)
// const API_URL = Platform.OS === 'android' ? 'http://192.168.1.34:8000/api/v1' : 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000, // 15 seconds for Render cold starts
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.warn('API Timeout - Server might be sleeping');
    }
    return Promise.reject(error);
  }
);
