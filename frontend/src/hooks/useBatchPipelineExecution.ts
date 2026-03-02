import { useCallback, useRef, useState } from 'react';
import { startBatchPipelineStream, buildBatchStreamFormData } from '../api/batch';
import { BATCH_PIPELINE_STEPS } from '../utils/constants';
import type {
  PipelineConfig,
  PipelineStep,
  BatchSSEEvent,
  BatchImageResult,
  BatchStatus,
  UploadedPair,
} from '../types';

export function useBatchPipelineExecution() {
  const [steps, setSteps] = useState<PipelineStep[]>(
    BATCH_PIPELINE_STEPS.map((s) => ({ ...s }))
  );
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImageName, setCurrentImageName] = useState('');
  const [totalImages, setTotalImages] = useState(0);
  const [imageResults, setImageResults] = useState<BatchImageResult[]>([]);
  const [scheduleCountdown, setScheduleCountdown] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);

  /** Reset all state to initial */
  const resetPipeline = useCallback(() => {
    setSteps(BATCH_PIPELINE_STEPS.map((s) => ({ ...s })));
    setBatchStatus('idle');
    setError(null);
    setCurrentImageIndex(0);
    setCurrentImageName('');
    setTotalImages(0);
    setImageResults([]);
    setScheduleCountdown(null);
  }, []);

  /** Handle a single SSE event from the batch stream */
  const handleBatchEvent = useCallback(
    (event: BatchSSEEvent) => {
      const { step, status, data, image_index, image_name, total_images } = event;

      // Backend uses 1-based index (enumerate(pairs, 1)), convert to 0-based
      const zeroIndex = image_index > 0 ? image_index - 1 : 0;

      // Update tracking info
      if (total_images > 0) setTotalImages(total_images);
      if (image_name) setCurrentImageName(image_name);
      setCurrentImageIndex(zeroIndex);

      // Schedule waiting statuses
      if (status === 'schedule_wait') {
        setBatchStatus('waiting');
        setSteps((prev) =>
          prev.map((s) =>
            s.step === 0
              ? { ...s, status: 'running', startedAt: Date.now() }
              : s
          )
        );
        if (data?.remaining_seconds) {
          setScheduleCountdown(`Waiting ${data.remaining_seconds}s`);
        }
        return;
      }

      if (status === 'schedule_tick') {
        if (data?.remaining_seconds) {
          setScheduleCountdown(`${data.remaining_seconds}s remaining`);
        }
        return;
      }

      // Schedule completed → mark step 0 completed
      if (status === 'completed' && step === 0 && !data?.result) {
        setScheduleCountdown(null);
        setSteps((prev) =>
          prev.map((s) =>
            s.step === 0
              ? { ...s, status: 'completed', completedAt: Date.now() }
              : s
          )
        );
        return;
      }

      // Image start → reset ALL steps to idle, then mark Schedule completed + steps 1-6 pending
      if (status === 'image_start') {
        setBatchStatus('running');
        setScheduleCountdown(null);

        // Reset ALL steps to idle first (visual reset between images)
        setSteps(
          BATCH_PIPELINE_STEPS.map((s) => ({
            ...s,
            status: 'idle' as const,
            data: null,
            startedAt: undefined,
            completedAt: undefined,
          }))
        );

        // After a brief delay, mark Schedule as completed and steps 1-6 as pending
        setTimeout(() => {
          setSteps((prev) =>
            prev.map((s) => {
              if (s.step === 0) return { ...s, status: 'completed' as const, completedAt: Date.now() };
              return { ...s, status: 'pending' as const };
            })
          );
        }, 150);

        // Update the matching image result to processing (using 0-based index)
        setImageResults((prev) =>
          prev.map((r) =>
            r.index === zeroIndex
              ? { ...r, status: 'processing', name: image_name || r.name }
              : r
          )
        );
        return;
      }

      // Step running/completed/error/skipped → update the step node
      if (step >= 1 && step <= 6) {
        if (status === 'running' || status === 'completed' || status === 'error' || status === 'skipped') {
          setSteps((prev) =>
            prev.map((s) => {
              if (s.step === step) {
                return {
                  ...s,
                  status: status as PipelineStep['status'],
                  data: data ?? null,
                  ...(status === 'running' ? { startedAt: Date.now() } : {}),
                  ...(status === 'completed' || status === 'error' || status === 'skipped'
                    ? { completedAt: Date.now() }
                    : {}),
                };
              }
              return s;
            })
          );
        }
      }

      // Image done → update image result (data.result contains the item_result from backend)
      if (status === 'image_done') {
        const resultData = (data?.result as Record<string, unknown>) || data || {};
        const imageStatus = resultData.status as string;
        setImageResults((prev) =>
          prev.map((r) =>
            r.index === zeroIndex
              ? {
                  ...r,
                  status: imageStatus === 'success' ? 'success' : 'error',
                  final_path: (resultData.final_path as string) || undefined,
                  youtube_url: (resultData.youtube_url as string) || undefined,
                  audio_script: (resultData.audio_script as string) || undefined,
                  duration: (resultData.duration as number) || undefined,
                  error: (resultData.error as string) || undefined,
                }
              : r
          )
        );
        return;
      }

      // Image error → update image result
      if (status === 'image_error') {
        setImageResults((prev) =>
          prev.map((r) =>
            r.index === zeroIndex
              ? {
                  ...r,
                  status: 'error',
                  error: (data?.error as string) || 'Unknown error',
                }
              : r
          )
        );
        return;
      }

      // Delay between images → reset ALL steps (including Schedule) to idle, then show Schedule as running/waiting
      if (status === 'delay_wait') {
        setScheduleCountdown(`Next image in ${data?.delay_seconds || 0}s`);
        // Reset ALL steps to idle (including Schedule node)
        setSteps(
          BATCH_PIPELINE_STEPS.map((s) => ({
            ...s,
            status: 'idle' as const,
            data: null,
            startedAt: undefined,
            completedAt: undefined,
          }))
        );
        // After brief idle flash, show Schedule node as "running" (waiting for next image)
        setTimeout(() => {
          setSteps((prev) =>
            prev.map((s) =>
              s.step === 0
                ? { ...s, status: 'running' as const, startedAt: Date.now() }
                : s
            )
          );
        }, 150);
        return;
      }

      // Batch completed
      if (status === 'batch_done') {
        setBatchStatus('completed');
        setScheduleCountdown(null);
        return;
      }

      // Batch error
      if (status === 'batch_error') {
        setBatchStatus('error');
        setError((data?.error as string) || 'Batch pipeline failed');
        setScheduleCountdown(null);
        return;
      }
    },
    []
  );

  /** Start the batch pipeline */
  const startBatch = useCallback(
    (
      pairs: UploadedPair[],
      config: PipelineConfig,
      scheduleTime: string | null,
      delayBetween: number
    ) => {
      resetPipeline();
      setBatchStatus('running');

      // Collect all files (images + descriptions interleaved)
      const files: File[] = [];
      pairs.forEach((pair) => {
        files.push(pair.image);
        files.push(pair.descriptionFile);
      });

      const formData = buildBatchStreamFormData(files, {
        duration: config.duration,
        voice: config.voice,
        background: config.background,
        bg_volume: config.bg_volume,
        width: config.width,
        height: config.height,
        steps: config.steps,
        cfg: config.cfg,
        upload_youtube: config.upload_youtube,
        youtube_privacy: config.youtube_privacy,
        schedule_time: scheduleTime,
        delay_between: delayBetween,
      });

      // Mark all steps as pending
      setSteps(
        BATCH_PIPELINE_STEPS.map((s) => ({ ...s, status: 'pending' as const }))
      );
      setTotalImages(pairs.length);

      // Initialize image results
      setImageResults(
        pairs.map((p, i) => ({
          index: i,
          name: p.name,
          status: 'pending' as const,
        }))
      );

      const handleError = (errMsg: string) => {
        setError(errMsg);
        setBatchStatus('error');
      };

      const handleComplete = () => {
        // SSE stream closed — if batch_done wasn't sent, mark as completed
        setBatchStatus((prev) => (prev === 'running' ? 'completed' : prev));
      };

      controllerRef.current = startBatchPipelineStream(
        formData,
        handleBatchEvent,
        handleError,
        handleComplete
      );
    },
    [resetPipeline, handleBatchEvent]
  );

  /** Cancel the batch pipeline */
  const cancelBatch = useCallback(() => {
    controllerRef.current?.abort();
    setBatchStatus('idle');
  }, []);

  // Derived state
  const isRunning = batchStatus === 'running' || batchStatus === 'waiting';
  const isCompleted = batchStatus === 'completed';
  const successCount = imageResults.filter((r) => r.status === 'success').length;
  const errorCount = imageResults.filter((r) => r.status === 'error').length;

  return {
    steps,
    batchStatus,
    isRunning,
    isCompleted,
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
  };
}
