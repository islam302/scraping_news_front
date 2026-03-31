import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar, Bot, Sparkles, Globe, Check, ChevronDown } from 'lucide-react';
import { useLang } from '../context/LangContext';

export default function SearchBar({ onScrape, loading, siteLists = [] }) {
  const { t } = useLang();
  const [keyword, setKeyword] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedLists, setSelectedLists] = useState([]);
  const [listOpen, setListOpen] = useState(false);

  // Deduplicate site lists by name
  const uniqueLists = [...new Map(siteLists.map((l) => [l.name, l])).values()];

  const dateOptions = [
    { value: '', label: t('noFilter') },
    { value: '24h', label: t('last24h') },
    { value: '48h', label: t('last48h') },
    { value: 'week', label: t('last7d') },
    { value: 'month', label: t('last30d') },
  ];

  const toggleList = (name) => {
    setSelectedLists((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (keyword.trim() && !loading) {
      onScrape(keyword.trim(), dateFilter, selectedLists);
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

        {/* Site Lists + Date + Submit row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          {/* Site Lists dropdown */}
          {uniqueLists.length > 0 && (
            <div className="relative flex-1 sm:max-w-[240px]">
              <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-accent-cyan" />
                {t('siteListLabel')}
              </label>
              <button
                type="button"
                onClick={() => setListOpen(!listOpen)}
                className="w-full flex items-center justify-between bg-dark-input border border-dark-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all"
              >
                <span className={selectedLists.length === 0 ? 'text-text-muted' : ''}>
                  {selectedLists.length === 0
                    ? t('siteListAll')
                    : selectedLists.join(', ')}
                </span>
                <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${listOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {listOpen && (
                  <motion.div
                    className="absolute z-20 top-full mt-1 w-full bg-dark-card border border-dark-border rounded-lg shadow-xl shadow-black/30 overflow-hidden"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                  >
                    {uniqueLists.map((list) => {
                      const isSelected = selectedLists.includes(list.name);
                      return (
                        <button
                          key={list.name}
                          type="button"
                          onClick={() => toggleList(list.name)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-start ${
                            isSelected
                              ? 'bg-accent-green/10 text-accent-green'
                              : 'text-text-primary hover:bg-dark-card-hover'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            isSelected ? 'bg-accent-green border-accent-green' : 'border-text-muted/40'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-dark-bg" />}
                          </div>
                          <span className="truncate">{list.name}</span>
                          <span className="text-text-muted text-xs ms-auto">{list.site_count}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Close dropdown when clicking outside */}
              {listOpen && (
                <div className="fixed inset-0 z-10" onClick={() => setListOpen(false)} />
              )}
            </div>
          )}

          {/* Date */}
          <div className="flex-1 sm:max-w-[180px]">
            <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-accent-purple" />
              {t('dateRange')}
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full appearance-none bg-dark-input border border-dark-border rounded-lg px-4 pe-10 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all cursor-pointer"
            >
              {dateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
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
