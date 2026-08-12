import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../components/Header';
import {
  Globe,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  List as ListIcon,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import {
  getCategorySites,
  getCategorySiteLists,
  createCategorySite,
  updateCategorySite,
  deleteCategorySite,
} from '../services/api';
import { useLang } from '../context/LangContext';
import { siteListLabel } from '../i18n/translations';
import { formatError } from '../utils/errors';

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.3 } }),
};

export default function Sites() {
  const { t } = useLang();
  const [tab, setTab] = useState('sites');
  const [sites, setSites] = useState([]);
  const [siteLists, setSiteLists] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Only apply the response from the LATEST request (guards against stale overwrites).
  const sitesReqId = useRef(0);
  const listsReqId = useRef(0);

  const reloadSites = useCallback(() => {
    setLoadingSites(true);
    const id = ++sitesReqId.current;
    return getCategorySites()
      .then((data) => { if (id === sitesReqId.current) setSites(data.sites || []); })
      .catch((err) => { if (id === sitesReqId.current) setLoadError(formatError(err, t, 'errLoadSites')); })
      .finally(() => { if (id === sitesReqId.current) setLoadingSites(false); });
  }, [t]);

  const reloadLists = useCallback(() => {
    setLoadingLists(true);
    const id = ++listsReqId.current;
    return getCategorySiteLists()
      .then((data) => { if (id === listsReqId.current) setSiteLists(data.site_lists || []); })
      .catch((err) => { if (id === listsReqId.current) setLoadError(formatError(err, t, 'errLoadSites')); })
      .finally(() => { if (id === listsReqId.current) setLoadingLists(false); });
  }, [t]);

  useEffect(() => {
    reloadSites();
    reloadLists();
  }, [reloadSites, reloadLists]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="hidden lg:block">
        <Header breadcrumbs={[t('dashboard'), t('sites')]} />
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loadError && (
          <div className="mb-4 bg-accent-red/10 border border-accent-red/30 rounded-xl p-3 text-sm text-accent-red">
            {loadError}
          </div>
        )}
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5 sm:mb-6 border-b border-dark-border">
          <TabButton active={tab === 'sites'} onClick={() => setTab('sites')} icon={Globe} label={t('sitesTab')} />
          <TabButton active={tab === 'lists'} onClick={() => setTab('lists')} icon={ListIcon} label={t('siteListsTab')} />
        </div>

        {tab === 'sites' ? (
          <SitesTab
            sites={sites}
            siteLists={siteLists}
            loading={loadingSites}
            t={t}
            onChanged={() => { reloadSites(); reloadLists(); }}
          />
        ) : (
          <ListsTab siteLists={siteLists} sites={sites} loading={loadingLists} t={t} />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active ? 'text-accent-green border-accent-green' : 'text-text-secondary border-transparent hover:text-text-primary'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ============================================================================
// Sites Tab — full CRUD on category sites
// ============================================================================

function SitesTab({ sites, siteLists, loading, t, onChanged }) {
  const [editing, setEditing] = useState(null); // site object, or {} for new
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const knownLists = siteLists.map((l) => l.name);

  const handleDelete = async (site) => {
    if (!window.confirm(`${t('deleteSiteConfirm')}: ${site.name}?`)) return;
    setBusyId(site.id);
    setError(null);
    try {
      await deleteCategorySite(site.id);
      onChanged();
    } catch (err) {
      setError(formatError(err, t, 'failedToSave'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <motion.div
        className="flex items-center justify-between gap-3 mb-5 sm:mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-text-primary">{t('sitesTitle')}</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {sites.length} {sites.length !== 1 ? t('sitesConfigured') : t('siteConfigured')}
          </p>
        </div>
        <motion.button
          onClick={() => setEditing({})}
          className="flex items-center gap-2 bg-accent-green text-dark-bg font-semibold px-4 py-2 rounded-lg text-sm hover:shadow-[0_0_20px_rgba(200,245,66,0.3)] transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('addSite')}</span>
        </motion.button>
      </motion.div>

      {error && (
        <div className="mb-4 bg-accent-red/10 border border-accent-red/30 rounded-xl p-3 text-sm text-accent-red">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('loadingSites')}
        </div>
      ) : sites.length === 0 ? (
        <motion.div className="text-center py-16" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <Globe className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-secondary">{t('noSitesYet')}</p>
        </motion.div>
      ) : (
        <div className="grid gap-2 sm:gap-3">
          {sites.map((site, i) => {
            const isGoogle = site.mode === 'google_search';
            return (
              <motion.div
                key={site.id}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
                className="bg-dark-card border border-dark-border rounded-xl p-3 sm:p-4 flex items-center gap-3 hover:border-accent-green/20 transition-all duration-300"
              >
                <div className="w-9 h-9 bg-accent-blue/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Globe className="w-4 h-4 text-accent-blue" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-text-primary truncate">{site.name}</p>
                    {isGoogle ? (
                      <Badge color="purple">{t('googleOnly')}</Badge>
                    ) : (
                      <Badge color={site.is_active ? 'green' : 'muted'}>
                        {site.is_active ? t('active') : t('inactive')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {(site.site_lists || []).map((l) => (
                      <span key={l} className="text-[11px] text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded">{l}</span>
                    ))}
                    <span className="text-xs text-text-muted">
                      {(site.categories || []).length} {t('categoryCount')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {site.base_url && (
                    <a
                      href={site.base_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={site.base_url}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-accent-blue hover:bg-accent-blue/10 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {!isGoogle && (
                    <IconButton onClick={() => setEditing(site)} label={t('editSite')} icon={Pencil} accent="green" disabled={busyId === site.id} />
                  )}
                  <IconButton onClick={() => handleDelete(site)} label={t('deleteSelected')} icon={Trash2} accent="red" disabled={busyId === site.id} />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <SiteFormModal
            key={editing.id || 'new-site'}
            site={editing}
            knownLists={knownLists}
            t={t}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); onChanged(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Badge({ color, children }) {
  const colors = {
    green: 'text-accent-green bg-accent-green/10',
    purple: 'text-accent-purple bg-accent-purple/10',
    muted: 'text-text-muted bg-dark-card-hover',
  };
  return <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${colors[color] || colors.muted}`}>{children}</span>;
}

function IconButton({ onClick, label, icon: Icon, accent, disabled }) {
  const accents = {
    green: 'text-accent-green hover:bg-accent-green/10',
    red: 'text-accent-red hover:bg-accent-red/10',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${accents[accent] || ''}`}
    >
      {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
    </button>
  );
}

// ============================================================================
// Lists Tab — expandable (lists are derived from each site's membership)
// ============================================================================

function ListsTab({ siteLists, sites, loading, t }) {
  const { lang } = useLang();
  const [openLists, setOpenLists] = useState(() => new Set());

  const toggle = (name) =>
    setOpenLists((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const sitesInList = (name) => sites.filter((s) => (s.site_lists || []).includes(name));

  return (
    <>
      <motion.div className="mb-4" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h2 className="text-lg sm:text-xl font-bold text-text-primary">{t('siteListsTitle')}</h2>
        <p className="text-sm text-text-secondary mt-0.5">{t('listsReadonlyNote')}</p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('loadingSiteLists')}
        </div>
      ) : siteLists.length === 0 ? (
        <motion.div className="text-center py-16" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <ListIcon className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-secondary">{t('noSiteListsYet')}</p>
        </motion.div>
      ) : (
        <div className="grid gap-2 sm:gap-3">
          {siteLists.map((list, i) => {
            const isOpen = openLists.has(list.name);
            const members = sitesInList(list.name);
            return (
              <motion.div
                key={list.name}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
                className="bg-dark-card border border-dark-border rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(list.name)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 p-3 sm:p-4 text-start hover:bg-dark-card-hover transition-colors"
                >
                  <div className="w-9 h-9 bg-accent-cyan/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ListIcon className="w-4 h-4 text-accent-cyan" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{siteListLabel(list.name, lang)}</p>
                    <p className="text-xs text-text-muted">{list.sites} {t('siteCount')}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 border-t border-dark-border space-y-1.5">
                        {members.length === 0 ? (
                          <p className="text-sm text-text-muted py-4 text-center">{t('noSitesInList')}</p>
                        ) : (
                          members.map((site) => (
                            <div key={site.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-dark-card-hover transition-colors">
                              <div className="w-7 h-7 bg-accent-blue/10 rounded-md flex items-center justify-center flex-shrink-0">
                                <Globe className="w-3.5 h-3.5 text-accent-blue" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-text-primary truncate">{site.name}</p>
                                <p className="text-xs text-text-muted">{(site.categories || []).length} {t('categoryCount')}</p>
                              </div>
                              {site.base_url && (
                                <a
                                  href={site.base_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={site.base_url}
                                  className="w-7 h-7 rounded-md flex items-center justify-center text-accent-blue hover:bg-accent-blue/10 transition-all flex-shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ============================================================================
// Site create / edit modal
// ============================================================================

const PAGE_MODES = ['query', 'path', 'none'];

function SiteFormModal({ site, knownLists, t, onClose, onSaved }) {
  const isNew = !site.id;
  const [name, setName] = useState(site.name || '');
  const [baseUrl, setBaseUrl] = useState(site.base_url || '');
  const [siteListsStr, setSiteListsStr] = useState((site.site_lists || []).join(', '));
  const [categories, setCategories] = useState(
    (site.categories || []).map((c) => ({ key: c.key || '', label: c.label || '', url: c.url || '' })),
  );
  const [isActive, setIsActive] = useState(site.is_active ?? true);
  const [js, setJs] = useState(site.js ?? false);
  const [pageMode, setPageMode] = useState(site.page_mode || 'query');
  const [selectors, setSelectors] = useState({
    item: site.selectors?.item || '',
    link: site.selectors?.link || '',
    title: site.selectors?.title || '',
    date: site.selectors?.date || '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const addCategoryRow = () => setCategories((prev) => [...prev, { key: '', label: '', url: '' }]);
  const removeCategoryRow = (idx) => setCategories((prev) => prev.filter((_, i) => i !== idx));
  const updateCategoryRow = (idx, field, value) =>
    setCategories((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim() || !baseUrl.trim()) {
      setError(t('baseUrlRequired'));
      return;
    }
    // categories items require at least key + url
    const cleanCategories = categories
      .map((c) => ({ key: c.key.trim(), label: c.label.trim(), url: c.url.trim() }))
      .filter((c) => c.key && c.url);

    const payload = {
      name: name.trim(),
      base_url: baseUrl.trim(),
      site_lists: siteListsStr.split(',').map((s) => s.trim()).filter(Boolean),
      categories: cleanCategories,
      is_active: isActive,
      js,
      page_mode: pageMode,
      selectors,
    };

    setSaving(true);
    setError(null);
    try {
      if (isNew) await createCategorySite(payload);
      else await updateCategorySite(site.id, payload);
      onSaved();
    } catch (err) {
      setError(formatError(err, t, 'failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-green/50 transition-all';

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-dark-card border border-dark-border rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">{isNew ? t('addSite') : t('editSite')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-dark-card-hover transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label={t('name')}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} autoFocus className={inputCls} />
          </Field>
          <Field label={t('baseUrl')}>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('baseUrlPlaceholder')} className={inputCls} />
          </Field>
          <Field label={t('siteListsField')}>
            <input value={siteListsStr} onChange={(e) => setSiteListsStr(e.target.value)} placeholder={t('siteListsPlaceholder')} className={inputCls} list="known-site-lists" />
            <datalist id="known-site-lists">
              {knownLists.map((l) => <option key={l} value={l} />)}
            </datalist>
          </Field>

          {/* Categories editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-text-secondary">{t('categoriesField')}</label>
              <button type="button" onClick={addCategoryRow} className="text-xs text-accent-green hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> {t('addCategory')}
              </button>
            </div>
            <div className="space-y-2">
              {categories.map((c, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input value={c.key} onChange={(e) => updateCategoryRow(idx, 'key', e.target.value)} placeholder={t('categoryKey')} className={`${inputCls} w-24`} />
                  <input value={c.label} onChange={(e) => updateCategoryRow(idx, 'label', e.target.value)} placeholder={t('categoryLabelField')} className={`${inputCls} w-28`} />
                  <input value={c.url} onChange={(e) => updateCategoryRow(idx, 'url', e.target.value)} placeholder={t('categoryUrl')} className={`${inputCls} flex-1`} />
                  <button type="button" onClick={() => removeCategoryRow(idx)} className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center text-accent-red hover:bg-accent-red/10 transition-all" aria-label="Remove">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Selectors */}
          <Field label={t('selectorsField')}>
            <div className="grid grid-cols-2 gap-1.5">
              <input value={selectors.item} onChange={(e) => setSelectors((s) => ({ ...s, item: e.target.value }))} placeholder={t('itemSelector')} className={inputCls} />
              <input value={selectors.link} onChange={(e) => setSelectors((s) => ({ ...s, link: e.target.value }))} placeholder={t('linkSelector')} className={inputCls} />
              <input value={selectors.title} onChange={(e) => setSelectors((s) => ({ ...s, title: e.target.value }))} placeholder={t('titleSelector')} className={inputCls} />
              <input value={selectors.date} onChange={(e) => setSelectors((s) => ({ ...s, date: e.target.value }))} placeholder={t('dateSelector')} className={inputCls} />
            </div>
          </Field>

          {/* Flags */}
          <div className="flex items-center gap-4 flex-wrap">
            <Field label={t('pageMode')} inline>
              <select value={pageMode} onChange={(e) => setPageMode(e.target.value)} className={`${inputCls} w-32`}>
                {PAGE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Checkbox label={t('isActiveField')} checked={isActive} onChange={setIsActive} />
            <Checkbox label={t('jsRendered')} checked={js} onChange={setJs} />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-accent-red">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-dark-card-hover transition-colors">
            {t('cancel')}
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-accent-green text-dark-bg font-semibold px-4 py-2 rounded-lg text-sm hover:shadow-[0_0_20px_rgba(200,245,66,0.3)] transition-all disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isNew ? t('create') : t('save')}
          </button>
        </div>
      </form>
    </motion.div>,
    document.body,
  );
}

function Field({ label, children, inline }) {
  return (
    <div className={inline ? '' : 'w-full'}>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm text-text-primary">
      <span className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${checked ? 'bg-accent-green border-accent-green' : 'border-text-muted/40'}`}>
        {checked && <span className="w-2 h-2 bg-dark-bg rounded-sm" />}
      </span>
      {label}
    </button>
  );
}
