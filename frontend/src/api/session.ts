import client from './client';
import type { PipelineConfig, PipelineSession } from '../types';

export async function createSession(image: File, config: PipelineConfig): Promise<PipelineSession> {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('description', config.description);
  formData.append('duration', String(config.duration));
  formData.append('voice', config.voice);
  if (config.background) formData.append('background', config.background);
  formData.append('bg_volume', String(config.bg_volume));
  formData.append('width', String(config.width));
  formData.append('height', String(config.height));
  formData.append('steps', String(config.steps));
  formData.append('cfg', String(config.cfg));
  if (config.audio_script) formData.append('audio_script', config.audio_script);
  if (config.video_prompt) formData.append('video_prompt', config.video_prompt);
  formData.append('upload_youtube', String(config.upload_youtube));
  if (config.youtube_privacy) formData.append('youtube_privacy', config.youtube_privacy);

  const response = await client.post('/pipeline/session', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function getSession(sessionId: string): Promise<PipelineSession> {
  const response = await client.get(`/pipeline/session/${sessionId}`);
  return response.data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await client.delete(`/pipeline/session/${sessionId}`);
}
