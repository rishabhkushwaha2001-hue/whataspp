import axios from 'axios';
import { Platform } from 'react-native';

// ✅ RENDER PRODUCTION URL (Active)
const RENDER_URL = 'https://whataspp-0u22.onrender.com/api/v1';

// 🏠 LOCAL TESTING (Use this for local dev)
const LOCAL_URL = Platform.OS === 'android' ? 'http://192.168.1.33:8000/api/v1' : 'http://localhost:8000/api/v1';

// Switch this to true if you want to test locally
const USE_LOCAL = false;

const API_URL = USE_LOCAL ? LOCAL_URL : RENDER_URL;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // Increased to 60s for Render cold starts
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
