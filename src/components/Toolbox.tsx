import {
  MousePointer2,
  PenTool,
  Spline,
  PaintBucket,
  Type,
  Shapes,
  Scissors,
  Move,
} from 'lucide-react';
import { ToolType } from '../types/embroidery';

interface ToolboxProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

interface ToolDef {
  id: ToolType;
  icon: typeof MousePointer2;
  label: string;
  subtitle: string;
  shortcut: string;
}

/** Wilcom-style tool groups with descriptive subtitles */
const toolGroups: { title: string; tools: ToolDef[] }[] = [
  {
    title: 'General',
    tools: [
      { id: 'select', icon: MousePointer2, label: 'Select', subtitle: 'Move / Resize', shortcut: 'V' },
      { id: 'reshape', icon: Move, label: 'Reshape', subtitle: 'Edit Nodes', shortcut: 'R' },
    ],
  },
  {
    title: 'Digitizing',
    tools: [
      { id: 'inputA', icon: PenTool, label: 'Input A', subtitle: 'Manual Satin', shortcut: 'A' },
      { id: 'inputB', icon: Spline, label: 'Input B', subtitle: 'Freehand Run', shortcut: 'B' },
      { id: 'complexFill', icon: PaintBucket, label: 'Complex Fill', subtitle: 'Tatami Fill', shortcut: 'F' },
    ],
  },
  {
    title: 'Lettering',
    tools: [
      { id: 'text', icon: Type, label: 'Text', subtitle: 'Lettering', shortcut: 'T' },
    ],
  },
  {
    title: 'Shapes',
    tools: [
      { id: 'shapes', icon: Shapes, label: 'Shapes', subtitle: 'Rectangle / Ellipse', shortcut: 'S' },
    ],
  },
  {
    title: 'Edit',
    tools: [
      { id: 'knife', icon: Scissors, label: 'Knife', subtitle: 'Split Object', shortcut: 'K' },
    ],
  },
];

export default function Toolbox({ activeTool, onToolChange }: ToolboxProps) {
  return (
    <aside className="w-14 bg-[#2d2d2d] border-r border-[#111] flex flex-col items-center py-1 gap-0 select-none shrink-0 overflow-y-auto">
      {toolGroups.map((group, gi) => (
        <div key={group.title} className="w-full flex flex-col items-center">
          {/* Divider between groups (skip first) */}
          {gi > 0 && (
            <div className="w-8 h-px bg-[#444] my-1" />
          )}
          {/* Group label */}
          <span className="text-[8px] text-gray-600 uppercase tracking-wider mb-0.5 leading-none">
            {group.title}
          </span>
          {group.tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                className={`
                  group relative w-10 h-10 flex items-center justify-center rounded cursor-pointer transition-all my-0.5
                  ${isActive
                    ? 'bg-[#D4AF37] text-[#1a1a1a] shadow-lg shadow-[#D4AF37]/20'
                    : 'text-gray-400 hover:bg-[#444] hover:text-gray-200'
                  }
                `}
                title={`${tool.label} — ${tool.subtitle} (${tool.shortcut})`}
                onClick={() => onToolChange(tool.id)}
              >
                <Icon size={18} />
                {/* Tooltip on hover */}
                <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 hidden group-hover:flex flex-col bg-[#1a1a1a] border border-[#444] rounded px-2 py-1 shadow-xl whitespace-nowrap">
                  <span className="text-[11px] text-gray-200 font-medium">{tool.label}</span>
                  <span className="text-[9px] text-gray-500">{tool.subtitle} &middot; {tool.shortcut}</span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
