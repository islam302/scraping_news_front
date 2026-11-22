import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getCategories, startScraping, getMissions, getMissionStatus, deleteMission, deleteAllMissions,
  getDownloadUrl, getCategorySites, getCategorySite, createCategorySite, updateCategorySite,
  deleteCategorySite, getCategorySiteLists, onApiMaintenance, checkApiHealth, isOutage, API_TIMEOUT_MS,
} from '../api';
import { http, reply, networkError, timeoutError, axiosError } from '../../__tests__/http';

const HEALTH = '/scraping-api/api/categories/';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request builders hit the exact backend routes', () => {
  it('getCategories without / with empty site lists sends no site_lists param', async () => {
    http.on('GET', HEALTH, reply(200, { available_categories: ['general'] }));
    for (const arg of [undefined, {}, { siteLists: undefined }, { siteLists: [] }, { siteLists: '' }, { siteLists: null }]) {
      await getCategories(arg);
    }
    http.calls.forEach((c) => expect(c.params).toEqual({}));
  });

  it('getCategories joins site lists into a CSV', async () => {
    http.on('GET', HEALTH, reply(200, {}));
    await getCategories({ siteLists: 'arabic_sites' });
    await getCategories({ siteLists: ['arabic_sites', 'gulf_agencies'] });
    expect(http.calls[0].params).toEqual({ site_lists: 'arabic_sites' });
    expect(http.calls[1].params).toEqual({ site_lists: 'arabic_sites,gulf_agencies' });
  });

  it('getCategories returns the response body', async () => {
    const body = { available_categories: ['general', 'sport'], site_lists: ['a'], max_categories_per_request: 5 };
    http.on('GET', HEALTH, reply(200, body));
    await expect(getCategories()).resolves.toEqual(body);
  });

  it('startScraping: defaults to categories [general] and omits undefined options', async () => {
    http.on('POST', '/scraping-api/api/category-scrape/', reply(202, { mission_id: 'm1', status: 'pending' }));
    await expect(startScraping('gaza')).resolves.toEqual({ mission_id: 'm1', status: 'pending' });
    expect(http.calls[0].body).toEqual({ keyword: 'gaza', categories: ['general'] });
  });

  it('startScraping: sends false / 0 values and every provided option', async () => {
    http.on('POST', '/scraping-api/api/category-scrape/', reply(202, {}));
    await startScraping('k', {
      categories: ['sport', 'economy'], siteLists: ['arabic_sites'], maxDays: 0, maxPages: 0, aiFilter: false, titlesOnly: false,
    });
    expect(http.calls[0].body).toEqual({
      keyword: 'k', categories: ['sport', 'economy'], site_lists: ['arabic_sites'],
      max_days: 0, max_pages: 0, ai_filter: false, titles_only: false,
    });
  });

  it('startScraping: site_lists only when non-empty; Arabic / emoji keywords pass through', async () => {
    http.on('POST', '/scraping-api/api/category-scrape/', reply(202, {}));
    await startScraping('غزة 🔥', { siteLists: [] });
    await startScraping('x', { siteLists: 'gulf_agencies', maxDays: 3, aiFilter: true, titlesOnly: true });
    expect(http.calls[0].body).toEqual({ keyword: 'غزة 🔥', categories: ['general'] });
    expect(http.calls[1].body).toEqual({
      keyword: 'x', categories: ['general'], site_lists: 'gulf_agencies', max_days: 3, ai_filter: true, titles_only: true,
    });
  });

  it('mission endpoints use GET/DELETE on /api/missions/ and /api/missions/<id>/', async () => {
    http.on('GET', '/scraping-api/api/missions/', reply(200, { missions: [] }));
    http.on('DELETE', '/scraping-api/api/missions/', reply(200, { deleted: 3 }));
    http.on('GET', '/scraping-api/api/missions/abc/', reply(200, { mission_id: 'abc' }));
    http.on('DELETE', '/scraping-api/api/missions/abc/', reply(200, { deleted: true }));
    await expect(getMissions()).resolves.toEqual({ missions: [] });
    await expect(deleteAllMissions()).resolves.toEqual({ deleted: 3 });
    await expect(getMissionStatus('abc')).resolves.toEqual({ mission_id: 'abc' });
    await expect(deleteMission('abc')).resolves.toEqual({ deleted: true });
    expect(http.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /scraping-api/api/missions/',
      'DELETE /scraping-api/api/missions/',
      'GET /scraping-api/api/missions/abc/',
      'DELETE /scraping-api/api/missions/abc/',
    ]);
  });

  it('category-sites CRUD uses GET/POST/PATCH/DELETE with trailing slashes', async () => {
    http.on('GET', '/scraping-api/api/category-sites/', reply(200, { sites: [] }));
    http.on('POST', '/scraping-api/api/category-sites/', reply(201, { id: 9 }));
    http.on('GET', '/scraping-api/api/category-sites/9/', reply(200, { id: 9 }));
    http.on('PATCH', '/scraping-api/api/category-sites/9/', reply(200, { id: 9, name: 'N' }));
    http.on('DELETE', '/scraping-api/api/category-sites/9/', reply(200, { deleted: true }));
    http.on('GET', '/scraping-api/api/category-site-lists/', reply(200, { site_lists: [] }));
    await getCategorySites();
    await getCategorySites({ siteLists: ['a', 'b'] });
    await createCategorySite({ name: 'N', base_url: 'https://n/' });
    await getCategorySite(9);
    await updateCategorySite(9, { is_active: false });
    await deleteCategorySite(9);
    await expect(getCategorySiteLists()).resolves.toEqual({ site_lists: [] });
    expect(http.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /scraping-api/api/category-sites/',
      'GET /scraping-api/api/category-sites/',
      'POST /scraping-api/api/category-sites/',
      'GET /scraping-api/api/category-sites/9/',
      'PATCH /scraping-api/api/category-sites/9/',
      'DELETE /scraping-api/api/category-sites/9/',
      'GET /scraping-api/api/category-site-lists/',
    ]);
    expect(http.calls[0].params).toEqual({});
    expect(http.calls[1].params).toEqual({ site_lists: 'a,b' });
    expect(http.calls[2].body).toEqual({ name: 'N', base_url: 'https://n/' });
    expect(http.calls[4].body).toEqual({ is_active: false });
  });

  it('sends JSON content type and never an API key from the browser', async () => {
    http.on('GET', '/scraping-api/api/missions/', reply(200, {}));
    await getMissions();
    expect(http.calls[0].headers['Content-Type']).toMatch(/application\/json/);
    expect(Object.keys(http.calls[0].headers).map((h) => h.toLowerCase())).not.toContain('x-api-key');
  });

  it('every request has a timeout (FE-14)', async () => {
    http.on('GET', '/scraping-api/api/missions/', reply(200, {}));
    await getMissions();
    expect(API_TIMEOUT_MS).toBeGreaterThan(0);
    expect(http.calls[0].timeout).toBe(API_TIMEOUT_MS);
  });

  it('getDownloadUrl returns the excel_download value as-is', () => {
    expect(getDownloadUrl('https://x/y.xlsx')).toBe('https://x/y.xlsx');
    expect(getDownloadUrl(null)).toBeNull();
  });

  it('errors propagate to the caller with the response attached', async () => {
    http.on('POST', '/scraping-api/api/category-scrape/', reply(400, { error: 'bad' }));
    await expect(startScraping('k')).rejects.toMatchObject({ response: { status: 400, data: { error: 'bad' } } });
  });
});

