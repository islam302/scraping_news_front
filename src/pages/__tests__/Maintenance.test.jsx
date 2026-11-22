import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useEffect } from 'react';
import Maintenance from '../Maintenance';
import { LangProvider } from '../../context/LangContext';
import { MaintenanceProvider, useMaintenance } from '../../context/MaintenanceContext';
import { http, reply, networkError, deferred } from '../../__tests__/http';
import { getMissions } from '../../services/api';
import { translations } from '../../i18n/translations';

const en = translations.en;
const HEALTH = '/scraping-api/api/categories/';

function Shell() {
  const { down, setDown } = useMaintenance();
  useEffect(() => { setDown(true); }, [setDown]);
  return down ? <Maintenance /> : <p>APP IS BACK</p>;
}
const renderPage = () => render(<LangProvider><MaintenanceProvider><Shell /></MaintenanceProvider></LangProvider>);
const retry = () => fireEvent.click(screen.getByText(en.maintRetry).closest('button'));

describe('Maintenance page', () => {
  it('Retry success returns to the app', async () => {
    http.on('GET', HEALTH, reply(200, {}));
    renderPage();
    retry();
    expect(await screen.findByText('APP IS BACK')).toBeInTheDocument();
  });

  it('Retry failure (network / 503) stays on the page', async () => {
    http.once('GET', HEALTH, networkError());
    http.once('GET', HEALTH, reply(503));
    renderPage();
    retry();
    await screen.findByText(en.maintRetry);
    retry();
    await screen.findByText(en.maintRetry);
    expect(screen.getByText(en.maintTitle)).toBeInTheDocument();
  });

  it('FE-09: a 429 from the probe means the API is up', async () => {
    http.on('GET', HEALTH, reply(429, { detail: 'throttled' }));
    renderPage();
    retry();
    expect(await screen.findByText('APP IS BACK')).toBeInTheDocument();
  });

  it('shows the checking state and guards double clicks', async () => {
    const d = deferred();
    http.on('GET', HEALTH, d);
    renderPage();
    retry();
    expect(screen.getByText(en.maintChecking)).toBeInTheDocument();
    expect(screen.getByText(en.maintChecking).closest('button')).toBeDisabled();
    fireEvent.click(screen.getByText(en.maintChecking).closest('button'));
    expect(http.callsTo('GET', HEALTH)).toHaveLength(1);
    await act(async () => { d.resolve(reply(200, {})); });
    expect(await screen.findByText('APP IS BACK')).toBeInTheDocument();
  });

  it('FE-09: auto-recovers without a click', async () => {
    vi.useFakeTimers();
    http.on('GET', HEALTH, reply(200, {}));
    renderPage();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText(en.maintTitle)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(screen.getByText('APP IS BACK')).toBeInTheDocument();
  });

  it('auto-retry timer is cleared when the page unmounts', async () => {
    vi.useFakeTimers();
    http.on('GET', HEALTH, networkError());
    const { unmount } = renderPage();
    await act(() => vi.advanceTimersByTimeAsync(0));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Arabic texts', () => {
    localStorage.setItem('lang', 'ar');
    renderPage();
    expect(screen.getByText(translations.ar.maintTitle)).toBeInTheDocument();
  });
});

describe('MaintenanceContext wiring', () => {
  function Probe() {
    const { down } = useMaintenance();
    return <p>{down ? 'DOWN' : 'UP'}</p>;
  }
  it('flips on a confirmed outage and back on the next success', async () => {
    render(<MaintenanceProvider><Probe /></MaintenanceProvider>);
    http.on('GET', /scraping-api/, reply(502));
    await act(async () => { await getMissions().catch(() => {}); });
    expect(screen.getByText('DOWN')).toBeInTheDocument();
    http.reset();
    http.on('GET', /scraping-api/, reply(200, {}));
    await act(async () => { await getMissions(); });
    expect(screen.getByText('UP')).toBeInTheDocument();
  });
});
