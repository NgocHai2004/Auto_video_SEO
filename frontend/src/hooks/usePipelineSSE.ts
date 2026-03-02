import { useCallback, useRef, useState } from 'react';
import { startPipelineStream } from '../api/sse';
import { buildPipelineStreamFormData } from '../api/pipeline';
import { PIPELINE_STEPS } from '../utils/constants';
import type { PipelineConfig, PipelineStep, PipelineResult, SSEEvent } from '../types';

export function usePipelineSSE() {
  const [steps, setSteps] = useState<PipelineStep[]>(
    PIPELINE_STEPS.map((s) => ({ ...s }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const resetPipeline = useCallback(() => {
    setSteps(PIPELINE_STEPS.map((s) => ({ ...s })));
    setResult(null);
    setError(null);
    setIsRunning(false);
  }, []);

  const startPipeline = useCallback((image: File, config: PipelineConfig) => {
    resetPipeline();
    setIsRunning(true);

    // Mark all steps as pending
    setSteps(PIPELINE_STEPS.map((s) => ({ ...s, status: 'pending' })));

    const formData = buildPipelineStreamFormData(image, config);

    const handleEvent = (event: SSEEvent) => {
      if (event.step === 0) {
        // Pipeline done or error
        if (event.status === 'done' && event.data) {
          setResult({
            final_path: event.data.final_path as string | undefined,
            audio_path: event.data.audio_path as string | undefined,
            video_path: event.data.video_path as string | undefined,
            youtube_url: event.data.youtube_url as string | undefined,
            audio_script: event.data.audio_script as string | undefined,
            video_prompt: event.data.video_prompt as string | undefined,
            duration: event.data.duration as number | undefined,
          });
        } else if (event.status === 'error') {
          setError((event.data?.error as string) || 'Pipeline failed');
        }
        return;
      }

      setSteps((prev) =>
        prev.map((s) => {
          if (s.step === event.step) {
            return {
              ...s,
              status: event.status as PipelineStep['status'],
              data: event.data,
              ...(event.status === 'running' ? { startedAt: Date.now() } : {}),
              ...(event.status === 'completed' || event.status === 'error'
                ? { completedAt: Date.now() }
                : {}),
            };
          }
          return s;
        })
      );
    };

    const handleError = (errMsg: string) => {
      setError(errMsg);
      setIsRunning(false);
    };

    const handleComplete = () => {
      setIsRunning(false);
    };

    controllerRef.current = startPipelineStream(
      formData,
      handleEvent,
      handleError,
      handleComplete
    );
  }, [resetPipeline]);

  const cancelPipeline = useCallback(() => {
    controllerRef.current?.abort();
    setIsRunning(false);
  }, []);

  return {
    steps,
    isRunning,
    result,
    error,
    startPipeline,
    cancelPipeline,
    resetPipeline,
  };
}
