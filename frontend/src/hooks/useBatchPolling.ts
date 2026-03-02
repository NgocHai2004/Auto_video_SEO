import { useCallback, useEffect, useRef, useState } from 'react';
import { getBatchStatus } from '../api/batch';
import { BATCH_POLL_INTERVAL } from '../utils/constants';
import type { BatchJob } from '../types';

export function useBatchPolling(jobId: string | null) {
  const [job, setJob] = useState<BatchJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const data = await getBatchStatus(jobId);
      setJob(data);
      setError(null);

      // Stop polling if job is done
      if (data.status === 'completed' || data.status === 'failed') {
        stopPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job status');
    }
  }, [jobId, stopPolling]);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    // Initial fetch
    poll();

    // Start polling
    intervalRef.current = setInterval(poll, BATCH_POLL_INTERVAL);

    return () => {
      stopPolling();
    };
  }, [jobId, poll, stopPolling]);

  return { job, error, refresh: poll };
}
