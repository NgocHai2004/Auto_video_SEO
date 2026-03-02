import { Film, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '../components/layout/PageHeader';
import PipelineForm from '../components/pipeline/PipelineForm';
import NodeFlowVisualizer from '../components/pipeline/NodeFlowVisualizer';
import PipelineResult from '../components/pipeline/PipelineResult';
import { usePipelineSSE } from '../hooks/usePipelineSSE';

export default function SinglePipeline() {
  const {
    steps,
    isRunning,
    result,
    error,
    startPipeline,
    cancelPipeline,
    resetPipeline,
  } = usePipelineSSE();

  const hasStarted = steps.some((s) => s.status !== 'idle');

  return (
    <div>
      <PageHeader
        icon={<Film className="h-5 w-5" />}
        title="Single Pipeline"
        subtitle="Create a video from an image and description"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column — Configuration */}
        <div className="glass-card p-5">
          <PipelineForm
            onSubmit={startPipeline}
            isRunning={isRunning}
            onCancel={cancelPipeline}
          />
        </div>

        {/* Right Column — Progress & Results */}
        <div className="space-y-4">
          {/* Node Flow Visualizer */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300">Pipeline Progress</h2>
              {hasStarted && !isRunning && (
                <button
                  type="button"
                  onClick={resetPipeline}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
            <NodeFlowVisualizer steps={steps} />
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-950/30 border border-red-500/30"
              >
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pipeline Result */}
          <AnimatePresence>
            {result && (
              <div className="glass-card p-5">
                <PipelineResult result={result} />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
