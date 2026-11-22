// Session handling in the scraping API client: Bearer token on every call,
// one shared refresh on 401, session teardown when refresh fails, and
// authorized Excel downloads (the proxy no longer serves anonymous requests).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getMissions, getMissionStatus, checkApiHealth, downloadFile, AUTH_EXPIRED_EVENT,
} from '../api';
import { http, reply, deferred } from '../../__tests__/http';

const MISSIONS = '/scraping-api/api/missions/';
const REFRESH = '/auth-api/api/auth/token/refresh/';

beforeEach(() => {
  localStorage.setItem('access_token', 'old-access');
  localStorage.setItem('refresh_token', 'refresh-1');
  localStorage.setItem('user', JSON.stringify({ username: 'u' }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Authorization header', () => {
  it('attaches the stored access token to every request', async () => {
    http.on('GET', MISSIONS, reply(200, []));
    await getMissions();
    expect(http.calls[0].headers.Authorization).toBe('Bearer old-access');
  });

  it('sends no Authorization header when signed out', async () => {
    localStorage.clear();
    http.on('GET', MISSIONS, reply(200, []));
    await getMissions();
    expect(http.calls[0].headers.Authorization).toBeUndefined();
  });

  it('picks up a token stored after the client was created', async () => {
    localStorage.setItem('access_token', 'newer');
    http.on('GET', MISSIONS, reply(200, []));
    await getMissions();
    expect(http.calls[0].headers.Authorization).toBe('Bearer newer');
  });
});

describe('401 → refresh → retry', () => {
  it('refreshes once and retries the original request with the new token', async () => {
    http.once('GET', MISSIONS, reply(401, { detail: 'Session expired or invalid' }));
    http.on('GET', MISSIONS, reply(200, [{ id: 'm1' }]));
    http.on('POST', REFRESH, reply(200, { access: 'new-access', refresh: 'refresh-2' }));

    await expect(getMissions()).resolves.toEqual([{ id: 'm1' }]);
    const missionCalls = http.callsTo('GET', MISSIONS);
    expect(missionCalls).toHaveLength(2);
    expect(missionCalls[1].headers.Authorization).toBe('Bearer new-access');
    expect(http.callsTo('POST', REFRESH)[0].body).toEqual({ refresh: 'refresh-1' });
    expect(localStorage.getItem('access_token')).toBe('new-access');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-2');
  });

  it('concurrent 401s share a single refresh', async () => {
    const gate = deferred();
    http.once('GET', MISSIONS, reply(401, {}));
    http.once('GET', `${MISSIONS}a/`, reply(401, {}));
    http.on('GET', MISSIONS, reply(200, []));
    http.on('GET', `${MISSIONS}a/`, reply(200, { id: 'a' }));
    http.on('POST', REFRESH, gate);

    const p = Promise.all([getMissions(), getMissionStatus('a')]);
    await new Promise((r) => setTimeout(r, 0));
    gate.resolve(reply(200, { access: 'shared' }));
    await expect(p).resolves.toEqual([[], { id: 'a' }]);
    expect(http.callsTo('POST', REFRESH)).toHaveLength(1);
  });

  it('a second 401 after the retry is returned as-is (no refresh loop)', async () => {
    http.on('GET', MISSIONS, reply(401, { detail: 'nope' }));
    http.on('POST', REFRESH, reply(200, { access: 'new' }));
    await expect(getMissions()).rejects.toMatchObject({ response: { status: 401 } });
    expect(http.callsTo('POST', REFRESH)).toHaveLength(1);
    expect(http.callsTo('GET', MISSIONS)).toHaveLength(2);
  });

  it('a failed refresh ends the session and emits auth:expired', async () => {
    const onExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    http.on('GET', MISSIONS, reply(401, {}));
    http.on('POST', REFRESH, reply(401, { detail: 'Token is blacklisted' }));

    await expect(getMissions()).rejects.toMatchObject({ response: { status: 401 } });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  });

  it('no refresh token → session ends without calling the auth API', async () => {
    localStorage.removeItem('refresh_token');
    const onExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    http.on('GET', MISSIONS, reply(401, {}));
    await expect(getMissions()).rejects.toBeTruthy();
    expect(http.callsTo('POST', REFRESH)).toHaveLength(0);
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  });

  it('non-401 errors are not retried', async () => {
    for (const status of [400, 403, 404, 429]) {
      http.reset();
      http.on('GET', MISSIONS, reply(status, {}));
      await expect(getMissions()).rejects.toMatchObject({ response: { status } });
      expect(http.callsTo('POST', REFRESH)).toHaveLength(0);
    }
  });

  it('the maintenance health probe never triggers a refresh', async () => {
    http.on('GET', '/scraping-api/api/categories/', reply(401, {}));
    await expect(checkApiHealth()).resolves.toBe(true);
    expect(http.callsTo('POST', REFRESH)).toHaveLength(0);
  });
});

describe('downloadFile', () => {
  let click;
  beforeEach(() => {
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  const savedName = () => click.mock.contexts[0].download;

  it('fetches proxied files with the session token and saves the blob', async () => {
    http.on('GET', '/scraping-api/api/missions/download/r1.xlsx', reply(200, new Blob(['x']), {
      'content-disposition': 'attachment; filename="تقرير.xlsx"',
    }));
    await downloadFile('/scraping-api/api/missions/download/r1.xlsx');
    const c = http.calls[0];
    expect(c.headers.Authorization).toBe('Bearer old-access');
    expect(c.config.responseType).toBe('blob');
    expect(click).toHaveBeenCalledTimes(1);
    expect(savedName()).toBe('تقرير.xlsx');
    expect(document.querySelector('a[download]')).toBeNull(); // cleaned up
  });

  it("uses RFC 5987 filename* when present", async () => {
    http.on('GET', /download/, reply(200, new Blob(['x']), {
      'content-disposition': "attachment; filename=\"fallback.xlsx\"; filename*=UTF-8''%D8%BA%D8%B2%D8%A9.xlsx",
    }));
    await downloadFile('/scraping-api/api/missions/download/a.xlsx');
    expect(savedName()).toBe('غزة.xlsx');
  });

  it('falls back to the URL basename when there is no disposition', async () => {
    http.on('GET', /download/, reply(200, new Blob(['x'])));
    await downloadFile('/scraping-api/api/missions/download/abc123.xlsx?v=1');
    expect(savedName()).toBe('abc123.xlsx');
  });

  it('opens non-proxied http(s) URLs directly', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    await downloadFile('https://files.example.org/r.xlsx');
    expect(open).toHaveBeenCalledWith('https://files.example.org/r.xlsx', '_blank', 'noopener,noreferrer');
    expect(http.calls).toHaveLength(0);
  });

  it('does nothing for an empty URL', async () => {
    await downloadFile('');
    await downloadFile(null);
    expect(http.calls).toHaveLength(0);
    expect(click).not.toHaveBeenCalled();
  });

  it('propagates download errors to the caller', async () => {
    http.on('GET', /download/, reply(404, {}));
    await expect(downloadFile('/scraping-api/api/missions/download/x.xlsx')).rejects.toBeTruthy();
  });
});