describe('maintenance detection (FE-08)', () => {
  const track = () => {
    const events = [];
    const off = onApiMaintenance((d) => events.push(d));
    return { events, off };
  };

  it('2xx clears maintenance', async () => {
    const { events, off } = track();
    http.on('GET', '/scraping-api/api/missions/', reply(200, {}));
    await getMissions();
    expect(events).toEqual([false]);
    off();
  });

  it.each([400, 401, 403, 404, 409, 413, 429])('%i never sets down', async (status) => {
    const { events, off } = track();
    http.on('GET', '/scraping-api/api/missions/', reply(status, { detail: 'x' }));
    await expect(getMissions()).rejects.toBeTruthy();
    expect(events).not.toContain(true);
    expect(http.callsTo('GET', HEALTH)).toHaveLength(0); // no probe for user errors
    off();
  });

  it('the proxy 500 {error: Proxy error} with the backend unreachable sets down', async () => {
    const { events, off } = track();
    http.on('GET', /\/scraping-api\//, reply(500, { error: 'Proxy error' }));
    await expect(getMissions()).rejects.toBeTruthy();
    expect(events).toContain(true);
    off();
  });

  it('a single 500 from one endpoint does NOT replace the app', async () => {
    const { events, off } = track();
    http.on('PATCH', '/scraping-api/api/category-sites/5/', reply(500, { detail: 'boom' }));
    http.on('GET', HEALTH, reply(200, {}));
    await expect(updateCategorySite(5, {})).rejects.toBeTruthy();
    expect(events).not.toContain(true);
    off();
  });

  it.each([500, 502, 503, 504])('%i with a healthy probe does not set down', async (status) => {
    const { events, off } = track();
    http.on('GET', '/scraping-api/api/missions/', reply(status));
    http.on('GET', HEALTH, reply(200, {}));
    await expect(getMissions()).rejects.toMatchObject({ response: { status } });
    expect(events).not.toContain(true);
    expect(http.callsTo('GET', HEALTH)).toHaveLength(1);
    off();
  });

  it.each([500, 502, 503, 504])('%i confirmed by a failing probe sets down', async (status) => {
    const { events, off } = track();
    http.on('GET', /\/scraping-api\/api\//, reply(status));
    await expect(getMissions()).rejects.toBeTruthy();
    expect(events).toContain(true);
    off();
  });

  it('network error confirmed by probe sets down', async () => {
    const { events, off } = track();
    http.on('GET', /\/scraping-api\//, networkError());
    await expect(getMissions()).rejects.toBeTruthy();
    expect(events).toEqual([true]);
    off();
  });

  it('timeouts confirmed by probe set down', async () => {
    const { events, off } = track();
    http.on('GET', /\/scraping-api\//, timeoutError());
    await expect(getMissions()).rejects.toMatchObject({ code: 'ECONNABORTED' });
    expect(events).toEqual([true]);
    off();
  });

  it('offline browser never shows maintenance (user sees "check connection")', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    const { events, off } = track();
    http.on('GET', /\/scraping-api\//, networkError());
    await expect(getMissions()).rejects.toBeTruthy();
    expect(events).not.toContain(true);
    off();
  });

  it('a rate-limiter 503 burst sends only one probe for concurrent failures', async () => {
    const { events, off } = track();
    http.on('GET', '/scraping-api/api/missions/', reply(503));
    http.on('GET', HEALTH, reply(200, {}));
    await Promise.allSettled([getMissions(), getMissions(), getMissions()]);
    expect(http.callsTo('GET', HEALTH)).toHaveLength(1);
    expect(events).not.toContain(true);
    off();
  });

  it('unsubscribe stops notifications', async () => {
    const { events, off } = track();
    off();
    http.on('GET', '/scraping-api/api/missions/', reply(200, {}));
    await getMissions();
    expect(events).toEqual([]);
  });

  it('isOutage classification', () => {
    expect(isOutage(axiosError(null))).toBe(true);
    expect(isOutage(axiosError(502))).toBe(true);
    expect(isOutage(axiosError(500))).toBe(true);
    expect(isOutage(axiosError(429))).toBe(false);
    expect(isOutage(axiosError(404))).toBe(false);
  });
});

describe('checkApiHealth (FE-09)', () => {
  it('resolves on 200 and clears down', async () => {
    const events = [];
    const off = onApiMaintenance((d) => events.push(d));
    http.on('GET', HEALTH, reply(200, {}));
    await expect(checkApiHealth()).resolves.toBe(true);
    expect(events.at(-1)).toBe(false);
    off();
  });

  it.each([401, 404, 429])('resolves on %i (API is reachable)', async (status) => {
    http.on('GET', HEALTH, reply(status, {}));
    await expect(checkApiHealth()).resolves.toBe(true);
  });

  it.each([500, 502, 503, 504])('rejects on %i', async (status) => {
    http.on('GET', HEALTH, reply(status));
    await expect(checkApiHealth()).rejects.toBeTruthy();
  });

  it('rejects on network error', async () => {
    http.on('GET', HEALTH, networkError());
    await expect(checkApiHealth()).rejects.toBeTruthy();
  });
});
