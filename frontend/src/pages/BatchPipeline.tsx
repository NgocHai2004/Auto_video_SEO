import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Layers } from 'lucide-react';
import BatchPipelineCanvas from '../components/canvas/BatchPipelineCanvas';
import BatchExecutionToolbar from '../components/canvas/BatchExecutionToolbar';
import BatchConfigDrawer from '../components/config/BatchConfigDrawer';
import BatchImageQueue from '../components/batch/BatchImageQueue';
import NodeDetailPopover from '../components/canvas/NodeDetailPopover';
import { useBatchPipelineExecution } from '../hooks/useBatchPipelineExecution';
import type { PipelineConfig, PipelineStep, UploadedPair } from '../types';

export default function BatchPipeline() {
  const {
    steps,
    batchStatus,
    isRunning,
    error,
    currentImageIndex,
    currentImageName,
    totalImages,
    imageResults,
    scheduleCountdown,
    successCount,
    errorCount,
    startBatch,
    cancelBatch,
    resetPipeline,
  } = useBatchPipelineExecution();

  const [configOpen, setConfigOpen] = useState(true);
  const [queueOpen, setQueueOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<PipelineStep | null>(null);

  // Open queue panel when batch starts running
  const hasStarted = batchStatus !== 'idle';
  if (hasStarted && !queueOpen && imageResults.length > 0) {
    setQueueOpen(true);
  }

  const handleStart = useCallback(
    (
      pairs: UploadedPair[],
      config: PipelineConfig,
      scheduleTime: string | null,
      delayBetween: number
    ) => {
      setConfigOpen(false);
      setSelectedNode(null);
      startBatch(pairs, config, scheduleTime, delayBetween);
    },
    [startBatch]
  );

  const handleNodeClick = useCallback((step: PipelineStep) => {
    if (step.status === 'completed' || step.status === 'error') {
      setSelectedNode(step);
      setQueueOpen(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    resetPipeline();
    setSelectedNode(null);
    setQueueOpen(false);
    setConfigOpen(true);
  }, [resetPipeline]);

  const handleToggleQueue = useCallback(() => {
    setQueueOpen((prev) => !prev);
    if (!queueOpen) setSelectedNode(null);
  }, [queueOpen]);

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col gap-3">
      {/* Page Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-amber-500 flex items-center justify-center">
            <Layers className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Batch Pipeline</h1>
            <p className="text-xs text-slate-500">
              Process multiple images sequentially through the pipeline
            </p>
          </div>
        </div>

        {/* Queue toggle button */}
        {imageResults.length > 0 && (
          <button
            onClick={handleToggleQueue}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              queueOpen
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40'
                : 'bg-slate-800/60 text-slate-400 border border-slate-700/40 hover:text-slate-300'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Queue ({imageResults.length})
          </button>
        )}
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative rounded-xl overflow-hidden">
        {/* Config Drawer */}
        <BatchConfigDrawer
          isOpen={configOpen}
          onToggle={() => setConfigOpen(!configOpen)}
          onStart={handleStart}
          isRunning={isRunning}
          hasStarted={hasStarted}
        />

        {/* Main Canvas */}
        <BatchPipelineCanvas
          steps={steps}
          currentImageName={currentImageName}
          currentImageIndex={currentImageIndex}
          totalImages={totalImages}
          onNodeClick={handleNodeClick}
        />

        {/* Node Detail Popover */}
        {selectedNode && (
          <NodeDetailPopover
            step={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* Image Queue Panel */}
        <BatchImageQueue
          isOpen={queueOpen}
          onClose={() => setQueueOpen(false)}
          imageResults={imageResults}
          currentImageIndex={currentImageIndex}
        />
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-950/30 border border-red-500/30"
          >
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Execution Toolbar */}
      <BatchExecutionToolbar
        batchStatus={batchStatus}
        isRunning={isRunning}
        totalImages={totalImages}
        currentImageIndex={currentImageIndex}
        currentImageName={currentImageName}
        successCount={successCount}
        errorCount={errorCount}
        scheduleCountdown={scheduleCountdown}
        imageResults={imageResults}
        onStop={cancelBatch}
        onReset={handleReset}
      />
    </div>
  );
}
