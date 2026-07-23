import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:6060';

export function assetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_ORIGIN}${path}`;
}

const api = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Otomatis tempelkan token ke setiap request yang keluar
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: Jika token expired (401), otomatis logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login'; // Lempar kembali ke halaman login
    }
    return Promise.reject(error);
  }
);

export default api;
