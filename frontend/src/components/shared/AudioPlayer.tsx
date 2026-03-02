import { useRef, useState } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { API_BASE_URL } from '../../utils/constants';

interface AudioPlayerProps {
  src: string;
  label?: string;
  compact?: boolean;
}

export default function AudioPlayer({ src, label, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Build URL: use /api/file?path= for relative paths from the backend
  const audioUrl = src.startsWith('http')
    ? src
    : `${API_BASE_URL}/file?path=${encodeURIComponent(src)}`;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'glass-card px-3 py-2'}`}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />
      <button
        type="button"
        onClick={togglePlay}
        className="flex items-center justify-center h-8 w-8 rounded-full bg-violet-600/20 text-violet-400 hover:bg-violet-600/40 transition-colors"
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      {label && (
        <span className="text-xs text-slate-400 truncate">
          <Volume2 className="inline h-3 w-3 mr-1" />
          {label}
        </span>
      )}
    </div>
  );
}
