import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import Sites from '../Sites';
import { renderWithProviders } from '../../__tests__/render';
import { http, reply, deferred } from '../../__tests__/http';
import { translations } from '../../i18n/translations';

const en = translations.en;
const SITES = '/scraping-api/api/category-sites/';
const LISTS = '/scraping-api/api/category-site-lists/';

const SPA = {
  id: 5, name: 'SPA', base_url: 'https://www.spa.gov.sa/', site_lists: ['arabic_sites', 'gulf_agencies'],
  categories: [
    { key: 'general', label: 'General', url: 'https://www.spa.gov.sa/news' },
    { key: 'sport', label: 'Sport', url: 'https://www.spa.gov.sa/sport' },
  ],
  js: true, page_mode: 'query', page_wait: '.card', load_more: '',
  selectors: { item: '.card', link: 'a', title: 'h3', image: 'img', snippet: 'p', date: 'time' },
  is_active: true,
};
const WP = { ...SPA, id: 6, name: 'WPSite', page_mode: 'wp', selectors: { item: 'article' } };
const EMPTY_MODE = { ...SPA, id: 7, name: 'FeedSite', page_mode: '' };
const GOOGLE_A = { name: 'Agency A', base_url: 'https://a.example/', site_lists: ['other_sites'], mode: 'google_search', categories: [] };
const GOOGLE_B = { name: 'Agency B', base_url: 'https://b.example/', site_lists: ['other_sites'], mode: 'google_search', categories: [] };

const lists = { site_lists: [{ name: 'arabic_sites', sites: 1 }, { name: 'gulf_agencies', sites: 1 }, { name: 'other_sites', sites: 2 }] };

const mount = ({ sites = [SPA, WP, EMPTY_MODE, GOOGLE_A, GOOGLE_B] } = {}) => {
  http.on('GET', SITES, reply(200, { count: sites.length, sites }));
  http.on('GET', LISTS, reply(200, lists));
  return renderWithProviders(<Sites />);
};

const row = (name) => screen.getByText(name).closest('[class*="rounded-xl"]');
const openEdit = async (name) => {
  await screen.findByText(name);
  fireEvent.click(within(row(name)).getByLabelText(en.editSite));
  return screen.findByText(en.save);
};
const save = () => fireEvent.click(screen.getByText(en.save).closest('button'));
const patchBody = () => http.callsTo('PATCH', /category-sites\/\d+\/$/).at(-1)?.body;

beforeEach(() => {
  http.on('GET', '/scraping-api/api/categories/', reply(200, {}));
});

