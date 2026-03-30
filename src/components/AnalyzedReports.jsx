import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, LayoutGrid, ExternalLink, FileText } from 'lucide-react';
import { useLang } from '../context/LangContext';

function ReportCard({ result, index }) {
  return (
    <motion.div
      className="bg-dark-card border border-dark-border rounded-2xl p-4 hover:border-accent-green/20 hover:shadow-[0_0_20px_rgba(200,245,66,0.06)] transition-all duration-300 group"
      initial={{ opacity: 0, y: 15, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      whileHover={{ y: -3 }}
    >
      <h3 className="text-sm font-semibold text-text-primary mb-1 line-clamp-2 group-hover:text-accent-green transition-colors duration-200">
        {result.Title}
      </h3>
      <p className="text-xs text-text-secondary mb-3 line-clamp-2">{result.Paragraph}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-dark-bg bg-accent-green/80 px-1.5 py-0.5 rounded font-medium">{result.Site}</span>
          <span className="text-xs text-text-muted">{result.Date}</span>
        </div>
        {result.Link && (
          <a href={result.Link} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent-blue transition-colors duration-200">
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </motion.div>
  );
}

function ReportListItem({ result, index }) {
  return (
    <motion.div
      className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center justify-between gap-4 hover:border-accent-green/20 hover:shadow-[0_0_15px_rgba(200,245,66,0.05)] transition-all duration-300 group"
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-text-primary truncate group-hover:text-accent-green transition-colors duration-200">{result.Title}</h3>
        <p className="text-xs text-text-secondary truncate">{result.Paragraph}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-dark-bg bg-accent-green/80 px-1.5 py-0.5 rounded font-medium">{result.Site}</span>
          <span className="text-xs text-text-muted">{result.Date}</span>
        </div>
      </div>
      {result.Link && (
        <a href={result.Link} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent-blue transition-colors duration-200 flex-shrink-0">
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </motion.div>
  );
}

export default function AnalyzedReports({ results = [] }) {
  const { t } = useLang();
  const [viewMode, setViewMode] = useState('grid');

  if (results.length === 0) {
    return (
      <motion.div className="text-center py-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: 'spring', stiffness: 150 }}>
          <FileText className="w-12 h-12 text-text-muted/40 mx-auto mb-3" />
        </motion.div>
        <p className="text-text-secondary text-sm">{t('noResultsYet')}</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-text-primary">
          {t('results')} <span className="text-text-muted font-normal text-sm">({results.length})</span>
        </h2>
        <div className="flex bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-all duration-200 ${viewMode === 'list' ? 'bg-accent-green/10 text-accent-green' : 'text-text-muted hover:text-text-secondary'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 transition-all duration-200 ${viewMode === 'grid' ? 'bg-accent-green/10 text-accent-green' : 'text-text-muted hover:text-text-secondary'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div key="grid" className="grid grid-cols-2 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {results.map((result, i) => <ReportCard key={i} result={result} index={i} />)}
          </motion.div>
        ) : (
          <motion.div key="list" className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {results.map((result, i) => <ReportListItem key={i} result={result} index={i} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
