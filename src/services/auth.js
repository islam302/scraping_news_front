import axios from 'axios';

// Proxied via Vite (dev) and Vercel rewrites (prod) to avoid CORS
const AUTH_URL = '/auth-api';

const authApi = axios.create({
  baseURL: AUTH_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every authenticated request
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================================================
// Token (Login / Refresh / Verify)
// ============================================================================

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

export const verifyToken = async (token) => {
  const { data } = await authApi.post('/api/auth/token/verify/', { token });
  return data;
};

// ============================================================================
// Register
// ============================================================================

export const register = async ({ username, email, password, organization }) => {
  const body = { username, email, password };
  if (organization) body.organization = organization;
  const { data } = await authApi.post('/api/auth/register/', body);
  return data;
};

// ============================================================================
// Profile
// ============================================================================

export const getProfile = async () => {
  const { data } = await authApi.get('/api/auth/profile/');
  return data;
};

export const updateProfile = async (payload) => {
  const { data } = await authApi.patch('/api/auth/profile/', payload);
  const current = getUser() || {};
  localStorage.setItem('user', JSON.stringify({ ...current, ...data }));
  return data;
};

// ============================================================================
// API Keys
// ============================================================================

export const getApiKeys = async () => {
  const { data } = await authApi.get('/api/auth/api-keys/');
  return data;
};

export const createApiKey = async () => {
  const { data } = await authApi.post('/api/auth/api-keys/');
  return data;
};

export const deleteApiKey = async (keyId) => {
  const { data } = await authApi.delete(`/api/auth/api-keys/${keyId}/`);
  return data;
};

// ============================================================================
// Password Reset
// ============================================================================

export const requestPasswordReset = async (email) => {
  const { data } = await authApi.post('/api/auth/password-reset/', { email });
  return data;
};

export const confirmPasswordReset = async (token, uidb64, password) => {
  const { data } = await authApi.post(
    `/api/auth/password-reset-confirm/${token}/${uidb64}/`,
    { password },
  );
  return data;
};

// ============================================================================
// User Management (Admin Only)
// ============================================================================

export const listUsers = async () => {
  const { data } = await authApi.get('/api/auth/users/');
  return data;
};

export const getUserDetails = async (userId) => {
  const { data } = await authApi.get(`/api/auth/users/${userId}/`);
  return data;
};

export const createUser = async (payload) => {
  const { data } = await authApi.post('/api/auth/users/', payload);
  return data;
};

export const updateUser = async (userId, payload) => {
  const { data } = await authApi.patch(`/api/auth/users/${userId}/`, payload);
  return data;
};

export const deleteUser = async (userId) => {
  const { data } = await authApi.delete(`/api/auth/users/${userId}/`);
  return data;
};

// ============================================================================
// Session helpers
// ============================================================================

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

// Check if access token is expired (3-day lifetime)
export const isAccessExpired = () => {
  const token = getAccessToken();
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

// Auto-refresh access token if expired but refresh token still valid (7-day lifetime)
export const ensureValidToken = async () => {
  if (!isAccessExpired()) return true;
  try {
    await refreshToken();
    return true;
  } catch {
    logout();
    return false;
  }
};
