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
    <div className="flex-1 flex flex-col min-h-screen">
      <Header breadcrumbs={[t('dashboard'), t('liveScraping')]} />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5">
          <SearchBar onScrape={scrape} loading={loading} />
          <StatsCards mission={mission} />

          <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
            <LiveScrapingStatus mission={mission} />
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
