// @vitest-environment node
// Scraping proxy: api/_lib/proxyCore.js (shared core) and api/scraping-proxy.js
// (Vercel wrapper). Covers the fixes for FE-01 (open relay + hard-coded key),
// FE-02 (identity / client IP / Retry-After) and FE-19 (path escape).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProxyHandler,
  createTokenVerifier,
  resolveUpstreamPath,
  clientIpFrom,
  decodeJwtPayload,
} from '../../api/_lib/proxyCore.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const UPSTREAM = 'https://upstream.test/scraping-api';
const KEY = 'test-service-key';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload) => `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
const future = () => Math.floor(Date.now() / 1000) + 3600;
const GOOD = jwt({ user_id: 7, exp: future() });

const makeReq = ({ url, method = 'GET', body, headers = {}, parsedBody, remote = '10.0.0.9' }) => {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  const h = { authorization: `Bearer ${GOOD}`, ...headers };
  for (const k of Object.keys(h)) if (h[k] === undefined) delete h[k];
  Object.assign(req, { url, method, headers: h, socket: { remoteAddress: remote } });
  if (parsedBody !== undefined) req.body = parsedBody;
  return req;
};

const makeRes = () => {
  const res = { statusCode: 200, headers: {}, body: undefined, ended: false };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = (b) => { res.body = b === undefined ? undefined : Buffer.from(b); res.ended = true; };
  res.json = () => JSON.parse(res.body.toString('utf8'));
  return res;
};

const upstreamRes = ({ status = 200, body = '{}', headers = { 'content-type': 'application/json' } } = {}) => ({
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
});

let fetchMock;
let verify;
let handler;
const build = (opts = {}) => createProxyHandler({
  upstream: UPSTREAM,
  apiKey: KEY,
  verifyToken: verify,
  fetchImpl: fetchMock,
  log: () => {},
  ...opts,
});

beforeEach(() => {
  fetchMock = vi.fn(async () => upstreamRes());
  verify = vi.fn(async () => true);
  handler = build();
});

const call = async (reqOpts, h = handler) => {
  const res = makeRes();
  await h(makeReq(reqOpts), res);
  return res;
};

describe('forwarding', () => {
  it('forwards method, path (prefix stripped) and query string', async () => {
    const res = await call({ url: '/scraping-api/api/categories/?site_lists=a,b' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${UPSTREAM}/api/categories/?site_lists=a,b`);
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(res.statusCode).toBe(200);
    expect(res.body.toString()).toBe('{}');
  });

  it('uses originalUrl when a mount (Vite/connect) stripped req.url', async () => {
    const req = makeReq({ url: '/api/missions/' });
    req.originalUrl = '/scraping-api/api/missions/';
    await handler(req, makeRes());
    expect(fetchMock.mock.calls[0][0]).toBe(`${UPSTREAM}/api/missions/`);
  });

  it('strips trailing slashes from the configured upstream', async () => {
    await call({ url: '/scraping-api/api/missions/' }, build({ upstream: `${UPSTREAM}///` }));
    expect(fetchMock.mock.calls[0][0]).toBe(`${UPSTREAM}/api/missions/`);
  });

  it('adds the service key, forwards Authorization and the platform client IP', async () => {
    await call({
      url: '/scraping-api/api/missions/',
      headers: { 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '6.6.6.6, 203.0.113.5' },
    });
    const h = fetchMock.mock.calls[0][1].headers;
    expect(h['X-API-Key']).toBe(KEY);
    expect(h.Authorization).toBe(`Bearer ${GOOD}`);
    expect(h['X-Forwarded-For']).toBe('203.0.113.5');
    expect(h['X-Real-IP']).toBe('203.0.113.5');
  });

  it('does not forward Authorization when forwardAuthorization is false (local dev)', async () => {
    await call({ url: '/scraping-api/api/missions/' }, build({ forwardAuthorization: false }));
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].headers['X-API-Key']).toBe(KEY);
  });

  it('never forwards arbitrary client headers (cookies, spoofed keys)', async () => {
    await call({
      url: '/scraping-api/api/missions/',
      headers: { cookie: 'a=b', 'x-api-key': 'attacker', host: 'evil' },
    });
    const h = fetchMock.mock.calls[0][1].headers;
    expect(h['X-API-Key']).toBe(KEY);
    expect(h.cookie).toBeUndefined();
    expect(h.host).toBeUndefined();
  });

  it('forwards the raw body byte-exact for POST/PUT/PATCH/DELETE with its content type', async () => {
    const body = '{"keyword":"غزة 🇵🇸"}';
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      fetchMock.mockClear();
      await call({ url: '/scraping-api/api/category-sites/5/', method, body, headers: { 'content-type': 'application/json; charset=utf-8' } });
      const init = fetchMock.mock.calls[0][1];
      expect(init.method).toBe(method);
      expect(Buffer.from(init.body).toString('utf8')).toBe(body);
      expect(init.headers['Content-Type']).toBe('application/json; charset=utf-8');
    }
  });

  it('accepts a body the platform already parsed (Vercel req.body)', async () => {
    await call({ url: '/scraping-api/api/category-scrape/', method: 'POST', parsedBody: { keyword: 'x' } });
    expect(Buffer.from(fetchMock.mock.calls[0][1].body).toString()).toBe('{"keyword":"x"}');
  });

  it('sends no body for GET/HEAD/OPTIONS or an empty POST', async () => {
    await call({ url: '/scraping-api/api/missions/', method: 'HEAD' });
    await call({ url: '/scraping-api/api/missions/', method: 'DELETE' });
    await call({ url: '/scraping-api/api/missions/', method: 'OPTIONS', headers: { authorization: undefined } });
    for (const c of fetchMock.mock.calls) expect(c[1].body).toBeUndefined();
  });

  it('does not follow upstream redirects', async () => {
    await call({ url: '/scraping-api/api/missions/' });
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });
});

