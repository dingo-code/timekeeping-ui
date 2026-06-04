import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const api = axios.create({
  baseURL: 'http://localhost:6060/api/v1',
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