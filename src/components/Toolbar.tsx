import {
  FilePlus,
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  Scissors,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react';

interface ToolbarProps {
  onNew: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  zoom: number;
}

export default function Toolbar({
  onNew,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  zoom,
}: ToolbarProps) {
  const btnClass =
    'p-2 rounded cursor-pointer text-gray-400 hover:bg-[#444] hover:text-[#D4AF37] transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="h-11 bg-[#2d2d2d] flex items-center px-3 gap-1 border-b border-[#111] select-none shrink-0">
      <button className={btnClass} title="New Design" onClick={onNew}>
        <FilePlus size={18} />
      </button>
      <button className={btnClass} title="Open">
        <FolderOpen size={18} />
      </button>
      <button className={btnClass} title="Save / Export" onClick={onExport}>
        <Save size={18} />
      </button>

      <div className="w-px h-5 bg-[#555] mx-1" />

      <button className={btnClass} title="Undo" onClick={onUndo} disabled={!canUndo}>
        <Undo2 size={18} />
      </button>
      <button className={btnClass} title="Redo" onClick={onRedo} disabled={!canRedo}>
        <Redo2 size={18} />
      </button>
      <button className={btnClass} title="Scissors">
        <Scissors size={18} />
      </button>

      <div className="w-px h-5 bg-[#555] mx-1" />

      <button className={btnClass} title="Zoom In" onClick={onZoomIn}>
        <ZoomIn size={18} />
      </button>
      <button className={btnClass} title="Zoom Out" onClick={onZoomOut}>
        <ZoomOut size={18} />
      </button>
      <button className={btnClass} title="Fit to View" onClick={onZoomFit}>
        <Maximize size={18} />
      </button>

      <span className="text-xs text-gray-500 ml-2 font-mono">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}
