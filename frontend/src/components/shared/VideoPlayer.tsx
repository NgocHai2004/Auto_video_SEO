import { useRef } from 'react';
import { API_BASE_URL } from '../../utils/constants';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

export default function VideoPlayer({ src, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Build URL: use /api/file?path= for relative paths from the backend
  const videoUrl = src.startsWith('http')
    ? src
    : `${API_BASE_URL}/file?path=${encodeURIComponent(src)}`;

  return (
    <div className={`rounded-lg overflow-hidden bg-black ${className}`}>
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="w-full h-auto max-h-[400px] object-contain"
        preload="metadata"
      >
        Your browser does not support video playback.
      </video>
    </div>
  );
}
