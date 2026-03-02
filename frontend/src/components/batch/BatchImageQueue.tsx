import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import type { BatchImageResult } from '../../types';

interface BatchImageQueueProps {
  isOpen: boolean;
  onClose: () => void;
  imageResults: BatchImageResult[];
  currentImageIndex: number;
}

export default function BatchImageQueue({
  isOpen,
  onClose,
  imageResults,
  currentImageIndex,
}: BatchImageQueueProps) {
  if (!isOpen || imageResults.length === 0) return null;

  const getStatusIcon = (status: BatchImageResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  const getStatusBg = (status: BatchImageResult['status'], index: number) => {
    if (index === currentImageIndex && status === 'processing') {
      return 'bg-violet-500/10 border-violet-500/40';
    }
    switch (status) {
      case 'success':
        return 'bg-emerald-500/5 border-emerald-500/20';
      case 'error':
        return 'bg-red-500/5 border-red-500/20';
      case 'processing':
        return 'bg-violet-500/5 border-violet-500/20';
      default:
        return 'bg-slate-800/30 border-slate-700/30';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="absolute top-0 right-0 w-[300px] h-full z-40"
      >
        <div className="h-full bg-[#13131a]/95 backdrop-blur-xl border-l border-slate-800/60 flex flex-col">
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-[#13131a]/90 backdrop-blur-md border-b border-slate-800/40">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Image Queue
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 tabular-nums">
                {imageResults.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Summary Stats */}
          <div className="px-4 py-2 border-b border-slate-800/30 flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {imageResults.filter((r) => r.status === 'success').length} done
            </span>
            <span className="flex items-center gap-1 text-[10px] text-red-400">
              <XCircle className="h-3 w-3" />
              {imageResults.filter((r) => r.status === 'error').length} failed
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Clock className="h-3 w-3" />
              {imageResults.filter((r) => r.status === 'pending').length} pending
            </span>
          </div>

          {/* Image List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {imageResults.map((result) => (
              <motion.div
                key={result.index}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: result.index * 0.03 }}
                className={`rounded-lg border p-3 transition-all ${getStatusBg(result.status, result.index)}`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Index */}
                  <div className="flex-shrink-0 h-6 w-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                      {result.index + 1}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {result.name}
                      </span>
                      {getStatusIcon(result.status)}
                    </div>

                    {/* Error message */}
                    {result.status === 'error' && result.error && (
                      <p className="text-[10px] text-red-400/80 mt-1 line-clamp-2">
                        {result.error}
                      </p>
                    )}

                    {/* Success info */}
                    {result.status === 'success' && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {result.final_path && (
                          <a
                            href={`/api/file?path=${encodeURIComponent(result.final_path)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-0.5"
                          >
                            Video <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {result.youtube_url && (
                          <a
                            href={result.youtube_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5"
                          >
                            YouTube <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {result.duration && (
                          <span className="text-[10px] text-slate-500 tabular-nums">
                            {result.duration.toFixed(1)}s
                          </span>
                        )}
                      </div>
                    )}

                    {/* Processing indicator */}
                    {result.status === 'processing' && (
                      <div className="mt-1.5">
                        <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
                            animate={{ width: ['0%', '70%', '30%', '90%'] }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
