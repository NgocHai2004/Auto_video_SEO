import PipelineNode from './PipelineNode';
import NodeConnector from './NodeConnector';
import type { PipelineStep } from '../../types';

interface NodeFlowVisualizerProps {
  steps: PipelineStep[];
}

export default function NodeFlowVisualizer({ steps }: NodeFlowVisualizerProps) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={step.step}>
          <PipelineNode step={step} isLast={i === steps.length - 1} />
          {i < steps.length - 1 && (
            <NodeConnector
              fromStatus={step.status}
              toStatus={steps[i + 1].status}
            />
          )}
        </div>
      ))}
    </div>
  );
}
