import { useState, useRef, useCallback, useEffect } from 'react';
import { startScraping, getMissionStatus } from '../services/api';

const POLL_INTERVAL = 3000;

export function useMission() {
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

  // Clean up polling on unmount
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
        setError(err.response?.data?.error || (typeof err.response?.data?.detail === 'string' ? err.response.data.detail : err.response?.data?.detail?.message) || 'Failed to fetch mission status');
        stopPolling();
        setLoading(false);
      }
    }, POLL_INTERVAL);
  }, [stopPolling]);

  const scrape = useCallback(async (keyword, text, dateFilter = 'none') => {
    setLoading(true);
    setError(null);
    setMission(null);

    try {
      const data = await startScraping(keyword, text, dateFilter);
      setMission({ mission_id: data.mission_id, status: data.status, keyword });
      pollMission(data.mission_id);
    } catch (err) {
      setError(err.response?.data?.error || (typeof err.response?.data?.detail === 'string' ? err.response.data.detail : err.response?.data?.detail?.message) || 'Failed to start scraping');
      setLoading(false);
    }
  }, [pollMission]);

  // Load a previous mission's full details (for viewing past results)
  const loadMission = useCallback(async (missionId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMissionStatus(missionId);
      setMission(data);

      // If still running, start polling
      if (['pending', 'scraping', 'filtering'].includes(data.status)) {
        pollMission(missionId);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || (typeof err.response?.data?.detail === 'string' ? err.response.data.detail : err.response?.data?.detail?.message) || 'Failed to load mission');
      setLoading(false);
    }
  }, [pollMission]);

  return { mission, loading, error, scrape, loadMission, stopPolling };
}
