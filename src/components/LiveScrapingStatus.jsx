import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Circle, Radio, Zap } from 'lucide-react';
import { useLang } from '../context/LangContext';

function PulseRing({ delay = 0 }) {
  return (
    <motion.div
      className="absolute inset-0 rounded-full border border-accent-green/30"
      initial={{ scale: 0.8, opacity: 0.5 }}
      animate={{ scale: 1.8, opacity: 0 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay }}
    />
  );
}

export default function LiveScrapingStatus({ mission }) {
  const { t } = useLang();

  const progress = mission?.progress || {};
  const total = progress.total || 0;
  const done = progress.done || 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const isActive = mission && ['pending', 'scraping', 'filtering'].includes(mission.status);

  let statusText = t('liveScrapingStatus');
  if (mission?.status === 'filtering') statusText = t('aiFilteringInProgress');
  else if (mission?.status === 'completed') statusText = t('scrapingComplete');
  else if (mission?.status === 'failed') statusText = t('scrapingFailed');

  const displayPercent = mission?.status === 'completed' ? 100 : percent;

  return (
    <motion.div
      className="bg-dark-card border border-dark-border rounded-2xl p-5 hover:border-dark-card-hover transition-colors duration-300 relative overflow-hidden"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      {/* Animated background glow when active */}
      {isActive && (
        <>
          <motion.div
            className="absolute -top-20 -end-20 w-40 h-40 rounded-full bg-accent-green/5 blur-[60px]"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-10 -start-10 w-32 h-32 rounded-full bg-accent-cyan/5 blur-[50px]"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {/* Animated radar icon when active */}
            <div className="relative w-6 h-6 flex items-center justify-center">
              {isActive ? (
                <>
                  <PulseRing delay={0} />
                  <PulseRing delay={0.7} />
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Radio className="w-4 h-4 text-accent-green" />
                  </motion.div>
                </>
              ) : mission?.status === 'completed' ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                  <CheckCircle2 className="w-5 h-5 text-accent-green" />
                </motion.div>
              ) : mission?.status === 'failed' ? (
                <XCircle className="w-5 h-5 text-accent-red" />
              ) : (
                <Circle className="w-5 h-5 text-text-muted" />
              )}
            </div>

            <div>
              <span className="text-sm font-semibold text-text-primary">{statusText}</span>
              {isActive && progress.current_site && (
                <motion.p
                  className="text-xs text-accent-blue"
                  key={progress.current_site}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Zap className="w-3 h-3 inline-block me-1" />
                  {progress.current_site}
                </motion.p>
              )}
            </div>
          </div>

          {displayPercent > 0 && (
            <motion.span
              className="text-sm font-mono text-text-secondary"
              key={displayPercent}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {displayPercent}%
            </motion.span>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-dark-border rounded-full overflow-hidden mb-4 relative">
          <motion.div
            className={`h-full rounded-full relative ${
              mission?.status === 'failed' ? 'bg-accent-red' : 'bg-gradient-to-r from-accent-green to-accent-cyan'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${displayPercent}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {/* Shimmer effect on active bar */}
            {isActive && displayPercent > 0 && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </motion.div>

          {/* Dots for inactive state */}
          {!mission && (
            <div className="absolute inset-0 flex items-center justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 h-1 rounded-full bg-text-muted/30"
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}
            </div>
          )}
        </div>


        {/* Error message — user-friendly only */}
        {mission?.status === 'failed' && (
          <motion.div
            className="mt-3 bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2.5 text-sm text-accent-red flex items-center gap-2"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <XCircle className="w-4 h-4 flex-shrink-0" />
            {t('scrapingFailedMsg')}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
