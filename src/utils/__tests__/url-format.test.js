import { describe, it, expect } from 'vitest';
import { safeHttpUrl, safeDownloadUrl } from '../url';
import { formatDate, statusLabel } from '../format';
import { translations } from '../../i18n/translations';

describe('safeHttpUrl', () => {
  it.each([
    ['https://spa.gov.sa/a?b=1#c', 'https://spa.gov.sa/a?b=1#c'],
    ['http://x.example', 'http://x.example/'],
    ['  https://x.example/p  ', 'https://x.example/p'],
    ['HTTPS://X.EXAMPLE/', 'https://x.example/'],
    ['https://وكالة.example/خبر', expect.stringMatching(/^https:\/\/xn--/)],
  ])('allows %s', (input, out) => {
    expect(safeHttpUrl(input)).toEqual(out);
  });

  it.each([
    'javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<script>', 'blob:https://x/1',
    'vbscript:x', 'ftp://x/y', 'mailto:a@b', '/relative/path', 'relative', '//evil.example/x',
    'https://', '', '   ', null, undefined, 42, {}, [],
  ])('rejects %j', (input) => {
    expect(safeHttpUrl(input)).toBeNull();
  });
});

describe('safeDownloadUrl', () => {
  it('allows same-origin absolute paths and http(s)', () => {
    expect(safeDownloadUrl('/scraping-api/api/missions/1/download/')).toBe('/scraping-api/api/missions/1/download/');
    expect(safeDownloadUrl('https://una-oic.org/x.xlsx')).toBe('https://una-oic.org/x.xlsx');
  });
  it.each(['//evil.example/x', '/\\evil.example', 'javascript:alert(1)', 'data:x', '', null])('rejects %j', (u) => {
    expect(safeDownloadUrl(u)).toBeNull();
  });
});

describe('format helpers', () => {
  const t = (k) => translations.en[k] || k;
  it('formatDate handles missing / invalid / en / ar', () => {
    expect(formatDate(null)).toBe('--');
    expect(formatDate('not a date')).toBe('--');
    expect(formatDate('2026-11-22T10:00:00Z', 'en')).toMatch(/Nov/);
    expect(formatDate('2026-11-22T10:00:00Z', 'ar')).not.toMatch(/Nov/);
  });
  it('statusLabel translates known and passes unknown through', () => {
    expect(statusLabel('completed', t)).toBe('Completed');
    expect(statusLabel('filtering', t)).toBe('AI filtering');
    expect(statusLabel('weird', t)).toBe('weird');
    expect(statusLabel(undefined, t)).toBe('--');
  });
});
