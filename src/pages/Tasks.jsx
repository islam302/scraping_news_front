import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../components/Header';
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { getMissions, deleteMission } from '../services/api';
import { useLang } from '../context/LangContext';
import { formatError } from '../utils/errors';
import { formatDate, statusLabel } from '../utils/format';

// Bulk delete runs at most this many DELETEs at once (a select-all of 50 must
// not burst 50 parallel requests into the rate limiter).
const DELETE_CONCURRENCY = 3;

/** Run `worker` over `items` with bounded concurrency; returns allSettled-style results. */
async function runLimited(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      try {
        results[idx] = { status: 'fulfilled', value: await worker(items[idx]) };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

function statusBadge(status, t) {
  switch (status) {
    case 'completed':
      return (<span className="flex items-center gap-1 text-xs font-medium text-accent-green bg-accent-green/10 px-2.5 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> {statusLabel('completed', t)}</span>);
    case 'failed':
      return (<span className="flex items-center gap-1 text-xs font-medium text-accent-red bg-accent-red/10 px-2.5 py-1 rounded-full"><XCircle className="w-3 h-3" /> {statusLabel('failed', t)}</span>);
    case 'scraping':
    case 'filtering':
      return (<span className="flex items-center gap-1 text-xs font-medium text-accent-blue bg-accent-blue/10 px-2.5 py-1 rounded-full"><Loader2 className="w-3 h-3 animate-spin" /> <span className="hidden sm:inline">{status === 'scraping' ? t('extracting') : t('aiFilteringInProgress')}</span></span>);
    default:
      return (<span className="flex items-center gap-1 text-xs font-medium text-text-muted bg-dark-card-hover px-2.5 py-1 rounded-full"><Clock className="w-3 h-3" /> {statusLabel('pending', t)}</span>);
  }
}


const listItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function Tasks() {
  const { t, isRTL, lang } = useLang();
  const navigate = useNavigate();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const selectionMode = selected.size > 0;

  useEffect(() => {
    let cancelled = false;
    getMissions()
      .then((data) => { if (!cancelled) setMissions(Array.isArray(data?.missions) ? data.missions : []); })
      .catch((err) => { if (!cancelled) setPageError(formatError(err, t, 'errLoadMissions')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [t]);

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === missions.length) setSelected(new Set());
    else setSelected(new Set(missions.map((m) => m.mission_id)));
  };

  const handleDeleteSelected = async () => {
    if (deleting) return;
    if (!window.confirm(t('deleteSelectedConfirm'))) return;
    setDeleting(true);
    setDeleteError(null);
    const ids = [...selected];
    const results = await runLimited(ids, DELETE_CONCURRENCY, (id) => deleteMission(id));
    // A 404 means the mission is already gone — that's the outcome we wanted.
    const gone = new Set();
    const failed = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' || r.reason?.response?.status === 404) gone.add(ids[i]);
      else failed.push(r.reason);
    });
    setMissions((prev) => prev.filter((m) => !gone.has(m.mission_id)));
    setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
    if (failed.length) {
      const reason = formatError(failed[0], t, 'errDeleteMission');
      setDeleteError(ids.length > 1
        ? `${t('errDeletePartial').replace('{n}', failed.length)} ${reason}`
        : reason);
    }
    setDeleting(false);
  };

  const allSelected = missions.length > 0 && selected.size === missions.length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="hidden lg:block sticky top-0 z-20">
        <Header breadcrumbs={[t('dashboard'), t('tasks')]} />
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {pageError && (
          <div className="mb-4 bg-accent-red/10 border border-accent-red/30 rounded-xl p-3 text-sm text-accent-red">
            {pageError}
          </div>
        )}
        {deleteError && (
          <div className="mb-4 bg-accent-red/10 border border-accent-red/30 rounded-xl p-3 text-sm text-accent-red">
            {deleteError}
          </div>
        )}
        <motion.div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text-primary">{t('missionsHistory')}</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              {selectionMode
                ? `${selected.size} ${t('selected')}`
                : `${missions.length} ${missions.length !== 1 ? t('missionsRecorded') : t('missionRecorded')}`
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {missions.length > 0 && (
              <motion.button
                onClick={toggleSelectAll}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm transition-all duration-300 border ${
                  allSelected
                    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                    : 'bg-dark-card border-dark-border text-text-secondary hover:text-text-primary hover:border-dark-card-hover'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  allSelected ? 'bg-accent-green border-accent-green' : 'border-text-muted'
                }`}>
                  {allSelected && <Check className="w-3 h-3 text-on-accent" />}
                </div>
                <span className="hidden sm:inline">{t('selectAll')}</span>
              </motion.button>
            )}

            <AnimatePresence>
              {selectionMode && (
                <motion.button
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-accent-red/10 border border-accent-red/30 rounded-lg text-sm text-accent-red hover:bg-accent-red/20 transition-all duration-300 disabled:opacity-50"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span className="hidden sm:inline">{t('deleteSelected')}</span> ({selected.size})
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-text-secondary">
            <Loader2 className="w-5 h-5 animate-spin" /> {t('loadingMissions')}
          </div>
        ) : missions.length === 0 ? (
          <motion.div className="text-center py-16" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <ClipboardList className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
            <p className="text-text-secondary">{t('noMissionsYet')}</p>
            <p className="text-xs text-text-muted mt-1">{t('noMissionsDesc')}</p>
          </motion.div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {missions.map((m, i) => {
              const isSelected = selected.has(m.mission_id);
              return (
                <motion.div
                  key={m.mission_id}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={listItemVariants}
                  className={`bg-dark-card border rounded-xl p-3 sm:p-4 flex items-center gap-3 transition-all duration-300 group cursor-pointer ${
                    isSelected
                      ? 'border-accent-green/40 bg-accent-green/5'
                      : 'border-dark-border hover:border-dark-card-hover'
                  }`}
                  onClick={() => navigate(`/tasks/${m.mission_id}`)}
                >
                  <div
                    onClick={(e) => toggleSelect(m.mission_id, e)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                      isSelected ? 'bg-accent-green border-accent-green' : 'border-text-muted/40 hover:border-text-muted'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-on-accent" />}
                  </div>

                  <div className="w-9 h-9 bg-accent-purple/10 rounded-lg items-center justify-center group-hover:bg-accent-purple/20 transition-colors flex-shrink-0 hidden sm:flex">
                    <Search className="w-4 h-4 text-accent-purple" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent-green transition-colors truncate">{m.keyword}</p>
                    <p className="text-xs text-text-muted">{formatDate(m.created_at, lang)}</p>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                    {m.total_results != null && <span className="text-xs text-text-secondary hidden sm:inline">{m.total_results} {t('results').toLowerCase()}</span>}
                    <div className="hidden sm:block">{statusBadge(m.status, t)}</div>
                    <Chevron className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
