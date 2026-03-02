import { useEffect, useState } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import StatusBadge from '../shared/StatusBadge';
import { listBatchJobs } from '../../api/batch';
import { JOBS_REFRESH_INTERVAL } from '../../utils/constants';
import type { BatchJobSummary } from '../../types';

interface JobsTableProps {
  onSelectJob: (jobId: string) => void;
  selectedJobId: string | null;
}

export default function JobsTable({ onSelectJob, selectedJobId }: JobsTableProps) {
  const [jobs, setJobs] = useState<BatchJobSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const data = await listBatchJobs();
      setJobs(data.jobs);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, JOBS_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const hasRunning = jobs.some((j) => j.status === 'running' || j.status === 'queued');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-300">
          All Jobs ({jobs.length})
        </span>
        <button
          type="button"
          onClick={fetchJobs}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${hasRunning ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-5 w-5 text-slate-500 animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <p className="text-sm">No batch jobs yet</p>
          <p className="text-xs mt-1">Start a batch pipeline to see jobs here</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Job ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Progress</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Created</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {jobs.map((job) => (
                <tr
                  key={job.job_id}
                  onClick={() => onSelectJob(job.job_id)}
                  className={`cursor-pointer transition-colors ${
                    selectedJobId === job.job_id
                      ? 'bg-violet-950/20'
                      : 'hover:bg-slate-800/30'
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <code className="text-xs text-violet-400">{job.job_id}</code>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all"
                          style={{ width: `${job.total > 0 ? (job.current / job.total) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {job.success_count}/{job.total}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="text-slate-500 hover:text-violet-400 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
