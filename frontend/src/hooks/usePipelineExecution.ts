import { useCallback, useRef, useState } from 'react';
import { startPipelineStream, executeSessionStep } from '../api/sse';
import { buildPipelineStreamFormData } from '../api/pipeline';
import { createSession, deleteSession } from '../api/session';
import { PIPELINE_STEPS } from '../utils/constants';
import type {
  PipelineConfig,
  PipelineStep,
  PipelineResult,
  SSEEvent,
  ExecutionMode,
} from '../types';

export function usePipelineExecution() {
  const [steps, setSteps] = useState<PipelineStep[]>(
    PIPELINE_STEPS.map((s) => ({ ...s }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ExecutionMode>('auto');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [configReady, setConfigReady] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const imageRef = useRef<File | null>(null);
  const configRef = useRef<PipelineConfig | null>(null);

  const resetPipeline = useCallback(() => {
    setSteps(PIPELINE_STEPS.map((s) => ({ ...s })));
    setResult(null);
    setError(null);
    setIsRunning(false);
    setSessionId(null);
    setConfigReady(false);
    imageRef.current = null;
    configRef.current = null;
  }, []);

  /** Update a single step's state */
  const updateStep = useCallback(
    (stepNum: number, updates: Partial<PipelineStep>) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.step === stepNum ? { ...s, ...updates } : s
        )
      );
    },
    []
  );

  /** Handle SSE events (shared between auto and manual modes) */
  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
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
              ...(event.status === 'completed' || event.status === 'error' || event.status === 'skipped'
                ? { completedAt: Date.now() }
                : {}),
            };
          }
          return s;
        })
      );

      // In manual mode, build result progressively
      if (event.status === 'completed' && event.data) {
        if (event.step === 5 && event.data.final_path) {
          setResult((prev) => ({
            ...prev,
            final_path: event.data!.final_path as string,
            duration: event.data!.duration as number,
          }));
        }
        if (event.step === 2 && event.data.audio_path) {
          setResult((prev) => ({
            ...prev,
            audio_path: event.data!.audio_path as string,
          }));
        }
        if (event.step === 1 && event.data.script) {
          setResult((prev) => ({
            ...prev,
            audio_script: event.data!.script as string,
          }));
        }
        if (event.step === 3 && event.data.prompt) {
          setResult((prev) => ({
            ...prev,
            video_prompt: event.data!.prompt as string,
          }));
        }
        if (event.step === 4 && event.data.video_path) {
          setResult((prev) => ({
            ...prev,
            video_path: event.data!.video_path as string,
          }));
        }
        if (event.step === 6 && event.data.youtube_url) {
          setResult((prev) => ({
            ...prev,
            youtube_url: event.data!.youtube_url as string,
          }));
        }
      }
    },
    []
  );

  /** Start pipeline in AUTO mode (runs all steps via SSE) */
  const startAuto = useCallback(
    (image: File, config: PipelineConfig) => {
      resetPipeline();
      setIsRunning(true);
      setMode('auto');

      // Mark all steps as pending
      setSteps(PIPELINE_STEPS.map((s) => ({ ...s, status: 'pending' })));

      const formData = buildPipelineStreamFormData(image, config);

      const handleError = (errMsg: string) => {
        setError(errMsg);
        setIsRunning(false);
      };

      const handleComplete = () => {
        setIsRunning(false);
      };

      controllerRef.current = startPipelineStream(
        formData,
        handleSSEEvent,
        handleError,
        handleComplete
      );
    },
    [resetPipeline, handleSSEEvent]
  );

  /** Prepare pipeline in MANUAL mode (creates session, doesn't execute any step) */
  const startManual = useCallback(
    async (image: File, config: PipelineConfig) => {
      resetPipeline();
      setMode('manual');
      setConfigReady(true);
      imageRef.current = image;
      configRef.current = config;

      try {
        const session = await createSession(image, config);
        setSessionId(session.session_id);
        // Mark all steps as pending (ready to be manually triggered)
        setSteps(PIPELINE_STEPS.map((s) => ({ ...s, status: 'pending' })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create session');
      }
    },
    [resetPipeline]
  );

  /** Execute the next pending step in manual mode */
  const executeNextStep = useCallback(() => {
    if (!sessionId) {
      setError('No active session');
      return;
    }

    // Find the next step to execute
    const nextStep = steps.find((s) => s.status === 'pending');
    if (!nextStep) {
      setError('All steps are already completed or no pending steps');
      return;
    }

    setIsRunning(true);
    updateStep(nextStep.step, { status: 'running', startedAt: Date.now() });

    const handleError = (errMsg: string) => {
      setError(errMsg);
      setIsRunning(false);
      updateStep(nextStep.step, { status: 'error', completedAt: Date.now() });
    };

    const handleComplete = () => {
      setIsRunning(false);
    };

    controllerRef.current = executeSessionStep(
      sessionId,
      nextStep.step,
      handleSSEEvent,
      handleError,
      handleComplete
    );
  }, [sessionId, steps, handleSSEEvent, updateStep]);

  /** Execute a specific step by number */
  const executeStep = useCallback(
    (stepNum: number) => {
      if (!sessionId) {
        setError('No active session');
        return;
      }

      setIsRunning(true);
      updateStep(stepNum, { status: 'running', startedAt: Date.now() });

      const handleError = (errMsg: string) => {
        setError(errMsg);
        setIsRunning(false);
        updateStep(stepNum, { status: 'error', completedAt: Date.now() });
      };

      const handleComplete = () => {
        setIsRunning(false);
      };

      controllerRef.current = executeSessionStep(
        sessionId,
        stepNum,
        handleSSEEvent,
        handleError,
        handleComplete
      );
    },
    [sessionId, handleSSEEvent, updateStep]
  );

  /** Cancel the current execution */
  const cancelPipeline = useCallback(() => {
    controllerRef.current?.abort();
    setIsRunning(false);
    if (sessionId) {
      deleteSession(sessionId).catch(() => {});
      setSessionId(null);
    }
  }, [sessionId]);

  /** Get the next executable step number */
  const nextStepNum = steps.find((s) => s.status === 'pending')?.step ?? null;

  /** Check if all steps are done */
  const allDone = steps.every(
    (s) => s.status === 'completed' || s.status === 'skipped'
  );

  /** Check if pipeline has started */
  const hasStarted = steps.some((s) => s.status !== 'idle');

  return {
    steps,
    isRunning,
    result,
    error,
    mode,
    sessionId,
    configReady,
    nextStepNum,
    allDone,
    hasStarted,
    setMode,
    startAuto,
    startManual,
    executeNextStep,
    executeStep,
    cancelPipeline,
    resetPipeline,
  };
}
