import type { NodeStatus } from '../../types';

interface NodeConnectorProps {
  fromStatus: NodeStatus;
  toStatus: NodeStatus;
}

export default function NodeConnector({ fromStatus, toStatus }: NodeConnectorProps) {
  const isActive = fromStatus === 'completed' && toStatus === 'running';
  const isCompleted = fromStatus === 'completed' && toStatus === 'completed';

  let lineClass = 'w-0.5 h-4 mx-auto rounded-full transition-colors duration-300';

  if (isCompleted) {
    lineClass += ' bg-emerald-500/60';
  } else if (isActive) {
    lineClass += ' animate-flow-dots w-[2px] h-5';
  } else {
    lineClass += ' bg-slate-700/50 border border-dashed border-slate-700';
  }

  return (
    <div className="flex justify-center">
      <div className={lineClass} />
    </div>
  );
}
