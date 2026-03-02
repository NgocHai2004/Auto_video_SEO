import { motion } from 'framer-motion';
import StatusBadge from '../shared/StatusBadge';
import type { BatchJob } from '../../types';

interface BatchProgressProps {
  job: BatchJob;
}

export default function BatchProgress({ job }: BatchProgressProps) {
  const progress = job.total > 0 ? (job.current / job.total) * 100 : 0;
  const completedCount = job.results.filter((r) => r.status === 'success').length;
  const failedCount = job.results.filter((r) => r.status === 'error' || r.status === 'failed').length;

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Batch Progress</span>
          <StatusBadge status={job.status} />
        </div>
        <span className="text-sm text-slate-400 tabular-nums">
          {job.current}/{job.total}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs">
        <span className="text-emerald-400">✓ {completedCount} success</span>
        {failedCount > 0 && <span className="text-red-400">✗ {failedCount} failed</span>}
        {job.current_name && job.status === 'running' && (
          <span className="text-violet-400">
            Processing: {job.current_name}
          </span>
        )}
      </div>
    </div>
  );
}
