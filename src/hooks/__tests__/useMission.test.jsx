import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMission, POLL_INTERVAL, MAX_POLL_FAILURES } from '../useMission';
import { LangProvider } from '../../context/LangContext';
import { http, reply, networkError, deferred } from '../../__tests__/http';
import { translations } from '../../i18n/translations';

const SCRAPE = '/scraping-api/api/category-scrape/';
const MISSION = '/scraping-api/api/missions/m1/';
const wrapper = ({ children }) => <LangProvider>{children}</LangProvider>;
const en = translations.en;

const setup = () => renderHook(() => useMission(), { wrapper });
const tick = (ms = POLL_INTERVAL) => act(() => vi.advanceTimersByTimeAsync(ms));
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));

beforeEach(() => {
  vi.useFakeTimers();
  // The health probe used by maintenance detection; keep it healthy.
  http.on('GET', '/scraping-api/api/categories/', reply(200, {}));
});

describe('scrape happy path', () => {
  it('POST -> poll -> completed stops polling and clears loading', async () => {
    http.on('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending', skipped_categories: [] }));
    http.once('GET', MISSION, reply(200, { mission_id: 'm1', status: 'scraping', progress: { done: 1, total: 4 } }));
    http.once('GET', MISSION, reply(200, { mission_id: 'm1', status: 'completed', results: [{ Title: 'A' }] }));
    const { result } = setup();

    await act(() => result.current.scrape('gaza', { categories: ['general'] }));
    expect(result.current.loading).toBe(true);
    expect(result.current.mission).toEqual({ mission_id: 'm1', status: 'pending', keyword: 'gaza' });

    await tick();
    expect(result.current.mission.status).toBe('scraping');
    expect(result.current.loading).toBe(true);

    await tick();
    expect(result.current.mission.status).toBe('completed');
    expect(result.current.mission.results).toHaveLength(1);
    expect(result.current.loading).toBe(false);

    await tick(POLL_INTERVAL * 5);
    expect(http.callsTo('GET', MISSION)).toHaveLength(2); // no more polling
  });

  it('failed status stops polling', async () => {
    http.on('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending' }));
    http.on('GET', MISSION, reply(200, { mission_id: 'm1', status: 'failed' }));
    const { result } = setup();
    await act(() => result.current.scrape('k'));
    await tick();
    expect(result.current.mission.status).toBe('failed');
    expect(result.current.loading).toBe(false);
    await tick(POLL_INTERVAL * 3);
    expect(http.callsTo('GET', MISSION)).toHaveLength(1);
  });

  it('surfaces skipped_categories', async () => {
    http.on('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending', skipped_categories: ['security'] }));
    http.on('GET', MISSION, reply(200, { status: 'completed' }));
    const { result } = setup();
    await act(() => result.current.scrape('k'));
    expect(result.current.skippedCategories).toEqual(['security']);
  });

  it('titles_only response without mission_id does not poll /missions/undefined/', async () => {
    http.on('POST', SCRAPE, reply(200, { titles: ['a', 'b'], count: 2 }));
    const { result } = setup();
    await act(() => result.current.scrape('k', { titlesOnly: true }));
    await tick(POLL_INTERVAL * 2);
    expect(http.callsTo('GET', /missions\/undefined/)).toHaveLength(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.mission.titles).toEqual(['a', 'b']);
  });
});

describe('startScraping errors', () => {
  it.each([
    ['400 server message', reply(400, { error: 'None of the selected categories exist' }), 'None of the selected categories exist'],
    ['429', reply(429, { detail: 'Request was throttled.', retry_after: 9 }), 'Too many requests. Please try again in 9 seconds.'],
    ['500', reply(500, {}), en.errServer],
    ['network', networkError(), en.errNetwork],
  ])('%s -> error message, loading false', async (_l, responder, expected) => {
    http.on('POST', SCRAPE, responder);
    const { result } = setup();
    await act(() => result.current.scrape('k'));
    expect(result.current.error).toBe(expected);
    expect(result.current.loading).toBe(false);
    expect(result.current.mission).toBeNull();
  });
});

