/** Locale-aware date/time for mission timestamps ('--' when missing/invalid). */
export function formatDate(dateStr, lang = 'en') {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString(lang === 'ar' ? 'ar' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_KEYS = {
  pending: 'statusPending',
  scraping: 'statusScraping',
  filtering: 'statusFiltering',
  completed: 'statusCompleted',
  failed: 'statusFailed',
};

/** Translated label for a mission status (raw value for unknown statuses). */
export function statusLabel(status, t) {
  const key = STATUS_KEYS[status];
  return key ? t(key) : (status || '--');
}
