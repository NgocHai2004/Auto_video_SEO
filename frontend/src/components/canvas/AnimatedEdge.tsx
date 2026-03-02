import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

interface AnimatedEdgeData {
  sourceStatus?: string;
  targetStatus?: string;
  [key: string]: unknown;
}

function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
}: EdgeProps & { data?: AnimatedEdgeData }) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const sourceStatus = data?.sourceStatus || 'idle';
  const targetStatus = data?.targetStatus || 'idle';

  // Determine edge visual state
  const isFlowing =
    sourceStatus === 'completed' && targetStatus === 'running';
  const isCompleted =
    sourceStatus === 'completed' &&
    (targetStatus === 'completed' || targetStatus === 'skipped');
  const isError =
    sourceStatus === 'error' || targetStatus === 'error';
  const isPending =
    sourceStatus === 'pending' || targetStatus === 'pending';

  let strokeColor = '#334155'; // slate-700 default
  let strokeWidth = 2;
  let dashArray = '6 4';
  let opacity = 0.5;

  if (isCompleted) {
    strokeColor = '#10b981'; // emerald-500
    dashArray = '';
    opacity = 0.8;
    strokeWidth = 2.5;
  } else if (isFlowing) {
    strokeColor = '#8b5cf6'; // violet-500
    dashArray = '';
    opacity = 1;
    strokeWidth = 3;
  } else if (isError) {
    strokeColor = '#ef4444'; // red-500
    dashArray = '4 4';
    opacity = 0.7;
  } else if (isPending) {
    strokeColor = '#475569'; // slate-600
    dashArray = '6 4';
    opacity = 0.4;
  }

  return (
    <>
      {/* Glow layer for active/completed edges */}
      {(isFlowing || isCompleted) && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            ...style,
            stroke: strokeColor,
            strokeWidth: strokeWidth + 4,
            opacity: isFlowing ? 0.2 : 0.1,
            filter: 'blur(4px)',
            strokeDasharray: '',
          }}
        />
      )}

      {/* Main edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: dashArray,
          opacity,
          transition: 'stroke 0.5s, stroke-width 0.3s, opacity 0.5s',
        }}
      />

      {/* Animated dot for flowing state */}
      {isFlowing && (
        <circle r="4" fill="#8b5cf6" filter="url(#glow-filter)">
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* SVG filter for glow effect */}
      {isFlowing && (
        <defs>
          <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
    </>
  );
}

export default memo(AnimatedEdge);