describe('list', () => {
  it('renders sites with active/inactive/google badges and counts', async () => {
    mount({ sites: [SPA, { ...WP, is_active: false }, GOOGLE_A] });
    await screen.findByText('SPA');
    expect(screen.getByText(`3 ${en.sitesConfigured}`)).toBeInTheDocument();
    expect(within(row('SPA')).getByText(en.active)).toBeInTheDocument();
    expect(within(row('WPSite')).getByText(en.inactive)).toBeInTheDocument();
    expect(within(row('Agency A')).getByText(en.googleOnly)).toBeInTheDocument();
    expect(within(row('SPA')).getByText(`2 ${en.categoryCount}`)).toBeInTheDocument();
  });

  it('singular count and empty state', async () => {
    mount({ sites: [] });
    expect(await screen.findByText(en.noSitesYet)).toBeInTheDocument();
  });

  it('FE-07: Google-only rows (no id) offer neither edit nor delete', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount();
    await screen.findByText('Agency A');
    expect(within(row('Agency A')).queryByLabelText(en.deleteSelected)).toBeNull();
    expect(within(row('Agency A')).queryByLabelText(en.editSite)).toBeNull();
    expect(within(row('Agency B')).queryByLabelText(en.deleteSelected)).toBeNull();
    expect(http.callsTo('DELETE', /undefined/)).toHaveLength(0);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('FE-07: no duplicate React keys for id-less rows', async () => {
    const spy = vi.spyOn(console, 'error');
    mount();
    await screen.findByText('Agency B');
    const keyWarnings = spy.mock.calls.filter((c) => String(c[0]).includes('same key'));
    expect(keyWarnings).toHaveLength(0);
  });

  it('only http(s) base URLs get an external link', async () => {
    mount({ sites: [SPA, { ...WP, base_url: 'javascript:alert(1)' }] });
    await screen.findByText('SPA');
    expect(within(row('SPA')).getByTitle(SPA.base_url).closest('a')).toHaveAttribute('href', SPA.base_url);
    expect(within(row('WPSite')).queryByRole('link')).toBeNull();
  });

  it('FE-18: load error banner is cleared once a reload succeeds', async () => {
    http.once('GET', SITES, reply(403, {}));
    http.on('GET', SITES, reply(200, { sites: [SPA] }));
    http.on('GET', LISTS, reply(200, lists));
    http.on('DELETE', '/scraping-api/api/category-sites/5/', reply(200, {}));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithProviders(<Sites />);
    expect(await screen.findByText(en.errForbidden)).toBeInTheDocument();
    // Trigger a reload via the "add site" flow's onChanged: create a site
    http.on('POST', SITES, reply(201, { id: 99 }));
    fireEvent.click(screen.getByText(en.addSite).closest('button'));
    fireEvent.change(screen.getByPlaceholderText(en.namePlaceholder), { target: { value: 'New' } });
    fireEvent.change(screen.getByPlaceholderText(en.baseUrlPlaceholder), { target: { value: 'https://new/' } });
    fireEvent.click(screen.getByText(en.create).closest('button'));
    await screen.findByText('SPA');
    await waitFor(() => expect(screen.queryByText(en.errForbidden)).toBeNull());
  });

  it('stale responses are ignored (latest reload wins)', async () => {
    const first = deferred();
    http.once('GET', SITES, first);
    http.on('GET', SITES, reply(200, { sites: [SPA] }));
    http.on('GET', LISTS, reply(200, lists));
    http.on('POST', SITES, reply(201, { id: 1 }));
    renderWithProviders(<Sites />);
    // second reload via create
    fireEvent.click(screen.getByText(en.addSite).closest('button'));
    fireEvent.change(screen.getByPlaceholderText(en.namePlaceholder), { target: { value: 'N' } });
    fireEvent.change(screen.getByPlaceholderText(en.baseUrlPlaceholder), { target: { value: 'https://n/' } });
    fireEvent.click(screen.getByText(en.create).closest('button'));
    await screen.findByText('SPA');
    first.resolve(reply(200, { sites: [{ ...SPA, id: 77, name: 'STALE' }] }));
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText('STALE')).toBeNull();
    expect(screen.getByText('SPA')).toBeInTheDocument();
  });
});

describe('delete', () => {
  it('cancel -> no request', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mount();
    await screen.findByText('SPA');
    fireEvent.click(within(row('SPA')).getByLabelText(en.deleteSelected));
    expect(http.callsTo('DELETE', /category-sites/)).toHaveLength(0);
  });

  it('success -> DELETE /api/category-sites/5/ and reload', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount();
    http.on('DELETE', '/scraping-api/api/category-sites/5/', reply(200, { deleted: true }));
    await screen.findByText('SPA');
    fireEvent.click(within(row('SPA')).getByLabelText(en.deleteSelected));
    await waitFor(() => expect(http.callsTo('GET', SITES).length).toBeGreaterThanOrEqual(2));
    expect(http.callsTo('DELETE', '/scraping-api/api/category-sites/5/')).toHaveLength(1);
  });

  it('404 -> error banner', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount();
    http.on('DELETE', '/scraping-api/api/category-sites/5/', reply(404, {}));
    await screen.findByText('SPA');
    fireEvent.click(within(row('SPA')).getByLabelText(en.deleteSelected));
    expect(await screen.findByText(en.errNotFound)).toBeInTheDocument();
  });
});

