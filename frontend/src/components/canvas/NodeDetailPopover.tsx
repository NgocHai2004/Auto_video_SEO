import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Volume2, Film, FileText, ExternalLink } from 'lucide-react';
import AudioPlayer from '../shared/AudioPlayer';
import VideoPlayer from '../shared/VideoPlayer';
import type { PipelineStep } from '../../types';

interface NodeDetailPopoverProps {
  step: PipelineStep | null;
  onClose: () => void;
}

export default function NodeDetailPopover({ step, onClose }: NodeDetailPopoverProps) {
  if (!step || !step.data) return null;

  const data = step.data;
  const script = data.script as string | undefined;
  const audioPath = data.audio_path as string | undefined;
  const audioDuration = data.duration as number | undefined;
  const prompt = data.prompt as string | undefined;
  const videoPath = data.video_path as string | undefined;
  const finalPath = data.final_path as string | undefined;
  const youtubeUrl = data.youtube_url as string | undefined;
  const ytTitle = data.title as string | undefined;
  const errorMsg = data.error as string | undefined;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="absolute top-0 right-0 w-[380px] h-full z-50"
      >
        <div className="h-full bg-[#13131a]/95 backdrop-blur-xl border-l border-slate-800/60 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-[#13131a]/90 backdrop-blur-md border-b border-slate-800/40">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Step {step.step}: {step.label}
              </h3>
              <p className="text-xs text-slate-500">{step.sublabel}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Step 1: Audio Script */}
            {step.step === 1 && script && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Generated Script
                  </span>
                  <button
                    onClick={() => copyText(script)}
                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/40">
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {script}
                  </p>
                </div>
                <span className="text-[10px] text-slate-600">
                  {script.length} characters
                </span>
              </div>
            )}

            {/* Step 2: Audio */}
            {step.step === 2 && audioPath && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                  <Volume2 className="h-3 w-3" />
                  Generated Audio
                  {audioDuration != null && (
                    <span className="text-slate-600 ml-1">
                      ({String(audioDuration)}s)
                    </span>
                  )}
                </span>
                <AudioPlayer src={audioPath} />
              </div>
            )}

            {/* Step 3: Video Prompt */}
            {step.step === 3 && prompt && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Video Prompt
                  </span>
                  <button
                    onClick={() => copyText(prompt)}
                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/40">
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {prompt}
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Video */}
            {step.step === 4 && videoPath && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                  <Film className="h-3 w-3" />
                  Generated Video
                </span>
                <VideoPlayer src={videoPath} />
              </div>
            )}

            {/* Step 5: Merged */}
            {step.step === 5 && finalPath && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                  <Film className="h-3 w-3" />
                  Final Video
                  {audioDuration != null && (
                    <span className="text-slate-600 ml-1">
                      ({String(audioDuration)}s)
                    </span>
                  )}
                </span>
                <VideoPlayer src={finalPath} />
              </div>
            )}

            {/* Step 6: YouTube */}
            {step.step === 6 && youtubeUrl && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-400">
                  YouTube Upload
                </span>
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-950/30 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <div>
                    <div className="text-sm font-medium">
                      {ytTitle || 'View on YouTube'}
                    </div>
                    <div className="text-[10px] text-red-500/70 truncate">
                      {youtubeUrl}
                    </div>
                  </div>
                </a>
              </div>
            )}

            {/* Timing Info */}
            {step.startedAt && step.completedAt && (
              <div className="pt-3 border-t border-slate-800/40">
                <span className="text-[10px] text-slate-600">
                  Completed in{' '}
                  {((step.completedAt - step.startedAt) / 1000).toFixed(1)}s
                </span>
              </div>
            )}

            {/* Error */}
            {step.status === 'error' && errorMsg && (
              <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/20">
                <span className="text-xs text-red-400">{errorMsg}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
