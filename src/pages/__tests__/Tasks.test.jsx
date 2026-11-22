import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Route } from 'react-router-dom';
import Tasks from '../Tasks';
import { renderWithProviders } from '../../__tests__/render';
import { http, reply, networkError } from '../../__tests__/http';
import { translations } from '../../i18n/translations';

const en = translations.en;
const LIST = '/scraping-api/api/missions/';
const missions = (n) => Array.from({ length: n }, (_, i) => ({
  mission_id: `m${i}`, keyword: `kw${i}`, status: 'completed', created_at: '2026-11-20T10:00:00Z', total_results: i,
}));

const renderTasks = (lang) => renderWithProviders(<Tasks />, {
  route: '/tasks', path: '/tasks', lang,
  extraRoutes: <Route path="/tasks/:missionId" element={<p>DETAIL PAGE</p>} />,
});

const checkbox = (kw) => screen.getByText(kw).closest('[class*="cursor-pointer"]').querySelector('[class*="rounded border-2"]');

beforeEach(() => {
  http.on('GET', '/scraping-api/api/categories/', reply(200, {}));
});

describe('loading', () => {
  it('lists missions with a pluralised count', async () => {
    http.on('GET', LIST, reply(200, { missions: missions(3) }));
    renderTasks();
    expect(await screen.findByText('kw0')).toBeInTheDocument();
    expect(screen.getByText(`3 ${en.missionsRecorded}`)).toBeInTheDocument();
  });

  it('singular count', async () => {
    http.on('GET', LIST, reply(200, { missions: missions(1) }));
    renderTasks();
    expect(await screen.findByText(`1 ${en.missionRecorded}`)).toBeInTheDocument();
  });

  it('empty state', async () => {
    http.on('GET', LIST, reply(200, { missions: [] }));
    renderTasks();
    expect(await screen.findByText(en.noMissionsYet)).toBeInTheDocument();
    expect(screen.getByText(`0 ${en.missionsRecorded}`)).toBeInTheDocument();
  });

  it('malformed body (missions not an array) is treated as empty', async () => {
    http.on('GET', LIST, reply(200, { missions: 'oops' }));
    renderTasks();
    expect(await screen.findByText(en.noMissionsYet)).toBeInTheDocument();
  });

  it('load error shows the page error', async () => {
    http.on('GET', LIST, reply(403, {}));
    renderTasks();
    expect(await screen.findByText(en.errForbidden)).toBeInTheDocument();
  });

  it('network error shows the connection message', async () => {
    http.on('GET', /scraping-api/, networkError());
    renderTasks();
    expect(await screen.findByText(en.errNetwork)).toBeInTheDocument();
  });

  it('status badges for every status, including unknown', async () => {
    http.on('GET', LIST, reply(200, {
      missions: ['completed', 'failed', 'scraping', 'filtering', 'pending', 'weird'].map((s, i) => ({ mission_id: `x${i}`, keyword: s, status: s })),
    }));
    renderTasks();
    await screen.findByText('weird');
    expect(screen.getByText(en.statusCompleted)).toBeInTheDocument();
    expect(screen.getByText(en.statusFailed)).toBeInTheDocument();
    expect(screen.getByText(en.extracting)).toBeInTheDocument();
    expect(screen.getByText(en.aiFilteringInProgress)).toBeInTheDocument();
    expect(screen.getAllByText(en.statusPending)).toHaveLength(2); // pending + unknown
  });

  it('Arabic UI: status badge is a status word, not the "completion date" label (FE-21)', async () => {
    http.on('GET', LIST, reply(200, { missions: missions(1) }));
    renderTasks('ar');
    await screen.findByText('kw0');
    expect(screen.getByText(translations.ar.statusCompleted)).toBeInTheDocument();
    expect(screen.queryByText(/Nov/)).toBeNull();
  });

  it('clicking a row navigates to /tasks/:id', async () => {
    http.on('GET', LIST, reply(200, { missions: missions(2) }));
    renderTasks();
    fireEvent.click(await screen.findByText('kw1'));
    expect(screen.getByText('DETAIL PAGE')).toBeInTheDocument();
  });
});

describe('selection', () => {
  it('select, deselect, select-all, deselect-all', async () => {
    http.on('GET', LIST, reply(200, { missions: missions(3) }));
    renderTasks();
    await screen.findByText('kw0');
    fireEvent.click(checkbox('kw0'));
    expect(screen.getByText(`1 ${en.selected}`)).toBeInTheDocument();
    fireEvent.click(checkbox('kw0'));
    expect(screen.getByText(`3 ${en.missionsRecorded}`)).toBeInTheDocument();
    fireEvent.click(screen.getByText(en.selectAll));
    expect(screen.getByText(`3 ${en.selected}`)).toBeInTheDocument();
    fireEvent.click(screen.getByText(en.selectAll));
    expect(screen.getByText(`3 ${en.missionsRecorded}`)).toBeInTheDocument();
  });

  it('clicking the checkbox does not navigate', async () => {
    http.on('GET', LIST, reply(200, { missions: missions(1) }));
    renderTasks();
    await screen.findByText('kw0');
    fireEvent.click(checkbox('kw0'));
    expect(screen.queryByText('DETAIL PAGE')).toBeNull();
  });
});