describe('edit (FE-06)', () => {
  it('saving unchanged keeps image/snippet selectors and every other field', async () => {
    mount();
    http.on('PATCH', '/scraping-api/api/category-sites/5/', reply(200, SPA));
    await openEdit('SPA');
    save();
    await waitFor(() => expect(patchBody()).toBeTruthy());
    expect(patchBody()).toEqual({
      name: 'SPA', base_url: 'https://www.spa.gov.sa/', site_lists: ['arabic_sites', 'gulf_agencies'],
      categories: SPA.categories, is_active: true, js: true, page_mode: 'query',
      selectors: SPA.selectors,
    });
  });

  it('editing a visible selector merges over the hidden ones', async () => {
    mount();
    http.on('PATCH', '/scraping-api/api/category-sites/5/', reply(200, SPA));
    await openEdit('SPA');
    fireEvent.change(screen.getByDisplayValue('h3'), { target: { value: 'h2.title' } });
    save();
    await waitFor(() => expect(patchBody()).toBeTruthy());
    expect(patchBody().selectors).toEqual({ ...SPA.selectors, title: 'h2.title' });
  });

  it.each([
    ['WPSite', 'wp'],
    ['FeedSite', ''],
  ])('page_mode of %s (%j) is preserved and shown as selected', async (name, mode) => {
    mount();
    http.on('PATCH', /category-sites\/\d+\/$/, reply(200, {}));
    await openEdit(name);
    const select = document.querySelector('form select');
    expect(select.value).toBe(mode);
    save();
    await waitFor(() => expect(patchBody()).toBeTruthy());
    expect(patchBody().page_mode).toBe(mode);
  });

  it('unknown stored page_mode is kept as an option', async () => {
    mount({ sites: [{ ...SPA, page_mode: 'custom' }] });
    http.on('PATCH', /category-sites/, reply(200, {}));
    await openEdit('SPA');
    expect(document.querySelector('form select').value).toBe('custom');
    save();
    await waitFor(() => expect(patchBody().page_mode).toBe('custom'));
  });

  it('page_mode options include the crawler modes (paged, wp) and no fake "none"', async () => {
    mount();
    await openEdit('SPA');
    const values = [...document.querySelector('form select').querySelectorAll('option')].map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['query', 'path', 'wp', 'paged', '']));
    expect(values).not.toContain('none');
  });

  it('toggling is_active only flips that flag', async () => {
    mount();
    http.on('PATCH', /category-sites/, reply(200, {}));
    await openEdit('SPA');
    fireEvent.click(within(document.querySelector('form')).getByText(en.isActiveField));
    save();
    await waitFor(() => expect(patchBody()).toBeTruthy());
    expect(patchBody().is_active).toBe(false);
    expect(patchBody().selectors).toEqual(SPA.selectors);
  });

  it('FE-18: a half-filled category row is an error, not silently dropped', async () => {
    mount();
    http.on('PATCH', /category-sites/, reply(200, {}));
    await openEdit('SPA');
    fireEvent.change(screen.getByDisplayValue('https://www.spa.gov.sa/sport'), { target: { value: '' } });
    save();
    expect(await screen.findByText(en.categoryRowIncomplete)).toBeInTheDocument();
    expect(http.callsTo('PATCH', /category-sites/)).toHaveLength(0);
  });

  it('a fully blank added row is ignored; removing a row removes that category', async () => {
    mount();
    http.on('PATCH', /category-sites/, reply(200, {}));
    await openEdit('SPA');
    fireEvent.click(screen.getByText(en.addCategory));
    const removeButtons = screen.getAllByLabelText('Remove');
    fireEvent.click(removeButtons[0]);
    save();
    await waitFor(() => expect(patchBody()).toBeTruthy());
    expect(patchBody().categories).toEqual([SPA.categories[1]]);
  });

  it('site_lists CSV: spaces, empties, duplicates, Arabic comma and names', async () => {
    mount();
    http.on('PATCH', /category-sites/, reply(200, {}));
    await openEdit('SPA');
    fireEvent.change(screen.getByDisplayValue('arabic_sites, gulf_agencies'), {
      target: { value: ' arabic_sites ,, gulf_agencies،قائمة عربية , arabic_sites ,' },
    });
    save();
    await waitFor(() => expect(patchBody()).toBeTruthy());
    expect(patchBody().site_lists).toEqual(['arabic_sites', 'gulf_agencies', 'قائمة عربية']);
  });

  it('server 400 / 409 messages are shown in the modal', async () => {
    mount();
    http.once('PATCH', /category-sites/, reply(400, { error: "'selectors' must be an object" }));
    http.once('PATCH', /category-sites/, reply(409, { error: 'A site with this name already exists' }));
    await openEdit('SPA');
    save();
    expect(await screen.findByText("'selectors' must be an object")).toBeInTheDocument();
    save();
    expect(await screen.findByText('A site with this name already exists')).toBeInTheDocument();
  });

  it('close / cancel do not send anything', async () => {
    mount();
    await openEdit('SPA');
    fireEvent.click(screen.getByText(en.cancel));
    await waitFor(() => expect(screen.queryByText(en.save)).toBeNull());
    expect(http.callsTo('PATCH', /category-sites/)).toHaveLength(0);
  });
});

