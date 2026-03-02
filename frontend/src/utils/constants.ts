import type { PipelineStep } from '../types';

export const API_BASE_URL = '/api';

export const PIPELINE_STEPS: PipelineStep[] = [
  { step: 1, label: 'Audio Script', sublabel: 'Groq LLM', icon: 'brain', status: 'idle' },
  { step: 2, label: 'TTS Audio', sublabel: 'Edge TTS', icon: 'mic', status: 'idle' },
  { step: 3, label: 'Video Prompt', sublabel: 'Groq LLM', icon: 'sparkles', status: 'idle' },
  { step: 4, label: 'Generate Video', sublabel: 'ComfyUI Wan2.2', icon: 'film', status: 'idle' },
  { step: 5, label: 'Merge A/V', sublabel: 'ffmpeg', icon: 'merge', status: 'idle' },
  { step: 6, label: 'YouTube Upload', sublabel: 'YouTube API', icon: 'upload', status: 'idle' },
];

export const DEFAULT_PIPELINE_CONFIG = {
  description: '',
  duration: 5,
  voice: 'vi-female',
  background: null as string | null,
  bg_volume: 0.3,
  width: 1280,
  height: 704,
  steps: 20,
  cfg: 5.0,
  audio_script: null as string | null,
  video_prompt: null as string | null,
  upload_youtube: false,
  youtube_privacy: 'private',
};

export const RESOLUTION_PRESETS = [
  { label: '1280×704 (16:9)', width: 1280, height: 704 },
  { label: '704×1280 (9:16)', width: 704, height: 1280 },
  { label: '960×960 (1:1)', width: 960, height: 960 },
  { label: '832×480 (Widescreen)', width: 832, height: 480 },
  { label: '480×832 (Portrait)', width: 480, height: 832 },
];

export const PRIVACY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'public', label: 'Public' },
];

export const BATCH_POLL_INTERVAL = 3000; // ms
export const JOBS_REFRESH_INTERVAL = 5000; // ms

// ================= Canvas Layout =================

/** Node positions for the React Flow canvas (2-row layout) */
export const CANVAS_NODE_POSITIONS: Record<number, { x: number; y: number }> = {
  1: { x: 50, y: 80 },
  2: { x: 350, y: 80 },
  3: { x: 650, y: 80 },
  4: { x: 650, y: 280 },
  5: { x: 350, y: 280 },
  6: { x: 50, y: 280 },
};

/** Edge definitions connecting the pipeline steps */
export const CANVAS_EDGES = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e3-4', source: '3', target: '4' },
  { id: 'e4-5', source: '4', target: '5' },
  { id: 'e5-6', source: '5', target: '6' },
];

// ================= Batch Canvas Layout =================

/** Pipeline steps for batch mode (includes Schedule node as step 0) */
export const BATCH_PIPELINE_STEPS: PipelineStep[] = [
  { step: 0, label: 'Schedule', sublabel: 'Wait/Timer', icon: 'clock', status: 'idle' },
  { step: 1, label: 'Audio Script', sublabel: 'Groq LLM', icon: 'brain', status: 'idle' },
  { step: 2, label: 'TTS Audio', sublabel: 'Edge TTS', icon: 'mic', status: 'idle' },
  { step: 3, label: 'Video Prompt', sublabel: 'Groq LLM', icon: 'sparkles', status: 'idle' },
  { step: 4, label: 'Generate Video', sublabel: 'ComfyUI Wan2.2', icon: 'film', status: 'idle' },
  { step: 5, label: 'Merge A/V', sublabel: 'ffmpeg', icon: 'merge', status: 'idle' },
  { step: 6, label: 'YouTube Upload', sublabel: 'YouTube API', icon: 'upload', status: 'idle' },
];

/** Node positions for batch canvas (7 nodes, zigzag layout) */
export const BATCH_CANVAS_NODE_POSITIONS: Record<number, { x: number; y: number }> = {
  0: { x: 50, y: 170 },   // Schedule - left center
  1: { x: 300, y: 60 },   // Audio Script
  2: { x: 550, y: 60 },   // TTS
  3: { x: 800, y: 60 },   // Video Prompt
  4: { x: 800, y: 280 },  // Video Gen
  5: { x: 550, y: 280 },  // Merge
  6: { x: 300, y: 280 },  // YouTube
};

/** Edge definitions for batch canvas (7 nodes) */
export const BATCH_CANVAS_EDGES = [
  { id: 'be0-1', source: '0', target: '1' },
  { id: 'be1-2', source: '1', target: '2' },
  { id: 'be2-3', source: '2', target: '3' },
  { id: 'be3-4', source: '3', target: '4' },
  { id: 'be4-5', source: '4', target: '5' },
  { id: 'be5-6', source: '5', target: '6' },
];
