import { describe, it, expect } from 'vitest';
import {
  login, logout, refreshToken, verifyToken, getUser, isAuthenticated, isAccessExpired,
  ensureValidToken, decodeJwtPayload, getAccessToken, updateProfile, register, AUTH_TIMEOUT_MS,
} from '../auth';
import { http, reply, networkError, timeoutError, makeJwt } from '../../__tests__/http';

const REFRESH = '/auth-api/api/auth/token/refresh/';
const day = 24 * 3600;
const now = () => Math.floor(Date.now() / 1000);

const storeSession = ({ access = makeJwt({ exp: now() + day }), refresh = 'R1', user = { username: 'u' } } = {}) => {
  localStorage.setItem('access_token', access);
  if (refresh != null) localStorage.setItem('refresh_token', refresh);
  if (user) localStorage.setItem('user', JSON.stringify(user));
};

describe('login / logout', () => {
  it('login stores tokens and the user profile', async () => {
    http.on('POST', '/auth-api/api/auth/token/', reply(200, {
      access: 'A', refresh: 'R', username: 'islam', email: 'e@x', organization: 'UNA', role: 'admin', extra: 1,
    }));
    await login('islam', 'pw');
    expect(http.calls[0].body).toEqual({ username: 'islam', password: 'pw' });
    expect(localStorage.getItem('access_token')).toBe('A');
    expect(localStorage.getItem('refresh_token')).toBe('R');
    expect(getUser()).toEqual({ username: 'islam', email: 'e@x', organization: 'UNA', role: 'admin' });
    expect(isAuthenticated()).toBe(true);
  });

  it.each([400, 401, 429, 500])('login %i rejects and stores nothing', async (status) => {
    http.on('POST', '/auth-api/api/auth/token/', reply(status, { detail: 'nope' }));
    await expect(login('a', 'b')).rejects.toMatchObject({ response: { status } });
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('login network error rejects', async () => {
    http.on('POST', '/auth-api/api/auth/token/', networkError());
    await expect(login('a', 'b')).rejects.toBeTruthy();
  });

  it('logout clears tokens and user', () => {
    storeSession();
    logout();
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(getUser()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('auth requests carry the bearer token and a timeout (FE-14)', async () => {
    storeSession({ access: 'TOKEN' });
    http.on('POST', '/auth-api/api/auth/token/verify/', reply(200, {}));
    await verifyToken('TOKEN');
    expect(http.calls[0].headers.Authorization).toBe('Bearer TOKEN');
    expect(http.calls[0].timeout).toBe(AUTH_TIMEOUT_MS);
    expect(AUTH_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('register only sends organization when given', async () => {
    http.on('POST', '/auth-api/api/auth/register/', reply(201, {}));
    await register({ username: 'u', email: 'e', password: 'p' });
    await register({ username: 'u', email: 'e', password: 'p', organization: 'O' });
    expect(http.calls[0].body).toEqual({ username: 'u', email: 'e', password: 'p' });
    expect(http.calls[1].body.organization).toBe('O');
  });

  it('updateProfile merges into the stored user', async () => {
    storeSession({ user: { username: 'u', role: 'x' } });
    http.on('PATCH', '/auth-api/api/auth/profile/', reply(200, { email: 'new@x' }));
    await updateProfile({ email: 'new@x' });
    expect(getUser()).toEqual({ username: 'u', role: 'x', email: 'new@x' });
  });
});

describe('getUser robustness (FE-21)', () => {
  it('corrupted localStorage.user returns null instead of throwing', () => {
    localStorage.setItem('user', '{bad');
    expect(() => getUser()).not.toThrow();
    expect(getUser()).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
  it('non-object JSON returns null', () => {
    localStorage.setItem('user', '"str"');
    expect(getUser()).toBeNull();
    localStorage.setItem('user', 'null');
    expect(getUser()).toBeNull();
  });
});

describe('isAccessExpired / JWT decoding (FE-12)', () => {
  it('no token -> expired', () => {
    expect(isAccessExpired()).toBe(true);
  });

  it('valid future exp -> not expired; past exp -> expired', () => {
    localStorage.setItem('access_token', makeJwt({ exp: now() + day }));
    expect(isAccessExpired()).toBe(false);
    localStorage.setItem('access_token', makeJwt({ exp: now() - 10 }));
    expect(isAccessExpired()).toBe(true);
  });

  it('base64url payload with - and _ is decoded correctly (valid token is not expired)', () => {
    // '?>?' / '~~~' style bytes produce '-' and '_' in base64url
    let token;
    for (let i = 0; i < 200; i += 1) {
      const t = makeJwt({ exp: now() + day, username: `user~~??>>${'ÿ'.repeat(i % 7)}${i}` });
      const payloadSeg = t.split('.')[1];
      if (/[-_]/.test(payloadSeg)) { token = t; break; }
    }
    expect(token).toBeTruthy();
    localStorage.setItem('access_token', token);
    expect(isAccessExpired()).toBe(false);
  });

  it('decodes UTF-8 (Arabic) claims', () => {
    const t = makeJwt({ exp: now() + day, name: 'إسلام' });
    expect(decodeJwtPayload(t).name).toBe('إسلام');
  });

  it('malformed tokens -> expired', () => {
    for (const bad of ['garbage', 'a.b', 'a.!!!.c', '.', 'a..c', makeJwt('str')]) {
      localStorage.setItem('access_token', bad);
      expect(isAccessExpired()).toBe(true);
    }
  });

  it('missing exp -> not expired; non-numeric exp -> expired', () => {
    localStorage.setItem('access_token', makeJwt({ sub: 1 }));
    expect(isAccessExpired()).toBe(false);
    localStorage.setItem('access_token', makeJwt({ exp: 'soon' }));
    expect(isAccessExpired()).toBe(true);
  });
});

describe('refreshToken / ensureValidToken', () => {
  it('valid access token -> no refresh call', async () => {
    storeSession();
    await expect(ensureValidToken()).resolves.toBe(true);
    expect(http.calls).toHaveLength(0);
  });

  it('expired access + refresh success stores the new access token', async () => {
    storeSession({ access: makeJwt({ exp: now() - 5 }) });
    http.on('POST', REFRESH, reply(200, { access: 'A2' }));
    await expect(ensureValidToken()).resolves.toBe(true);
    expect(http.calls[0].body).toEqual({ refresh: 'R1' });
    expect(getAccessToken()).toBe('A2');
    expect(localStorage.getItem('refresh_token')).toBe('R1');
  });

  it('a rotated refresh token is persisted (FE-13)', async () => {
    storeSession({ access: makeJwt({ exp: now() - 5 }) });
    http.on('POST', REFRESH, reply(200, { access: 'A2', refresh: 'R2' }));
    await refreshToken();
    expect(localStorage.getItem('refresh_token')).toBe('R2');
  });

  it.each([400, 401])('refresh rejected with %i -> logout', async (status) => {
    storeSession({ access: makeJwt({ exp: now() - 5 }) });
    http.on('POST', REFRESH, reply(status, { detail: 'Token is invalid or expired' }));
    await expect(ensureValidToken()).resolves.toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it.each([
    ['network error', networkError()],
    ['timeout', timeoutError()],
    ['502', reply(502)],
    ['500', reply(500)],
    ['429', reply(429, { detail: 'throttled' })],
  ])('transient refresh failure (%s) does NOT log the user out (FE-11)', async (_label, responder) => {
    storeSession({ access: makeJwt({ exp: now() - 5 }) });
    http.on('POST', REFRESH, responder);
    await expect(ensureValidToken()).resolves.toBe(true);
    expect(localStorage.getItem('refresh_token')).toBe('R1');
    expect(getUser()).toEqual({ username: 'u' });
  });

  it('expired access and no refresh token -> logout', async () => {
    storeSession({ access: makeJwt({ exp: now() - 5 }), refresh: null });
    await expect(ensureValidToken()).resolves.toBe(false);
    expect(http.calls).toHaveLength(0);
    expect(getAccessToken()).toBeNull();
  });

  it('refreshToken without a stored refresh token throws', async () => {
    await expect(refreshToken()).rejects.toThrow('No refresh token');
  });
});