describe('create', () => {
  const openCreate = async () => {
    await screen.findByText('SPA');
    fireEvent.click(screen.getByText(en.addSite).closest('button'));
  };

  it('requires name and base URL (whitespace counts as empty)', async () => {
    mount();
    await openCreate();
    fireEvent.change(screen.getByPlaceholderText(en.namePlaceholder), { target: { value: '   ' } });
    fireEvent.click(screen.getByText(en.create).closest('button'));
    expect(await screen.findByText(en.baseUrlRequired)).toBeInTheDocument();
    expect(http.callsTo('POST', SITES)).toHaveLength(0);
  });

  it('POSTs a trimmed payload with page_mode query and no empty selectors', async () => {
    mount();
    http.on('POST', SITES, reply(201, { id: 10 }));
    await openCreate();
    fireEvent.change(screen.getByPlaceholderText(en.namePlaceholder), { target: { value: '  وكالة الأنباء  ' } });
    fireEvent.change(screen.getByPlaceholderText(en.baseUrlPlaceholder), { target: { value: ' https://wam.ae/ ' } });
    fireEvent.change(screen.getByPlaceholderText(en.itemSelector), { target: { value: '.item' } });
    fireEvent.click(screen.getByText(en.create).closest('button'));
    await waitFor(() => expect(http.callsTo('POST', SITES)).toHaveLength(1));
    expect(http.callsTo('POST', SITES)[0].body).toEqual({
      name: 'وكالة الأنباء', base_url: 'https://wam.ae/', site_lists: [], categories: [],
      is_active: true, js: false, page_mode: 'query', selectors: { item: '.item' },
    });
  });

  it('409 duplicate name shows the message', async () => {
    mount();
    http.on('POST', SITES, reply(409, { error: "A site named 'SPA' already exists" }));
    await openCreate();
    fireEvent.change(screen.getByPlaceholderText(en.namePlaceholder), { target: { value: 'SPA' } });
    fireEvent.change(screen.getByPlaceholderText(en.baseUrlPlaceholder), { target: { value: 'https://x/' } });
    fireEvent.click(screen.getByText(en.create).closest('button'));
    expect(await screen.findByText("A site named 'SPA' already exists")).toBeInTheDocument();
  });
});

describe('lists tab', () => {
  it('expand / collapse shows the member sites and counts', async () => {
    mount();
    await screen.findByText('SPA');
    fireEvent.click(screen.getByText(en.siteListsTab));
    const btn = (await screen.findByText('Other Sites')).closest('button');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(within(btn).getByText(`2 ${en.siteCount}`)).toBeInTheDocument();
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('Agency A')).toBeInTheDocument();
    expect(screen.getByText('Agency B')).toBeInTheDocument();
    fireEvent.click(btn);
    await waitFor(() => expect(screen.queryByText('Agency A')).toBeNull());
  });

  it('empty list shows "no sites in list"', async () => {
    http.on('GET', SITES, reply(200, { sites: [] }));
    http.on('GET', LISTS, reply(200, { site_lists: [{ name: 'empty_list', sites: 0 }] }));
    renderWithProviders(<Sites />);
    fireEvent.click(screen.getByText(en.siteListsTab));
    fireEvent.click((await screen.findByText('Empty List')).closest('button'));
    expect(await screen.findByText(en.noSitesInList)).toBeInTheDocument();
  });

  it('no lists -> empty state', async () => {
    http.on('GET', SITES, reply(200, { sites: [] }));
    http.on('GET', LISTS, reply(200, { site_lists: [] }));
    renderWithProviders(<Sites />);
    fireEvent.click(screen.getByText(en.siteListsTab));
    expect(await screen.findByText(en.noSiteListsYet)).toBeInTheDocument();
  });
});
