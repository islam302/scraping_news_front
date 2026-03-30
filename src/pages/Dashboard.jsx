import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import StatsCards from '../components/StatsCards';
import LiveScrapingStatus from '../components/LiveScrapingStatus';
import ExportButtons from '../components/ExportButtons';
import AnalyzedReports from '../components/AnalyzedReports';
import { useMission } from '../hooks/useMission';
import { useLang } from '../context/LangContext';

export default function Dashboard() {
  const { mission, loading, error, scrape } = useMission();
  const { t } = useLang();
  const results = mission?.results || [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="hidden lg:block">
        <Header breadcrumbs={[t('dashboard'), t('liveScraping')]} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <SearchBar onScrape={scrape} loading={loading} />
          <StatsCards mission={mission} />

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-start">
            <div className="flex-1">
              <LiveScrapingStatus mission={mission} />
            </div>
            <ExportButtons mission={mission} />
          </div>

          {error && (
            <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-4 text-sm text-accent-red">
              {t('scrapingFailedMsg')}
            </div>
          )}

          <AnalyzedReports results={results} />
        </div>
      </div>
    </div>
  );
}
