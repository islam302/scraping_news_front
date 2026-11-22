import { useState, useRef, useCallback, useEffect } from 'react';
import { startScraping, getMissionStatus } from '../services/api';
import { formatError, isRetriableError, getRetryAfterSeconds } from '../utils/errors';
import { useLang } from '../context/LangContext';

export const POLL_INTERVAL = 3000;
// Back-off ceiling for transient poll failures (429 / 5xx / network).
export const MAX_POLL_BACKOFF = 30000;
// Give up tracking after this many transient failures IN A ROW.
export const MAX_POLL_FAILURES = 20;

export const ACTIVE_STATUSES = ['pending', 'scraping', 'filtering'];
const isTerminal = (status) => status === 'completed' || status === 'failed';

export function useMission() {
  const { t } = useLang();
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Categories the backend skipped because no site in the chosen lists has them.
  const [skippedCategories, setSkippedCategories] = useState([]);

  const timerRef = useRef(null);
  // Bumped on every new poll session / stop / unmount. A response whose token
  // is no longer current is stale and is dropped (no backwards status jumps).
  const sessionRef = useRef(0);
  const mountedRef = useRef(true);
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  const stopPolling = useCallback(() => {
    sessionRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // Sequential polling: the next GET is scheduled only after the previous one
  // settled, so requests never overlap or arrive out of order.
  const pollMission = useCallback((missionId) => {
    stopPolling();
    const session = sessionRef.current;
    let failures = 0;
    const isCurrent = () => mountedRef.current && session === sessionRef.current;

    const schedule = (delay) => {
      if (!isCurrent()) return;
      timerRef.current = setTimeout(tick, delay);
    };

    async function tick() {
      timerRef.current = null;
      if (!isCurrent()) return;
      try {
        const data = await getMissionStatus(missionId);
        if (!isCurrent()) return;
        failures = 0;
        setError(null);
        setMission(data);
        if (isTerminal(data?.status)) {
          stopPolling();
          setLoading(false);
          return;
        }
        schedule(POLL_INTERVAL);
      } catch (err) {
        if (!isCurrent()) return;
        if (isRetriableError(err) && failures < MAX_POLL_FAILURES - 1) {
          // Transient (rate limit / outage / network): keep tracking, back off.
          failures += 1;
          const retryAfter = getRetryAfterSeconds(err);
          const backoff = Math.min(POLL_INTERVAL * 2 ** failures, MAX_POLL_BACKOFF);
          const delay = retryAfter != null
            ? Math.min(Math.max(retryAfter * 1000, POLL_INTERVAL), MAX_POLL_BACKOFF * 2)
            : backoff;
          setError(formatError(err, tRef.current, 'errGeneric'));
          schedule(delay);
          return;
        }
        // Terminal (404 mission gone, 401/403, too many failures): stop.
        setError(formatError(err, tRef.current, 'errGeneric'));
        stopPolling();
        setLoading(false);
      }
    }

    schedule(POLL_INTERVAL);
  }, [stopPolling]);

  const scrape = useCallback(async (keyword, options = {}) => {
    stopPolling();
    const session = sessionRef.current;
    setLoading(true);
    setError(null);
    setMission(null);
    setSkippedCategories([]);
    try {
      const data = await startScraping(keyword, options);
      if (!mountedRef.current || session !== sessionRef.current) return;
      setSkippedCategories(data?.skipped_categories || []);
      if (data?.mission_id == null) {
        // titles_only (inline) response: no mission to track.
        setMission({ ...data, keyword, status: data?.status || 'completed' });
        setLoading(false);
        return;
      }
      setMission({ mission_id: data.mission_id, status: data.status, keyword });
      if (isTerminal(data.status)) {
        setLoading(false);
        return;
      }
      pollMission(data.mission_id);
    } catch (err) {
      if (!mountedRef.current || session !== sessionRef.current) return;
      setError(formatError(err, tRef.current, 'errScrape'));
      setLoading(false);
    }
  }, [pollMission, stopPolling]);

  const loadMission = useCallback(async (missionId) => {
    stopPolling();
    const session = sessionRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getMissionStatus(missionId);
      if (!mountedRef.current || session !== sessionRef.current) return;
      setMission(data);
      if (ACTIVE_STATUSES.includes(data?.status)) {
        pollMission(missionId);
      } else {
        setLoading(false);
      }
    } catch (err) {
      if (!mountedRef.current || session !== sessionRef.current) return;
      setError(formatError(err, tRef.current, 'errGeneric'));
      setLoading(false);
    }
  }, [pollMission, stopPolling]);

  return { mission, loading, error, skippedCategories, scrape, loadMission, stopPolling };
}
