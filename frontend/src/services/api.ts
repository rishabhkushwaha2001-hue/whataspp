import axios from 'axios';
import { Platform } from 'react-native';

// Using your LIVE Render URL so it works everywhere!
const API_URL = 'https://whataspp-0u22.onrender.com/api/v1';

export const api = axios.create({
  baseURL: API_URL,
});
