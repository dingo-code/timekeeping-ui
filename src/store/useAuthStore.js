import { create } from 'zustand';

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token') || null,
  role: normalizeRole(localStorage.getItem('role')) || null,
  username: localStorage.getItem('username') || '',
  eventId: localStorage.getItem('event_id') || '',
  eventName: localStorage.getItem('event_name') || '',
  
  login: (token, role, username = '', eventId = '', eventName = '') => {
    const normalizedRole = normalizeRole(role);
    localStorage.setItem('token', token);
    localStorage.setItem('role', normalizedRole);
    localStorage.setItem('username', username);
    localStorage.setItem('event_id', eventId);
    localStorage.setItem('event_name', eventName);
    set({ token, role: normalizedRole, username, eventId, eventName });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('event_id');
    localStorage.removeItem('event_name');
    set({ token: null, role: null, username: '', eventId: '', eventName: '' });
  }
}));
