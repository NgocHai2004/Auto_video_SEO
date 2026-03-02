import { ExternalLink } from 'lucide-react';
import StatusBadge from '../shared/StatusBadge';
import type { BatchItemResult } from '../../types';

interface BatchItemCardProps {
  item: BatchItemResult;
}

export default function BatchItemCard({ item }: BatchItemCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/40">
      {/* Index */}
      <span className="flex-shrink-0 h-8 w-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-xs font-bold text-slate-400">
        {item.index}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200 truncate">{item.name}</span>
          <StatusBadge status={item.status} />
        </div>
        {item.duration && (
          <span className="text-xs text-slate-500">{item.duration}s</span>
        )}
        {item.error && (
          <p className="text-xs text-red-400 mt-0.5 truncate">{item.error}</p>
        )}
      </div>

      {/* YouTube Link */}
      {item.youtube_url && (
        <a
          href={item.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-red-400 hover:text-red-300 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