describe('authentication (FE-01: no open relay)', () => {
  it('401 without a Bearer token — nothing reaches upstream', async () => {
    const res = await call({ url: '/scraping-api/api/missions/', method: 'DELETE', headers: { authorization: undefined } });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('not_authenticated');
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['Basic abc'],
    ['Bearer'],
    ['Bearer two words'],
    ['bearer'],
  ])('401 for malformed Authorization %j', async (authorization) => {
    const res = await call({ url: '/scraping-api/api/missions/', headers: { authorization } });
    expect(res.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401 when the verifier rejects the token', async () => {
    verify.mockResolvedValue(false);
    const res = await call({ url: '/scraping-api/api/missions/' });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('token_invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('503 when the auth service is down (fail closed)', async () => {
    const verifier = createTokenVerifier({ profileUrl: 'https://auth.test/v', fetchImpl: vi.fn(async () => { throw new Error('ECONNREFUSED'); }) });
    const res = await call({ url: '/scraping-api/api/missions/' }, build({ verifyToken: verifier }));
    expect(res.statusCode).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('OPTIONS preflight needs no token', async () => {
    const res = await call({ url: '/scraping-api/api/missions/', method: 'OPTIONS', headers: { authorization: undefined } });
    expect(res.statusCode).toBe(200);
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('configuration', () => {
  it.each([
    [{ apiKey: '' }],
    [{ apiKey: undefined }],
    [{ upstream: '' }],
    [{ verifyToken: undefined }],
  ])('500 "not configured" when %j', async (override) => {
    const res = await call({ url: '/scraping-api/api/missions/' }, build(override));
    expect(res.statusCode).toBe(500);
    expect(res.json().code).toBe('misconfigured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the service key is no longer in any source file', () => {
    for (const f of ['api/scraping-proxy.js', 'api/_lib/proxyCore.js', 'vite.config.js', 'vite.local.config.js']) {
      expect(fs.readFileSync(path.join(root, f), 'utf8')).not.toMatch(/nra_[0-9a-f]{20,}/);
    }
  });

  it('the Vercel function reads its key from SCRAPING_API_KEY', async () => {
    vi.resetModules();
    process.env.SCRAPING_API_KEY = 'from-env';
    const realFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push([url, init]);
      if (String(url).includes('/auth/profile/')) return { status: 200 };
      return upstreamRes();
    });
    try {
      const { default: vercelHandler } = await import('../../api/scraping-proxy.js');
      const res = makeRes();
      await vercelHandler(makeReq({ url: '/scraping-api/api/missions/' }), res);
      expect(res.statusCode).toBe(200);
      expect(calls[0][0]).toBe('https://una-ai-tools-apis.una-oic.org/auth-api/api/auth/profile/');
      expect(calls[0][1].headers.Authorization).toBe(`Bearer ${GOOD}`);
      expect(calls[1][0]).toBe('https://una-ai-tools-apis.una-oic.org/scraping-api/api/missions/');
      expect(calls[1][1].headers['X-API-Key']).toBe('from-env');
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.SCRAPING_API_KEY;
    }
  });
});

describe('path validation (FE-19)', () => {
  it.each([
    '/scraping-api/%2e%2e/auth-api/x',
    '/scraping-api/api/%2E%2E/%2e%2e/auth-api',
    '/scraping-api/api/..%2fadmin',
    '/scraping-api/api/../../auth-api/x',
    '/scraping-api/api/./missions/',
    '/scraping-api/api/missions\\..\\x',
    '/scraping-api/api/missions%5c',
    '/scraping-api/api/missions%00',
  ])('400 for %s', async (url) => {
    const res = await call({ url });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    '/scraping-api/admin/login/',
    '/scraping-api/',
    '/scraping-api/static/x.js',
    '/other/api/missions/',
    '/scraping-apix/api/missions/',
  ])('404 for non-API path %s', async (url) => {
    const res = await call({ url });
    expect(res.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows encoded characters that are not path separators (Arabic query, ids)', () => {
    expect(resolveUpstreamPath('/scraping-api/api/missions/abc-123/?q=%D8%BA%D8%B2%D8%A9'))
      .toBe('/api/missions/abc-123/?q=%D8%BA%D8%B2%D8%A9');
    expect(resolveUpstreamPath('/scraping-api/api')).toBe('/api');
  });

  it('dots inside a segment are fine (filenames)', () => {
    expect(resolveUpstreamPath('/scraping-api/api/missions/download/a.b.xlsx'))
      .toBe('/api/missions/download/a.b.xlsx');
  });
});

describe('methods and body limits', () => {
  it.each(['TRACE', 'CONNECT', 'PROPFIND'])('405 for %s', async (method) => {
    const res = await call({ url: '/scraping-api/api/missions/', method });
    expect(res.statusCode).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lower-case method names are normalised', async () => {
    await call({ url: '/scraping-api/api/missions/', method: 'get' });
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('413 when the streamed body exceeds the cap', async () => {
    const res = await call({ url: '/scraping-api/api/category-scrape/', method: 'POST', body: 'x'.repeat(2048) }, build({ maxBodyBytes: 1024 }));
    expect(res.statusCode).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('413 when a pre-parsed body exceeds the cap', async () => {
    const res = await call({ url: '/scraping-api/api/category-scrape/', method: 'POST', parsedBody: 'y'.repeat(2048) }, build({ maxBodyBytes: 1024 }));
    expect(res.statusCode).toBe(413);
  });
});

describe('responses (FE-02)', () => {
  it('passes 4xx and 429 through with Retry-After and rate-limit headers', async () => {
    fetchMock.mockResolvedValue(upstreamRes({
      status: 429,
      body: '{"detail":"throttled"}',
      headers: { 'content-type': 'application/json', 'retry-after': '7', 'x-ratelimit-remaining': '0' },
    }));
    const res = await call({ url: '/scraping-api/api/category-scrape/', method: 'POST', body: '{}' });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('7');
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
    expect(res.body.toString()).toBe('{"detail":"throttled"}');
  });

  it('streams binary (Excel) bodies with type, disposition and a correct length', async () => {
    const xlsx = 'PK\u0003\u0004binary';
    fetchMock.mockResolvedValue(upstreamRes({
      body: xlsx,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': 'attachment; filename="report.xlsx"',
        'content-length': '999',
      },
    }));
    const res = await call({ url: '/scraping-api/api/missions/download/report.xlsx' });
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="report.xlsx"');
    expect(res.headers['content-length']).toBe(String(res.body.length));
  });

  it('does not leak upstream-only headers (cookies, server)', async () => {
    fetchMock.mockResolvedValue(upstreamRes({ headers: { 'content-type': 'application/json', 'set-cookie': 'sid=1', server: 'gunicorn' } }));
    const res = await call({ url: '/scraping-api/api/missions/' });
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.headers.server).toBeUndefined();
  });

  it('missing upstream content-type does not crash', async () => {
    fetchMock.mockResolvedValue(upstreamRes({ headers: {} }));
    const res = await call({ url: '/scraping-api/api/missions/' });
    expect(res.statusCode).toBe(200);
  });

  it.each([204, 304])('%i responses end without a body', async (status) => {
    fetchMock.mockResolvedValue(upstreamRes({ status }));
    const res = await call({ url: '/scraping-api/api/missions/x/', method: 'DELETE' });
    expect(res.statusCode).toBe(status);
    expect(res.body).toBeUndefined();
  });

  it('HEAD responses end without a body', async () => {
    const res = await call({ url: '/scraping-api/api/missions/', method: 'HEAD' });
    expect(res.body).toBeUndefined();
  });

  it('upstream unreachable -> 502 JSON', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await call({ url: '/scraping-api/api/missions/' });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('upstream_unavailable');
  });

  it('upstream timeout -> 504 JSON', async () => {
    fetchMock.mockImplementation((_u, init) => new Promise((_r, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const res = await call({ url: '/scraping-api/api/missions/' }, build({ timeoutMs: 20 }));
    expect(res.statusCode).toBe(504);
    expect(res.json().code).toBe('upstream_timeout');
  });

  it('an unexpected exception becomes a 502, never a crash', async () => {
    fetchMock.mockResolvedValue({ status: 200, headers: { get: () => { throw new Error('boom'); } } });
    const res = await call({ url: '/scraping-api/api/missions/' });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('proxy_error');
  });

  it('error responses are JSON with no-store caching', async () => {
    const res = await call({ url: '/scraping-api/api/missions/', headers: { authorization: undefined } });
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('client IP', () => {
  it('prefers x-real-ip, then the first x-forwarded-for entry, then the socket', () => {
    expect(clientIpFrom({ headers: { 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' } })).toBe('1.1.1.1');
    expect(clientIpFrom({ headers: { 'x-forwarded-for': ' 2.2.2.2 , 3.3.3.3' } })).toBe('2.2.2.2');
    expect(clientIpFrom({ headers: {}, socket: { remoteAddress: '::1' } })).toBe('::1');
    expect(clientIpFrom({ headers: {} })).toBe('');
  });

  it('omits the IP headers when no address is known', async () => {
    const req = makeReq({ url: '/scraping-api/api/missions/', remote: undefined });
    req.socket = {};
    await handler(req, makeRes());
    expect(fetchMock.mock.calls[0][1].headers['X-Forwarded-For']).toBeUndefined();
  });
});

describe('token verifier', () => {
  let authFetch;
  let now;
  const mk = () => createTokenVerifier({ profileUrl: 'https://auth.test/profile/', fetchImpl: authFetch, now: () => now });

  beforeEach(() => {
    now = Date.now();
    authFetch = vi.fn(async () => ({ status: 200 }));
  });
  afterEach(() => vi.useRealTimers());

  it('checks the token with GET /profile/ (Bearer) and caches a valid result', async () => {
    const v = mk();
    expect(await v(GOOD)).toBe(true);
    expect(await v(GOOD)).toBe(true);
    expect(authFetch).toHaveBeenCalledTimes(1);
    const [url, init] = authFetch.mock.calls[0];
    expect(url).toBe('https://auth.test/profile/');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe(`Bearer ${GOOD}`);
    expect(init.body).toBeUndefined();
  });

  it.each([401, 403])('%i from the auth service means the token is invalid', async (status) => {
    authFetch.mockResolvedValue({ status });
    expect(await mk()(GOOD)).toBe(false);
  });

  it.each([404, 400, 405, 302])(
    'regression: a %i from the auth service is NOT treated as an expired session (503 instead)',
    async (status) => {
      // Production incident: the verifier hit a non-existent endpoint (404)
      // and every signed-in user was told their session had expired.
      authFetch.mockResolvedValue({ status });
      await expect(mk()(GOOD)).rejects.toMatchObject({ status: 503, code: 'auth_unavailable' });
    },
  );

  it('a 404 from the auth service surfaces as 503 from the proxy, never 401', async () => {
    const res = await call(
      { url: '/scraping-api/api/missions/' },
      build({ verifyToken: createTokenVerifier({ profileUrl: 'https://auth.test/p', fetchImpl: async () => ({ status: 404 }) }) }),
    );
    expect(res.statusCode).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-verifies after the 5-minute cache window', async () => {
    const v = mk();
    await v(GOOD);
    now += 5 * 60 * 1000 + 1;
    await v(GOOD);
    expect(authFetch).toHaveBeenCalledTimes(2);
  });

  it('rejects expired tokens locally without calling the auth service', async () => {
    const v = mk();
    expect(await v(jwt({ exp: Math.floor(now / 1000) - 1 }))).toBe(false);
    expect(authFetch).not.toHaveBeenCalled();
  });

  it('a cached valid token stops being valid at its exp', async () => {
    const exp = Math.floor(now / 1000) + 60;
    const tok = jwt({ exp });
    const v = mk();
    expect(await v(tok)).toBe(true);
    now = exp * 1000 + 1;
    expect(await v(tok)).toBe(false);
  });

  it.each(['garbage', 'a.b', 'a.!!!.c', `${b64({})}.${Buffer.from('[1]').toString('base64url')}.s`])(
    'rejects non-JWT input %j without a network call',
    async (tok) => {
      expect(await mk()(tok)).toBe(false);
      expect(authFetch).not.toHaveBeenCalled();
    },
  );

  it('caches rejections for 30 s', async () => {
    authFetch.mockResolvedValue({ status: 401 });
    const v = mk();
    expect(await v(GOOD)).toBe(false);
    expect(await v(GOOD)).toBe(false);
    expect(authFetch).toHaveBeenCalledTimes(1);
    now += 30001;
    await v(GOOD);
    expect(authFetch).toHaveBeenCalledTimes(2);
  });

  it('auth-service 5xx is "unavailable", not "invalid", and is not cached', async () => {
    authFetch.mockResolvedValueOnce({ status: 502 }).mockResolvedValueOnce({ status: 200 });
    const v = mk();
    await expect(v(GOOD)).rejects.toMatchObject({ status: 503 });
    expect(await v(GOOD)).toBe(true);
  });

  it('times out a hung auth service', async () => {
    const hung = vi.fn((_u, init) => new Promise((_r, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const v = createTokenVerifier({ profileUrl: 'https://auth.test/v', fetchImpl: hung, timeoutMs: 20 });
    await expect(v(GOOD)).rejects.toMatchObject({ status: 503 });
  });

  it('bounds its cache size', async () => {
    const v = mk();
    for (let i = 0; i < 1100; i++) await v(jwt({ i, exp: future() }));
    expect(v._cache.size).toBeLessThanOrEqual(1000);
  });
});

describe('decodeJwtPayload', () => {
  it('decodes base64url payloads (incl. - and _)', () => {
    const p = { sub: '>>>???', name: 'عربي' };
    expect(decodeJwtPayload(jwt(p))).toEqual(p);
  });
  it.each([null, undefined, 42, '', 'x.y', 'x..z', 'a.%%%.c'])('returns null for %j', (v) => {
    expect(decodeJwtPayload(v)).toBeNull();
  });
});
