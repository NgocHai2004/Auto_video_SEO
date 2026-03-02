import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import BatchProgress from '../batch/BatchProgress';
import BatchItemCard from '../batch/BatchItemCard';
import { useBatchPolling } from '../../hooks/useBatchPolling';

interface JobDetailPanelProps {
  jobId: string;
  onClose: () => void;
}

export default function JobDetailPanel({ jobId, onClose }: JobDetailPanelProps) {
  const { job, error } = useBatchPolling(jobId);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="glass-card p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Job Detail</h3>
          <code className="text-xs text-violet-400">{jobId}</code>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      {job && (
        <>
          {/* Progress */}
          <BatchProgress job={job} />

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Created:</span>
              <span className="text-slate-300 ml-1">
                {new Date(job.created_at).toLocaleString()}
              </span>
            </div>
            {job.completed_at && (
              <div>
                <span className="text-slate-500">Completed:</span>
                <span className="text-slate-300 ml-1">
                  {new Date(job.completed_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Results */}
          {job.results.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-400">
                Results ({job.results.length})
              </span>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {job.results.map((item) => (
                  <BatchItemCard key={item.index} item={item} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!job && !error && (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </motion.div>
  );
}
