import axios from 'axios';

// Proxied via Vite (dev) and Vercel rewrites (prod) to avoid CORS
const AUTH_URL = '/auth-api';

// Auth calls gate the whole app (AuthProvider renders nothing until the
// startup refresh settles), so they must never hang indefinitely.
export const AUTH_TIMEOUT_MS = 15000;

const authApi = axios.create({
  baseURL: AUTH_URL,
  timeout: AUTH_TIMEOUT_MS,
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
  // Rotating refresh tokens (SimpleJWT ROTATE_REFRESH_TOKENS): the old one is
  // blacklisted after use, so keep the new one or the next refresh fails.
  if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
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
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    return user && typeof user === 'object' ? user : null;
  } catch {
    // Corrupted entry: drop it instead of crashing the whole app on startup.
    localStorage.removeItem('user');
    return null;
  }
};

export const isAuthenticated = () => !!localStorage.getItem('access_token');

/** Decode a base64url JWT segment (handles '-', '_' and missing padding + UTF-8). */
export const decodeJwtPayload = (token) => {
  const segment = String(token || '').split('.')[1];
  if (!segment) throw new Error('Malformed token');
  let b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

// Check if access token is expired (3-day lifetime)
export const isAccessExpired = () => {
  const token = getAccessToken();
  if (!token) return true;
  try {
    const payload = decodeJwtPayload(token);
    if (payload == null || typeof payload !== 'object') return true;
    if (payload.exp == null) return false; // no expiry claim → never expires
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp)) return true;
    return exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

// Only these answers from /token/refresh/ mean the refresh token itself is
// bad. Anything else (network error, timeout, 5xx, 429) is transient and must
// not destroy a still-valid session.
const isRefreshRejected = (err) => {
  const status = err?.response?.status;
  return status === 400 || status === 401 || status === 403;
};

// Auto-refresh access token if expired but refresh token still valid (7-day lifetime)
export const ensureValidToken = async () => {
  if (!isAccessExpired()) return true;
  if (!localStorage.getItem('refresh_token')) {
    logout();
    return false;
  }
  try {
    await refreshToken();
    return true;
  } catch (err) {
    if (isRefreshRejected(err)) {
      logout();
      return false;
    }
    // Transient failure: keep the tokens; the next load retries the refresh.
    return true;
  }
};
