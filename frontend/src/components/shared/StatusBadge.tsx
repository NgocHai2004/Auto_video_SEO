import type { NodeStatus } from '../../types';

interface StatusBadgeProps {
  status: NodeStatus | string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  idle: { bg: 'bg-slate-700/50', text: 'text-slate-400', label: 'Idle' },
  pending: { bg: 'bg-slate-600/50', text: 'text-slate-300', label: 'Pending' },
  running: { bg: 'bg-violet-500/20', text: 'text-violet-400', label: 'Running' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Completed' },
  success: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Success' },
  error: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Error' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
  skipped: { bg: 'bg-slate-600/30', text: 'text-slate-500', label: 'Skipped' },
  queued: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Queued' },
  scheduled: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Scheduled' },
  processing: { bg: 'bg-violet-500/20', text: 'text-violet-400', label: 'Processing' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.idle;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClass}`}
    >
      {status === 'running' || status === 'processing' ? (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      ) : null}
      {config.label}
    </span>
  );
}
