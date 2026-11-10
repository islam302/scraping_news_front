import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import StatsCards from '../components/StatsCards';
import LiveScrapingStatus from '../components/LiveScrapingStatus';
import ExportButtons from '../components/ExportButtons';
import AnalyzedReports from '../components/AnalyzedReports';
import { useMission } from '../hooks/useMission';
import { getCategories } from '../services/api';
import { DEFAULT_CATEGORIES, categoryLabel } from '../i18n/translations';
import { useLang } from '../context/LangContext';

export default function Dashboard() {
  const { mission, loading, error, skippedCategories, scrape } = useMission();
  const { t, lang } = useLang();
  const results = mission?.results || [];

  // Seed with the canonical list so the picker is always populated; API
  // discovery refines it if the backend returns a non-empty set.
  const [availableCategories, setAvailableCategories] = useState(DEFAULT_CATEGORIES);
  const [siteLists, setSiteLists] = useState([]);
  // Backend caps categories per search (MAX_CATEGORIES_PER_REQUEST); 5 until discovery says otherwise.
  const [maxCategories, setMaxCategories] = useState(5);

  useEffect(() => {
    getCategories()
      .then((data) => {
        if (data.available_categories?.length) setAvailableCategories(data.available_categories);
        setSiteLists(data.site_lists || []);
        if (Number(data.max_categories_per_request) > 0) setMaxCategories(Number(data.max_categories_per_request));
      })
      .catch(() => { /* discovery is best-effort; the canonical fallback stays */ });
  }, []);

  // Categories depend on the chosen site lists (e.g. the Gulf agencies have no
  // "security" section). Re-ask the backend whenever the selection changes so
  // the picker only offers categories that will actually be searched.
  const listsRequest = useRef(0);
  const handleSiteListsChange = (lists) => {
    const reqId = ++listsRequest.current;
    getCategories({ siteLists: lists })
      .then((data) => {
        if (reqId !== listsRequest.current) return; // a newer selection won
        setAvailableCategories(data.available_categories || []);
      })
      .catch(() => { /* keep the current list; the backend still skips unknown ones */ });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="hidden lg:block">
        <Header breadcrumbs={[t('dashboard'), t('liveScraping')]} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <SearchBar
            onScrape={scrape}
            loading={loading}
            availableCategories={availableCategories}
            siteLists={siteLists}
            maxCategories={maxCategories}
            onSiteListsChange={handleSiteListsChange}
          />
          <StatsCards mission={mission} />

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-start">
            <div className="flex-1">
              <LiveScrapingStatus mission={mission} />
            </div>
            <ExportButtons mission={mission} />
          </div>

          {skippedCategories.length > 0 && (
            <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-xl p-4 text-sm text-accent-cyan">
              {t('categoriesSkipped').replace(
                '{list}', skippedCategories.map((c) => categoryLabel(c, lang)).join('، '),
              )}
            </div>
          )}

          {error && (
            <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-4 text-sm text-accent-red">
              {error}
            </div>
          )}

          <AnalyzedReports results={results} />
        </div>
      </div>
    </div>
  );
}
