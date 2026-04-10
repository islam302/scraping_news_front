import axios from 'axios';

// In dev, Vite proxy handles /auth-api to avoid CORS.
// In production, set this to the full auth URL.
const AUTH_URL = import.meta.env.PROD
  ? 'https://una-ai-tools-apis.una-oic.org/auth-api'
  : '/auth-api';

const authApi = axios.create({
  baseURL: AUTH_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const login = async (username, password) => {
  const { data } = await authApi.post('/api/auth/token/', { username, password });
  localStorage.setItem('access_token', data.access);
  localStorage.setItem('refresh_token', data.refresh);
  localStorage.setItem('user', JSON.stringify({
    username: data.username,
    email: data.email,
    organization: data.organization,
    role: data.role,
  }));
  return data;
};

export const refreshToken = async () => {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) throw new Error('No refresh token');
  const { data } = await authApi.post('/api/auth/token/refresh/', { refresh });
  localStorage.setItem('access_token', data.access);
  return data.access;
};

export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

export const getAccessToken = () => localStorage.getItem('access_token');

export const getUser = () => {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
};

export const isAuthenticated = () => !!localStorage.getItem('access_token');
