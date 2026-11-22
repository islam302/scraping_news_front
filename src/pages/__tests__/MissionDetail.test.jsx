import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, act, fireEvent } from '@testing-library/react';
import { Route, useNavigate } from 'react-router-dom';
import MissionDetail from '../MissionDetail';
import { renderWithProviders } from '../../__tests__/render';
import { http, reply, networkError, deferred } from '../../__tests__/http';
import { translations } from '../../i18n/translations';

const en = translations.en;
const ar = translations.ar;
const url = (id) => `/scraping-api/api/missions/${id}/`;
const tick = (ms = 3000) => act(() => vi.advanceTimersByTimeAsync(ms));

// A tiny nav helper rendered next to the page so tests can change :missionId.
let nav;
function NavGrabber() {
  nav = useNavigate();
  return null;
}
const renderAt = (id, opts = {}) => renderWithProviders(
  <><NavGrabber /><MissionDetail /></>,
  {
    route: `/tasks/${id}`, path: '/tasks/:missionId', ...opts,
    extraRoutes: <Route path="/sites" element={<NavGrabber />} />,
  },
);

beforeEach(() => {
  vi.useFakeTimers();
  http.on('GET', '/scraping-api/api/categories/', reply(200, {}));
});

describe('initial load', () => {
  it('renders a completed mission with results; no polling', async () => {
    http.on('GET', url('A'), reply(200, {
      mission_id: 'A', keyword: 'gaza', status: 'completed', total_results: 1,
      created_at: '2026-11-22T10:00:00Z', completed_at: '2026-11-22T10:05:00Z',
      results: [{ Title: 'Headline', Link: 'https://spa.gov.sa/1', Site: 'SPA (Google)', Paragraph: 'p', Date: '2026-11-22' }],
      excel_download: '/scraping-api/api/missions/A/download/',
    }));
    renderAt('A');
    await tick(0);
    expect(screen.getAllByText('gaza').length).toBeGreaterThan(0);
    expect(screen.getByText('Headline').closest('a')).toHaveAttribute('href', 'https://spa.gov.sa/1');
    expect(screen.getByText('SPA')).toBeInTheDocument();
    expect(screen.getByText(en.downloadExcel)).toBeInTheDocument();
    await tick(9000);
    expect(http.callsTo('GET', url('A'))).toHaveLength(1);
  });

  it.each([
    [404, en.errNotFound],
    [500, en.errServer],
  ])('load %i shows the error', async (status, msg) => {
    http.on('GET', url('A'), reply(status, {}));
    renderAt('A');
    await tick(0);
    expect(screen.getByText(msg)).toBeInTheDocument();
  });

  it('network error shows the connection message', async () => {
    http.on('GET', /\/missions\//, networkError());
    http.on('GET', '/scraping-api/api/categories/', networkError());
    renderAt('A');
    await tick(0);
    expect(screen.getByText(en.errNetwork)).toBeInTheDocument();
  });

  it('download button fetches the sanitized URL with auth; null excel_download hides it', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    http.on('GET', '/scraping-api/api/missions/A/download/', reply(200, new Blob(['x'])));
    http.on('GET', url('A'), reply(200, { status: 'completed', keyword: 'k', excel_download: '/scraping-api/api/missions/A/download/' }));
    http.on('GET', url('B'), reply(200, { status: 'completed', keyword: 'k', excel_download: null }));
    http.on('GET', url('C'), reply(200, { status: 'completed', keyword: 'k', excel_download: 'javascript:alert(1)' }));
    const { unmount } = renderAt('A');
    await tick(0);
    fireEvent.click(screen.getByText(en.downloadExcel));
    await tick(0);
    expect(http.callsTo('GET', '/scraping-api/api/missions/A/download/')).toHaveLength(1);
    expect(URL.createObjectURL).toHaveBeenCalled();
    unmount();
    const r2 = renderAt('B');
    await tick(0);
    expect(screen.queryByText(en.downloadExcel)).toBeNull();
    r2.unmount();
    renderAt('C');
    await tick(0);
    expect(screen.queryByText(en.downloadExcel)).toBeNull();
  });
});

