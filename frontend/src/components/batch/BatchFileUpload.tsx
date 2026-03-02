import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FolderOpen, X } from 'lucide-react';
import type { UploadedPair } from '../../types';

interface BatchFileUploadProps {
  pairs: UploadedPair[];
  onPairsChange: (pairs: UploadedPair[]) => void;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];

function getBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export default function BatchFileUpload({ pairs, onPairsChange }: BatchFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(
    (fileList: FileList) => {
      const files = Array.from(fileList);
      const imageFiles = files.filter((f) => isImageFile(f.name));
      const textFiles = files.filter((f) => f.name.toLowerCase().endsWith('.txt'));

      const textMap = new Map<string, File>();
      textFiles.forEach((f) => textMap.set(getBaseName(f.name), f));

      const newPairs: UploadedPair[] = [];

      imageFiles.forEach((imageFile) => {
        const baseName = getBaseName(imageFile.name);
        const txtFile = textMap.get(baseName);

        if (txtFile) {
          const preview = URL.createObjectURL(imageFile);
          newPairs.push({
            name: baseName,
            image: imageFile,
            imagePreview: preview,
            description: '', // Will read async
            descriptionFile: txtFile,
          });
        }
      });

      // Read text files async
      Promise.all(
        newPairs.map(async (pair) => {
          const text = await pair.descriptionFile.text();
          return { ...pair, description: text.trim() };
        })
      ).then((resolvedPairs) => {
        onPairsChange([...pairs, ...resolvedPairs]);
      });
    },
    [pairs, onPairsChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
      e.target.value = '';
    },
    [processFiles]
  );

  const removePair = (index: number) => {
    const updated = [...pairs];
    URL.revokeObjectURL(updated[index].imagePreview);
    updated.splice(index, 1);
    onPairsChange(updated);
  };

  const clearAll = () => {
    pairs.forEach((p) => URL.revokeObjectURL(p.imagePreview));
    onPairsChange([]);
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <motion.label
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`
          flex flex-col items-center justify-center gap-3 px-4 py-8
          rounded-xl border-2 border-dashed cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-violet-500 bg-violet-950/20'
            : 'border-slate-700 bg-slate-900/30 hover:border-slate-600'
          }
        `}
      >
        <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center">
          {isDragging ? (
            <Upload className="h-5 w-5 text-violet-400" />
          ) : (
            <FolderOpen className="h-5 w-5 text-slate-500" />
          )}
        </div>
        <div className="text-center">
          <span className="text-sm font-medium text-slate-300">
            Drop image + txt pairs or <span className="text-violet-400">browse</span>
          </span>
          <p className="text-xs text-slate-500 mt-1">
            e.g., product1.jpg + product1.txt, product2.png + product2.txt
          </p>
        </div>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.bmp,.txt"
          onChange={handleInputChange}
          className="hidden"
        />
      </motion.label>

      {/* Pairs Count */}
      {pairs.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {pairs.length} pair{pairs.length > 1 ? 's' : ''} ready
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Mini Previews */}
      <div className="space-y-2">
        {pairs.map((pair, i) => (
          <div
            key={pair.name}
            className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50"
          >
            <img
              src={pair.imagePreview}
              alt={pair.name}
              className="h-10 w-10 rounded object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate">{pair.name}</p>
              <p className="text-xs text-slate-500 truncate">{pair.description.substring(0, 60)}...</p>
            </div>
            <button
              type="button"
              onClick={() => removePair(i)}
              className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