describe('bulk delete (FE-10)', () => {
  const deleteBtn = () => screen.getByText(en.deleteSelected).closest('button');

  it('confirm cancelled -> no requests', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    http.on('GET', LIST, reply(200, { missions: missions(2) }));
    renderTasks();
    await screen.findByText('kw0');
    fireEvent.click(screen.getByText(en.selectAll));
    fireEvent.click(deleteBtn());
    expect(http.callsTo('DELETE', /missions\/m/)).toHaveLength(0);
  });

  it('all success removes the rows and clears the selection', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    http.on('GET', LIST, reply(200, { missions: missions(3) }));
    http.on('DELETE', /\/missions\/m\d+\/$/, reply(200, { deleted: true }));
    renderTasks();
    await screen.findByText('kw0');
    fireEvent.click(checkbox('kw0'));
    fireEvent.click(checkbox('kw2'));
    fireEvent.click(deleteBtn());
    await waitFor(() => expect(screen.queryByText('kw0')).toBeNull());
    expect(screen.queryByText('kw2')).toBeNull();
    expect(screen.getByText('kw1')).toBeInTheDocument();
    expect(screen.getByText(`1 ${en.missionRecorded}`)).toBeInTheDocument();
    expect(http.callsTo('DELETE', /missions\/m/).map((c) => c.path).sort())
      .toEqual(['/scraping-api/api/missions/m0/', '/scraping-api/api/missions/m2/']);
  });

  it('partial failure removes the deleted ones, keeps the failed ones selected, shows an error', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    http.on('GET', LIST, reply(200, { missions: missions(10) }));
    ['m0', 'm1', 'm2'].forEach((id) => http.on('DELETE', `/scraping-api/api/missions/${id}/`, reply(200, {})));
    http.on('DELETE', /\/missions\/m\d+\/$/, reply(429, { detail: 'throttled', retry_after: 5 }));
    renderTasks();
    await screen.findByText('kw0');
    fireEvent.click(screen.getByText(en.selectAll));
    fireEvent.click(deleteBtn());
    await screen.findByText(/could not be deleted/);
    expect(screen.getByText(/7 mission\(s\) could not be deleted/)).toBeInTheDocument();
    expect(screen.getByText(/Too many requests/)).toBeInTheDocument();
    ['kw0', 'kw1', 'kw2'].forEach((k) => expect(screen.queryByText(k)).toBeNull());
    expect(screen.getByText('kw9')).toBeInTheDocument();
    expect(screen.getByText(`7 ${en.selected}`)).toBeInTheDocument();

    // Retry only re-sends the failed ones (no 404 storm for already-deleted ids)
    http.reset();
    http.on('GET', '/scraping-api/api/categories/', reply(200, {}));
    http.on('DELETE', /\/missions\/m\d+\/$/, reply(200, {}));
    fireEvent.click(deleteBtn());
    await waitFor(() => expect(screen.queryByText('kw9')).toBeNull());
    expect(http.callsTo('DELETE', /missions/)).toHaveLength(7);
    expect(screen.queryByText(/could not be deleted/)).toBeNull();
  });

  it('a 404 for an already-deleted mission counts as deleted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    http.on('GET', LIST, reply(200, { missions: missions(2) }));
    http.on('DELETE', '/scraping-api/api/missions/m0/', reply(404, {}));
    http.on('DELETE', '/scraping-api/api/missions/m1/', reply(200, {}));
    renderTasks();
    await screen.findByText('kw0');
    fireEvent.click(screen.getByText(en.selectAll));
    fireEvent.click(deleteBtn());
    expect(await screen.findByText(en.noMissionsYet)).toBeInTheDocument();
    expect(screen.queryByText(/could not be deleted/)).toBeNull();
  });

  it('single failure shows the plain reason', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    http.on('GET', LIST, reply(200, { missions: missions(1) }));
    http.on('DELETE', '/scraping-api/api/missions/m0/', reply(403, {}));
    renderTasks();
    await screen.findByText('kw0');
    fireEvent.click(checkbox('kw0'));
    fireEvent.click(deleteBtn());
    expect(await screen.findByText(en.errForbidden)).toBeInTheDocument();
    expect(screen.getByText('kw0')).toBeInTheDocument();
  });

  it('select-all with 50 missions never runs more than 3 DELETEs at once', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    http.on('GET', LIST, reply(200, { missions: missions(50) }));
    let inFlight = 0;
    let peak = 0;
    http.on('DELETE', /\/missions\/m\d+\/$/, () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise((r) => setTimeout(() => { inFlight -= 1; r({ kind: 'response', status: 200, data: {} }); }, 1));
    });
    renderTasks();
    await screen.findByText('kw0');
    fireEvent.click(screen.getByText(en.selectAll));
    fireEvent.click(deleteBtn());
    expect(await screen.findByText(en.noMissionsYet, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(http.callsTo('DELETE', /missions/)).toHaveLength(50);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('list row region keeps keyword and result count', async () => {
    http.on('GET', LIST, reply(200, { missions: [{ mission_id: 'z', keyword: 'zz', status: 'completed', total_results: 7 }] }));
    renderTasks();
    const row = (await screen.findByText('zz')).closest('[class*="cursor-pointer"]');
    expect(within(row).getByText(`7 ${en.results.toLowerCase()}`)).toBeInTheDocument();
  });
});
