import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import App from '../App';
import { http, reply, networkError, never, timeoutError, makeJwt } from './http';
import { translations } from '../i18n/translations';
import { AUTH_TIMEOUT_MS } from '../services/auth';

const en = translations.en;
const now = () => Math.floor(Date.now() / 1000);
const REFRESH = '/auth-api/api/auth/token/refresh/';

const goTo = (path) => window.history.pushState({}, '', path);
const session = (exp = now() + 86400) => {
  localStorage.setItem('access_token', makeJwt({ exp }));
  localStorage.setItem('refresh_token', 'R1');
  localStorage.setItem('user', JSON.stringify({ username: 'islam', role: 'admin' }));
};

beforeEach(() => {
  goTo('/');
  http.on('GET', '/scraping-api/api/categories/', reply(200, { available_categories: ['general'], site_lists: [] }));
  http.on('GET', '/scraping-api/api/missions/', reply(200, { missions: [] }));
});

describe('routing / auth guards', () => {
  it('unauthenticated users are redirected to /login', async () => {
    render(<App />);
    expect(await screen.findByText(en.welcomeBack)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('authenticated users visiting /login are sent to the dashboard', async () => {
    session();
    goTo('/login');
    render(<App />);
    await screen.findByText(en.newMonitorTitle);
    expect(window.location.pathname).toBe('/');
  });

  it('protected /tasks renders for an authenticated user', async () => {
    session();
    goTo('/tasks');
    render(<App />);
    expect(await screen.findByText(en.noMissionsYet)).toBeInTheDocument();
  });

  it('expired access + refresh 401 -> login page and tokens wiped', async () => {
    session(now() - 10);
    http.on('POST', REFRESH, reply(401, { detail: 'Token is invalid or expired' }));
    render(<App />);
    expect(await screen.findByText(en.welcomeBack)).toBeInTheDocument();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('FE-11: expired access + refresh network error keeps the session', async () => {
    session(now() - 10);
    http.on('POST', REFRESH, networkError());
    render(<App />);
    expect(await screen.findByText(en.newMonitorTitle)).toBeInTheDocument();
    expect(localStorage.getItem('refresh_token')).toBe('R1');
  });

  it('FE-14: the startup refresh has a finite timeout', async () => {
    session(now() - 10);
    http.on('POST', REFRESH, never());
    render(<App />);
    expect(document.body.textContent).toBe(''); // blank only while waiting
    await waitFor(() => expect(http.callsTo('POST', REFRESH)).toHaveLength(1));
    expect(http.callsTo('POST', REFRESH)[0].timeout).toBe(AUTH_TIMEOUT_MS);
    expect(AUTH_TIMEOUT_MS).toBeLessThanOrEqual(30000);
  });

  it('FE-14: when that timeout fires the app renders (session kept)', async () => {
    session(now() - 10);
    http.on('POST', REFRESH, timeoutError());
    render(<App />);
    expect(await screen.findByText(en.newMonitorTitle)).toBeInTheDocument();
  });

  it('FE-21: corrupted localStorage.user does not crash the app', async () => {
    localStorage.setItem('access_token', makeJwt({ exp: now() + 86400 }));
    localStorage.setItem('user', '{bad');
    render(<App />);
    expect(await screen.findByText(en.newMonitorTitle)).toBeInTheDocument();
    expect(screen.queryByText(en.errBoundaryTitle)).toBeNull();
  });

  it('multi-tab logout: removing the token in another tab signs this tab out', async () => {
    session();
    render(<App />);
    await screen.findByText(en.newMonitorTitle);
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: 'access_token', newValue: null }));
    });
    expect(await screen.findByText(en.welcomeBack)).toBeInTheDocument();
  });
});

