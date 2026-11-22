import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../components/Header';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { getMissionStatus, getDownloadUrl, downloadFile } from '../services/api';
import { useLang } from '../context/LangContext';
import { categoryLabel } from '../i18n/translations';
import { formatError, isRetriableError, getRetryAfterSeconds } from '../utils/errors';
import { formatDate, statusLabel } from '../utils/format';
import { safeHttpUrl, safeDownloadUrl } from '../utils/url';

const POLL_INTERVAL = 3000;
const MAX_POLL_BACKOFF = 30000;
const ACTIVE = ['pending', 'scraping', 'filtering'];

function StatusIcon({ status }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-5 h-5 text-accent-green" />;
    case 'failed': return <XCircle className="w-5 h-5 text-accent-red" />;
    case 'scraping': case 'filtering': return <Loader2 className="w-5 h-5 text-accent-blue animate-spin" />;
    default: return <Clock className="w-5 h-5 text-text-muted" />;
  }
}

function statusColor(status) {
  switch (status) {
    case 'completed': return 'text-accent-green bg-accent-green/10';
    case 'failed': return 'text-accent-red bg-accent-red/10';
    case 'scraping': case 'filtering': return 'text-accent-blue bg-accent-blue/10';
    default: return 'text-text-muted bg-dark-card-hover';
  }
}

