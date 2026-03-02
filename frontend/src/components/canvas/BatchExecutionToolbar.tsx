import { Square, RotateCcw, Images, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { BatchStatus, BatchImageResult } from '../../types';

interface BatchExecutionToolbarProps {
  batchStatus: BatchStatus;
  isRunning: boolean;
  totalImages: number;
  currentImageIndex: number;
  currentImageName: string;
  successCount: number;
  errorCount: number;
  scheduleCountdown: string | null;
  imageResults: BatchImageResult[];
  onStop: () => void;
  onReset: () => void;
}

export default function BatchExecutionToolbar(props: BatchExecutionToolbarProps) {
  const {
    batchStatus,
    isRunning,
    totalImages,
    currentImageName,
    successCount,
    errorCount,
    scheduleCountdown,
    imageResults,
    onStop,
    onReset,
  } = props;
  const processedCount = imageResults.filter(
    (r) => r.status === 'success' || r.status === 'error'
  ).length;
  const progressPercent = totalImages > 0 ? (processedCount / totalImages) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#13131a]/90 backdrop-blur-md border border-slate-800/60"
    >
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            batchStatus === 'running'
              ? 'bg-violet-500 animate-pulse'
              : batchStatus === 'waiting'
              ? 'bg-amber-500 animate-pulse'
              : batchStatus === 'completed'
              ? 'bg-emerald-500'
              : batchStatus === 'error'
              ? 'bg-red-500'
              : 'bg-slate-600'
          }`}
        />
        <span className="text-xs font-medium text-slate-300 capitalize">
          {batchStatus === 'idle'
            ? 'Ready'
            : batchStatus === 'waiting'
            ? 'Scheduled'
            : batchStatus}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-700/50" />

      {/* Progress Info */}
      {totalImages > 0 && (
        <div className="flex items-center gap-3">
          {/* Image counter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Images className="h-3.5 w-3.5" />
            <span className="tabular-nums">
              {processedCount}/{totalImages}
            </span>
          </div>

          {/* Current image name */}
          {isRunning && currentImageName && (
            <span className="text-xs text-violet-300 truncate max-w-[160px] font-medium">
              {currentImageName}
            </span>
          )}

          {/* Success/Error counts */}
          {(successCount > 0 || errorCount > 0) && (
            <div className="flex items-center gap-2">
              {successCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {successCount}
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <XCircle className="h-3 w-3" />
                  {errorCount}
                </span>
              )}
            </div>
          )}

          {/* Schedule countdown */}
          {scheduleCountdown && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Clock className="h-3 w-3" />
              {scheduleCountdown}
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {totalImages > 0 && (
        <>
          <div className="w-px h-6 bg-slate-700/50" />
          <div className="flex-1 max-w-[200px]">
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {isRunning && (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>
        )}

        {(batchStatus === 'completed' || batchStatus === 'error' || batchStatus === 'idle') && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 text-slate-300 border border-slate-700/50 hover:bg-slate-700/60 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>
    </motion.div>
  );
}
