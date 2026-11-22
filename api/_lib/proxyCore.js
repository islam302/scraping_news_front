// Shared scraping-API proxy used by the Vercel function (api/scraping-proxy.js)
// and the Vite dev servers (vite.config.js / vite.local.config.js).
//
// Security model
// --------------
// The service API key (X-API-Key) is a server-side secret: it comes from the
// environment and is never shipped to the browser. The proxy only attaches it
// to requests that carry a VALID user session (Bearer JWT), so the proxy is no
// longer an open relay that lends the service key to anyone on the internet.
//
//   1. Only /scraping-api/api/... paths are forwarded; encoded or literal
//      dot-segments, backslashes and NUL bytes are rejected (no path escape to
//      sibling services on the upstream host).
//   2. Only known HTTP methods; request bodies are capped.
//   3. Missing/expired/invalid Bearer token → 401 (nothing reaches upstream).
//      Tokens are verified against the auth service's /profile/ endpoint and
//      cached until expiry.
//   4. The user's Authorization header is forwarded (per-user identity on the
//      backend → per-user rate limits and owner scoping), plus the client IP
//      as X-Forwarded-For / X-Real-IP (taken from the platform, not from the
//      client-supplied chain).
//   5. Upstream status codes and the headers clients need (Retry-After,
//      Content-Disposition, …) are passed through; upstream failures map to
//      502 (unreachable) / 504 (timeout) instead of a generic 500.

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-disposition',
  'content-length',
  'cache-control',
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
];
const PREFIX = '/scraping-api';

export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024; // 1 MiB
export const DEFAULT_TIMEOUT_MS = 55000; // just under Vercel's 60s function limit

const VERIFIED_CACHE_MAX = 1000;
const VERIFIED_TTL_MS = 5 * 60 * 1000;
const REJECTED_TTL_MS = 30 * 1000;

class ProxyError extends Error {
  constructor(status, detail, code) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

const sendJson = (res, status, payload, extraHeaders = {}) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(payload));
};

/** Decode a JWT payload (base64url) without verifying it. Returns null on garbage. */
export const decodeJwtPayload = (token) => {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
};

const bearerFrom = (headers) => {
  const raw = headers?.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const m = /^Bearer\s+([A-Za-z0-9\-_.]+)\s*$/.exec(value);
  return m ? m[1] : null;
};

/**
 * Resolve and validate the upstream path. Returns "/api/...?query" (without the
 * /scraping-api prefix) or throws a ProxyError.
 */
export const resolveUpstreamPath = (rawUrl) => {
  if (typeof rawUrl !== 'string' || !rawUrl.startsWith(PREFIX + '/')) {
    throw new ProxyError(404, 'Not found', 'not_found');
  }
  const q = rawUrl.indexOf('?');
  const rawPath = q === -1 ? rawUrl : rawUrl.slice(0, q);
  const search = q === -1 ? '' : rawUrl.slice(q);

  // Reject anything that could be normalised into a different path upstream.
  if (/%2e|%2f|%5c|%00|\\|\0/i.test(rawPath)) {
    throw new ProxyError(400, 'Invalid path', 'bad_path');
  }
  const segments = rawPath.split('/');
  if (segments.some((s) => s === '.' || s === '..')) {
    throw new ProxyError(400, 'Invalid path', 'bad_path');
  }
  if (/[\0\r\n]/.test(search)) throw new ProxyError(400, 'Invalid query', 'bad_query');

  const path = rawPath.slice(PREFIX.length);
  if (!/^\/api(\/|$)/.test(path)) throw new ProxyError(404, 'Not found', 'not_found');
  return path + search;
};

/** Client IP as seen by the hosting platform (never the client-supplied chain alone). */
export const clientIpFrom = (req) => {
  const h = req.headers || {};
  const realIp = Array.isArray(h['x-real-ip']) ? h['x-real-ip'][0] : h['x-real-ip'];
  if (realIp) return String(realIp).trim();
  // Vercel sets x-forwarded-for to the client IP; its first entry is the client.
  const xff = Array.isArray(h['x-forwarded-for']) ? h['x-forwarded-for'][0] : h['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '';
};

const readBody = async (req, maxBytes) => {
  // Frameworks (Vercel) may have parsed the body already.
  if (req.body !== undefined && req.body !== null) {
    const buf = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    if (buf.length > maxBytes) throw new ProxyError(413, 'Request body too large', 'too_large');
    return buf;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += b.length;
    if (size > maxBytes) throw new ProxyError(413, 'Request body too large', 'too_large');
    chunks.push(b);
  }
  return Buffer.concat(chunks);
};

/**
 * Token verifier backed by the auth service's profile endpoint
 * (GET <profileUrl> with the Bearer token — the same check the scraping API
 * itself uses), with an in-memory cache (valid until min(exp, 5 min);
 * rejections for 30 s).
 *
 * 200 → valid. 401/403 → invalid (cached). Anything else (404, 5xx, network
 * error, timeout) means the auth service can't answer: fail closed with 503
 * rather than telling a signed-in user their session expired.
 */
export const createTokenVerifier = ({ profileUrl, fetchImpl = globalThis.fetch, timeoutMs = 10000, now = () => Date.now() } = {}) => {
  const cache = new Map(); // token -> { ok, until }

  const remember = (token, ok, until) => {
    if (cache.size >= VERIFIED_CACHE_MAX) {
      const t = now();
      for (const [k, v] of cache) if (v.until <= t) cache.delete(k);
      if (cache.size >= VERIFIED_CACHE_MAX) cache.delete(cache.keys().next().value);
    }
    cache.set(token, { ok, until });
  };

  const verify = async (token) => {
    const payload = decodeJwtPayload(token);
    if (!payload) return false;
    const t = now();
    const expMs = typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    if (expMs !== null && expMs <= t) return false;

    const hit = cache.get(token);
    if (hit && hit.until > t) return hit.ok;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(profileUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: ctrl.signal,
      });
    } catch {
      // Auth service unreachable: fail closed, don't cache (transient).
      throw new ProxyError(503, 'Authentication service unavailable', 'auth_unavailable');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) {
      remember(token, false, t + REJECTED_TTL_MS);
      return false;
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ProxyError(503, 'Authentication service unavailable', 'auth_unavailable');
    }
    remember(token, true, Math.min(expMs ?? Infinity, t + VERIFIED_TTL_MS));
    return true;
  };
  verify._cache = cache;
  return verify;
};

