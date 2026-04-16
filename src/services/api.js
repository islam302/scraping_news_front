import axios from 'axios';

// Proxied via Vite (dev) and Vercel rewrites (prod) — API key added server-side
const BASE_URL = '/scraping-api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// Site Lists CRUD
// ============================================================================

export const getSiteLists = async () => {
  const { data } = await api.get('/api/site-lists/');
  return data;
};

export const getSiteList = async (listName) => {
  const { data } = await api.get(`/api/site-lists/${encodeURIComponent(listName)}/`);
  return data;
};

export const createSiteList = async (name) => {
  const { data } = await api.post('/api/site-lists/', { name });
  return data;
};

export const updateSiteList = async (listName, payload) => {
  const { data } = await api.put(
    `/api/site-lists/${encodeURIComponent(listName)}/`,
    payload,
  );
  return data;
};

export const deleteSiteList = async (listName) => {
  const { data } = await api.delete(`/api/site-lists/${encodeURIComponent(listName)}/`);
  return data;
};

export const addSitesToList = async (listName, siteIds) => {
  const { data } = await api.post(
    `/api/site-lists/${encodeURIComponent(listName)}/sites/`,
    { site_ids: siteIds },
  );
  return data;
};

export const removeSitesFromList = async (listName, siteIds) => {
  const { data } = await api.delete(
    `/api/site-lists/${encodeURIComponent(listName)}/sites/`,
    { data: { site_ids: siteIds } },
  );
  return data;
};

// ============================================================================
// Sites CRUD
// ============================================================================

export const getSites = async (siteListName) => {
  const params = siteListName ? { site_list: siteListName } : {};
  const { data } = await api.get('/api/sites/', { params });
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

// ============================================================================
// Scraping (Full Pipeline)
// ============================================================================

export const startScraping = async (keyword, dateFilter = 'none', siteList = []) => {
  const body = { keyword, date_filter: dateFilter || 'none' };
  if (Array.isArray(siteList) ? siteList.length > 0 : siteList) {
    body.site_list = siteList;
  }
  const { data } = await api.post('/api/scrape/', body);
  return data;
};

// ============================================================================
// Google Search Only
// ============================================================================

export const startGoogleSearch = async (keyword, dateFilter = 'none', siteList = []) => {
  const body = { keyword, date_filter: dateFilter || 'none' };
  if (Array.isArray(siteList) ? siteList.length > 0 : siteList) {
    body.site_list = siteList;
  }
  const { data } = await api.post('/api/google-search/', body);
  return data;
};

// ============================================================================
// Scheduled Scraping (Recurring)
// ============================================================================

export const createScheduledScrape = async ({
  keyword,
  dateFilter = 'none',
  siteList = [],
  intervalHours,
  durationHours,
}) => {
  const body = {
    keyword,
    date_filter: dateFilter || 'none',
    interval_hours: intervalHours,
    duration_hours: durationHours,
  };
  if (Array.isArray(siteList) ? siteList.length > 0 : siteList) {
    body.site_list = siteList;
  }
  const { data } = await api.post('/api/scrape/scheduled/', body);
  return data;
};

export const getScheduledScrapes = async () => {
  const { data } = await api.get('/api/scrape/scheduled/');
  return data;
};

export const getScheduledScrape = async (scheduleId) => {
  const { data } = await api.get(`/api/scrape/scheduled/${scheduleId}/`);
  return data;
};

export const stopScheduledScrape = async (scheduleId) => {
  const { data } = await api.delete(`/api/scrape/scheduled/${scheduleId}/`);
  return data;
};

// ============================================================================
// Missions
// ============================================================================

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

export const deleteAllMissions = async () => {
  const { data } = await api.delete('/api/missions/');
  return data;
};

// ============================================================================
// Download
// ============================================================================

// excel_download from API is already a full URL, use it directly
export const getDownloadUrl = (excelDownload) => excelDownload;

export default api;
