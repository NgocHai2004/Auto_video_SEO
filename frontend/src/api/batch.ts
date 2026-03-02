import client from './client';
import { API_BASE_URL } from '../utils/constants';
import type { BatchJob, BatchCreateResponse, BatchListResponse, BatchSSEEvent } from '../types';

export async function createBatchJob(
  files: File[],
  params: {
    duration: number;
    voice: string;
    background?: string | null;
    bg_volume: number;
    width: number;
    height: number;
    steps: number;
    cfg: number;
    upload_youtube: boolean;
    youtube_privacy?: string;
    schedule_time?: string | null;
    delay_between: number;
  }
): Promise<BatchCreateResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('duration', String(params.duration));
  formData.append('voice', params.voice);
  if (params.background) formData.append('background', params.background);
  formData.append('bg_volume', String(params.bg_volume));
  formData.append('width', String(params.width));
  formData.append('height', String(params.height));
  formData.append('steps', String(params.steps));
  formData.append('cfg', String(params.cfg));
  formData.append('upload_youtube', String(params.upload_youtube));
  if (params.youtube_privacy) formData.append('youtube_privacy', params.youtube_privacy);
  if (params.schedule_time) {
    formData.append('schedule_time', params.schedule_time);
    formData.append('client_timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  }
  formData.append('delay_between', String(params.delay_between));

  const response = await client.post<BatchCreateResponse>('/batch-pipeline', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function getBatchStatus(jobId: string): Promise<BatchJob> {
  const response = await client.get<BatchJob>(`/batch-pipeline/${jobId}`);
  return response.data;
}

export async function listBatchJobs(): Promise<BatchListResponse> {
  const response = await client.get<BatchListResponse>('/batch-pipeline');
  return response.data;
}

/**
 * Build FormData for batch pipeline SSE stream.
 */
export function buildBatchStreamFormData(
  files: File[],
  params: {
    duration: number;
    voice: string;
    background?: string | null;
    bg_volume: number;
    width: number;
    height: number;
    steps: number;
    cfg: number;
    upload_youtube: boolean;
    youtube_privacy?: string;
    schedule_time?: string | null;
    delay_between: number;
  }
): FormData {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('duration', String(params.duration));
  formData.append('voice', params.voice);
  if (params.background) formData.append('background', params.background);
  formData.append('bg_volume', String(params.bg_volume));
  formData.append('width', String(params.width));
  formData.append('height', String(params.height));
  formData.append('steps', String(params.steps));
  formData.append('cfg', String(params.cfg));
  formData.append('upload_youtube', String(params.upload_youtube));
  if (params.youtube_privacy) formData.append('youtube_privacy', params.youtube_privacy);
  if (params.schedule_time) {
    formData.append('schedule_time', params.schedule_time);
    formData.append('client_timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  }
  formData.append('delay_between', String(params.delay_between));
  return formData;
}

/**
 * Start batch pipeline SSE stream for real-time step-by-step progress.
 */
export function startBatchPipelineStream(
  formData: FormData,
  onEvent: (event: BatchSSEEvent) => void,
  onError: (error: string) => void,
  onComplete: () => void
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE_URL}/batch-pipeline/stream`, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        onError(`HTTP ${response.status}: ${text}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6)) as BatchSSEEvent;
              onEvent(data);

              if (data.status === 'batch_done' || data.status === 'batch_error') {
                onComplete();
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }

      onComplete();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Batch stream connection failed');
      }
    });

  return controller;
}
