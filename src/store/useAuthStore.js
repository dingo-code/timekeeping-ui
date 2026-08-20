import { create } from 'zustand';

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token') || null,
  role: normalizeRole(localStorage.getItem('role')) || null,
  
  login: (token, role) => {
    const normalizedRole = normalizeRole(role);
    localStorage.setItem('token', token);
    localStorage.setItem('role', normalizedRole);
    set({ token, role: normalizedRole });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    set({ token: null, role: null });
  }
}));
