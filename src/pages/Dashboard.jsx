import { useState, useEffect } from 'react';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import StatsCards from '../components/StatsCards';
import LiveScrapingStatus from '../components/LiveScrapingStatus';
import ExportButtons from '../components/ExportButtons';
import AnalyzedReports from '../components/AnalyzedReports';
import { useMission } from '../hooks/useMission';
import { getCategories } from '../services/api';
import { DEFAULT_CATEGORIES } from '../i18n/translations';
import { useLang } from '../context/LangContext';

export default function Dashboard() {
  const { mission, loading, error, scrape } = useMission();
  const { t } = useLang();
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
          />
          <StatsCards mission={mission} />

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-start">
            <div className="flex-1">
              <LiveScrapingStatus mission={mission} />
            </div>
            <ExportButtons mission={mission} />
          </div>

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
