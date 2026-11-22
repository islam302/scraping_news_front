import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import SearchBar from '../SearchBar';
import { renderWithProviders } from '../../__tests__/render';
import { translations, DEFAULT_CATEGORIES } from '../../i18n/translations';

const en = translations.en;

const setup = (props = {}) => {
  const onScrape = vi.fn();
  const onSiteListsChange = vi.fn();
  const utils = renderWithProviders(
    <SearchBar
      onScrape={onScrape}
      onSiteListsChange={onSiteListsChange}
      availableCategories={DEFAULT_CATEGORIES}
      siteLists={['arabic_sites', 'gulf_agencies']}
      {...props}
    />,
    { lang: props.lang },
  );
  return { onScrape, onSiteListsChange, ...utils };
};

const keywordInput = () => screen.getByPlaceholderText(en.keywordsPlaceholder);
const daysInput = () => screen.getByRole('spinbutton');
const submitBtn = () => screen.getByText(en.scrapeAnalyze).closest('button');
const openCategories = () => fireEvent.click(screen.getByText(en.categoriesLabel).parentElement.querySelector('button'));
const openLists = () => fireEvent.click(screen.getByText(en.siteListAll).closest('button'));

describe('keyword', () => {
  it('empty / whitespace keyword is blocked', () => {
    const { onScrape } = setup();
    expect(submitBtn()).toBeDisabled();
    fireEvent.change(keywordInput(), { target: { value: '    ' } });
    expect(submitBtn()).toBeDisabled();
    fireEvent.submit(submitBtn().closest('form'));
    expect(onScrape).not.toHaveBeenCalled();
  });

  it('submits trimmed keyword with defaults', () => {
    const { onScrape } = setup();
    fireEvent.change(keywordInput(), { target: { value: '  gaza  ' } });
    fireEvent.click(submitBtn());
    expect(onScrape).toHaveBeenCalledWith('gaza', { categories: ['general'], siteLists: [], maxDays: 1 });
  });

  it('Arabic and emoji keywords are passed through', () => {
    const { onScrape } = setup();
    fireEvent.change(keywordInput(), { target: { value: 'القدس 🕌' } });
    fireEvent.click(submitBtn());
    expect(onScrape.mock.calls[0][0]).toBe('القدس 🕌');
  });

  it('keyword is capped at the backend max_length (500)', () => {
    const { onScrape } = setup();
    expect(keywordInput()).toHaveAttribute('maxLength', '500');
    fireEvent.change(keywordInput(), { target: { value: 'x'.repeat(800) } });
    fireEvent.click(submitBtn());
    expect(onScrape.mock.calls[0][0]).toHaveLength(500);
  });

  it('submit disabled and blocked while loading', () => {
    const { onScrape } = setup({ loading: true });
    fireEvent.change(keywordInput(), { target: { value: 'k' } });
    expect(screen.getByText(en.scraping).closest('button')).toBeDisabled();
    fireEvent.submit(keywordInput().closest('form'));
    expect(onScrape).not.toHaveBeenCalled();
  });
});

describe('max days clamping', () => {
  it.each([
    ['0', '1'], ['-3', '1'], ['6', '5'], ['99', '5'], ['3', '3'], ['2.7', '2'],
  ])('%s -> %s', (input, shown) => {
    setup();
    fireEvent.change(daysInput(), { target: { value: input } });
    expect(daysInput()).toHaveValue(Number(shown));
  });

  it('empty while typing is allowed and submits 1', () => {
    const { onScrape } = setup();
    fireEvent.change(daysInput(), { target: { value: '' } });
    expect(daysInput()).toHaveValue(null);
    fireEvent.change(keywordInput(), { target: { value: 'k' } });
    fireEvent.click(submitBtn());
    expect(onScrape.mock.calls[0][1].maxDays).toBe(1);
  });

  it('submits the clamped number', () => {
    const { onScrape } = setup();
    fireEvent.change(daysInput(), { target: { value: '4' } });
    fireEvent.change(keywordInput(), { target: { value: 'k' } });
    fireEvent.click(submitBtn());
    expect(onScrape.mock.calls[0][1].maxDays).toBe(4);
  });
});

