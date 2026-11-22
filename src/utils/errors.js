/**
 * Classify an axios error and return a user-friendly message.
 *
 * Rules:
 *  - 5xx  → our fault   → friendly "system maintenance" message
 *  - net  → our fault   → "check your connection" message
 *  - timeout            → "the server took too long" message
 *  - 4xx  → user fault  → show the actual server explanation so they can fix it
 *  - 401  → session     → ask them to sign in again
 *  - 403  → permission  → explain they lack access
 *  - 404  → not found   → resource missing
 *  - 429  → rate limit  → translated "too many requests, retry in N s"
 */

// A body that is an HTML/XML document (nginx, Vercel, CDN error pages) must
// never be shown to the user as text.
const looksLikeMarkup = (s) => /^\s*</.test(s) || /<\/?(html|body|head|h1|title)\b/i.test(s);
// Very long plain-text bodies are stack traces / dumps, not messages.
const MAX_MESSAGE_LENGTH = 500;

const cleanString = (s) => {
  if (typeof s !== 'string') return null;
  const trimmed = s.trim();
  if (!trimmed || looksLikeMarkup(trimmed) || trimmed.length > MAX_MESSAGE_LENGTH) return null;
  return trimmed;
};

// Pull a human-readable string out of any axios error response body
export function extractServerMessage(err) {
  const data = err?.response?.data;
  if (data == null) return null;
  if (typeof data === 'string') return cleanString(data);
  if (typeof data !== 'object') return null;
  const candidates = [data.error, data.detail, data.detail?.message, data.message];
  for (const c of candidates) {
    const msg = cleanString(c);
    if (msg) return msg;
  }
  // Array of field errors e.g. { name: ["This field is required."] }
  if (Array.isArray(data)) return cleanString(data[0]);
  const firstField = Object.values(data)[0];
  if (Array.isArray(firstField)) return cleanString(firstField[0]);
  return null;
}

/**
 * Seconds to wait before retrying a throttled request, from the Retry-After
 * header or the backend's `retry_after` body field. null when unknown.
 */
export function getRetryAfterSeconds(err) {
  const res = err?.response;
  if (!res) return null;
  const headers = res.headers || {};
  const header = typeof headers.get === 'function'
    ? headers.get('retry-after')
    : headers['retry-after'] ?? headers['Retry-After'];
  const candidates = [header, res.data?.retry_after];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
    // HTTP-date form of Retry-After
    const when = Date.parse(c);
    if (!Number.isNaN(when)) return Math.max(0, Math.ceil((when - Date.now()) / 1000));
  }
  return null;
}

/** True for errors worth retrying later (rate limit, 5xx, network, timeout). */
export function isRetriableError(err) {
  const status = err?.response?.status;
  if (!status) return true;
  return status === 429 || status >= 500;
}

const isTimeout = (err) =>
  err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || /timeout/i.test(err?.message || '');

/**
 * @param {Error} err         - the caught error (usually axios)
 * @param {Function} t        - translation function from useLang()
 * @param {string} fallbackKey - i18n key to use if nothing else matches
 */
export function formatError(err, t, fallbackKey = 'errGeneric') {
  const status = err?.response?.status;

  // Network error (no response at all)
  if (!status) {
    return isTimeout(err) ? t('errTimeout') : t('errNetwork');
  }

  // Rate limited — translated, with the wait time when the server tells us
  if (status === 429) {
    const wait = getRetryAfterSeconds(err);
    return wait ? t('errRateLimitWait').replace('{n}', wait) : t('errRateLimit');
  }

  // Server errors — our problem, not the user's
  if (status >= 500) {
    return t('errServer');
  }

  // Authentication
  if (status === 401) {
    return t('errUnauthorized');
  }

  // Permission
  if (status === 403) {
    return t('errForbidden');
  }

  // Not found
  if (status === 404) {
    return t('errNotFound');
  }

  // 400 / other 4xx — user input issue, show the actual server message
  const serverMsg = extractServerMessage(err);
  if (serverMsg) return serverMsg;

  return t(fallbackKey);
}
