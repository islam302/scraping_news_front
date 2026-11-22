// In-memory HTTP mock wired in as axios' default adapter (see setup.js), so
// every axios instance created by the app (api.js, auth.js) is hermetic.
import axios, { AxiosError, AxiosHeaders } from 'axios';

const state = { routes: [], calls: [] };

const methodMatches = (route, method) => route.method === '*' || route.method === method;
const pathMatches = (route, path) =>
  typeof route.path === 'string' ? route.path === path : route.path.test(path);

export const http = {
  get calls() { return state.calls; },
  reset() {
    state.routes = [];
    state.calls = [];
  },
  /**
   * Register a responder. `responder(call)` returns a response object from
   * reply()/networkError()/... (or a promise of one). `once` routes are used a
   * single time and take priority (in registration order) over persistent ones.
   */
  on(method, path, responder, { once = false } = {}) {
    state.routes.push({ method: method.toUpperCase(), path, responder, once, used: false });
    return http;
  },
  once(method, path, responder) {
    return http.on(method, path, responder, { once: true });
  },
  callsTo(method, path) {
    return state.calls.filter((c) => c.method === method.toUpperCase() && (
      typeof path === 'string' ? c.path === path : path.test(c.path)));
  },
};

// ---- responder helpers ------------------------------------------------------

export const reply = (status, data = null, headers = {}) => () => ({ kind: 'response', status, data, headers });
export const networkError = () => () => ({ kind: 'network' });
export const timeoutError = () => () => ({ kind: 'timeout' });
export const never = () => () => new Promise(() => {});
export const delayed = (ms, responder) => (call) =>
  new Promise((resolve) => setTimeout(() => resolve(responder(call)), ms));
/** A responder whose resolution the test controls: d.resolve(reply(...)) */
export const deferred = () => {
  let resolveFn;
  const promise = new Promise((r) => { resolveFn = r; });
  const responder = () => promise.then((r) => r());
  responder.resolve = (r) => resolveFn(r);
  return responder;
};

const parseBody = (data) => {
  if (data == null) return undefined;
  if (typeof data !== 'string') return data;
  try { return JSON.parse(data); } catch { return data; }
};

export async function mockAdapter(config) {
  const path = `${config.baseURL || ''}${config.url || ''}`;
  const method = (config.method || 'get').toUpperCase();
  const call = {
    method,
    path,
    params: config.params || {},
    body: parseBody(config.data),
    headers: AxiosHeaders.from(config.headers || {}).toJSON(),
    timeout: config.timeout,
    config,
  };
  state.calls.push(call);

  const candidates = state.routes.filter((r) => methodMatches(r, method) && pathMatches(r, path) && !r.used);
  const route = candidates.find((r) => r.once) || candidates.find((r) => !r.once);
  if (!route) {
    throw new AxiosError(`Unmocked request ${method} ${path}`, AxiosError.ERR_NETWORK, config, {});
  }
  if (route.once) route.used = true;

  const result = await route.responder(call);
  if (!result || result.kind === 'network') {
    throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
  }
  if (result.kind === 'timeout') {
    throw new AxiosError(`timeout of ${config.timeout}ms exceeded`, AxiosError.ECONNABORTED, config, {});
  }
  const response = {
    data: result.data,
    status: result.status,
    statusText: String(result.status),
    headers: AxiosHeaders.from(result.headers || {}),
    config,
    request: {},
  };
  const validate = config.validateStatus || ((s) => s >= 200 && s < 300);
  if (validate(result.status)) return response;
  throw new AxiosError(
    `Request failed with status code ${result.status}`,
    result.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    {},
    response,
  );
}

export function installHttpMock() {
  axios.defaults.adapter = mockAdapter;
}

/** Build an axios-shaped error without going through the adapter. */
export const axiosError = (status, data, headers = {}) => {
  if (status == null) return new AxiosError('Network Error', AxiosError.ERR_NETWORK, {}, {});
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', {}, {}, {
    status, data, headers: AxiosHeaders.from(headers), config: {}, statusText: String(status),
  });
};

/** A JWT with the given payload (base64url, unsigned). */
export const makeJwt = (payload) => {
  const enc = (obj) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.sig`;
};
