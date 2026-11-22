// Global test setup (vitest --setupFiles). Keeps every test hermetic:
// no real network, clean storage/DOM between tests, no animations.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { installHttpMock, http } from './http';

installHttpMock();

MotionGlobalConfig.skipAnimations = true;

const isDom = typeof window !== 'undefined';

if (isDom && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Any test that forgets to mock the network fails loudly instead of leaking.
const blockedFetch = () => Promise.reject(new Error('Network access is blocked in tests'));

beforeEach(() => {
  http.reset();
  globalThis.fetch = vi.fn(blockedFetch);
});

afterEach(() => {
  if (isDom) {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('data-theme');
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});