describe('polling', () => {
  it.each(['pending', 'scraping', 'filtering'])('polls while %s and stops on completed', async (status) => {
    http.once('GET', url('A'), reply(200, { status, keyword: 'k' }));
    http.once('GET', url('A'), reply(200, { status, keyword: 'k' }));
    http.on('GET', url('A'), reply(200, { status: 'completed', keyword: 'k' }));
    renderAt('A');
    await tick(0);
    await tick();
    await tick();
    await tick(15000);
    expect(http.callsTo('GET', url('A'))).toHaveLength(3);
  });

  it('stops on failed', async () => {
    http.once('GET', url('A'), reply(200, { status: 'scraping', keyword: 'k' }));
    http.on('GET', url('A'), reply(200, { status: 'failed', keyword: 'k' }));
    renderAt('A');
    await tick(0);
    await tick(15000);
    expect(http.callsTo('GET', url('A'))).toHaveLength(2);
    expect(screen.getByText(en.scrapingFailedMsg)).toBeInTheDocument();
  });

  it('interval is cleared on unmount', async () => {
    http.on('GET', url('A'), reply(200, { status: 'scraping', keyword: 'k' }));
    const { unmount } = renderAt('A');
    await tick(0);
    await tick();
    unmount();
    await tick(15000);
    expect(http.callsTo('GET', url('A'))).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('FE-05: route change before the first fetch resolves leaks no interval and no stale data', async () => {
    const slowA = deferred();
    http.once('GET', url('A'), slowA);
    http.on('GET', url('A'), reply(200, { status: 'scraping', keyword: 'kwA' }));
    http.on('GET', url('B'), reply(200, { status: 'completed', keyword: 'kwB' }));
    renderAt('A');
    await tick(0);
    await act(async () => { nav('/tasks/B'); });
    await tick(0);
    expect(screen.getAllByText('kwB').length).toBeGreaterThan(0);
    await act(async () => { slowA.resolve(reply(200, { status: 'scraping', keyword: 'kwA' })); });
    await tick(0);
    await tick(12000);
    expect(screen.queryByText('kwA')).toBeNull();
    expect(screen.getAllByText('kwB').length).toBeGreaterThan(0);
    expect(http.callsTo('GET', url('A'))).toHaveLength(1);
    await act(async () => { nav('/sites'); });
    await tick(12000);
    expect(http.callsTo('GET', url('A'))).toHaveLength(1);
  });

  it('FE-16: a 404 during polling (mission deleted) stops polling and says not found', async () => {
    http.once('GET', url('A'), reply(200, { status: 'scraping', keyword: 'k' }));
    http.on('GET', url('A'), reply(404, { detail: 'Not found.' }));
    renderAt('A');
    await tick(0);
    await tick();
    await tick(30000);
    expect(http.callsTo('GET', url('A'))).toHaveLength(2);
    expect(screen.getByText(en.errNotFound)).toBeInTheDocument();
  });

  it('transient 429/5xx during polling keeps the data and keeps tracking', async () => {
    http.once('GET', url('A'), reply(200, { status: 'scraping', keyword: 'k' }));
    http.once('GET', url('A'), reply(429, {}, { 'Retry-After': '3' }));
    http.once('GET', url('A'), reply(502));
    http.on('GET', url('A'), reply(200, { status: 'completed', keyword: 'k', results: [{ Title: 'Late' }] }));
    renderAt('A');
    await tick(0);
    await tick(30000);
    expect(screen.getByText('Late')).toBeInTheDocument();
  });

  it('FE-15: overlapping polls cannot move the status backwards', async () => {
    const slow = deferred();
    http.once('GET', url('A'), reply(200, { status: 'scraping', keyword: 'k' }));
    http.once('GET', url('A'), slow);
    http.on('GET', url('A'), reply(200, { status: 'completed', keyword: 'k', results: [{ Title: 'Final' }] }));
    renderAt('A');
    await tick(0);
    await tick(); // slow poll in flight
    await tick(6000); // no parallel poll is sent meanwhile
    expect(http.callsTo('GET', url('A'))).toHaveLength(2);
    await act(async () => { slow.resolve(reply(200, { status: 'scraping', keyword: 'k' })); });
    await tick();
    expect(screen.getByText('Final')).toBeInTheDocument();
    await tick(9000);
    expect(screen.getByText('Final')).toBeInTheDocument();
  });

  it('FE-16: error and mission reset when missionId changes', async () => {
    http.on('GET', url('bogus'), reply(404));
    http.on('GET', url('good'), reply(200, { status: 'completed', keyword: 'goodkw' }));
    renderAt('bogus');
    await tick(0);
    expect(screen.getByText(en.errNotFound)).toBeInTheDocument();
    await act(async () => { nav('/tasks/good'); });
    await tick(0);
    expect(screen.queryByText(en.errNotFound)).toBeNull();
    expect(screen.getAllByText('goodkw').length).toBeGreaterThan(0);
  });

  it('shows the loading state for the new id instead of the old mission', async () => {
    const slowB = deferred();
    http.on('GET', url('A'), reply(200, { status: 'completed', keyword: 'oldkw' }));
    http.on('GET', url('B'), slowB);
    renderAt('A');
    await tick(0);
    await act(async () => { nav('/tasks/B'); });
    await tick(0);
    expect(screen.queryByText('oldkw')).toBeNull();
    expect(screen.getByText(en.loadingDetails)).toBeInTheDocument();
  });
});

describe('rendering edge cases', () => {
  const load = async (mission, opts) => {
    http.on('GET', url('A'), reply(200, { keyword: 'k', ...mission }));
    renderAt('A', opts);
    await tick(0);
  };

  it('percent: total=0 hides percent; done>total clamps to 100', async () => {
    await load({ status: 'scraping', progress: { done: 9, total: 3, current_site: 'SPA' } });
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(`${en.extracting} SPA`)).toBeInTheDocument();
  });

  it('percent with total=0 is not shown', async () => {
    await load({ status: 'scraping', progress: { done: 0, total: 0 } });
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it('renders categories_added (array) and ignores a non-array value', async () => {
    await load({ status: 'completed', site_stats: { categories_added: ['security'] } });
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('non-array categories_added is ignored', async () => {
    await load({ status: 'completed', site_stats: { categories_added: 'x' } });
    expect(screen.queryByText(`${en.autoAddedCategories}:`)).toBeNull();
  });

  it('results with missing Link/Image/Site render safely; unsafe links are dropped (FE-20)', async () => {
    await load({
      status: 'completed',
      results: [
        { Title: 'NoLink' },
        { Title: 'JsLink', Link: 'javascript:alert(1)', Image: 'data:image/png;base64,AAA' },
        { Title: 'DataLink', Link: 'data:text/html,<script>alert(1)</script>' },
        { Title: 'RelLink', Link: '/scraping-api/api/missions/' },
        { Title: 'Good', Link: 'https://ok.example/a', Image: 'https://ok.example/i.jpg' },
      ],
    });
    ['NoLink', 'JsLink', 'DataLink', 'RelLink'].forEach((title) => {
      expect(screen.getByText(title).closest('a')).not.toHaveAttribute('href');
    });
    expect(screen.getByText('Good').closest('a')).toHaveAttribute('href', 'https://ok.example/a');
    const imgs = document.querySelectorAll('img');
    expect([...imgs].map((i) => i.getAttribute('src'))).toEqual(['https://ok.example/i.jpg']);
  });

  it('broken image hides its container', async () => {
    await load({ status: 'completed', results: [{ Title: 'T', Image: 'https://x/i.jpg' }] });
    const img = document.querySelector('img');
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
    expect(img.parentElement.style.display).toBe('none');
  });

  it('FE-21: Arabic UI shows a translated status and Arabic dates', async () => {
    await load({ status: 'completed', created_at: '2026-11-22T10:00:00Z' }, { lang: 'ar' });
    expect(screen.getAllByText(ar.statusCompleted).length).toBeGreaterThan(0);
    expect(screen.queryByText('completed')).toBeNull();
    expect(screen.queryByText(/Nov/)).toBeNull();
  });

  it('English UI shows a translated status, not the raw value', async () => {
    await load({ status: 'scraping', progress: {} });
    expect(screen.getAllByText(en.statusScraping).length).toBeGreaterThan(0);
  });

  it('back button navigates to /tasks', async () => {
    http.on('GET', url('A'), reply(200, { status: 'completed', keyword: 'k' }));
    renderWithProviders(<MissionDetail />, {
      route: '/tasks/A', path: '/tasks/:missionId',
      extraRoutes: <Route path="/tasks" element={<p>TASKS PAGE</p>} />,
    });
    await tick(0);
    fireEvent.click(screen.getByRole('button', { name: en.tasks }));
    expect(screen.getByText('TASKS PAGE')).toBeInTheDocument();
  });
});
