import { motion } from 'framer-motion';
import { Download, ExternalLink, FileText, Film, Volume2 } from 'lucide-react';
import VideoPlayer from '../shared/VideoPlayer';
import AudioPlayer from '../shared/AudioPlayer';
import ExpandableSection from '../shared/ExpandableSection';
import { API_BASE_URL } from '../../utils/constants';
import type { PipelineResult as PipelineResultType } from '../../types';

interface PipelineResultProps {
  result: PipelineResultType;
}

function fileUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_BASE_URL}/file?path=${encodeURIComponent(path)}`;
}

export default function PipelineResult({ result }: PipelineResultProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <Film className="h-4 w-4 text-emerald-400" />
        Pipeline Result
      </h3>

      {/* Video Player */}
      {result.final_path && (
        <VideoPlayer src={result.final_path} />
      )}

      {/* Audio Player */}
      {result.audio_path && (
        <div className="space-y-1.5">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Volume2 className="h-3 w-3" />
            Generated Audio {result.duration ? `(${result.duration}s)` : ''}
          </span>
          <AudioPlayer src={result.audio_path} />
        </div>
      )}

      {/* Generated Scripts */}
      {result.audio_script && (
        <ExpandableSection title="📝 Audio Script">
          <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
            {result.audio_script}
          </p>
        </ExpandableSection>
      )}

      {result.video_prompt && (
        <ExpandableSection title="🎬 Video Prompt">
          <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
            {result.video_prompt}
          </p>
        </ExpandableSection>
      )}

      {/* YouTube Link */}
      {result.youtube_url && (
        <a
          href={result.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-400 hover:bg-red-950/50 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="text-sm font-medium">View on YouTube</span>
        </a>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {result.final_path && (
          <a
            href={fileUrl(result.final_path)}
            download
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download Video
          </a>
        )}
        {result.audio_script && (
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(result.audio_script || '')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Copy Script
          </button>
        )}
      </div>
    </motion.div>
  );
}
