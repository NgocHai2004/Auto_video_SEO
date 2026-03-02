import type { UploadedPair } from '../../types';

interface BatchPairsTableProps {
  pairs: UploadedPair[];
}

export default function BatchPairsTable({ pairs }: BatchPairsTableProps) {
  if (pairs.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/50">
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 w-16">Preview</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Name</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {pairs.map((pair) => (
            <tr key={pair.name} className="hover:bg-slate-800/30">
              <td className="px-3 py-2">
                <img
                  src={pair.imagePreview}
                  alt={pair.name}
                  className="h-10 w-10 rounded object-cover"
                />
              </td>
              <td className="px-3 py-2 text-slate-200 font-medium">{pair.name}</td>
              <td className="px-3 py-2 text-slate-400 max-w-xs truncate">
                {pair.description.substring(0, 100)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
