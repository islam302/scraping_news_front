import { useState, useRef, useCallback, useEffect } from 'react';
import { startScraping, getMissionStatus } from '../services/api';
import { formatError } from '../utils/errors';
import { useLang } from '../context/LangContext';

const POLL_INTERVAL = 3000;

export function useMission() {
  const { t } = useLang();
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollMission = useCallback((missionId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const data = await getMissionStatus(missionId);
        setMission(data);
        if (data.status === 'completed' || data.status === 'failed') {
          stopPolling();
          setLoading(false);
        }
      } catch (err) {
        setError(formatError(err, t, 'errGeneric'));
        stopPolling();
        setLoading(false);
      }
    }, POLL_INTERVAL);
  }, [stopPolling, t]);

  const scrape = useCallback(async (keyword, dateFilter = '', siteList = []) => {
    setLoading(true);
    setError(null);
    setMission(null);
    try {
      const data = await startScraping(keyword, dateFilter, siteList);
      setMission({ mission_id: data.mission_id, status: data.status, keyword });
      pollMission(data.mission_id);
    } catch (err) {
      setError(formatError(err, t, 'errScrape'));
      setLoading(false);
    }
  }, [pollMission, t]);

  const loadMission = useCallback(async (missionId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMissionStatus(missionId);
      setMission(data);
      if (['pending', 'scraping', 'filtering'].includes(data.status)) {
        pollMission(missionId);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(formatError(err, t, 'errGeneric'));
      setLoading(false);
    }
  }, [pollMission, t]);

  return { mission, loading, error, scrape, loadMission, stopPolling };
}
