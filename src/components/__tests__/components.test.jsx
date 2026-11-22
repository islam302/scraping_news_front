import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { http, reply } from '../../__tests__/http';
import StatsCards from '../StatsCards';
import AnalyzedReports from '../AnalyzedReports';
import ExportButtons from '../ExportButtons';
import LiveScrapingStatus from '../LiveScrapingStatus';
import { renderWithProviders } from '../../__tests__/render';
import { translations } from '../../i18n/translations';

const en = translations.en;
const value = (label) => screen.getByText(label).nextElementSibling.textContent;

describe('StatsCards', () => {
  it('no mission -> zeros and --', () => {
    renderWithProviders(<StatsCards mission={null} />);
    expect(value(en.articlesFound)).toBe('0');
    expect(value(en.relevantMatches)).toBe('0');
    expect(value(en.processingTime)).toBe('--');
  });

  it('uses ai_filter before/after', () => {
    renderWithProviders(<StatsCards mission={{ status: 'completed', ai_filter: { before: 1234, after: 12 } }} />);
    expect(value(en.articlesFound)).toBe('1,234');
    expect(value(en.relevantMatches)).toBe('12');
  });

  it('ai_filter.before=0 falls back to site_stats, ignoring non-object values', () => {
    renderWithProviders(<StatsCards mission={{
      status: 'completed', ai_filter: { before: 0, after: 0 },
      site_stats: { SPA: { before: 5 }, WAM: { before: '3' }, categories_added: ['security'], broken: null, n: 7 },
    }} />);
    expect(value(en.articlesFound)).toBe('8');
    expect(value(en.relevantMatches)).toBe('0');
  });

  it('total_results fallback when there is no ai_filter', () => {
    renderWithProviders(<StatsCards mission={{ status: 'completed', total_results: 4 }} />);
    expect(value(en.relevantMatches)).toBe('4');
  });

  it.each([
    ['2026-11-22T10:00:00Z', '2026-11-22T10:00:42Z', '42s'],
    ['2026-11-22T10:00:00Z', '2026-11-22T10:03:05Z', '3m 5s'],
    ['2026-11-22T10:00:10Z', '2026-11-22T10:00:00Z', '0s'],
  ])('processing time %s -> %s = %s', (created, completed, expected) => {
    renderWithProviders(<StatsCards mission={{ status: 'completed', created_at: created, completed_at: completed }} />);
    expect(value(en.processingTime)).toBe(expected);
  });

  it('running mission shows in progress; failed without completed_at shows --', () => {
    const { unmount } = renderWithProviders(<StatsCards mission={{ status: 'scraping', created_at: '2026-11-22T10:00:00Z' }} />);
    expect(value(en.processingTime)).toBe(en.inProgress);
    unmount();
    renderWithProviders(<StatsCards mission={{ status: 'failed', created_at: '2026-11-22T10:00:00Z' }} />);
    expect(value(en.processingTime)).toBe('--');
  });
});

describe('AnalyzedReports', () => {
  const results = [
    { Title: 'One', Link: 'https://a.example/1', Image: 'https://a.example/1.jpg', Site: 'SPA (Google)', Date: '2026-11-22', Paragraph: 'p1' },
    { Title: 'Two' },
    { Title: 'Js', Link: 'javascript:alert(1)', Image: 'javascript:alert(2)' },
    { Title: 'Data', Link: 'data:text/html,<script>alert(1)</script>' },
  ];

  it('empty state (also for non-array input)', () => {
    const { unmount } = renderWithProviders(<AnalyzedReports results={[]} />);
    expect(screen.getByText(en.noResultsYet)).toBeInTheDocument();
    unmount();
    renderWithProviders(<AnalyzedReports results={null} />);
    expect(screen.getByText(en.noResultsYet)).toBeInTheDocument();
  });

  it('grid view: count, site name without (Google), only safe links/images (FE-20)', () => {
    renderWithProviders(<AnalyzedReports results={results} />);
    expect(screen.getByText('(4)')).toBeInTheDocument();
    expect(screen.getByText('SPA')).toBeInTheDocument();
    const hrefs = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://a.example/1']);
    const srcs = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(['https://a.example/1.jpg']);
  });

  it('list view toggle renders the same items', () => {
    renderWithProviders(<AnalyzedReports results={results} />);
    const [listBtn, gridBtn] = screen.getAllByRole('button');
    fireEvent.click(listBtn);
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect([...document.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://a.example/1']);
    fireEvent.click(gridBtn);
    expect(screen.getByText('One')).toBeInTheDocument();
  });

  it('image onError hides its container', () => {
    renderWithProviders(<AnalyzedReports results={[results[0]]} />);
    const img = document.querySelector('img');
    fireEvent.error(img);
    expect(img.parentElement.style.display).toBe('none');
  });
});

describe('ExportButtons', () => {
  it('disabled without excel_download', () => {
    renderWithProviders(<ExportButtons mission={{}} />);
    expect(screen.getByText(en.export).closest('button')).toBeDisabled();
  });

  it('downloads the same-origin path with the session token (proxy requires auth)', async () => {
    localStorage.setItem('access_token', 'tok');
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    http.on('GET', '/scraping-api/api/missions/m1/download/', reply(200, new Blob(['x'])));
    renderWithProviders(<ExportButtons mission={{ excel_download: '/scraping-api/api/missions/m1/download/' }} />);
    fireEvent.click(screen.getByText(en.export).closest('button'));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(http.calls[0].headers.Authorization).toBe('Bearer tok');
    expect(open).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', '//evil.example/x', 'data:text/html,x'])('refuses unsafe URL %s (FE-20)', (u) => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderWithProviders(<ExportButtons mission={{ excel_download: u }} />);
    const btn = screen.getByText(en.export).closest('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(open).not.toHaveBeenCalled();
  });
});

describe('LiveScrapingStatus', () => {
  it.each([
    [null, en.liveScrapingStatus],
    [{ status: 'pending' }, en.liveScrapingStatus],
    [{ status: 'filtering' }, en.aiFilteringInProgress],
    [{ status: 'completed' }, en.scrapingComplete],
    [{ status: 'failed' }, en.scrapingFailed],
  ])('%j -> status text', (mission, text) => {
    renderWithProviders(<LiveScrapingStatus mission={mission} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('percent clamps and shows current site', () => {
    renderWithProviders(<LiveScrapingStatus mission={{ status: 'scraping', progress: { done: 5, total: 2, current_site: 'WAM' } }} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('WAM')).toBeInTheDocument();
  });

  it('completed is 100%; failed shows the friendly message', () => {
    const { unmount } = renderWithProviders(<LiveScrapingStatus mission={{ status: 'completed', progress: { total: 0 } }} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    unmount();
    renderWithProviders(<LiveScrapingStatus mission={{ status: 'failed' }} />);
    expect(screen.getByText(en.scrapingFailedMsg)).toBeInTheDocument();
  });
});
