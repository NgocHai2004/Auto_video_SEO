import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import PipelineStepNode from './PipelineStepNode';
import AnimatedEdge from './AnimatedEdge';
import type { PipelineStep } from '../../types';
import { CANVAS_NODE_POSITIONS, CANVAS_EDGES } from '../../utils/constants';

const nodeTypes = { pipelineStep: PipelineStepNode };
const edgeTypes = { animated: AnimatedEdge };

interface PipelineCanvasProps {
  steps: PipelineStep[];
  onNodeClick?: (step: PipelineStep) => void;
}

export default function PipelineCanvas({ steps, onNodeClick }: PipelineCanvasProps) {
  const nodes: Node[] = useMemo(
    () =>
      steps.map((step) => ({
        id: String(step.step),
        type: 'pipelineStep',
        position: CANVAS_NODE_POSITIONS[step.step] || { x: 0, y: 0 },
        data: { step, onNodeClick },
        draggable: false,
        selectable: false,
      })),
    [steps, onNodeClick]
  );

  const edges: Edge[] = useMemo(
    () =>
      CANVAS_EDGES.map((e) => {
        const sourceStep = steps.find((s) => String(s.step) === e.source);
        const targetStep = steps.find((s) => String(s.step) === e.target);
        return {
          ...e,
          type: 'animated',
          data: {
            sourceStatus: sourceStep?.status || 'idle',
            targetStatus: targetStep?.status || 'idle',
          },
        };
      }),
    [steps]
  );

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 100);
  }, []);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-800/50 bg-[#0a0a0f]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        className="pipeline-canvas"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1a1a2a"
        />
        <Controls
          showInteractive={false}
          className="!bg-slate-900 !border-slate-700 !shadow-xl [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-400 [&>button:hover]:!bg-slate-700"
        />
        <MiniMap
          nodeColor={(node) => {
            const step = steps.find((s) => String(s.step) === node.id);
            switch (step?.status) {
              case 'running':
                return '#8b5cf6';
              case 'completed':
                return '#10b981';
              case 'error':
                return '#ef4444';
              case 'pending':
                return '#475569';
              default:
                return '#1e293b';
            }
          }}
          maskColor="rgba(10, 10, 15, 0.8)"
          className="!bg-slate-900/80 !border-slate-700"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
