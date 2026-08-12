import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar, Bot, Sparkles, Globe, Layers, Check, ChevronDown, FileStack } from 'lucide-react';
import { useLang } from '../context/LangContext';

// Compact multi-select dropdown used for categories + site lists.
function MultiSelect({ label, icon: Icon, iconColor, placeholder, options, selected, onToggle, formatOption }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-1">
      <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
        <Icon className={`w-3 h-3 ${iconColor}`} />
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-dark-input border border-dark-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all"
      >
        <span className={`truncate ${selected.length === 0 ? 'text-text-muted' : ''}`}>
          {selected.length === 0
            ? placeholder
            : selected.map((v) => (formatOption ? formatOption(v) : v)).join(', ')}
        </span>
        <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute z-20 top-full mt-1 w-full max-h-64 overflow-y-auto bg-dark-card border border-dark-border rounded-lg shadow-xl shadow-black/30"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {options.length === 0 ? (
              <p className="px-4 py-3 text-xs text-text-muted">—</p>
            ) : (
              options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onToggle(opt)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-start ${
                      isSelected ? 'bg-accent-green/10 text-accent-green' : 'text-text-primary hover:bg-dark-card-hover'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected ? 'bg-accent-green border-accent-green' : 'border-text-muted/40'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-dark-bg" />}
                    </div>
                    <span className="truncate">{formatOption ? formatOption(opt) : opt}</span>
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
    </div>
  );
}

export default function SearchBar({
  onScrape,
  loading,
  availableCategories = [],
  siteLists = [],
  allToken = 'all',
}) {
  const { t } = useLang();
  const [keyword, setKeyword] = useState('');
  const [categories, setCategories] = useState(['general']);
  const [selectedLists, setSelectedLists] = useState([]);
  const [maxDays, setMaxDays] = useState(7);
  const [maxPages, setMaxPages] = useState(300);
  const [aiFilter, setAiFilter] = useState(true);

  // Category options: the "all" token first, then every discovered key.
  const categoryOptions = [allToken, ...availableCategories.filter((c) => c !== allToken)];

  const toggleCategory = (key) => {
    if (key === allToken) {
      // "all" is exclusive — picking it clears everything else.
      setCategories((prev) => (prev.includes(allToken) ? [] : [allToken]));
      return;
    }
    setCategories((prev) => {
      const withoutAll = prev.filter((c) => c !== allToken);
      return withoutAll.includes(key)
        ? withoutAll.filter((c) => c !== key)
        : [...withoutAll, key];
    });
  };

  const toggleList = (name) => {
    setSelectedLists((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!keyword.trim() || loading) return;
    const cats = categories.length > 0 ? categories : ['general'];
    onScrape(keyword.trim(), {
      categories: cats,
      siteLists: selectedLists,
      maxDays: Math.min(Math.max(Number(maxDays) || 1, 1), 30),
      maxPages: Math.min(Math.max(Number(maxPages) || 1, 1), 300),
      aiFilter,
    });
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

        {/* Categories + Site Lists */}
        <div className="flex flex-col sm:flex-row gap-3">
          <MultiSelect
            label={t('categoriesLabel')}
            icon={Layers}
            iconColor="text-accent-green"
            placeholder={t('selectCategories')}
            options={categoryOptions}
            selected={categories}
            onToggle={toggleCategory}
            formatOption={(v) => (v === allToken ? t('allCategories') : v)}
          />
          <MultiSelect
            label={t('siteListLabel')}
            icon={Globe}
            iconColor="text-accent-cyan"
            placeholder={t('siteListAll')}
            options={siteLists}
            selected={selectedLists}
            onToggle={toggleList}
          />
        </div>

        {/* Max Days + Max Pages + AI Filter + Submit */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          {/* Max Days */}
          <div className="flex-1 sm:max-w-[130px]">
            <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-accent-purple" />
              {t('maxDaysLabel')}
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={maxDays}
              onChange={(e) => setMaxDays(e.target.value)}
              className="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all"
            />
          </div>

          {/* Max Pages */}
          <div className="flex-1 sm:max-w-[130px]">
            <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
              <FileStack className="w-3 h-3 text-accent-blue" />
              {t('maxPagesLabel')}
            </label>
            <input
              type="number"
              min="1"
              max="300"
              value={maxPages}
              onChange={(e) => setMaxPages(e.target.value)}
              className="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all"
            />
          </div>

          {/* AI Filter toggle */}
          <div className="sm:pb-1">
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">{t('aiFilterLabel')}</label>
            <button
              type="button"
              onClick={() => setAiFilter((v) => !v)}
              role="switch"
              aria-checked={aiFilter}
              className={`relative w-12 h-7 rounded-full transition-colors ${aiFilter ? 'bg-accent-green' : 'bg-dark-border'}`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${aiFilter ? 'start-6' : 'start-1'}`}
              />
            </button>
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
