import { Music } from 'lucide-react';
import { useBackgrounds } from '../../hooks/useBackgrounds';

interface BackgroundMusicSelectorProps {
  value: string | null;
  onChange: (bg: string | null) => void;
}

export default function BackgroundMusicSelector({ value, onChange }: BackgroundMusicSelectorProps) {
  const { backgrounds, loading } = useBackgrounds();

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
        <Music className="h-3.5 w-3.5 text-cyan-400" />
        Background Music
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
        className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
      >
        <option value="">No background music</option>
        {loading ? (
          <option>Loading...</option>
        ) : (
          backgrounds.map((bg) => (
            <option key={bg} value={bg}>
              {bg.replace('.mp3', '')}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