describe('login page', () => {
  const fill = (u, p) => {
    fireEvent.change(screen.getByPlaceholderText(en.enterUsername), { target: { value: u } });
    fireEvent.change(screen.getByPlaceholderText(en.enterPassword), { target: { value: p } });
  };
  const signIn = () => fireEvent.click(screen.getByText(en.signIn).closest('button'));

  it('login success stores tokens and opens the dashboard', async () => {
    http.on('POST', '/auth-api/api/auth/token/', reply(200, { access: makeJwt({ exp: now() + 99 }), refresh: 'R', username: 'u' }));
    render(<App />);
    await screen.findByText(en.welcomeBack);
    fill(' u ', 'pw');
    signIn();
    expect(await screen.findByText(en.newMonitorTitle)).toBeInTheDocument();
    expect(http.callsTo('POST', '/auth-api/api/auth/token/')[0].body).toEqual({ username: 'u', password: 'pw' });
  });

  it('blank fields are blocked', async () => {
    render(<App />);
    await screen.findByText(en.welcomeBack);
    fill('   ', '   ');
    expect(screen.getByText(en.signIn).closest('button')).toBeDisabled();
  });

  it.each([
    [401, { detail: 'No active account found with the given credentials' }, 'No active account found with the given credentials'],
    [400, { detail: { message: 'Bad request' } }, 'Bad request'],
    [400, { username: ['This field is required.'] }, 'This field is required.'],
    [400, {}, en.loginFailed],
    [429, { detail: 'Request was throttled. Expected available in 30 seconds.' }, 'Too many requests. Please wait a moment and try again.'],
    [503, '<html><body>503</body></html>', en.errServer],
  ])('login %i shows a friendly message', async (status, body, expected) => {
    http.on('POST', '/auth-api/api/auth/token/', reply(status, body));
    render(<App />);
    await screen.findByText(en.welcomeBack);
    fill('u', 'p');
    signIn();
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('login network error -> connection message', async () => {
    http.on('POST', '/auth-api/api/auth/token/', networkError());
    render(<App />);
    await screen.findByText(en.welcomeBack);
    fill('u', 'p');
    signIn();
    expect(await screen.findByText(en.errNetwork)).toBeInTheDocument();
  });

  it('language toggle switches to Arabic and RTL', async () => {
    render(<App />);
    await screen.findByText(en.welcomeBack);
    fireEvent.click(screen.getByTitle('العربية'));
    expect(await screen.findByText(translations.ar.welcomeBack)).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('lang')).toBe('ar');
  });
});

describe('maintenance takeover (FE-08)', () => {
  it('a single 500 on save does not replace the app with the maintenance page', async () => {
    session();
    goTo('/sites');
    http.on('GET', '/scraping-api/api/category-sites/', reply(200, { sites: [{ id: 5, name: 'SPA', base_url: 'https://spa/', is_active: true, categories: [], selectors: {} }] }));
    http.on('GET', '/scraping-api/api/category-site-lists/', reply(200, { site_lists: [] }));
    http.on('PATCH', '/scraping-api/api/category-sites/5/', reply(500, { detail: 'boom' }));
    render(<App />);
    fireEvent.click(await screen.findByLabelText(en.editSite));
    fireEvent.click(await screen.findByText(en.save));
    expect(await screen.findByText(en.errServer)).toBeInTheDocument();
    expect(screen.queryByText(en.maintTitle)).toBeNull();
    expect(screen.getByText(en.save)).toBeInTheDocument(); // modal survived
  });

  it('a confirmed outage shows the maintenance page; Retry brings the app back', async () => {
    session();
    goTo('/tasks');
    http.reset();
    http.on('GET', /scraping-api/, reply(503));
    render(<App />);
    expect(await screen.findByText(en.maintTitle)).toBeInTheDocument();
    http.reset();
    http.on('GET', '/scraping-api/api/categories/', reply(200, {}));
    http.on('GET', '/scraping-api/api/missions/', reply(200, { missions: [] }));
    fireEvent.click(screen.getByText(en.maintRetry).closest('button'));
    await waitFor(() => expect(screen.queryByText(en.maintTitle)).toBeNull());
  });
});

describe('ErrorBoundary', () => {
  it('ErrorBoundary content follows the persisted language', async () => {
    const { default: ErrorBoundary } = await import('../components/ErrorBoundary');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('lang', 'ar');
    const Boom = () => { throw new Error('kaput'); };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText(translations.ar.errBoundaryTitle)).toBeInTheDocument();
    expect(screen.getByText('kaput')).toBeInTheDocument();
  });

  it('Try Again re-renders children; a deterministic crash reloads instead of looping', async () => {
    const { default: ErrorBoundary } = await import('../components/ErrorBoundary');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } });
    let crash = true;
    const Maybe = () => { if (crash) throw new Error('x'); return <p>RECOVERED</p>; };
    render(<ErrorBoundary><Maybe /></ErrorBoundary>);
    fireEvent.click(screen.getByText(en.errBoundaryRetry));
    // still crashing → second Try Again soon after reloads the page
    fireEvent.click(screen.getByText(en.errBoundaryRetry));
    expect(reload).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, 'location', { configurable: true, value: original });
    crash = false;
  });

  it('Try Again recovers from a transient crash', async () => {
    const { default: ErrorBoundary } = await import('../components/ErrorBoundary');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let crash = true;
    const Maybe = () => { if (crash) throw new Error('x'); return <p>RECOVERED</p>; };
    render(<ErrorBoundary><Maybe /></ErrorBoundary>);
    crash = false;
    fireEvent.click(screen.getByText(en.errBoundaryRetry));
    expect(screen.getByText('RECOVERED')).toBeInTheDocument();
  });
});
