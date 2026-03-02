import { useState } from 'react';
import { FileText, Clock, Sliders, Youtube } from 'lucide-react';
import VoiceSelector from '../shared/VoiceSelector';
import BackgroundMusicSelector from '../shared/BackgroundMusicSelector';
import ExpandableSection from '../shared/ExpandableSection';
import ImageUpload from './ImageUpload';
import GlowButton from '../shared/GlowButton';
import { DEFAULT_PIPELINE_CONFIG, RESOLUTION_PRESETS, PRIVACY_OPTIONS } from '../../utils/constants';
import type { PipelineConfig } from '../../types';

interface PipelineFormProps {
  onSubmit: (image: File, config: PipelineConfig) => void;
  isRunning: boolean;
  onCancel: () => void;
}

export default function PipelineForm({ onSubmit, isRunning, onCancel }: PipelineFormProps) {
  const [image, setImage] = useState<File | null>(null);
  const [config, setConfig] = useState<PipelineConfig>({ ...DEFAULT_PIPELINE_CONFIG });

  const update = <K extends keyof PipelineConfig>(key: K, value: PipelineConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleResolutionPreset = (preset: { width: number; height: number }) => {
    setConfig((prev) => ({ ...prev, width: preset.width, height: preset.height }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !config.description.trim()) return;
    onSubmit(image, config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Image Upload */}
      <ImageUpload image={image} onImageChange={setImage} />

      {/* Description */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
          <FileText className="h-3.5 w-3.5 text-violet-400" />
          Product Description
        </label>
        <textarea
          value={config.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Describe the product or scene for the video..."
          rows={3}
          className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 resize-none transition-colors"
        />
      </div>

      {/* Duration Slider */}
      <div className="space-y-1.5">
        <label className="flex items-center justify-between text-sm font-medium text-slate-300">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            Duration
          </span>
          <span className="text-violet-400 tabular-nums">{config.duration}s</span>
        </label>
        <input
          type="range"
          min={3}
          max={30}
          step={1}
          value={config.duration}
          onChange={(e) => update('duration', Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Voice Selector */}
      <VoiceSelector value={config.voice} onChange={(v) => update('voice', v)} />

      {/* Background Music */}
      <BackgroundMusicSelector
        value={config.background}
        onChange={(v) => update('background', v)}
      />

      {/* BG Volume */}
      {config.background && (
        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-sm font-medium text-slate-300">
            <span>Background Volume</span>
            <span className="text-violet-400 tabular-nums">{Math.round(config.bg_volume * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.bg_volume}
            onChange={(e) => update('bg_volume', Number(e.target.value))}
            className="w-full"
          />
        </div>
      )}

      {/* Advanced Settings */}
      <ExpandableSection title="⚙️ Advanced Settings">
        {/* Resolution Presets */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-violet-400" />
            Resolution
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {RESOLUTION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleResolutionPreset(preset)}
                className={`px-2 py-1.5 rounded-lg text-xs transition-colors ${
                  config.width === preset.width && config.height === preset.height
                    ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Steps & CFG */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">ComfyUI Steps</label>
            <input
              type="number"
              min={10}
              max={50}
              value={config.steps}
              onChange={(e) => update('steps', Number(e.target.value))}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">CFG Scale</label>
            <input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={config.cfg}
              onChange={(e) => update('cfg', Number(e.target.value))}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Script Override */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Custom Audio Script (override)</label>
          <textarea
            value={config.audio_script || ''}
            onChange={(e) => update('audio_script', e.target.value || null)}
            placeholder="Leave empty to auto-generate..."
            rows={2}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Video Prompt Override */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Custom Video Prompt (override)</label>
          <textarea
            value={config.video_prompt || ''}
            onChange={(e) => update('video_prompt', e.target.value || null)}
            placeholder="Leave empty to auto-generate..."
            rows={2}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-violet-500"
          />
        </div>
      </ExpandableSection>

      {/* YouTube Upload */}
      <div className="glass-card p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.upload_youtube}
            onChange={(e) => update('upload_youtube', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500/30"
          />
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
            <Youtube className="h-4 w-4 text-red-500" />
            Upload to YouTube
          </span>
        </label>
        {config.upload_youtube && (
          <select
            value={config.youtube_privacy}
            onChange={(e) => update('youtube_privacy', e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
          >
            {PRIVACY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-2">
        {isRunning ? (
          <GlowButton variant="danger" onClick={onCancel} className="flex-1">
            Cancel Pipeline
          </GlowButton>
        ) : (
          <GlowButton
            type="submit"
            disabled={!image || !config.description.trim()}
            loading={isRunning}
            size="lg"
            className="flex-1"
          >
            🚀 Run Pipeline
          </GlowButton>
        )}
      </div>
    </form>
  );
}