/**
 * Build a Node-style (req, res) handler.
 *
 * @param {object}   opts
 * @param {string}   opts.upstream             Base URL the "/api/..." path is appended to.
 * @param {string}   opts.apiKey               Service API key (server-side secret).
 * @param {Function} opts.verifyToken          async (token) => boolean
 * @param {boolean} [opts.forwardAuthorization=true]  Forward the user's Bearer token upstream.
 * @param {Function}[opts.fetchImpl]
 * @param {number}  [opts.timeoutMs]
 * @param {number}  [opts.maxBodyBytes]
 * @param {Function}[opts.log]                 (message) => void, for server-side errors.
 */
export const createProxyHandler = ({
  upstream,
  apiKey,
  verifyToken,
  forwardAuthorization = true,
  fetchImpl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  log = (msg) => console.error(msg),
} = {}) => {
  const base = typeof upstream === 'string' ? upstream.replace(/\/+$/, '') : '';

  return async function scrapingProxy(req, res) {
    try {
      if (!apiKey || !base || typeof verifyToken !== 'function') {
        log('[scraping-proxy] misconfigured: SCRAPING_API_KEY / upstream / verifier missing');
        throw new ProxyError(500, 'Proxy is not configured', 'misconfigured');
      }

      const method = String(req.method || 'GET').toUpperCase();
      if (!ALLOWED_METHODS.has(method)) {
        throw new ProxyError(405, 'Method not allowed', 'method_not_allowed');
      }

      // originalUrl: connect/Vite strips the mount path from req.url.
      const path = resolveUpstreamPath(req.originalUrl || req.url);

      // CORS preflight never needs (or gets) credentials.
      if (method !== 'OPTIONS') {
        const token = bearerFrom(req.headers);
        if (!token) throw new ProxyError(401, 'Authentication required', 'not_authenticated');
        const ok = await verifyToken(token);
        if (!ok) throw new ProxyError(401, 'Session expired or invalid', 'token_invalid');
      }

      const headers = {
        'X-API-Key': apiKey,
        Accept: req.headers?.accept || 'application/json',
      };
      const ip = clientIpFrom(req);
      if (ip) {
        headers['X-Forwarded-For'] = ip;
        headers['X-Real-IP'] = ip;
      }
      if (forwardAuthorization && req.headers?.authorization) {
        headers.Authorization = req.headers.authorization;
      }

      const init = { method, headers, redirect: 'manual' };
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const body = await readBody(req, maxBodyBytes);
        if (body.length) {
          init.body = body;
          headers['Content-Type'] = req.headers?.['content-type'] || 'application/json';
        }
      }

      const doFetch = fetchImpl || globalThis.fetch;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      init.signal = ctrl.signal;
      let upstreamRes;
      try {
        upstreamRes = await doFetch(base + path, init);
      } catch (err) {
        if (err?.name === 'AbortError') throw new ProxyError(504, 'Upstream timed out', 'upstream_timeout');
        log(`[scraping-proxy] upstream unreachable: ${err?.message || err}`);
        throw new ProxyError(502, 'Upstream unavailable', 'upstream_unavailable');
      } finally {
        clearTimeout(timer);
      }

      res.statusCode = upstreamRes.status;
      for (const name of PASSTHROUGH_HEADERS) {
        if (name === 'content-length') continue; // recomputed from the body we send
        const v = upstreamRes.headers.get(name);
        if (v !== null && v !== undefined) res.setHeader(name, v);
      }
      if (method === 'HEAD' || upstreamRes.status === 204 || upstreamRes.status === 304) {
        res.end();
        return;
      }
      const buf = Buffer.from(await upstreamRes.arrayBuffer());
      res.setHeader('Content-Length', String(buf.length));
      res.end(buf);
    } catch (err) {
      if (err instanceof ProxyError) {
        const extra = err.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {};
        sendJson(res, err.status, { detail: err.message, code: err.code }, extra);
        return;
      }
      log(`[scraping-proxy] unexpected error: ${err?.stack || err}`);
      sendJson(res, 502, { detail: 'Proxy error', code: 'proxy_error' });
    }
  };
};
