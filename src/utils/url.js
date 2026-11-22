/**
 * URL allow-listing for scraped / server-provided links (defense in depth).
 *
 * Scraped article links and images come from third-party pages, so only
 * absolute http(s) URLs are rendered. Anything else (javascript:, data:,
 * blob:, custom protocol handlers, relative paths that would resolve against
 * this app's origin) is dropped.
 */
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

/** Absolute http(s) URL as a string, or null. */
export function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    return HTTP_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Download links come from OUR backend: either an absolute http(s) URL or a
 * same-origin absolute path (e.g. "/scraping-api/api/missions/<id>/download/").
 * Protocol-relative ("//evil") and other schemes are rejected.
 */
export function safeDownloadUrl(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes(String.fromCharCode(92))) return raw;
  return safeHttpUrl(raw);
}