export default function MissionDetail() {
  const { missionId } = useParams();
  const navigate = useNavigate();
  const { t, isRTL, lang } = useLang();
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  // Load + poll the mission. Everything is scoped to this effect run: a
  // `cancelled` flag drops late responses after the route changes / unmount,
  // and polling is a setTimeout chain (never overlapping requests).
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let failures = 0;

    setMission(null);
    setError(null);
    setLoading(true);

    const schedule = (delay) => {
      if (!cancelled) timer = setTimeout(poll, delay);
    };

    async function poll() {
      timer = null;
      try {
        const updated = await getMissionStatus(missionId);
        if (cancelled) return;
        failures = 0;
        setMission(updated);
        if (ACTIVE.includes(updated?.status)) schedule(POLL_INTERVAL);
      } catch (err) {
        if (cancelled) return;
        if (isRetriableError(err)) {
          // 429 / 5xx / network: keep the last data on screen and back off.
          failures += 1;
          const retryAfter = getRetryAfterSeconds(err);
          schedule(retryAfter != null
            ? Math.max(retryAfter * 1000, POLL_INTERVAL)
            : Math.min(POLL_INTERVAL * 2 ** failures, MAX_POLL_BACKOFF));
          return;
        }
        // 404 (deleted elsewhere) / 401 / 403: stop polling and say why.
        setError(formatError(err, tRef.current, 'errGeneric'));
      }
    }

    (async () => {
      try {
        const data = await getMissionStatus(missionId);
        if (cancelled) return;
        setMission(data);
        setLoading(false);
        if (ACTIVE.includes(data?.status)) schedule(POLL_INTERVAL);
      } catch (err) {
        if (cancelled) return;
        setError(formatError(err, tRef.current, 'errGeneric'));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [missionId]);

  const progress = mission?.progress || {};
  const total = progress.total || 0;
  const done = progress.done || 0;
  const percent = mission?.status === 'completed' ? 100 : total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0;
  const isActive = mission && ['pending', 'scraping', 'filtering'].includes(mission.status);
  const results = mission?.results || [];
  const downloadUrl = safeDownloadUrl(getDownloadUrl(mission?.excel_download));
  const addedCategories = Array.isArray(mission?.site_stats?.categories_added)
    ? mission.site_stats.categories_added
    : [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="hidden lg:block sticky top-0 z-20">
        <Header breadcrumbs={[t('dashboard'), t('tasks'), mission?.keyword || '...']} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Back button */}
        <motion.button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mb-4 sm:mb-5 transition-colors"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ x: isRTL ? 3 : -3 }}
        >
          <BackArrow className="w-4 h-4" />
          {t('tasks')}
        </motion.button>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-text-secondary">
            <Loader2 className="w-5 h-5 animate-spin" /> {t('loadingDetails')}
          </div>
        ) : error ? (
          <motion.div className="max-w-md mx-auto text-center py-20" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <AlertTriangle className="w-12 h-12 text-accent-red/50 mx-auto mb-4" />
            <p className="text-text-secondary">{error}</p>
          </motion.div>
        ) : mission ? (
          <div className="space-y-4 sm:space-y-5">
            {/* Mission header card */}
            <motion.div
              className="bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-6"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                <h2 className="text-base sm:text-lg font-bold text-text-primary break-words">{mission.keyword}</h2>
                <span className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full whitespace-nowrap self-start ${statusColor(mission.status)}`}>
                  <StatusIcon status={mission.status} />
                  {statusLabel(mission.status, t)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs text-text-muted mb-0.5">{t('status')}</p>
                  <p className="text-sm text-text-primary capitalize">{statusLabel(mission.status, t)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-0.5">{t('created')}</p>
                  <p className="text-sm text-text-primary">{formatDate(mission.created_at, lang)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-0.5">{t('completed')}</p>
                  <p className="text-sm text-text-primary">{formatDate(mission.completed_at, lang)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-0.5">{t('results')}</p>
                  <p className="text-sm text-text-primary">{mission.total_results ?? '--'}</p>
                </div>
              </div>

              {addedCategories.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2" title={t('autoAddedCategoriesHint')}>
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Sparkles className="w-3.5 h-3.5 text-accent-cyan" />
                    {t('autoAddedCategories')}:
                  </span>
                  {addedCategories.map((c) => (
                    <span key={c} className="text-xs text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded-full">
                      {categoryLabel(c, lang)}
                    </span>
                  ))}
                </div>
              )}

              {isActive && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-text-secondary truncate">
                      {progress.current_site && `${t('extracting')} ${progress.current_site}`}
                    </span>
                    {percent > 0 && <span className="text-xs text-text-secondary">{percent}%</span>}
                  </div>
                  <div className="w-full h-2 bg-dark-border rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-accent-green to-accent-cyan"
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}

              {mission.status === 'failed' && (
                <div className="mt-4 bg-accent-red/10 border border-accent-red/30 rounded-lg p-3 text-sm text-accent-red">
                  {t('scrapingFailedMsg')}
                </div>
              )}

              {downloadUrl && (
                <motion.button
                  onClick={() => { downloadFile(downloadUrl).catch(() => {}); }}
                  className="mt-4 flex items-center gap-2 bg-accent-green/10 text-accent-green px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-accent-green/20 transition-all duration-300"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Download className="w-4 h-4" />
                  {t('downloadExcel')}
                </motion.button>
              )}
            </motion.div>

            {/* Results */}
            {results.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <h3 className="text-base font-bold text-text-primary mb-3">
                  {t('results')} <span className="text-text-muted font-normal text-sm">({results.length})</span>
                </h3>
                <div className="space-y-2">
                  {results.map((r, i) => {
                    const link = safeHttpUrl(r?.Link);
                    const image = safeHttpUrl(r?.Image);
                    return (
                    <motion.a
                      key={i}
                      href={link || undefined}
                      target={link ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className={`bg-dark-card border border-dark-border rounded-xl p-3 sm:p-4 flex items-start gap-3 sm:gap-4 hover:border-accent-green/20 transition-all duration-200 group block ${link ? 'cursor-pointer' : 'cursor-default'}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      {image && (
                        <div className="w-20 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-dark-border">
                          <img
                            src={image}
                            alt={r.Title}
                            className="w-full h-full object-cover"
                            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium text-text-primary group-hover:text-accent-green transition-colors break-words">
                          {r.Title}
                        </h4>
                        {r.Paragraph && (
                          <p className="text-xs text-text-secondary mt-1 break-words">{r.Paragraph}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-[11px] text-on-accent bg-accent-green/80 px-1.5 py-0.5 rounded font-medium">
                            {typeof r.Site === 'string' ? r.Site.replace(/\s*\(Google\)/gi, '') : ''}
                          </span>
                          {r.Date && <span className="text-xs text-text-muted">{r.Date}</span>}
                        </div>
                      </div>
                      {link && (
                        <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-accent-blue transition-colors flex-shrink-0 mt-1" />
                      )}
                    </motion.a>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
