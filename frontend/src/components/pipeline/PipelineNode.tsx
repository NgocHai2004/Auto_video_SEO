import { motion } from 'framer-motion';
import { Check, X, Minus, Loader2 } from 'lucide-react';
import type { PipelineStep } from '../../types';

interface PipelineNodeProps {
  step: PipelineStep;
  isLast?: boolean;
}

const statusStyles = {
  idle: {
    border: 'border-slate-700',
    bg: 'bg-slate-900/50',
    iconBg: 'bg-slate-700/50',
    iconText: 'text-slate-500',
  },
  pending: {
    border: 'border-slate-600',
    bg: 'bg-slate-800/50',
    iconBg: 'bg-slate-600/50',
    iconText: 'text-slate-400',
  },
  running: {
    border: 'border-violet-500',
    bg: 'bg-violet-950/30',
    iconBg: 'bg-violet-600/30',
    iconText: 'text-violet-400',
  },
  completed: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-950/20',
    iconBg: 'bg-emerald-600/30',
    iconText: 'text-emerald-400',
  },
  error: {
    border: 'border-red-500',
    bg: 'bg-red-950/20',
    iconBg: 'bg-red-600/30',
    iconText: 'text-red-400',
  },
  skipped: {
    border: 'border-slate-600',
    bg: 'bg-slate-900/30',
    iconBg: 'bg-slate-700/30',
    iconText: 'text-slate-500',
  },
};

function StepIcon({ step }: { step: PipelineStep }) {
  const style = statusStyles[step.status];
  const iconClass = `h-4 w-4 ${style.iconText}`;

  switch (step.status) {
    case 'running':
      return <Loader2 className={`${iconClass} animate-spin`} />;
    case 'completed':
      return <Check className={iconClass} />;
    case 'error':
      return <X className={iconClass} />;
    case 'skipped':
      return <Minus className={iconClass} />;
    default:
      return <span className={`text-xs font-bold ${style.iconText}`}>{step.step}</span>;
  }
}

function getElapsedTime(step: PipelineStep): string | null {
  if (step.status === 'running' && step.startedAt) {
    const elapsed = Math.round((Date.now() - step.startedAt) / 1000);
    return `${elapsed}s`;
  }
  if (step.status === 'completed' && step.startedAt && step.completedAt) {
    const elapsed = ((step.completedAt - step.startedAt) / 1000).toFixed(1);
    return `${elapsed}s`;
  }
  return null;
}

function getStepDetail(step: PipelineStep): string | null {
  if (step.status !== 'completed' || !step.data) return null;

  const data = step.data;
  switch (step.step) {
    case 1:
      return data.script ? `${(data.script as string).length} chars` : null;
    case 2:
      return data.duration ? `${data.duration}s audio` : null;
    case 3:
      return data.prompt ? `${(data.prompt as string).substring(0, 40)}...` : null;
    case 4:
      return 'Video generated';
    case 5:
      return data.duration ? `${data.duration}s final` : 'Merged';
    case 6:
      return data.youtube_url ? 'Uploaded ✓' : null;
    default:
      return null;
  }
}

export default function PipelineNode({ step }: PipelineNodeProps) {
  const style = statusStyles[step.status];
  const elapsed = getElapsedTime(step);
  const detail = getStepDetail(step);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: step.step * 0.05 }}
      className={`
        relative flex items-center gap-3 px-4 py-3 rounded-xl border
        transition-all duration-300
        ${style.border} ${style.bg}
        ${step.status === 'running' ? 'animate-pulse-glow' : ''}
      `}
    >
      {/* Step Icon */}
      <div
        className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${style.iconBg}`}
      >
        <StepIcon step={step} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">{step.label}</span>
          {elapsed && (
            <span className="text-xs text-slate-500 tabular-nums">{elapsed}</span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {detail || step.sublabel}
        </div>
      </div>

      {/* Status indicator dot */}
      {step.status === 'running' && (
        <div className="flex-shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
          </span>
        </div>
      )}
    </motion.div>
  );
}
