import {
  MousePointer2,
  PenTool,
  Spline,
  PaintBucket,
  Type,
  Shapes,
} from 'lucide-react';
import { ToolType } from '../types/embroidery';

interface ToolboxProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

const tools: { id: ToolType; icon: typeof MousePointer2; label: string; shortcut: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'inputA', icon: PenTool, label: 'Input A (Click)', shortcut: 'A' },
  { id: 'inputB', icon: Spline, label: 'Input B (Freehand)', shortcut: 'B' },
  { id: 'complexFill', icon: PaintBucket, label: 'Complex Fill', shortcut: 'F' },
  { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { id: 'shapes', icon: Shapes, label: 'Shapes', shortcut: 'S' },
];

export default function Toolbox({ activeTool, onToolChange }: ToolboxProps) {
  return (
    <aside className="w-12 bg-[#2d2d2d] border-r border-[#111] flex flex-col items-center py-2 gap-1 select-none shrink-0">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            className={`
              w-9 h-9 flex items-center justify-center rounded cursor-pointer transition-all
              ${isActive
                ? 'bg-[#D4AF37] text-[#1a1a1a] shadow-lg shadow-[#D4AF37]/20'
                : 'text-gray-400 hover:bg-[#444] hover:text-gray-200'
              }
            `}
            title={`${tool.label} (${tool.shortcut})`}
            onClick={() => onToolChange(tool.id)}
          >
            <Icon size={18} />
          </button>
        );
      })}
    </aside>
  );
}
