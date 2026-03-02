import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Workflow } from 'lucide-react';
import PipelineCanvas from '../components/canvas/PipelineCanvas';
import ExecutionToolbar from '../components/canvas/ExecutionToolbar';
import NodeDetailPopover from '../components/canvas/NodeDetailPopover';
import ConfigDrawer from '../components/config/ConfigDrawer';
import ResultPanel from '../components/results/ResultPanel';
import { usePipelineExecution } from '../hooks/usePipelineExecution';
import type { PipelineConfig, PipelineStep } from '../types';

export default function PipelineWorkspace() {
  const {
    steps,
    isRunning,
    result,
    error,
    mode,
    configReady,
    nextStepNum,
    allDone,
    hasStarted,
    setMode,
    startAuto,
    startManual,
    executeNextStep,
    cancelPipeline,
    resetPipeline,
  } = usePipelineExecution();

  const [configOpen, setConfigOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<PipelineStep | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  // Open result panel when pipeline completes
  const prevAllDone = allDone;
  if (prevAllDone && result && !resultOpen) {
    setResultOpen(true);
  }

  const handleStart = useCallback(
    (image: File, config: PipelineConfig) => {
      setConfigOpen(false);
      setSelectedNode(null);
      setResultOpen(false);
      if (mode === 'auto') {
        startAuto(image, config);
      } else {
        startManual(image, config);
      }
    },
    [mode, startAuto, startManual]
  );

  const handleNodeClick = useCallback(
    (step: PipelineStep) => {
      if (step.status === 'completed' || step.status === 'error') {
        setSelectedNode(step);
        setResultOpen(false);
      }
    },
    []
  );

  const handleReset = useCallback(() => {
    resetPipeline();
    setSelectedNode(null);
    setResultOpen(false);
    setConfigOpen(true);
  }, [resetPipeline]);

  const handleRunAll = useCallback(() => {
    // In auto mode, this is handled by the start button in config drawer
    // But if already prepared in manual mode and switched to auto, just run all
    if (configReady && mode === 'auto') {
      // Already started auto mode from config
    }
  }, [configReady, mode]);

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col gap-3">
      {/* Page Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
            <Workflow className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Pipeline Workspace</h1>
            <p className="text-xs text-slate-500">Visual workflow editor with step-by-step execution</p>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative rounded-xl overflow-hidden">
        {/* Config Drawer */}
        <ConfigDrawer
          isOpen={configOpen}
          onToggle={() => setConfigOpen(!configOpen)}
          onStart={handleStart}
          mode={mode}
          isRunning={isRunning}
          hasStarted={hasStarted}
        />

        {/* Main Canvas */}
        <PipelineCanvas steps={steps} onNodeClick={handleNodeClick} />

        {/* Node Detail Popover */}
        {selectedNode && (
          <NodeDetailPopover
            step={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* Result Panel */}
        <ResultPanel
          result={result}
          steps={steps}
          isOpen={resultOpen}
          onClose={() => setResultOpen(false)}
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
      <ExecutionToolbar
        mode={mode}
        isRunning={isRunning}
        hasStarted={hasStarted}
        allDone={allDone}
        configReady={configReady}
        nextStepNum={nextStepNum}
        onModeChange={setMode}
        onRunAll={handleRunAll}
        onStepForward={executeNextStep}
        onStop={cancelPipeline}
        onReset={handleReset}
      />
    </div>
  );
}
