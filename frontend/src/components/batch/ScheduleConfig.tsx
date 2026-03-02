import { Clock, Timer } from 'lucide-react';

interface ScheduleConfigProps {
  scheduleTime: string;
  onScheduleTimeChange: (time: string) => void;
  delayBetween: number;
  onDelayChange: (delay: number) => void;
}

export default function ScheduleConfig({
  scheduleTime,
  onScheduleTimeChange,
  delayBetween,
  onDelayChange,
}: ScheduleConfigProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Schedule Time */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
          Schedule Time
        </label>
        <input
          type="time"
          value={scheduleTime}
          onChange={(e) => onScheduleTimeChange(e.target.value)}
          className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
        />
        <p className="text-xs text-slate-500">Leave empty to start immediately</p>
      </div>

      {/* Delay Between */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
          <Timer className="h-3.5 w-3.5 text-violet-400" />
          Delay Time
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={3600}
            value={delayBetween}
            onChange={(e) => onDelayChange(Number(e.target.value))}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
          />
          <span className="text-xs text-slate-500 whitespace-nowrap">seconds</span>
        </div>
      </div>
    </div>
  );
}