describe('categories', () => {
  it('enforces the max limit and disables extra options', () => {
    const { onScrape } = setup({ maxCategories: 2 });
    openCategories();
    fireEvent.click(screen.getByText('Sport'));
    expect(screen.getByText('2/2')).toBeInTheDocument();
    const economy = screen.getByText('Economy').closest('button');
    expect(economy).toBeDisabled();
    fireEvent.click(economy);
    fireEvent.change(keywordInput(), { target: { value: 'k' } });
    fireEvent.click(submitBtn());
    expect(onScrape.mock.calls[0][1].categories).toEqual(['general', 'sport']);
  });

  it('"all" is never offered', () => {
    setup({ availableCategories: ['all', 'general', 'sport'] });
    openCategories();
    expect(screen.queryByText('all')).toBeNull();
  });

  it('deselecting everything falls back to general on submit', () => {
    const { onScrape } = setup();
    openCategories();
    fireEvent.click(screen.getAllByText('General').at(-1));
    fireEvent.change(keywordInput(), { target: { value: 'k' } });
    fireEvent.click(submitBtn());
    expect(onScrape.mock.calls[0][1].categories).toEqual(['general']);
  });

  function Harness({ initial, onScrape }) {
    const [cats, setCats] = useState(initial);
    return (
      <>
        <button type="button" onClick={() => setCats(['general', 'sport'])}>narrow</button>
        <button type="button" onClick={() => setCats([])}>empty</button>
        <button type="button" onClick={() => setCats(['sport'])}>sportonly</button>
        <SearchBar onScrape={onScrape} availableCategories={cats} siteLists={[]} />
      </>
    );
  }

  it('categories no longer offered are removed with a message', () => {
    const onScrape = vi.fn();
    renderWithProviders(<Harness initial={DEFAULT_CATEGORIES} onScrape={onScrape} />);
    openCategories();
    fireEvent.click(screen.getByText('Security'));
    fireEvent.click(screen.getByText('narrow'));
    expect(screen.getByText(en.categoriesRemoved.replace('{list}', 'Security'))).toBeInTheDocument();
    fireEvent.change(keywordInput(), { target: { value: 'k' } });
    fireEvent.click(submitBtn());
    expect(onScrape.mock.calls[0][1].categories).toEqual(['general']);
  });

  it('when general goes away the first offered category is selected', () => {
    const onScrape = vi.fn();
    renderWithProviders(<Harness initial={DEFAULT_CATEGORIES} onScrape={onScrape} />);
    fireEvent.click(screen.getByText('sportonly'));
    fireEvent.change(keywordInput(), { target: { value: 'k' } });
    fireEvent.click(submitBtn());
    expect(onScrape.mock.calls[0][1].categories).toEqual(['sport']);
  });

  it('FE-17: empty available categories clears the stale selection and blocks submit', () => {
    const onScrape = vi.fn();
    renderWithProviders(<Harness initial={DEFAULT_CATEGORIES} onScrape={onScrape} />);
    fireEvent.click(screen.getByText('empty'));
    fireEvent.change(keywordInput(), { target: { value: 'k' } });
    expect(submitBtn()).toBeDisabled();
    fireEvent.submit(keywordInput().closest('form'));
    expect(onScrape).not.toHaveBeenCalled();
    expect(screen.getByText(en.selectCategories)).toBeInTheDocument();
  });

  it('renders without availableCategories prop without looping', () => {
    renderWithProviders(<SearchBar onScrape={() => {}} />);
    expect(screen.getByText(en.selectCategories)).toBeInTheDocument();
  });
});

describe('site lists', () => {
  it('toggle calls onSiteListsChange and submits the selection', () => {
    const { onScrape, onSiteListsChange } = setup();
    openLists();
    fireEvent.click(screen.getByText('Gulf Agencies'));
    expect(onSiteListsChange).toHaveBeenLastCalledWith(['gulf_agencies']);
    fireEvent.click(screen.getAllByText('Arabic Sites').at(-1));
    expect(onSiteListsChange).toHaveBeenLastCalledWith(['gulf_agencies', 'arabic_sites']);
    fireEvent.click(screen.getAllByText('Gulf Agencies').at(-1));
    expect(onSiteListsChange).toHaveBeenLastCalledWith(['arabic_sites']);
    fireEvent.change(keywordInput(), { target: { value: 'k' } });
    fireEvent.click(submitBtn());
    expect(onScrape.mock.calls[0][1].siteLists).toEqual(['arabic_sites']);
  });

  it('no site lists -> dash placeholder in the dropdown', () => {
    setup({ siteLists: [] });
    openLists();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('Arabic UI', () => {
  it('labels are Arabic', () => {
    setup({ lang: 'ar' });
    expect(screen.getByText(translations.ar.scrapeAnalyze)).toBeInTheDocument();
    expect(screen.getByText('عام')).toBeInTheDocument();
  });
});
