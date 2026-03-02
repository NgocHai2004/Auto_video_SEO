import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Sliders,
  Youtube,
  Settings2,
  Timer,
  FolderUp,
} from 'lucide-react';
import VoiceSelector from '../shared/VoiceSelector';
import BackgroundMusicSelector from '../shared/BackgroundMusicSelector';
import BatchFileUpload from '../batch/BatchFileUpload';
import ScheduleConfig from '../batch/ScheduleConfig';
import { DEFAULT_PIPELINE_CONFIG, RESOLUTION_PRESETS, PRIVACY_OPTIONS } from '../../utils/constants';
import type { PipelineConfig, UploadedPair } from '../../types';

interface BatchConfigDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  onStart: (
    pairs: UploadedPair[],
    config: PipelineConfig,
    scheduleTime: string | null,
    delayBetween: number
  ) => void;
  isRunning: boolean;
  hasStarted: boolean;
}

export default function BatchConfigDrawer({
  isOpen,
  onToggle,
  onStart,
  isRunning,
  hasStarted,
}: BatchConfigDrawerProps) {
  const [pairs, setPairs] = useState<UploadedPair[]>([]);
  const [config, setConfig] = useState<PipelineConfig>({ ...DEFAULT_PIPELINE_CONFIG });
  const [scheduleTime, setScheduleTime] = useState<string | null>(null);
  const [delayBetween, setDelayBetween] = useState(30);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = <K extends keyof PipelineConfig>(key: K, value: PipelineConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleResolutionPreset = (preset: { width: number; height: number }) => {
    setConfig((prev) => ({ ...prev, width: preset.width, height: preset.height }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pairs.length === 0) return;
    onStart(pairs, config, scheduleTime, delayBetween);
  };

  const canSubmit = pairs.length > 0 && !isRunning && !hasStarted;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-6 h-16 bg-[#13131a] border border-slate-800/60 border-l-0 rounded-r-lg hover:bg-slate-800/60 transition-colors"
        style={{ left: isOpen ? '340px' : '0px' }}
      >
        {isOpen ? (
          <ChevronLeft className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {/* Drawer panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -340 }}
            animate={{ x: 0 }}
            exit={{ x: -340 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute left-0 top-0 h-full w-[340px] z-30 bg-[#13131a]/95 backdrop-blur-xl border-r border-slate-800/60 overflow-y-auto"
          >
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/40">
                <Settings2 className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-slate-200">Batch Configuration</h2>
              </div>

              {/* File Upload Section */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                  <FolderUp className="h-3 w-3 text-violet-400" />
                  Upload Images ({pairs.length} files)
                </label>
                <BatchFileUpload pairs={pairs} onPairsChange={setPairs} />
              </div>

              {/* Schedule & Timing */}
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/40 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                  <Timer className="h-3 w-3 text-amber-400" />
                  Schedule & Timing
                </div>
                <ScheduleConfig
                  scheduleTime={scheduleTime || ''}
                  onScheduleTimeChange={(v) => setScheduleTime(v || null)}
                  delayBetween={delayBetween}
                  onDelayChange={setDelayBetween}
                />
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-cyan-400" />
                    Duration
                  </span>
                  <span className="text-violet-400 tabular-nums">{config.duration}s</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={30}
                  step={1}
                  value={config.duration}
                  onChange={(e) => update('duration', Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Voice */}
              <VoiceSelector value={config.voice} onChange={(v) => update('voice', v)} />

              {/* Background Music */}
              <BackgroundMusicSelector
                value={config.background}
                onChange={(v) => update('background', v)}
              />

              {/* BG Volume */}
              {config.background && (
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-medium text-slate-300">
                    <span>BG Volume</span>
                    <span className="text-violet-400 tabular-nums">
                      {Math.round(config.bg_volume * 100)}%
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.bg_volume}
                    onChange={(e) => update('bg_volume', Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}

              {/* Advanced Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40 text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="h-3 w-3" />
                  Advanced Settings
                </span>
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Advanced Section */}
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    {/* Resolution */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Resolution</label>
                      <div className="grid grid-cols-2 gap-1">
                        {RESOLUTION_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => handleResolutionPreset(preset)}
                            className={`px-2 py-1 rounded text-[10px] transition-colors ${
                              config.width === preset.width && config.height === preset.height
                                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
                                : 'bg-slate-800/50 text-slate-500 border border-slate-700/50 hover:bg-slate-700/50'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Steps & CFG */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">ComfyUI Steps</label>
                        <input
                          type="number"
                          min={10}
                          max={50}
                          value={config.steps}
                          onChange={(e) => update('steps', Number(e.target.value))}
                          className="w-full bg-slate-800/80 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">CFG Scale</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          step={0.5}
                          value={config.cfg}
                          onChange={(e) => update('cfg', Number(e.target.value))}
                          className="w-full bg-slate-800/80 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* YouTube */}
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/40 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.upload_youtube}
                    onChange={(e) => update('upload_youtube', e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500/30"
                  />
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Youtube className="h-3.5 w-3.5 text-red-500" />
                    Upload to YouTube
                  </span>
                </label>
                {config.upload_youtube && (
                  <select
                    value={config.youtube_privacy}
                    onChange={(e) => update('youtube_privacy', e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                  >
                    {PRIVACY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  canSubmit
                    ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-500/20'
                    : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                }`}
              >
                🚀 Start Batch Pipeline ({pairs.length} images)
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
