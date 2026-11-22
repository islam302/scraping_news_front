import axios from 'axios';
import { getAccessToken, refreshToken, logout as clearSession } from './auth';

// Proxied via Vite (dev) and Vercel rewrites (prod) — API key added server-side.
// Backend is served under FORCE_SCRIPT_NAME = '/scraping-api', so the full base
// for every route is `/scraping-api/api/...`.
const BASE_URL = '/scraping-api';

// Every request gets a ceiling so a hung backend can never stall a page (or
// stack up overlapping polls) forever.
export const API_TIMEOUT_MS = 60000;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// Global API health / maintenance detection
// ----------------------------------------------------------------------------
// When the backend or proxy is down we surface a full-screen "we're doing
// updates" page instead of letting each call fail silently. A successful
// response clears the flag again (auto-recovery).
//
// One failing call is NOT proof of an outage: a 500 from a single endpoint is
// a bug in that endpoint, and an offline browser is the user's connection. So:
//   - 4xx (incl. 429) never trigger maintenance mode;
//   - an offline browser (navigator.onLine === false) never does either;
//   - network errors / timeouts / 5xx (incl. the proxy's own 500 "Proxy
//     error") trigger ONE confirmation probe of a lightweight public endpoint,
//     and only if that probe ALSO fails as an outage is the maintenance page
//     shown. A healthy probe means the failure was local to that endpoint.
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

const HEALTH_PATH = '/api/categories/';

const isOffline = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

/** True when this error looks like the backend/proxy is unreachable. */
export const isOutage = (error) => {
  if (axios.isCancel?.(error)) return false;
  const status = error?.response?.status;
  if (!status) return !isOffline(); // network error / timeout (not offline)
  return status >= 500;
};

let probeInFlight = null;

// Confirm a suspected outage with one probe (shared by concurrent failures).
const confirmOutage = () => {
  if (!probeInFlight) {
    probeInFlight = api
      .get(HEALTH_PATH, { _healthProbe: true })
      .then(() => false)
      .catch((err) => isOutage(err))
      .finally(() => { probeInFlight = null; });
  }
  return probeInFlight;
};

api.interceptors.response.use(
  (response) => {
    notifyMaintenance(false);
    return response;
  },
  async (error) => {
    if (!error?.config?._healthProbe && isOutage(error)) {
      if (await confirmOutage()) notifyMaintenance(true);
    }
    return Promise.reject(error);
  },
);

// ============================================================================
// Session: every call carries the user's Bearer token (the proxy only lends
// the service API key to signed-in users). On a 401 the access token is
// refreshed once — shared by concurrent failures — and the call retried. If
// the refresh fails the session is over: tokens are cleared and an
// `auth:expired` event lets AuthContext route back to the login page.
// ============================================================================

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, undefined, { synchronous: true });

let refreshInFlight = null;
const refreshOnce = () => {
  if (!refreshInFlight) {
    refreshInFlight = refreshToken().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
};

export const AUTH_EXPIRED_EVENT = 'auth:expired';

api.interceptors.response.use(undefined, async (error) => {
  const config = error?.config;
  if (error?.response?.status !== 401 || !config || config._authRetried || config._healthProbe) {
    return Promise.reject(error);
  }
  config._authRetried = true;
  let fresh;
  try {
    fresh = await refreshOnce();
  } catch {
    if (getAccessToken()) {
      clearSession();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${fresh}`;
  return api.request(config);
});

/**
 * Lightweight public probe used by the maintenance page to check if we're back.
 * Any HTTP answer that is not an outage status (even 401/404/429) proves the
 * API is reachable, so it resolves true; it rejects only on a real outage.
 */
export const checkApiHealth = async () => {
  try {
    await api.get(HEALTH_PATH, { _healthProbe: true });
  } catch (err) {
    if (isOutage(err) || !err?.response) throw err;
  }
  notifyMaintenance(false);
  return true;
};

// Join an array (or a single string) into a comma list for query params.
const toCsv = (value) =>
  Array.isArray(value) ? value.join(',') : value;

// ============================================================================
// Categories — discovery (GET /api/categories/)
// ----------------------------------------------------------------------------
// Returns { available_categories, categories, site_lists, max_categories_per_request }.
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
//   categories  (required)  — string[] | string. 1–5 category keys (no "all" option).
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

const filenameFrom = (disposition, url) => {
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition || '');
  if (star) {
    try { return decodeURIComponent(star[1].trim()); } catch { /* fall through */ }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition || '');
  if (plain) return plain[1].trim();
  const last = String(url).split('?')[0].split('/').filter(Boolean).pop();
  return last || 'download.xlsx';
};

/**
 * Download a file. Proxied paths (/scraping-api/...) need the user's session,
 * which a plain window.open can't send, so they are fetched with the
 * Authorization header and saved from a blob. Other http(s) URLs open directly.
 */
export const downloadFile = async (url) => {
  if (!url) return;
  if (!String(url).startsWith(`${BASE_URL}/`)) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const res = await api.get(String(url).slice(BASE_URL.length), { responseType: 'blob', timeout: 120000 });
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filenameFrom(res.headers?.['content-disposition'], url);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
};

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
