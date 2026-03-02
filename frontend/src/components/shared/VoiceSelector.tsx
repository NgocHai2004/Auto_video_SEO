import { Mic } from 'lucide-react';
import { useVoices } from '../../hooks/useBackgrounds';

interface VoiceSelectorProps {
  value: string;
  onChange: (voice: string) => void;
}

export default function VoiceSelector({ value, onChange }: VoiceSelectorProps) {
  const { voices, loading } = useVoices();

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
        <Mic className="h-3.5 w-3.5 text-violet-400" />
        Voice
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
      >
        {loading ? (
          <option>Loading voices...</option>
        ) : (
          voices.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
