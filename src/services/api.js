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
// Global API health / maintenance detection
// ----------------------------------------------------------------------------
// When the backend or proxy is down (network error / 5xx), we surface a
// full-screen "we're doing updates" page instead of letting each call fail
// silently. A successful response clears the flag again (auto-recovery).
// 4xx (auth, validation, not-found) are the user's request, NOT an outage, so
// they never trigger maintenance mode.
// ============================================================================

const maintenanceListeners = new Set();

/** Subscribe to API up/down changes. Returns an unsubscribe fn. */
export const onApiMaintenance = (listener) => {
  maintenanceListeners.add(listener);
  return () => maintenanceListeners.delete(listener);
};

const notifyMaintenance = (down) => {
  maintenanceListeners.forEach((fn) => fn(down));
};

const isOutage = (error) => {
  const status = error?.response?.status;
  // No response → network/CORS/timeout. 5xx → backend or proxy failure.
  return !status || status >= 500;
};

api.interceptors.response.use(
  (response) => {
    notifyMaintenance(false);
    return response;
  },
  (error) => {
    if (isOutage(error)) notifyMaintenance(true);
    return Promise.reject(error);
  },
);

/** Lightweight probe used by the maintenance page to check if we're back. */
export const checkApiHealth = async () => {
  await api.get('/api/site-lists/');
  return true;
};

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

export const startScraping = async (keyword, {
  categories = ['general'],
  maxDays = 1,
  maxPages = 200,
} = {}) => {
  const body = {
    keyword,
    categories,
    max_days: maxDays,
    max_pages: maxPages,
  };
  const { data } = await api.post('/api/category-scrape/', body);
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
