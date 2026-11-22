import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { LangProvider, useLang } from '../LangContext';
import { ThemeProvider, useTheme } from '../ThemeContext';
import {
  translations, categoryLabel, siteListLabel, DEFAULT_CATEGORIES, categoryLabels,
} from '../../i18n/translations';

function LangProbe() {
  const { lang, setLang, t, isRTL } = useLang();
  return (
    <>
      <p data-testid="lang">{lang}</p>
      <p data-testid="rtl">{String(isRTL)}</p>
      <p data-testid="t">{t('signIn')}</p>
      <p data-testid="missing">{t('__definitely_missing__')}</p>
      <button type="button" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>toggle</button>
    </>
  );
}

describe('LangContext', () => {
  it('defaults to English LTR', () => {
    render(<LangProvider><LangProbe /></LangProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByTestId('t')).toHaveTextContent(translations.en.signIn);
  });

  it('restores Arabic from localStorage and sets RTL', () => {
    localStorage.setItem('lang', 'ar');
    render(<LangProvider><LangProbe /></LangProvider>);
    expect(screen.getByTestId('rtl')).toHaveTextContent('true');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(screen.getByTestId('t')).toHaveTextContent(translations.ar.signIn);
  });

  it('setLang persists and flips dir', () => {
    render(<LangProvider><LangProbe /></LangProvider>);
    fireEvent.click(screen.getByText('toggle'));
    expect(localStorage.getItem('lang')).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    fireEvent.click(screen.getByText('toggle'));
    expect(localStorage.getItem('lang')).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('t() falls back to English then to the key', () => {
    localStorage.setItem('lang', 'fr');
    render(<LangProvider><LangProbe /></LangProvider>);
    expect(screen.getByTestId('t')).toHaveTextContent(translations.en.signIn);
    expect(screen.getByTestId('missing')).toHaveTextContent('__definitely_missing__');
  });
});

function ThemeProbe() {
  const { theme, toggleTheme, isDark } = useTheme();
  return (
    <>
      <p data-testid="theme">{theme}</p>
      <p data-testid="dark">{String(isDark)}</p>
      <button type="button" onClick={toggleTheme}>toggle</button>
    </>
  );
}

describe('ThemeContext', () => {
  it('defaults to light, toggles and persists', () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('dark')).toHaveTextContent('true');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('restores the saved theme', () => {
    localStorage.setItem('theme', 'dark');
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });
});

describe('translations', () => {
  it('en and ar define exactly the same keys, none empty', () => {
    const enKeys = Object.keys(translations.en).sort();
    const arKeys = Object.keys(translations.ar).sort();
    expect(arKeys).toEqual(enKeys);
    for (const lang of ['en', 'ar']) {
      for (const [k, v] of Object.entries(translations[lang])) {
        expect(typeof v, `${lang}.${k}`).toBe('string');
        expect(v.trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      }
    }
  });

  it("every t('key') used in src exists in both languages", () => {
    const srcDir = path.resolve(__dirname, '../..');
    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full); }
        else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(full);
      }
    };
    walk(srcDir);
    const used = new Set();
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'\s*\)/g)) used.add(m[1]);
      for (const m of text.matchAll(/\btr\(\s*'([A-Za-z0-9_]+)'\s*\)/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(50);
    const missing = [...used].filter((k) => !(k in translations.en) || !(k in translations.ar));
    expect(missing).toEqual([]);
  });

  it('placeholders are consistent between languages', () => {
    for (const k of Object.keys(translations.en)) {
      const ph = (s) => (s.match(/\{[a-z]+\}/g) || []).sort();
      expect(ph(translations.ar[k]), k).toEqual(ph(translations.en[k]));
    }
  });

  it('categoryLabel: known keys, Arabic, unknown fallback', () => {
    expect(categoryLabel('sport')).toBe('Sport');
    expect(categoryLabel('sport', 'ar')).toBe('رياضة');
    expect(categoryLabel('weird_key', 'ar')).toBe('weird_key');
    expect(categoryLabel('sport', 'fr')).toBe('Sport');
    DEFAULT_CATEGORIES.forEach((c) => {
      expect(categoryLabels.en[c], c).toBeTruthy();
      expect(categoryLabels.ar[c], c).toBeTruthy();
    });
  });

  it('siteListLabel: known keys, Arabic, prettified fallback', () => {
    expect(siteListLabel('gulf_agencies')).toBe('Gulf Agencies');
    expect(siteListLabel('gulf_agencies', 'ar')).toBe('وكالات الخليج');
    expect(siteListLabel('asian_news_agencies', 'ar')).toBe('Asian News Agencies');
  });
});
