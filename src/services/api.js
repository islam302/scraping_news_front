import axios from 'axios';
import { getAccessToken, logout } from './auth';

// Proxied via Vite (dev) and Vercel rewrites (prod) — API key added server-side
const BASE_URL = '/scraping-api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Returns true if the JWT access token is expired (3-day lifetime)
const isTokenExpired = () => {
  const token = getAccessToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return false;
  }
};

// Auto-logout when token is expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && isTokenExpired()) {
      logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// === Sites ===

export const getSites = async () => {
  const { data } = await api.get('/api/sites/');
  return data;
};

export const addSite = async (siteData) => {
  const { data } = await api.post('/api/sites/', siteData);
  return data;
};

export const updateSite = async (siteId, siteData) => {
  const { data } = await api.put(`/api/sites/${siteId}/`, siteData);
  return data;
};

export const deleteSite = async (siteId) => {
  const { data } = await api.delete(`/api/sites/${siteId}/`);
  return data;
};

// === Site Lists ===

export const getSiteLists = async () => {
  const { data } = await api.get('/api/site-lists/');
  return data;
};

// === Scraping ===

export const startScraping = async (keyword, dateFilter = 'none', siteList = []) => {
  const body = { keyword, date_filter: dateFilter || 'none' };
  if (siteList.length > 0) body.site_list = siteList;
  const { data } = await api.post('/api/scrape/', body);
  return data;
};

// === Missions ===

export const getMissions = async () => {
  const { data } = await api.get('/api/missions/');
  return data;
};

export const getMissionStatus = async (missionId) => {
  const { data } = await api.get(`/api/missions/${missionId}/`);
  return data;
};

export const deleteMission = async (missionId) => {
  const { data } = await api.delete(`/api/missions/${missionId}/`);
  return data;
};

// === Download ===
// excel_download from API is already a full URL, use it directly
export const getDownloadUrl = (excelDownload) => excelDownload;

export default api;
