import axios from 'axios';
import { getAccessToken } from './auth';

const BASE_URL = 'https://una-ai-tools-apis.una-oic.org/scraping-api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export const startScraping = async (keyword, dateFilter = '', siteList = []) => {
  const body = { keyword, date_filter: dateFilter };
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
