import {
  Play,
  SkipForward,
  Square,
  RotateCcw,
  Zap,
  Hand,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { ExecutionMode } from '../../types';

interface ExecutionToolbarProps {
  mode: ExecutionMode;
  isRunning: boolean;
  hasStarted: boolean;
  allDone: boolean;
  configReady: boolean;
  nextStepNum: number | null;
  onModeChange: (mode: ExecutionMode) => void;
  onRunAll: () => void;
  onStepForward: () => void;
  onStop: () => void;
  onReset: () => void;
}

export default function ExecutionToolbar({
  mode,
  isRunning,
  hasStarted,
  allDone,
  configReady,
  nextStepNum,
  onModeChange,
  onRunAll,
  onStepForward,
  onStop,
  onReset,
}: ExecutionToolbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#13131a]/90 backdrop-blur-md border border-slate-800/60"
    >
      {/* Mode Selector */}
      <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1">
        <button
          type="button"
          onClick={() => onModeChange('auto')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === 'auto'
              ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Auto
        </button>
        <button
          type="button"
          onClick={() => onModeChange('manual')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === 'manual'
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <Hand className="h-3.5 w-3.5" />
          Manual
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-700/50" />

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {mode === 'auto' ? (
          <button
            type="button"
            onClick={onRunAll}
            disabled={isRunning || !configReady || allDone}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isRunning || !configReady || allDone
                ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                : 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40'
            }`}
          >
            <Play className="h-4 w-4" />
            Run All
          </button>
        ) : (
          <button
            type="button"
            onClick={onStepForward}
            disabled={isRunning || !configReady || allDone || nextStepNum === null}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isRunning || !configReady || allDone || nextStepNum === null
                ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40'
            }`}
          >
            <SkipForward className="h-4 w-4" />
            {nextStepNum ? `Step ${nextStepNum}` : 'Done'}
          </button>
        )}

        {isRunning && (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-all"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>
        )}

        {hasStarted && !isRunning && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800/60 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* Status indicator */}
      <div className="ml-auto flex items-center gap-2">
        {isRunning && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            <span className="text-xs text-violet-400 font-medium">Running...</span>
          </div>
        )}
        {allDone && !isRunning && (
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            ✓ Pipeline Complete
          </span>
        )}
        {hasStarted && !isRunning && !allDone && mode === 'manual' && (
          <span className="text-xs text-cyan-400 font-medium">
            Step {(nextStepNum ?? 7) - 1}/6 completed
          </span>
        )}
      </div>
    </motion.div>
  );
}
