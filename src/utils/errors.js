/**
 * Classify an axios error and return a user-friendly message.
 *
 * Rules:
 *  - 5xx  → our fault   → friendly "system maintenance" message
 *  - net  → our fault   → "check your connection" message
 *  - 4xx  → user fault  → show the actual server explanation so they can fix it
 *  - 401  → session     → ask them to sign in again
 *  - 403  → permission  → explain they lack access
 *  - 404  → not found   → resource missing
 */

// Pull a human-readable string out of any axios error response body
function extractServerMessage(err) {
  const data = err?.response?.data;
  if (!data) return null;
  if (typeof data === 'string') return data;
  if (typeof data.error === 'string') return data.error;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.detail?.message === 'string') return data.detail.message;
  if (typeof data.message === 'string') return data.message;
  // Array of field errors e.g. { name: ["This field is required."] }
  const firstField = Object.values(data)?.[0];
  if (Array.isArray(firstField)) return firstField[0];
  return null;
}

/**
 * @param {Error} err         - the caught error (usually axios)
 * @param {Function} t        - translation function from useLang()
 * @param {string} fallbackKey - i18n key to use if nothing else matches
 */
export function formatError(err, t, fallbackKey = 'errGeneric') {
  const status = err?.response?.status;

  // Network error (no response at all)
  if (!status) {
    return t('errNetwork');
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
