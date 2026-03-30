import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar, Bot, Sparkles, X, Plus, FileText, Info } from 'lucide-react';
import { useLang } from '../context/LangContext';

const MAX_KEYWORDS = 3;

export default function SearchBar({ onScrape, loading }) {
  const { t } = useLang();
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [text, setText] = useState('');
  const [dateFilter, setDateFilter] = useState('none');
  const inputRef = useRef(null);

  const dateOptions = [
    { value: 'none', label: t('allTime') },
    { value: '24h', label: t('last24h') },
    { value: '48h', label: t('last48h') },
    { value: 'week', label: t('last7d') },
    { value: 'month', label: t('last30d') },
  ];

  const addKeyword = (raw) => {
    const word = raw.trim();
    if (!word || keywords.length >= MAX_KEYWORDS) return;
    if (keywords.includes(word)) return;
    setKeywords([...keywords, word]);
    setKeywordInput('');
  };

  const removeKeyword = (index) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword(keywordInput);
    }
    if (e.key === ',' ) {
      e.preventDefault();
      addKeyword(keywordInput);
    }
    if (e.key === 'Backspace' && !keywordInput && keywords.length > 0) {
      removeKeyword(keywords.length - 1);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val.includes(',')) {
      const parts = val.split(',');
      parts.forEach((p) => addKeyword(p));
      return;
    }
    setKeywordInput(val);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Add any pending input as keyword
    if (keywordInput.trim()) addKeyword(keywordInput);

    const finalKeywords = keywordInput.trim()
      ? [...keywords, keywordInput.trim()]
      : keywords;

    if (finalKeywords.length === 0 || !text.trim() || loading) return;

    const keywordStr = finalKeywords.join('، ');
    onScrape(keywordStr, text.trim(), dateFilter);
  };

  const canSubmit = (keywords.length > 0 || keywordInput.trim()) && text.trim() && !loading;

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="bg-dark-card rounded-2xl border border-dark-border p-4 sm:p-5 hover:border-dark-card-hover transition-colors duration-300"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="space-y-4">
        {/* Keywords */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-accent-green" />
              {t('keywordsLabel')}
            </label>
            <span className={`text-[11px] ${keywords.length >= MAX_KEYWORDS ? 'text-accent-red' : 'text-text-muted'}`}>
              {keywords.length}/{MAX_KEYWORDS}
            </span>
          </div>

          <div
            className="flex flex-wrap items-center gap-2 bg-dark-input border border-dark-border rounded-lg px-3 py-2 focus-within:border-accent-green/50 focus-within:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all cursor-text min-h-[42px]"
            onClick={() => inputRef.current?.focus()}
          >
            <AnimatePresence>
              {keywords.map((kw, i) => (
                <motion.span
                  key={kw}
                  className="flex items-center gap-1 bg-accent-green/15 text-accent-green text-xs font-medium px-2.5 py-1 rounded-full"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  {kw}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeKeyword(i); }}
                    className="hover:text-accent-red transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>

            {keywords.length < MAX_KEYWORDS && (
              <input
                ref={inputRef}
                type="text"
                value={keywordInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={keywords.length === 0 ? t('keywordsPlaceholder') : ''}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            )}
          </div>

          <p className="text-[11px] text-text-muted mt-1.5 flex items-center gap-1">
            <Info className="w-3 h-3 flex-shrink-0" />
            {keywords.length >= MAX_KEYWORDS ? t('maxKeywords') : t('keywordsHint')}
          </p>
        </div>

        {/* Article Text */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3 h-3 text-accent-blue" />
            {t('articleText')}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('articleTextPlaceholder')}
            rows={3}
            className="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all resize-none"
          />
          <p className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
            <Info className="w-3 h-3 flex-shrink-0" />
            {t('articleTextHint')}
          </p>
        </div>

        {/* Date + Submit row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 sm:max-w-[200px]">
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
