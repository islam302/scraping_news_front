import { motion } from 'framer-motion';
import { FileText, Filter, Clock } from 'lucide-react';
import { useLang } from '../context/LangContext';

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: 0.1 + i * 0.08, duration: 0.4, ease: 'easeOut' },
  }),
};

export default function StatsCards({ mission }) {
  const { t } = useLang();

  let articlesFound = 0;
  if (mission?.ai_filter?.before) {
    articlesFound = mission.ai_filter.before;
  } else if (mission?.site_stats) {
    articlesFound = Object.values(mission.site_stats).reduce(
      (sum, s) => sum + (s && typeof s === 'object' && !Array.isArray(s) ? Number(s.before) || 0 : 0),
      0,
    );
  }

  const relevantMatches = mission?.ai_filter?.after ?? mission?.total_results ?? 0;

  let processingTime = '--';
  if (mission?.created_at && mission?.completed_at) {
    const ms = new Date(mission.completed_at).getTime() - new Date(mission.created_at).getTime();
    const secs = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    processingTime = mins > 0 ? `${mins}m ${remSecs}s` : `${secs}s`;
  } else if (mission && !['completed', 'failed'].includes(mission.status)) {
    processingTime = t('inProgress');
  }

  const stats = [
    { icon: FileText, label: t('articlesFound'), value: articlesFound.toLocaleString(), color: 'text-accent-green', bg: 'bg-accent-green/10', bar: 'bg-accent-green' },
    { icon: Filter, label: t('relevantMatches'), value: String(relevantMatches), color: 'text-amber-500', bg: 'bg-amber-500/10', bar: 'bg-amber-500' },
    { icon: Clock, label: t('processingTime'), value: processingTime, color: 'text-accent-purple', bg: 'bg-accent-purple/10', bar: 'bg-accent-purple' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {stats.map(({ icon: Icon, label, value, color, bg, bar }, i) => (
        <motion.div
          key={label}
          className="group relative overflow-hidden bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-5 flex items-center gap-4 hover:border-accent-green/25 transition-colors duration-300 cursor-default"
          custom={i}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          whileHover={{ y: -2 }}
        >
          <span className={`absolute inset-y-0 start-0 w-1 ${bar} opacity-80`} />
          <motion.div
            className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center flex-shrink-0`}
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.4 }}
          >
            <Icon className={`w-5 h-5 ${color}`} />
          </motion.div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-secondary">{label}</p>
            <p className="text-2xl font-extrabold tracking-tight text-text-primary tabular-nums">{value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
