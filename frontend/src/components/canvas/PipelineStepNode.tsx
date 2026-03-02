import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import {
  Brain,
  Mic,
  Sparkles,
  Film,
  GitMerge,
  Upload,
  Check,
  X,
  Minus,
  Loader2,
  Clock,
} from 'lucide-react';
import type { PipelineStep } from '../../types';

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  brain: Brain,
  mic: Mic,
  sparkles: Sparkles,
  film: Film,
  merge: GitMerge,
  upload: Upload,
  clock: Clock,
};

const statusConfig = {
  idle: {
    border: 'border-slate-700/60',
    bg: 'bg-[#13131a]',
    glow: '',
    iconBg: 'bg-slate-800',
    iconColor: 'text-slate-500',
    labelColor: 'text-slate-400',
  },
  pending: {
    border: 'border-slate-600/60',
    bg: 'bg-[#15151f]',
    glow: '',
    iconBg: 'bg-slate-700/60',
    iconColor: 'text-slate-400',
    labelColor: 'text-slate-300',
  },
  running: {
    border: 'border-violet-500',
    bg: 'bg-[#1a1528]',
    glow: 'shadow-[0_0_25px_rgba(139,92,246,0.4)]',
    iconBg: 'bg-violet-600/30',
    iconColor: 'text-violet-400',
    labelColor: 'text-violet-200',
  },
  completed: {
    border: 'border-emerald-500/70',
    bg: 'bg-[#121f1a]',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    iconBg: 'bg-emerald-600/20',
    iconColor: 'text-emerald-400',
    labelColor: 'text-emerald-200',
  },
  error: {
    border: 'border-red-500/70',
    bg: 'bg-[#1f1215]',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    iconBg: 'bg-red-600/20',
    iconColor: 'text-red-400',
    labelColor: 'text-red-200',
  },
  skipped: {
    border: 'border-slate-600/40',
    bg: 'bg-[#111118]',
    glow: '',
    iconBg: 'bg-slate-800/40',
    iconColor: 'text-slate-600',
    labelColor: 'text-slate-500',
  },
};

function StatusIcon({ status, className }: { status: string; className?: string }) {
  switch (status) {
    case 'running':
      return <Loader2 className={`${className} animate-spin`} />;
    case 'completed':
      return <Check className={className} />;
    case 'error':
      return <X className={className} />;
    case 'skipped':
      return <Minus className={className} />;
    default:
      return null;
  }
}

function getElapsedTime(step: PipelineStep): string | null {
  if (step.status === 'running' && step.startedAt) {
    const elapsed = Math.round((Date.now() - step.startedAt) / 1000);
    return `${elapsed}s`;
  }
  if (
    (step.status === 'completed' || step.status === 'error') &&
    step.startedAt &&
    step.completedAt
  ) {
    const elapsed = ((step.completedAt - step.startedAt) / 1000).toFixed(1);
    return `${elapsed}s`;
  }
  return null;
}

interface PipelineStepNodeData {
  step: PipelineStep;
  onNodeClick?: (step: PipelineStep) => void;
  minStep?: number;
  maxStep?: number;
  [key: string]: unknown;
}

function PipelineStepNode({ data }: NodeProps & { data: PipelineStepNodeData }) {
  const { step, onNodeClick } = data;
  const config = statusConfig[step.status];
  const IconComponent = iconMap[step.icon] || Brain;
  const elapsed = getElapsedTime(step);

  // Determine handle positions based on node layout
  // For batch mode (has step 0): 0=Schedule(left-center), 1-3=top row, 4-6=bottom row reversed
  // For normal mode: 1-3=top row, 4-6=bottom row reversed
  const hasTargetHandle = step.step > (data.minStep ?? 1);
  const hasSourceHandle = step.step < (data.maxStep ?? 6);

  const getTargetPosition = () => {
    if (step.step === 0) return Position.Left;
    if (step.step <= 3) return Position.Left;
    return Position.Right;
  };

  const getSourcePosition = () => {
    if (step.step === 0) return Position.Right;
    if (step.step < 3) return Position.Right;
    if (step.step === 3) return Position.Bottom;
    return Position.Left;
  };

  return (
    <>
      {/* Input handle */}
      {hasTargetHandle && (
        <Handle
          type="target"
          position={getTargetPosition()}
          className="!bg-slate-600 !border-slate-500 !w-2 !h-2"
        />
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: step.step * 0.05, duration: 0.3 }}
        onClick={() => onNodeClick?.(step)}
        className={`
          relative w-[200px] rounded-xl border-2 cursor-pointer
          transition-all duration-500 select-none
          ${config.border} ${config.bg} ${config.glow}
          hover:brightness-110
          ${step.status === 'running' ? 'animate-pulse-glow' : ''}
        `}
      >
        {/* Top accent bar */}
        <div
          className={`h-1 rounded-t-[10px] ${
            step.status === 'running'
              ? 'bg-gradient-to-r from-violet-500 to-cyan-500'
              : step.status === 'completed'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
              : step.status === 'error'
              ? 'bg-gradient-to-r from-red-500 to-orange-500'
              : 'bg-slate-700/30'
          }`}
        />

        <div className="px-4 py-3">
          {/* Header row: icon + status */}
          <div className="flex items-center justify-between mb-2">
            <div
              className={`h-9 w-9 rounded-lg flex items-center justify-center ${config.iconBg}`}
            >
              <IconComponent className={`h-4.5 w-4.5 ${config.iconColor}`} />
            </div>

            <div className="flex items-center gap-1.5">
              {elapsed && (
                <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                  {elapsed}
                </span>
              )}
              {step.status !== 'idle' && step.status !== 'pending' && (
                <StatusIcon
                  status={step.status}
                  className={`h-4 w-4 ${config.iconColor}`}
                />
              )}
              {step.status === 'running' && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                </span>
              )}
            </div>
          </div>

          {/* Label */}
          <div className={`text-sm font-semibold ${config.labelColor}`}>
            {step.label}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{step.sublabel}</div>

          {/* Step number badge */}
          <div className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
            <span className="text-[10px] font-bold text-slate-400">
              {step.step}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Output handle */}
      {hasSourceHandle && (
        <Handle
          type="source"
          position={getSourcePosition()}
          className="!bg-slate-600 !border-slate-500 !w-2 !h-2"
        />
      )}
    </>
  );
}

export default memo(PipelineStepNode);
