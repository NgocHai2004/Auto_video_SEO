import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, FileText, Film, Volume2, Clock } from 'lucide-react';
import VideoPlayer from '../shared/VideoPlayer';
import AudioPlayer from '../shared/AudioPlayer';
import ExpandableSection from '../shared/ExpandableSection';
import { API_BASE_URL } from '../../utils/constants';
import type { PipelineResult, PipelineStep } from '../../types';

interface ResultPanelProps {
  result: PipelineResult | null;
  steps: PipelineStep[];
  isOpen: boolean;
  onClose: () => void;
}

function fileUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_BASE_URL}/file?path=${encodeURIComponent(path)}`;
}

export default function ResultPanel({ result, steps, isOpen, onClose }: ResultPanelProps) {
  if (!result || !isOpen) return null;

  // Calculate total time
  const completedSteps = steps.filter(
    (s) => s.startedAt && s.completedAt && (s.status === 'completed' || s.status === 'skipped')
  );
  const totalTime = completedSteps.reduce(
    (sum, s) => sum + ((s.completedAt! - s.startedAt!) / 1000),
    0
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 30 }}
        className="absolute top-0 right-0 w-[420px] h-full z-40 bg-[#13131a]/95 backdrop-blur-xl border-l border-slate-800/60 overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-[#13131a]/90 backdrop-blur-md border-b border-slate-800/40 z-10">
          <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
            <Film className="h-4 w-4" />
            Pipeline Result
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Video Player */}
          {result.final_path && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Film className="h-3 w-3" />
                Final Video
              </span>
              <VideoPlayer src={result.final_path} />
            </div>
          )}

          {/* Audio Player */}
          {result.audio_path && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Volume2 className="h-3 w-3" />
                Generated Audio
                {result.duration != null && (
                  <span className="text-slate-600 ml-1">({result.duration}s)</span>
                )}
              </span>
              <AudioPlayer src={result.audio_path} />
            </div>
          )}

          {/* Scripts */}
          {result.audio_script && (
            <ExpandableSection title="📝 Audio Script">
              <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                {result.audio_script}
              </p>
            </ExpandableSection>
          )}

          {result.video_prompt && (
            <ExpandableSection title="🎬 Video Prompt">
              <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                {result.video_prompt}
              </p>
            </ExpandableSection>
          )}

          {/* YouTube Link */}
          {result.youtube_url && (
            <a
              href={result.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-950/30 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="text-sm font-medium">View on YouTube</span>
            </a>
          )}

          {/* Step Timeline */}
          {completedSteps.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Step Timeline
              </span>
              <div className="space-y-1">
                {steps
                  .filter((s) => s.startedAt && s.completedAt)
                  .map((s) => (
                    <div
                      key={s.step}
                      className="flex items-center justify-between px-3 py-1.5 rounded bg-slate-900/40"
                    >
                      <span className="text-[11px] text-slate-400">
                        {s.step}. {s.label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                        {((s.completedAt! - s.startedAt!) / 1000).toFixed(1)}s
                      </span>
                    </div>
                  ))}
                <div className="flex items-center justify-between px-3 py-1.5 rounded bg-violet-950/20 border border-violet-500/20">
                  <span className="text-[11px] font-medium text-violet-400">
                    Total
                  </span>
                  <span className="text-[10px] font-mono text-violet-400 tabular-nums">
                    {totalTime.toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {result.final_path && (
              <a
                href={fileUrl(result.final_path)}
                download
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Download className="h-3 w-3" />
                Download Video
              </a>
            )}
            {result.audio_script && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(result.audio_script || '')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <FileText className="h-3 w-3" />
                Copy Script
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