describe('poll error handling (FE-04)', () => {
  it('a transient 429 does not stop tracking; results appear later', async () => {
    http.on('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending' }));
    http.once('GET', MISSION, reply(200, { status: 'scraping' }));
    http.once('GET', MISSION, reply(429, { detail: 'throttled' }, { 'Retry-After': '1' }));
    http.on('GET', MISSION, reply(200, { status: 'completed', results: [{ Title: 'R' }] }));
    const { result } = setup();
    await act(() => result.current.scrape('k'));
    await tick(); // scraping
    await tick(); // 429
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toMatch(/Too many requests/);
    await tick(POLL_INTERVAL * 2); // retried after back-off
    expect(result.current.mission.status).toBe('completed');
    expect(result.current.mission.results).toEqual([{ Title: 'R' }]);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it.each([
    ['5xx', reply(502)],
    ['network', networkError()],
  ])('%s blips are retried with back-off', async (_l, responder) => {
    http.on('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending' }));
    http.once('GET', MISSION, responder);
    http.once('GET', MISSION, responder);
    http.on('GET', MISSION, reply(200, { status: 'completed' }));
    const { result } = setup();
    await act(() => result.current.scrape('k'));
    await tick(POLL_INTERVAL * 20);
    expect(result.current.mission.status).toBe('completed');
    expect(result.current.loading).toBe(false);
    expect(http.callsTo('GET', MISSION).length).toBe(3);
  });

  it('404 (mission deleted) is terminal: stop polling, show not found', async () => {
    http.on('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending' }));
    http.on('GET', MISSION, reply(404, { detail: 'Not found.' }));
    const { result } = setup();
    await act(() => result.current.scrape('k'));
    await tick();
    expect(result.current.error).toBe(en.errNotFound);
    expect(result.current.loading).toBe(false);
    await tick(POLL_INTERVAL * 5);
    expect(http.callsTo('GET', MISSION)).toHaveLength(1);
  });

  it('gives up after MAX_POLL_FAILURES consecutive transient failures', async () => {
    http.on('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending' }));
    http.on('GET', MISSION, reply(503));
    const { result } = setup();
    await act(() => result.current.scrape('k'));
    await tick(60 * 60 * 1000);
    expect(http.callsTo('GET', MISSION)).toHaveLength(MAX_POLL_FAILURES);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(en.errServer);
  });
});

describe('ordering / overlap (FE-15)', () => {
  it('never has two polls in flight; a slow response cannot overwrite a newer one', async () => {
    http.on('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending' }));
    const slow = deferred();
    http.once('GET', MISSION, slow);
    http.on('GET', MISSION, reply(200, { status: 'completed', results: [{ Title: 'done' }] }));
    const { result } = setup();
    await act(() => result.current.scrape('k'));
    await tick(); // poll #1 sent, hangs
    await tick(POLL_INTERVAL * 3); // old setInterval would have fired #2, #3, #4 here
    expect(http.callsTo('GET', MISSION)).toHaveLength(1);
    await act(async () => { slow.resolve(reply(200, { status: 'scraping' })); });
    await flush();
    expect(result.current.mission.status).toBe('scraping');
    await tick();
    expect(result.current.mission.status).toBe('completed');
    expect(result.current.loading).toBe(false);
  });

  it('a new scrape invalidates the previous poll session', async () => {
    http.once('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending' }));
    http.once('POST', SCRAPE, reply(202, { mission_id: 'm2', status: 'pending' }));
    const slow = deferred();
    http.once('GET', MISSION, slow);
    http.on('GET', '/scraping-api/api/missions/m2/', reply(200, { mission_id: 'm2', status: 'completed' }));
    const { result } = setup();
    await act(() => result.current.scrape('first'));
    await tick(); // m1 poll in flight
    await act(() => result.current.scrape('second'));
    await tick();
    expect(result.current.mission.mission_id).toBe('m2');
    await act(async () => { slow.resolve(reply(200, { mission_id: 'm1', status: 'scraping' })); });
    await flush();
    expect(result.current.mission.mission_id).toBe('m2');
    expect(result.current.loading).toBe(false);
  });
});

describe('lifecycle', () => {
  it('timer cleared on unmount and no setState after unmount', async () => {
    const spy = vi.spyOn(console, 'error');
    http.on('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending' }));
    const slow = deferred();
    http.on('GET', MISSION, slow);
    const { result, unmount } = setup();
    await act(() => result.current.scrape('k'));
    await tick();
    unmount();
    await act(async () => { slow.resolve(reply(200, { status: 'scraping' })); });
    await tick(POLL_INTERVAL * 5);
    expect(http.callsTo('GET', MISSION)).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('stopPolling halts an active mission', async () => {
    http.on('POST', SCRAPE, reply(202, { mission_id: 'm1', status: 'pending' }));
    http.on('GET', MISSION, reply(200, { status: 'scraping' }));
    const { result } = setup();
    await act(() => result.current.scrape('k'));
    await tick();
    act(() => result.current.stopPolling());
    await tick(POLL_INTERVAL * 4);
    expect(http.callsTo('GET', MISSION)).toHaveLength(1);
  });
});

describe('loadMission', () => {
  it('terminal mission: no polling', async () => {
    http.on('GET', MISSION, reply(200, { mission_id: 'm1', status: 'completed' }));
    const { result } = setup();
    await act(() => result.current.loadMission('m1'));
    expect(result.current.loading).toBe(false);
    await tick(POLL_INTERVAL * 3);
    expect(http.callsTo('GET', MISSION)).toHaveLength(1);
  });

  it.each(['pending', 'scraping', 'filtering'])('%s mission keeps polling until done', async (status) => {
    http.once('GET', MISSION, reply(200, { status }));
    http.on('GET', MISSION, reply(200, { status: 'completed' }));
    const { result } = setup();
    await act(() => result.current.loadMission('m1'));
    expect(result.current.loading).toBe(true);
    await tick();
    expect(result.current.loading).toBe(false);
    expect(result.current.mission.status).toBe('completed');
  });

  it('load error -> message', async () => {
    http.on('GET', MISSION, reply(404));
    const { result } = setup();
    await act(() => result.current.loadMission('m1'));
    expect(result.current.error).toBe(en.errNotFound);
    expect(result.current.loading).toBe(false);
  });
});
