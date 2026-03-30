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
    articlesFound = Object.values(mission.site_stats).reduce((sum, s) => sum + (s.before || 0), 0);
  }

  const relevantMatches = mission?.ai_filter?.after ?? mission?.total_results ?? 0;

  let processingTime = '--';
  if (mission?.created_at && mission?.completed_at) {
    const ms = new Date(mission.completed_at).getTime() - new Date(mission.created_at).getTime();
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    processingTime = mins > 0 ? `${mins}m ${remSecs}s` : `${secs}s`;
  } else if (mission && !['completed', 'failed'].includes(mission.status)) {
    processingTime = t('inProgress');
  }

  const stats = [
    { icon: FileText, label: t('articlesFound'), value: articlesFound.toLocaleString(), color: 'text-accent-green', bg: 'bg-accent-green/10', glow: 'group-hover:shadow-[0_0_20px_rgba(200,245,66,0.15)]' },
    { icon: Filter, label: t('relevantMatches'), value: String(relevantMatches), color: 'text-yellow-400', bg: 'bg-yellow-400/10', glow: 'group-hover:shadow-[0_0_20px_rgba(250,204,21,0.15)]' },
    { icon: Clock, label: t('processingTime'), value: processingTime, color: 'text-accent-purple', bg: 'bg-accent-purple/10', glow: 'group-hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {stats.map(({ icon: Icon, label, value, color, bg, glow }, i) => (
        <motion.div
          key={label}
          className={`group bg-dark-card border border-dark-border rounded-2xl p-4 flex items-center gap-4 hover:border-dark-card-hover transition-all duration-300 cursor-default ${glow}`}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          whileHover={{ y: -2 }}
        >
          <motion.div
            className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.4 }}
          >
            <Icon className={`w-5 h-5 ${color}`} />
          </motion.div>
          <div>
            <p className="text-xs text-text-secondary">{label}</p>
            <p className="text-xl font-bold text-text-primary">{value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
