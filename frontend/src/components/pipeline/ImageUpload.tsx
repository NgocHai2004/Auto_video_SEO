import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  image: File | null;
  onImageChange: (file: File | null) => void;
}

export default function ImageUpload({ image, onImageChange }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      onImageChange(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    },
    [onImageChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const clearImage = () => {
    onImageChange(null);
    setPreview(null);
  };

  if (preview && image) {
    return (
      <div className="relative group">
        <div className="rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900/50">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover"
          />
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-slate-400 truncate">{image.name}</span>
            <button
              type="button"
              onClick={clearImage}
              className="text-slate-500 hover:text-red-400 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.label
      whileHover={{ scale: 1.01 }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        flex flex-col items-center justify-center gap-3 px-4 py-8
        rounded-xl border-2 border-dashed cursor-pointer
        transition-all duration-200
        ${isDragging
          ? 'border-violet-500 bg-violet-950/20'
          : 'border-slate-700 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-800/30'
        }
      `}
    >
      <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center">
        {isDragging ? (
          <Upload className="h-5 w-5 text-violet-400" />
        ) : (
          <ImageIcon className="h-5 w-5 text-slate-500" />
        )}
      </div>
      <div className="text-center">
        <span className="text-sm font-medium text-slate-300">
          Drop image here or <span className="text-violet-400">browse</span>
        </span>
        <p className="text-xs text-slate-500 mt-1">JPG, PNG, WEBP</p>
      </div>
      <input
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
    </motion.label>
  );
}
