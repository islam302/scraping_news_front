// Vitest config kept under src/ (the root vite configs are left untouched).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/__tests__/**/*.test.{js,jsx}'],
    css: false,
    testTimeout: 15000,
  },
});
