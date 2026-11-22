import { describe, it, expect } from 'vitest';
import { formatError, extractServerMessage, getRetryAfterSeconds, isRetriableError } from '../errors';
import { translations } from '../../i18n/translations';
import { axiosError } from '../../__tests__/http';

const tFor = (lang) => (key) => translations[lang]?.[key] || translations.en[key] || key;
const en = tFor('en');
const ar = tFor('ar');

describe('formatError — status classes', () => {
  it('network error (no response) -> errNetwork', () => {
    expect(formatError(axiosError(null), en)).toBe(en('errNetwork'));
    expect(formatError(new Error('boom'), en)).toBe(en('errNetwork'));
    expect(formatError(undefined, en)).toBe(en('errNetwork'));
  });

  it('timeout -> errTimeout', () => {
    const err = Object.assign(new Error('timeout of 60000ms exceeded'), { code: 'ECONNABORTED' });
    expect(formatError(err, en)).toBe(en('errTimeout'));
  });

  it.each([500, 502, 503, 504, 599])('%i -> errServer', (status) => {
    expect(formatError(axiosError(status, { detail: 'Traceback ...' }), en)).toBe(en('errServer'));
  });

  it('401 -> errUnauthorized', () => {
    expect(formatError(axiosError(401, { detail: 'x' }), en)).toBe(en('errUnauthorized'));
  });
  it('403 -> errForbidden', () => {
    expect(formatError(axiosError(403, { detail: 'x' }), en)).toBe(en('errForbidden'));
  });
  it('404 -> errNotFound', () => {
    expect(formatError(axiosError(404, { detail: 'Not found.' }), en)).toBe(en('errNotFound'));
  });
});

describe('formatError — 400 body shapes', () => {
  it.each([
    [{ error: 'Keyword is required' }, 'Keyword is required'],
    [{ detail: 'Bad thing' }, 'Bad thing'],
    [{ detail: { message: 'Nested msg' } }, 'Nested msg'],
    [{ message: 'Message field' }, 'Message field'],
    [{ name: ['This field is required.'] }, 'This field is required.'],
    [['list form error'], 'list form error'],
    ['plain text body', 'plain text body'],
    ['  padded  ', 'padded'],
  ])('body %j -> %s', (body, expected) => {
    expect(formatError(axiosError(400, body), en)).toBe(expected);
  });

  it('empty / unusable bodies fall back to the given key', () => {
    expect(formatError(axiosError(400, null), en, 'errScrape')).toBe(en('errScrape'));
    expect(formatError(axiosError(400, ''), en, 'errScrape')).toBe(en('errScrape'));
    expect(formatError(axiosError(400, {}), en, 'errScrape')).toBe(en('errScrape'));
    expect(formatError(axiosError(400, { error: 42 }), en, 'errScrape')).toBe(en('errScrape'));
    expect(formatError(axiosError(400, 12345), en, 'errScrape')).toBe(en('errScrape'));
    expect(formatError(axiosError(400, {}), en)).toBe(en('errGeneric'));
  });

  it('409 conflict shows the server message', () => {
    expect(formatError(axiosError(409, { error: "A site named 'SPA' already exists" }), en))
      .toBe("A site named 'SPA' already exists");
  });

  it('413 with an HTML body never returns markup (FE-03)', () => {
    const html = '<html><head><title>413</title></head><body><h1>413 Request Entity Too Large</h1></body></html>';
    const msg = formatError(axiosError(413, html), en, 'failedToSave');
    expect(msg).toBe(en('failedToSave'));
    expect(msg).not.toMatch(/</);
  });

  it('a huge plain-text body is not rendered', () => {
    expect(formatError(axiosError(400, 'x'.repeat(5000)), en)).toBe(en('errGeneric'));
  });

  it('Arabic error messages from the server are passed through', () => {
    expect(formatError(axiosError(400, { error: 'الكلمة المفتاحية مطلوبة' }), ar)).toBe('الكلمة المفتاحية مطلوبة');
  });
});

describe('formatError — 429 rate limit (FE-03)', () => {
  it('DRF detail is NOT shown raw; translated message with the wait (en)', () => {
    const err = axiosError(429, { detail: 'Request was throttled. Expected available in 5 seconds.' }, { 'Retry-After': '5' });
    expect(formatError(err, en)).toBe('Too many requests. Please try again in 5 seconds.');
  });

  it('Arabic UI gets the Arabic message', () => {
    const err = axiosError(429, { detail: 'Request was throttled. Expected available in 37 seconds.' }, { 'retry-after': '37' });
    const msg = formatError(err, ar);
    expect(msg).toBe(ar('errRateLimitWait').replace('{n}', 37));
    expect(msg).not.toMatch(/throttled/i);
  });

  it('uses the backend retry_after body field when the proxy dropped the header', () => {
    const err = axiosError(429, { detail: 'throttled', retry_after: 12, code: 'throttled' });
    expect(formatError(err, en)).toBe('Too many requests. Please try again in 12 seconds.');
  });

  it('429 with an HTML body (nginx/Vercel) -> generic translated message, no markup', () => {
    const err = axiosError(429, '<html><body><h1>429 Too Many Requests</h1></body></html>');
    expect(formatError(err, en)).toBe(en('errRateLimit'));
  });

  it('429 with no body -> translated message', () => {
    expect(formatError(axiosError(429, null), en)).toBe(en('errRateLimit'));
    expect(formatError(axiosError(429, null), ar)).toBe(ar('errRateLimit'));
  });
});

describe('helpers', () => {
  it('getRetryAfterSeconds reads header (number / HTTP-date) or body', () => {
    expect(getRetryAfterSeconds(axiosError(429, null, { 'Retry-After': '7' }))).toBe(7);
    expect(getRetryAfterSeconds(axiosError(429, null, { 'Retry-After': '2.2' }))).toBe(3);
    const future = new Date(Date.now() + 10_000).toUTCString();
    const secs = getRetryAfterSeconds(axiosError(429, null, { 'Retry-After': future }));
    expect(secs).toBeGreaterThanOrEqual(8);
    expect(secs).toBeLessThanOrEqual(11);
    expect(getRetryAfterSeconds(axiosError(429, { retry_after: 4 }))).toBe(4);
    expect(getRetryAfterSeconds(axiosError(429, null, { 'Retry-After': 'garbage' }))).toBeNull();
    expect(getRetryAfterSeconds(axiosError(429, null))).toBeNull();
    expect(getRetryAfterSeconds(axiosError(null))).toBeNull();
    // plain-object headers (non-AxiosHeaders)
    expect(getRetryAfterSeconds({ response: { status: 429, headers: { 'retry-after': '9' } } })).toBe(9);
  });

  it('isRetriableError: 429 / 5xx / network yes; other 4xx no', () => {
    expect(isRetriableError(axiosError(null))).toBe(true);
    expect(isRetriableError(axiosError(429))).toBe(true);
    expect(isRetriableError(axiosError(500))).toBe(true);
    expect(isRetriableError(axiosError(503))).toBe(true);
    [400, 401, 403, 404, 409].forEach((s) => expect(isRetriableError(axiosError(s))).toBe(false));
  });

  it('extractServerMessage returns null for no body', () => {
    expect(extractServerMessage({})).toBeNull();
    expect(extractServerMessage(axiosError(400, undefined))).toBeNull();
  });
});
