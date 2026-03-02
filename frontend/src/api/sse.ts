import { API_BASE_URL } from '../utils/constants';
import type { SSEEvent } from '../types';

export function startPipelineStream(
  formData: FormData,
  onEvent: (event: SSEEvent) => void,
  onError: (error: string) => void,
  onComplete: () => void
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE_URL}/pipeline/stream`, {
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
              const data = JSON.parse(trimmed.slice(6)) as SSEEvent;
              onEvent(data);

              if (data.status === 'done' || (data.step === 0 && data.status === 'error')) {
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
        onError(err.message || 'Stream connection failed');
      }
    });

  return controller;
}

/**
 * Execute a single step in a pipeline session via SSE stream.
 */
export function executeSessionStep(
  sessionId: string,
  stepNum: number,
  onEvent: (event: SSEEvent) => void,
  onError: (error: string) => void,
  onComplete: () => void
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE_URL}/pipeline/session/${sessionId}/step/${stepNum}`, {
    method: 'POST',
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
              const data = JSON.parse(trimmed.slice(6)) as SSEEvent;
              onEvent(data);
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
        onError(err.message || 'Step execution failed');
      }
    });

  return controller;
}
