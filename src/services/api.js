import axios from 'axios';

// Proxied via Vite (dev) and Vercel rewrites (prod) — API key added server-side.
// Backend is served under FORCE_SCRIPT_NAME = '/scraping-api', so the full base
// for every route is `/scraping-api/api/...`.
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

/** Lightweight public probe used by the maintenance page to check if we're back. */
export const checkApiHealth = async () => {
  await api.get('/api/categories/');
  return true;
};

// Join an array (or a single string) into a comma list for query params.
const toCsv = (value) =>
  Array.isArray(value) ? value.join(',') : value;

// ============================================================================
// Categories — discovery (GET /api/categories/)
// ----------------------------------------------------------------------------
// Returns { available_categories, categories, site_lists, all_categories_token }.
// Optionally narrow by site lists: getCategories({ siteLists: ['arabic_sites'] }).
// ============================================================================

export const getCategories = async ({ siteLists } = {}) => {
  const params = {};
  if (siteLists != null && (Array.isArray(siteLists) ? siteLists.length : siteLists)) {
    params.site_lists = toCsv(siteLists);
  }
  const { data } = await api.get('/api/categories/', { params });
  return data;
};

// ============================================================================
// Category Scrape (POST /api/category-scrape/)
// ----------------------------------------------------------------------------
// Every scrape variable from the API contract is supported. Only fields that
// are explicitly provided are sent, so backend defaults apply otherwise:
//   categories  (required)  — string[] | string. Pass ['all'] for every category.
//   site_lists  (optional)  — string[] | string. Omit for all sites.
//   max_days    (optional)  — int 1–30   (default 7).
//   max_pages   (optional)  — int 1–300  (default 300).
//   ai_filter   (optional)  — bool       (default true).
//   titles_only (optional)  — bool. true → runs inline, returns titles (no mission).
// ============================================================================

export const startScraping = async (keyword, {
  categories = ['general'],
  siteLists,
  maxDays,
  maxPages,
  aiFilter,
  titlesOnly,
} = {}) => {
  const body = { keyword, categories };

  if (siteLists != null && (Array.isArray(siteLists) ? siteLists.length : siteLists)) {
    body.site_lists = siteLists;
  }
  if (maxDays != null) body.max_days = maxDays;
  if (maxPages != null) body.max_pages = maxPages;
  if (aiFilter != null) body.ai_filter = aiFilter;
  if (titlesOnly != null) body.titles_only = titlesOnly;

  const { data } = await api.post('/api/category-scrape/', body);
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

// excel_download from the mission response is already a full URL — use it directly.
export const getDownloadUrl = (excelDownload) => excelDownload;

// ============================================================================
// Category Sites — admin CRUD (GET/POST/PATCH/DELETE /api/category-sites/)
// ----------------------------------------------------------------------------
// Site object shape:
//   { id, name, base_url, site_lists: [], categories: [{ key, label, url }],
//     js, page_mode, page_wait, load_more, selectors: {...}, is_active, ... }
// Google-only sources appear with mode: 'google_search' and categories: [].
// ============================================================================

export const getCategorySites = async ({ siteLists } = {}) => {
  const params = {};
  if (siteLists != null && (Array.isArray(siteLists) ? siteLists.length : siteLists)) {
    params.site_lists = toCsv(siteLists);
  }
  const { data } = await api.get('/api/category-sites/', { params });
  return data;
};

export const getCategorySite = async (siteId) => {
  const { data } = await api.get(`/api/category-sites/${siteId}/`);
  return data;
};

export const createCategorySite = async (siteData) => {
  const { data } = await api.post('/api/category-sites/', siteData);
  return data;
};

export const updateCategorySite = async (siteId, siteData) => {
  const { data } = await api.patch(`/api/category-sites/${siteId}/`, siteData);
  return data;
};

export const deleteCategorySite = async (siteId) => {
  const { data } = await api.delete(`/api/category-sites/${siteId}/`);
  return data;
};

// GET /api/category-site-lists/ → { site_lists: [{ name, sites }] }
export const getCategorySiteLists = async () => {
  const { data } = await api.get('/api/category-site-lists/');
  return data;
};

export default api;
