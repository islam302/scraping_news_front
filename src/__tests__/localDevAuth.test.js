// @vitest-environment node
// vite.local.config.js — the local-only /auth-api stand-in. The users file is
// mocked; no server is started.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import { Readable } from 'node:stream';

let middleware;
let usersJson;

beforeEach(async () => {
  usersJson = JSON.stringify({ users: [{ username: 'dev', password: 'devpw', email: 'd@x', role: 'admin' }] });
  const realRead = fs.readFileSync;
  vi.spyOn(fs, 'readFileSync').mockImplementation((p, ...rest) => {
    if (String(p).endsWith('.local-auth.json')) {
      if (usersJson == null) throw new Error('ENOENT');
      return usersJson;
    }
    return realRead(p, ...rest);
  });
  if (!middleware) {
    const { default: config } = await import('../../vite.local.config.js');
    const plugin = config.plugins.flat().find((p) => p && p.name === 'local-dev-auth');
    plugin.configureServer({ middlewares: { use: (_path, fn) => { middleware = fn; } } });
  }
});

const call = (method, url, body) => new Promise((resolve) => {
  const req = Readable.from(body == null ? [] : [Buffer.from(body)]);
  Object.assign(req, { method, url });
  const res = {
    statusCode: 200, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    end(data) { resolve({ status: this.statusCode, body: JSON.parse(data) }); },
  };
  middleware(req, res);
});

const payload = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

describe('localDevAuth', () => {
  it('POST /token with valid credentials returns tokens + profile', async () => {
    const r = await call('POST', '/token/', JSON.stringify({ username: 'dev', password: 'devpw' }));
    expect(r.status).toBe(200);
    expect(r.body.username).toBe('dev');
    expect(payload(r.body.access).exp).toBeGreaterThan(Date.now() / 1000);
    expect(payload(r.body.refresh).exp).toBeGreaterThan(payload(r.body.access).exp);
  });

  it('POST /token with bad credentials -> 401', async () => {
    const r = await call('POST', '/token', JSON.stringify({ username: 'dev', password: 'nope' }));
    expect(r.status).toBe(401);
  });

  it('malformed JSON body -> 401 (treated as empty)', async () => {
    const r = await call('POST', '/token', '{not json');
    expect(r.status).toBe(401);
  });

  it('refresh and verify succeed', async () => {
    expect((await call('POST', '/token/refresh/', '{}')).body.access).toBeTruthy();
    expect((await call('POST', '/token/verify', '{}')).status).toBe(200);
  });

  it('/profile with and without a users file', async () => {
    expect((await call('GET', '/profile/')).body.username).toBe('dev');
    usersJson = null;
    expect((await call('GET', '/profile')).status).toBe(401);
  });

  it('/users and /api-keys return empty lists; unknown routes 404', async () => {
    expect((await call('GET', '/users/')).body).toEqual([]);
    expect((await call('GET', '/api-keys')).body).toEqual([]);
    expect((await call('GET', '/nope')).status).toBe(404);
    expect((await call('GET', '/token')).status).toBe(404);
  });
});

describe('local scraping proxy (vite.local.config.js)', () => {
  const runProxy = async (authorization) => {
    const { default: config } = await import('../../vite.local.config.js');
    const plugin = config.plugins.flat().find((p) => p && p.name === 'scraping-proxy');
    let handler;
    plugin.configureServer({
      config: { logger: { warn: () => {} } },
      middlewares: { use: (_p, fn) => { handler = fn; } },
    });
    const upstream = vi.fn(async () => ({
      status: 200,
      headers: { get: (k) => (k === 'content-type' ? 'application/json' : null) },
      arrayBuffer: async () => new TextEncoder().encode('[]').buffer,
    }));
    vi.stubGlobal('fetch', upstream);
    const res = await new Promise((resolve) => {
      const req = Readable.from([]);
      Object.assign(req, {
        method: 'GET', url: '/api/missions/', originalUrl: '/scraping-api/api/missions/',
        headers: authorization ? { authorization } : {}, socket: { remoteAddress: '127.0.0.1' },
      });
      const r = {
        statusCode: 200, headers: {},
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        end() { resolve(this); },
      };
      handler(req, r);
    });
    vi.unstubAllGlobals();
    return { res, upstream };
  };

  it('accepts a token minted by the local login and targets the local backend without forwarding it', async () => {
    process.env.SCRAPING_API_KEY = 'local-key';
    try {
      vi.resetModules();
      const login = await call('POST', '/token', JSON.stringify({ username: 'dev', password: 'devpw' }));
      const { res, upstream } = await runProxy(`Bearer ${login.body.access}`);
      expect(res.statusCode).toBe(200);
      const [target, init] = upstream.mock.calls[0];
      expect(target).toBe('http://127.0.0.1:8000/api/missions/');
      expect(init.headers['X-API-Key']).toBe('local-key');
      expect(init.headers.Authorization).toBeUndefined();
    } finally {
      delete process.env.SCRAPING_API_KEY;
    }
  });

  it.each([
    [undefined],
    ['Bearer not-a-jwt'],
    [`Bearer ${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: 9999999999 })).toString('base64url')}.real-signature`],
    [`Bearer ${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url')}.local-dev`],
  ])('rejects %s with 401 and never calls the backend', async (authorization) => {
    process.env.SCRAPING_API_KEY = 'local-key';
    try {
      const { res, upstream } = await runProxy(authorization);
      expect(res.statusCode).toBe(401);
      expect(upstream).not.toHaveBeenCalled();
    } finally {
      delete process.env.SCRAPING_API_KEY;
    }
  });
});
