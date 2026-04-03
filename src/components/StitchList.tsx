import { GripVertical, Eye, EyeOff, Trash2 } from 'lucide-react';
import { StitchPath } from '../types/embroidery';
import { useRef, useState } from 'react';

interface StitchListProps {
  paths: StitchPath[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDelete: (pathId: string) => void;
  onToggleVisibility: (pathId: string) => void;
  hiddenPaths: Set<string>;
}

const STITCH_LABELS: Record<string, string> = {
  run: 'Run',
  satin: 'Satin',
  tatami: 'Tatami',
  zigzag: 'ZigZag',
};

export default function StitchList({
  paths,
  onReorder,
  onDelete,
  onToggleVisibility,
  hiddenPaths,
}: StitchListProps) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    const from = dragIndexRef.current;
    if (from !== null && from !== index) {
      onReorder(from, index);
    }
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  return (
    <div className="border-b border-[#222]">
      <div className="bg-[#3c3c3c] px-3 py-2 text-xs font-bold text-[#D4AF37] border-b border-[#222] flex items-center justify-between">
        <span>Stitch List</span>
        <span className="text-gray-500 font-normal">{paths.length} obj</span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {paths.length === 0 && (
          <div className="p-3 text-xs text-gray-600 italic text-center">
            No objects yet
          </div>
        )}
        {paths.map((path, index) => {
          const isHidden = hiddenPaths.has(path.id);
          const isDragOver = dragOverIndex === index;
          // Embroidery order is bottom-up: first path stitches first
          const orderNum = index + 1;
          return (
            <div
              key={path.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`
                flex items-center gap-1 px-2 py-1.5 text-xs border-b border-[#222] cursor-grab
                ${isDragOver ? 'bg-[#D4AF37]/10 border-t-2 border-t-[#D4AF37]' : 'hover:bg-[#3a3a3a]'}
                ${isHidden ? 'opacity-40' : ''}
              `}
            >
              {/* Drag handle */}
              <GripVertical size={12} className="text-gray-600 shrink-0" />
              {/* Order number */}
              <span className="text-gray-600 w-4 text-right shrink-0">{orderNum}</span>
              {/* Color swatch + index */}
              <span
                className="w-3 h-3 rounded-sm border border-[#555] shrink-0"
                style={{ backgroundColor: path.color }}
                title={`Color #${path.colorIndex}`}
              />
              <span className="text-[#D4AF37] text-[9px] shrink-0">C{path.colorIndex}</span>
              {/* Stitch type label */}
              <span className="text-gray-300 truncate flex-1">
                {STITCH_LABELS[path.stitchType] || path.stitchType}
              </span>
              {/* Point count */}
              <span className="text-gray-600 shrink-0">{path.points.length}pt</span>
              {/* Visibility toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(path.id); }}
                className="p-0.5 hover:text-gray-200 text-gray-500 transition-colors"
                title={isHidden ? 'Show' : 'Hide'}
              >
                {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              {/* Delete */}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(path.id); }}
                className="p-0.5 hover:text-red-400 text-gray-500 transition-colors"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
