import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, Bot, Sparkles } from 'lucide-react';
import { useLang } from '../context/LangContext';

export default function SearchBar({ onScrape, loading }) {
  const { t } = useLang();
  const [keyword, setKeyword] = useState('');
  const [dateFilter, setDateFilter] = useState('none');

  const dateOptions = [
    { value: 'none', label: t('allTime') },
    { value: '24h', label: t('last24h') },
    { value: '48h', label: t('last48h') },
    { value: 'week', label: t('last7d') },
    { value: 'month', label: t('last30d') },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (keyword.trim() && !loading) {
      onScrape(keyword.trim(), dateFilter);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="bg-dark-card rounded-2xl border border-dark-border p-4 sm:p-5 hover:border-dark-card-hover transition-colors duration-300"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-accent-green" />
            {t('keywordsQuery')}
          </label>
          <div className="relative group">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-green transition-colors" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-dark-input border border-dark-border rounded-lg ps-10 pe-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 sm:flex-none">
            <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-accent-blue" />
              {t('dateRange')}
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full appearance-none bg-dark-input border border-dark-border rounded-lg px-4 pe-10 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all cursor-pointer sm:min-w-[170px]"
            >
              {dateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <motion.button
              type="submit"
              disabled={loading || !keyword.trim()}
              className="flex items-center gap-2 bg-accent-green text-dark-bg font-semibold px-4 sm:px-6 py-2.5 rounded-lg text-sm hover:shadow-[0_0_20px_rgba(200,245,66,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none whitespace-nowrap"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Bot className="w-4 h-4" />
                </motion.div>
              ) : (
                <Bot className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{loading ? t('scraping') : t('scrapeAnalyze')}</span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.form>
  );
}
