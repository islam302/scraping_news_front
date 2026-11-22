import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { renderWithProviders } from '../../__tests__/render';
import { http, reply, deferred, networkError } from '../../__tests__/http';
import { translations } from '../../i18n/translations';

const en = translations.en;
const CATS = '/scraping-api/api/categories/';

const openCategories = () => fireEvent.click(screen.getByText(en.categoriesLabel).parentElement.querySelector('button'));
const closeDropdowns = () => {
  const overlay = document.querySelector('.fixed.inset-0.z-10');
  if (overlay) fireEvent.click(overlay);
};
const keyword = () => screen.getByPlaceholderText(en.keywordsPlaceholder);
const submit = () => fireEvent.click(screen.getByText(en.scrapeAnalyze).closest('button'));

describe('discovery', () => {
  it('sets categories, site lists and max_categories_per_request from the API', async () => {
    http.on('GET', CATS, reply(200, {
      available_categories: ['general', 'sport'], site_lists: ['arabic_sites'], max_categories_per_request: 3,
    }));
    renderWithProviders(<Dashboard />);
    await screen.findByText('1/3');
    openCategories();
    expect(screen.getByText('Sport')).toBeInTheDocument();
    expect(screen.queryByText('Economy')).toBeNull();
  });

  it('failure keeps DEFAULT_CATEGORIES and the 5 cap', async () => {
    http.on('GET', CATS, reply(404, {}));
    renderWithProviders(<Dashboard />);
    await waitFor(() => expect(http.callsTo('GET', CATS).length).toBeGreaterThan(0));
    expect(screen.getByText('1/5')).toBeInTheDocument();
    openCategories();
    expect(screen.getByText('Economy')).toBeInTheDocument();
  });

  it('empty available_categories / bad max keep the defaults', async () => {
    http.on('GET', CATS, reply(200, { available_categories: [], max_categories_per_request: 'x' }));
    renderWithProviders(<Dashboard />);
    await waitFor(() => expect(http.callsTo('GET', CATS).length).toBeGreaterThan(0));
    openCategories();
    expect(screen.getByText('Economy')).toBeInTheDocument();
    expect(screen.getByText('1/5')).toBeInTheDocument();
  });

  it('FE-17 (refuted race): site lists only become selectable once the initial discovery answered', async () => {
    // The reviewer's race needs the user to pick a site list BEFORE the initial
    // discovery returns, but the site-list options come from that very response.
    const initial = deferred();
    http.once('GET', CATS, initial);
    http.on('GET', CATS, reply(200, { available_categories: ['general', 'sport'] }));
    renderWithProviders(<Dashboard />);
    fireEvent.click(screen.getByText(en.siteListAll).closest('button'));
    expect(screen.queryByText('Gulf Agencies')).toBeNull();
    await act(async () => {
      initial.resolve(reply(200, { available_categories: ['general', 'sport', 'security'], site_lists: ['gulf_agencies'] }));
    });
    fireEvent.click(await screen.findByText('Gulf Agencies'));
    closeDropdowns();
    openCategories();
    await waitFor(() => expect(screen.queryByText('Security')).toBeNull());
    expect(screen.getByText('Sport')).toBeInTheDocument();
  });

  it('FE-17: a filtered response with no categories clears the selection and blocks submit', async () => {
    http.once('GET', CATS, reply(200, { available_categories: ['general', 'security'], site_lists: ['gulf_agencies'] }));
    http.on('GET', CATS, reply(200, { available_categories: [] }));
    renderWithProviders(<Dashboard />);
    fireEvent.click((await screen.findByText(en.siteListAll)).closest('button'));
    fireEvent.click(await screen.findByText('Gulf Agencies'));
    closeDropdowns();
    await waitFor(() => expect(screen.getByText(en.selectCategories)).toBeInTheDocument());
    fireEvent.change(keyword(), { target: { value: 'k' } });
    expect(screen.getByText(en.scrapeAnalyze).closest('button')).toBeDisabled();
    expect(http.callsTo('POST', /category-scrape/)).toHaveLength(0);
  });

  it('filtered request failure keeps the current list', async () => {
    http.once('GET', CATS, reply(200, { available_categories: ['general', 'sport'], site_lists: ['gulf_agencies'] }));
    http.on('GET', CATS, networkError());
    renderWithProviders(<Dashboard />);
    fireEvent.click((await screen.findByText(en.siteListAll)).closest('button'));
    fireEvent.click(await screen.findByText('Gulf Agencies'));
    closeDropdowns();
    openCategories();
    expect(screen.getByText('Sport')).toBeInTheDocument();
  });

  it('race guard: only the latest site-list selection wins', async () => {
    http.once('GET', CATS, reply(200, { available_categories: ['general', 'sport', 'economy'], site_lists: ['a_list', 'b_list'] }));
    const slowA = deferred();
    http.once('GET', CATS, slowA);
    http.once('GET', CATS, reply(200, { available_categories: ['general', 'economy'] }));
    renderWithProviders(<Dashboard />);
    fireEvent.click((await screen.findByText(en.siteListAll)).closest('button'));
    fireEvent.click(await screen.findByText('A List'));
    fireEvent.click(screen.getAllByText('B List').at(-1));
    await waitFor(() => expect(http.callsTo('GET', CATS)).toHaveLength(3));
    await act(async () => { slowA.resolve(reply(200, { available_categories: ['general', 'sport'] })); });
    closeDropdowns();
    openCategories();
    expect(screen.getByText('Economy')).toBeInTheDocument();
    expect(screen.queryByText('Sport')).toBeNull();
  });
});

describe('scrape flow', () => {
  it('skipped categories banner joins with the Arabic comma', async () => {
    http.on('GET', CATS, reply(200, {}));
    http.on('POST', '/scraping-api/api/category-scrape/', reply(202, {
      mission_id: 'm1', status: 'pending', skipped_categories: ['security', 'sport'],
    }));
    http.on('GET', '/scraping-api/api/missions/m1/', reply(200, { status: 'scraping' }));
    renderWithProviders(<Dashboard />);
    fireEvent.change(keyword(), { target: { value: 'k' } });
    submit();
    expect(await screen.findByText(en.categoriesSkipped.replace('{list}', 'Security، Sport'))).toBeInTheDocument();
  });

  it('startScraping error shows the message box', async () => {
    http.on('GET', CATS, reply(200, {}));
    http.on('POST', '/scraping-api/api/category-scrape/', reply(400, { error: 'None of the selected categories exist' }));
    renderWithProviders(<Dashboard />);
    fireEvent.change(keyword(), { target: { value: 'k' } });
    submit();
    expect(await screen.findByText('None of the selected categories exist')).toBeInTheDocument();
  });

  it('completed mission renders results', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    http.on('GET', CATS, reply(200, {}));
    http.on('POST', '/scraping-api/api/category-scrape/', reply(202, { mission_id: 'm1', status: 'pending' }));
    http.on('GET', '/scraping-api/api/missions/m1/', reply(200, {
      status: 'completed', results: [{ Title: 'Story', Link: 'https://x/1', Site: 'WAM' }],
      ai_filter: { before: 10, after: 1 },
    }));
    renderWithProviders(<Dashboard />);
    fireEvent.change(keyword(), { target: { value: 'k' } });
    submit();
    await act(() => vi.advanceTimersByTimeAsync(3500));
    expect(await screen.findByText('Story')).toBeInTheDocument();
    expect(screen.getByText(en.scrapingComplete)).toBeInTheDocument();
  });
});
