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
  Check,
  List as ListIcon,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import {
  getSites,
  getSiteLists,
  getSiteList,
  createSiteList,
  updateSiteList,
  deleteSiteList,
  addSitesToList,
  removeSitesFromList,
} from '../services/api';
import { useLang } from '../context/LangContext';
import { formatError } from '../utils/errors';

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.3 } }),
};

export default function Sites() {
  const { t, isRTL } = useLang();
  const [tab, setTab] = useState('sites');
  const [sites, setSites] = useState([]);
  const [siteLists, setSiteLists] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Request-ID refs: only apply the response from the LATEST request,
  // preventing a slow stale response from overwriting fresher data.
  const sitesReqId = useRef(0);
  const listsReqId = useRef(0);

  const reloadSites = useCallback(() => {
    setLoadingSites(true);
    const id = ++sitesReqId.current;
    return getSites()
      .then((data) => { if (id === sitesReqId.current) setSites(data.sites || []); })
      .catch((err) => { if (id === sitesReqId.current) setLoadError(formatError(err, t, 'errLoadSites')); })
      .finally(() => { if (id === sitesReqId.current) setLoadingSites(false); });
  }, [t]);

  const reloadLists = useCallback(() => {
    setLoadingLists(true);
    const id = ++listsReqId.current;
    return getSiteLists()
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
          <TabButton
            active={tab === 'sites'}
            onClick={() => setTab('sites')}
            icon={Globe}
            label={t('sitesTab')}
          />
          <TabButton
            active={tab === 'lists'}
            onClick={() => setTab('lists')}
            icon={ListIcon}
            label={t('siteListsTab')}
          />
        </div>

        {tab === 'sites' ? (
          <SitesTab sites={sites} loading={loadingSites} t={t} />
        ) : (
          <ListsTab
            siteLists={siteLists}
            sites={sites}
            loading={loadingLists}
            t={t}
            isRTL={isRTL}
            onListCreated={(newList) => {
              setSiteLists((prev) => [...prev, { name: newList.name, site_count: newList.site_count ?? 0, sites: [] }]);
            }}
            onListRenamed={(oldName, newName) => {
              setSiteLists((prev) => prev.map((l) => l.name === oldName ? { ...l, name: newName } : l));
            }}
            onListDeleted={(listName) => {
              setSiteLists((prev) => prev.filter((l) => l.name !== listName));
            }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tab Button
// ============================================================================

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? 'text-accent-green border-accent-green'
          : 'text-text-secondary border-transparent hover:text-text-primary'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ============================================================================
// Sites Tab
// ============================================================================

function SitesTab({ sites, loading, t }) {
  return (
    <>
      <motion.div
        className="mb-5 sm:mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-lg sm:text-xl font-bold text-text-primary">{t('sitesTitle')}</h2>
        <p className="text-sm text-text-secondary mt-0.5">
          {sites.length} {sites.length !== 1 ? t('sitesConfigured') : t('siteConfigured')}
        </p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('loadingSites')}
        </div>
      ) : sites.length === 0 ? (
        <motion.div
          className="text-center py-16"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Globe className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-secondary">{t('noSitesYet')}</p>
        </motion.div>
      ) : (
        <div className="grid gap-2 sm:gap-3">
          {sites.map((site, i) => (
            <motion.a
              key={site.id}
              href={site.search_url}
              target="_blank"
              rel="noopener noreferrer"
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="bg-dark-card border border-dark-border rounded-xl p-3 sm:p-4 flex items-center gap-3 hover:border-accent-green/20 hover:shadow-[0_0_15px_rgba(200,245,66,0.04)] transition-all duration-300 group cursor-pointer"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-accent-blue/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-accent-blue/20 transition-colors">
                <Globe className="w-4 h-4 text-accent-blue" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary group-hover:text-accent-green transition-colors truncate">{site.name}</p>
                <p className="text-xs text-text-muted truncate">
                  {site.lang}
                  {site.site_list ? ` · ${site.site_list}` : ''}
                </p>
              </div>
            </motion.a>
          ))}
        </div>
      )}
    </>
  );
}

// ============================================================================
// Lists Tab
// ============================================================================

function ListsTab({ siteLists, sites, loading, t, isRTL, onListCreated, onListRenamed, onListDeleted }) {
  const [creating, setCreating] = useState(false);
  const [editingList, setEditingList] = useState(null); // list object being renamed
  const [managingList, setManagingList] = useState(null); // list name whose sites are being managed
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async (listName) => {
    if (!window.confirm(t('deleteSiteListConfirm'))) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSiteList(listName);
      onListDeleted(listName);
    } catch (err) {
      setError(formatError(err, t, 'errSaveList'));
    } finally {
      setBusy(false);
    }
  };

  if (managingList) {
    return (
      <ManageListSites
        listName={managingList}
        allSites={sites}
        t={t}
        isRTL={isRTL}
        onBack={() => setManagingList(null)}
      />
    );
  }

  return (
    <>
      <motion.div
        className="flex items-center justify-between gap-3 mb-5 sm:mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-text-primary">{t('siteListsTitle')}</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {siteLists.length} {siteLists.length !== 1 ? t('sitesConfigured').replace('sites', 'lists') : t('siteConfigured').replace('site', 'list')}
          </p>
        </div>
        <motion.button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-accent-green text-dark-bg font-semibold px-4 py-2 rounded-lg text-sm hover:shadow-[0_0_20px_rgba(200,245,66,0.3)] transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('addSiteList')}</span>
        </motion.button>
      </motion.div>

      {error && (
        <div className="mb-4 bg-accent-red/10 border border-accent-red/30 rounded-xl p-3 text-sm text-accent-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('loadingSiteLists')}
        </div>
      ) : siteLists.length === 0 ? (
        <motion.div
          className="text-center py-16"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <ListIcon className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-secondary">{t('noSiteListsYet')}</p>
          <p className="text-xs text-text-muted mt-1">{t('noSiteListsDesc')}</p>
        </motion.div>
      ) : (
        <div className="grid gap-2 sm:gap-3">
          {siteLists.map((list, i) => (
            <motion.div
              key={list.name}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="bg-dark-card border border-dark-border rounded-xl p-3 sm:p-4 flex items-center gap-3 hover:border-accent-green/20 transition-all duration-300"
            >
              <div className="w-9 h-9 bg-accent-cyan/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <ListIcon className="w-4 h-4 text-accent-cyan" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{list.name}</p>
                <p className="text-xs text-text-muted">
                  {list.site_count} {t('siteCount')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  onClick={() => setManagingList(list.name)}
                  label={t('manageSites')}
                  icon={Globe}
                  accent="blue"
                  disabled={busy}
                />
                <IconButton
                  onClick={() => setEditingList(list)}
                  label={t('rename')}
                  icon={Pencil}
                  accent="green"
                  disabled={busy}
                />
                <IconButton
                  onClick={() => handleDelete(list.name)}
                  label={t('deleteSelected')}
                  icon={Trash2}
                  accent="red"
                  disabled={busy}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {creating && (
          <ListFormModal
            key="create-list-modal"
            title={t('newSiteList')}
            submitLabel={t('create')}
            t={t}
            onClose={() => setCreating(false)}
            onSubmit={async (name) => {
              const resp = await createSiteList(name);
              setCreating(false);
              onListCreated({ name: resp?.name ?? name, site_count: resp?.site_count ?? 0 });
            }}
          />
        )}
        {editingList && (
          <ListFormModal
            key={`edit-list-modal-${editingList.name}`}
            title={t('editSiteList')}
            submitLabel={t('save')}
            t={t}
            initialName={editingList.name}
            onClose={() => setEditingList(null)}
            onSubmit={async (name) => {
              await updateSiteList(editingList.name, { name });
              setEditingList(null);
              onListRenamed(editingList.name, name);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// Icon Button
// ============================================================================

function IconButton({ onClick, label, icon: Icon, accent, disabled }) {
  const accents = {
    blue: 'text-accent-blue hover:bg-accent-blue/10',
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
      <Icon className="w-4 h-4" />
    </button>
  );
}

// ============================================================================
// Create / Rename Modal
// ============================================================================

function ListFormModal({ title, submitLabel, initialName = '', t, onSubmit, onClose }) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('listNameRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(formatError(err, t, 'errSaveList'));
    } finally {
      setSaving(false);
    }
  };

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
        className="relative z-10 w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-dark-card-hover transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          {t('listName')}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('listNamePlaceholder')}
          autoFocus
          className="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-green/50 focus:shadow-[0_0_0_3px_rgba(200,245,66,0.08)] transition-all"
        />
        {error && (
          <p className="mt-3 text-xs text-accent-red">{error}</p>
        )}
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-dark-card-hover transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-accent-green text-dark-bg font-semibold px-4 py-2 rounded-lg text-sm hover:shadow-[0_0_20px_rgba(200,245,66,0.3)] transition-all disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </form>
    </motion.div>,
    document.body,
  );
}

// ============================================================================
// Manage Sites In A List
// ============================================================================

function ManageListSites({ listName, allSites, t, isRTL, onBack }) {
  const [listDetail, setListDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const BackIcon = isRTL ? ChevronRight : ArrowLeft;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSiteList(listName)
      .then((data) => setListDetail(data))
      .catch((err) => setError(formatError(err, t, 'errGeneric')))
      .finally(() => setLoading(false));
  }, [listName, t]);

  useEffect(() => {
    load();
  }, [load]);

  const inListIds = new Set((listDetail?.sites || []).map((s) => s.id));
  const available = allSites.filter((s) => !inListIds.has(s.id));
  const inList = listDetail?.sites || [];

  const handleAdd = async (siteId) => {
    setBusyId(siteId);
    setError(null);
    try {
      await addSitesToList(listName, [siteId]);
      await load();
    } catch (err) {
      setError(formatError(err, t, 'errSaveList'));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (siteId) => {
    setBusyId(siteId);
    setError(null);
    try {
      await removeSitesFromList(listName, [siteId]);
      await load();
    } catch (err) {
      setError(formatError(err, t, 'errSaveList'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <motion.div
        className="flex items-center gap-3 mb-5 sm:mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-lg bg-dark-card border border-dark-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-dark-card-hover transition-all"
          aria-label={t('back')}
        >
          <BackIcon className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-text-primary truncate">{listName}</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {inList.length} {t('siteCount')}
          </p>
        </div>
      </motion.div>

      {error && (
        <div className="mb-4 bg-accent-red/10 border border-accent-red/30 rounded-xl p-3 text-sm text-accent-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('loadingSiteLists')}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <SiteColumn
            title={t('sitesInList')}
            empty={t('noSitesInList')}
            sites={inList}
            actionLabel={t('removeFromList')}
            actionIcon={X}
            accent="red"
            busyId={busyId}
            onAction={handleRemove}
          />
          <SiteColumn
            title={t('availableSites')}
            empty="—"
            sites={available}
            actionLabel={t('addToList')}
            actionIcon={Check}
            accent="green"
            busyId={busyId}
            onAction={handleAdd}
          />
        </div>
      )}
    </>
  );
}

function SiteColumn({ title, empty, sites, actionLabel, actionIcon: ActionIcon, accent, busyId, onAction }) {
  const accents = {
    red: 'text-accent-red hover:bg-accent-red/10',
    green: 'text-accent-green hover:bg-accent-green/10',
  };
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-3 sm:p-4">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        {title} ({sites.length})
      </h3>
      {sites.length === 0 ? (
        <p className="text-sm text-text-muted py-6 text-center">{empty}</p>
      ) : (
        <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
          {sites.map((site) => (
            <div
              key={site.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-dark-card-hover transition-colors"
            >
              <div className="w-7 h-7 bg-accent-blue/10 rounded-md flex items-center justify-center flex-shrink-0">
                <Globe className="w-3.5 h-3.5 text-accent-blue" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-primary truncate">{site.name}</p>
                {site.lang && <p className="text-xs text-text-muted truncate">{site.lang}</p>}
              </div>
              <button
                onClick={() => onAction(site.id)}
                disabled={busyId === site.id}
                title={actionLabel}
                aria-label={actionLabel}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${accents[accent]}`}
              >
                {busyId === site.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ActionIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
