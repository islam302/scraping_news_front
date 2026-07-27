import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, Bot, Sparkles } from 'lucide-react';
import { useLang } from '../context/LangContext';

export default function SearchBar({ onScrape, loading }) {
  const { t } = useLang();
  const [keyword, setKeyword] = useState('');
  const [maxDays, setMaxDays] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (keyword.trim() && !loading) {
      const days = Math.min(Math.max(Number(maxDays) || 1, 1), 3);
      onScrape(keyword.trim(), { maxDays: days });
    }
  };

  const canSubmit = keyword.trim() && !loading;

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="bg-dark-card rounded-2xl border border-dark-border p-4 sm:p-5 hover:border-dark-card-hover transition-colors duration-300"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="space-y-4">
        {/* Keyword */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-accent-green" />
            {t('keywordsLabel')}
          </label>
          <div className="relative group">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-green transition-colors" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('keywordsPlaceholder')}
              className="w-full bg-dark-input border border-dark-border rounded-lg ps-10 pe-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all"
            />
          </div>
        </div>

        {/* Max Days + Submit row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          {/* Max Days */}
          <div className="flex-1 sm:max-w-[180px]">
            <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-accent-purple" />
              {t('maxDaysLabel')}
            </label>
            <input
              type="number"
              min="1"
              max="3"
              value={maxDays}
              onChange={(e) => setMaxDays(e.target.value)}
              className="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all"
            />
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center justify-center gap-2 bg-accent-green text-dark-bg font-semibold px-6 py-2.5 rounded-lg text-sm hover:shadow-[0_0_20px_rgba(200,245,66,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none sm:ms-auto"
            whileHover={canSubmit ? { scale: 1.02 } : {}}
            whileTap={canSubmit ? { scale: 0.97 } : {}}
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Bot className="w-4 h-4" />
              </motion.div>
            ) : (
              <Bot className="w-4 h-4" />
            )}
            {loading ? t('scraping') : t('scrapeAnalyze')}
          </motion.button>
        </div>
      </div>
    </motion.form>
  );
}
