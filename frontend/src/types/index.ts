// ================= Pipeline Types =================

export type NodeStatus = 'idle' | 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export interface PipelineStep {
  step: number;
  label: string;
  sublabel: string;
  icon: string;
  status: NodeStatus;
  data?: Record<string, unknown> | null;
  startedAt?: number;
  completedAt?: number;
}

export interface SSEEvent {
  step: number;
  status: string;
  label: string;
  data: Record<string, unknown> | null;
}

export interface PipelineConfig {
  description: string;
  duration: number;
  voice: string;
  background: string | null;
  bg_volume: number;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  audio_script: string | null;
  video_prompt: string | null;
  upload_youtube: boolean;
  youtube_privacy: string;
}

export interface PipelineResult {
  final_path?: string;
  audio_path?: string;
  video_path?: string;
  youtube_url?: string;
  audio_script?: string;
  video_prompt?: string;
  duration?: number;
}

// ================= Pipeline Session (Step-by-Step) =================

export interface SessionStepResult {
  status: NodeStatus;
  data: Record<string, unknown> | null;
}

export interface PipelineSession {
  session_id: string;
  status: 'created' | 'running' | 'paused' | 'completed' | 'error';
  current_step: number;
  steps: Record<string, SessionStepResult>;
  created_at: string;
}

// ================= Batch Types =================

export interface BatchPair {
  name: string;
  description: string;
}

export interface BatchItemResult {
  name: string;
  index: number;
  status: 'success' | 'error' | 'failed' | 'processing';
  final_path?: string;
  youtube_url?: string;
  duration?: number;
  audio_script?: string;
  error?: string;
}

export interface BatchJob {
  job_id: string;
  status: 'queued' | 'scheduled' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  started_at?: string;
  scheduled_for?: string;
  total: number;
  current: number;
  current_name: string;
  pairs: BatchPair[];
  results: BatchItemResult[];
  success_count: number;
  fail_count: number;
  error?: string;
}

export interface BatchJobSummary {
  job_id: string;
  status: string;
  total: number;
  current: number;
  success_count: number;
  fail_count: number;
  created_at: string;
  completed_at?: string;
}

// ================= API Response Types =================

export interface BackgroundsResponse {
  backgrounds: string[];
}

export interface VoicesResponse {
  voices: string[];
}

export interface BatchCreateResponse {
  job_id: string;
  status: string;
  total_pairs: number;
  pairs: BatchPair[];
  schedule_time: string | null;
  delay_between: number;
  track_url: string;
}

export interface BatchListResponse {
  jobs: BatchJobSummary[];
}

// ================= Batch Stream Types =================

export interface BatchSSEEvent {
  step: number;
  status: string;
  label: string;
  data: Record<string, unknown> | null;
  image_index: number;
  image_name: string;
  total_images: number;
}

export interface BatchImageResult {
  index: number;
  name: string;
  status: 'success' | 'error' | 'pending' | 'processing';
  final_path?: string;
  youtube_url?: string;
  audio_script?: string;
  duration?: number;
  error?: string;
}

export type BatchStatus = 'idle' | 'waiting' | 'running' | 'completed' | 'error';

// ================= UI Types =================

export type ExecutionMode = 'auto' | 'manual';

export interface UploadedFile {
  file: File;
  preview?: string;
}

export interface UploadedPair {
  name: string;
  image: File;
  imagePreview: string;
  description: string;
  descriptionFile: File;
}
