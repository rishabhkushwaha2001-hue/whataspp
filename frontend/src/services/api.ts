import axios from 'axios';
import { Platform } from 'react-native';

// ✅ RENDER PRODUCTION URL (Active)
const API_URL = 'https://whataspp-0u22.onrender.com/api/v1';

// 🛑 LOCAL TESTING (Disabled)
// const API_URL = Platform.OS === 'android' ? 'http://192.168.1.34:8000/api/v1' : 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
});
