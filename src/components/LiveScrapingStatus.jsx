import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle, Circle } from 'lucide-react';
import { useLang } from '../context/LangContext';

export default function LiveScrapingStatus({ mission }) {
  const { t } = useLang();

  const progress = mission?.progress || {};
  const total = progress.total || 0;
  const done = progress.done || 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const isActive = mission && ['pending', 'scraping', 'filtering'].includes(mission.status);

  let sourceStatuses = [];

  if (mission?.status === 'completed' && mission?.site_stats) {
    sourceStatuses = Object.keys(mission.site_stats).map((name) => ({ name, status: 'done' }));
  } else if (isActive && mission?.progress) {
    const currentSite = progress.current_site;
    if (currentSite) sourceStatuses.push({ name: currentSite, status: 'extracting' });
    if (mission.site_stats) {
      Object.keys(mission.site_stats).forEach((name) => {
        if (name !== currentSite) sourceStatuses.push({ name, status: 'done' });
      });
    }
  } else if (mission?.status === 'failed') {
    if (mission.site_stats) {
      sourceStatuses = Object.keys(mission.site_stats).map((name) => ({ name, status: 'done' }));
    }
    if (progress.current_site) sourceStatuses.push({ name: progress.current_site, status: 'error' });
  }

  let statusText = t('liveScrapingStatus');
  if (mission?.status === 'filtering') statusText = t('aiFilteringInProgress');
  else if (mission?.status === 'completed') statusText = t('scrapingComplete');
  else if (mission?.status === 'failed') statusText = t('scrapingFailed');

  const displayPercent = mission?.status === 'completed' ? 100 : percent;

  const getStatusLabel = (name, status) => {
    const labels = { done: t('done'), extracting: t('extracting'), error: t('failed'), pending: t('pending') };
    return `${name} (${labels[status] || labels.pending})`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-4 h-4 text-accent-green" />;
      case 'extracting': return <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />;
      case 'error': return <XCircle className="w-4 h-4 text-accent-red" />;
      default: return <Circle className="w-4 h-4 text-text-muted" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'done': return 'text-accent-green';
      case 'extracting': return 'text-accent-blue';
      case 'error': return 'text-accent-red';
      default: return 'text-text-muted';
    }
  };

  return (
    <motion.div
      className="bg-dark-card border border-dark-border rounded-2xl p-5 hover:border-dark-card-hover transition-colors duration-300"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            isActive ? 'bg-accent-green animate-pulse'
              : mission?.status === 'completed' ? 'bg-accent-green'
              : mission?.status === 'failed' ? 'bg-accent-red'
              : 'bg-text-muted'
          }`} />
          <span className="text-sm font-semibold text-text-primary">{statusText}</span>
        </div>
        {displayPercent > 0 && (
          <span className="text-sm text-text-secondary">
            {displayPercent}% {t('complete')}
          </span>
        )}
      </div>

      <div className="w-full h-2.5 bg-dark-border rounded-full overflow-hidden mb-4">
        <motion.div
          className={`h-full rounded-full ${
            mission?.status === 'failed' ? 'bg-accent-red' : 'bg-gradient-to-r from-accent-green to-accent-cyan'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${displayPercent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <AnimatePresence>
        {sourceStatuses.length > 0 && (
          <motion.div className="flex items-center gap-6 flex-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            {sourceStatuses.map(({ name, status }, i) => (
              <motion.div key={name} className="flex items-center gap-2" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                {getStatusIcon(status)}
                <span className={`text-sm ${getStatusColor(status)}`}>{getStatusLabel(name, status)}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {mission?.status === 'failed' && mission?.error && (
        <motion.p className="text-xs text-accent-red mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {mission.error}
        </motion.p>
      )}
    </motion.div>
  );
}
