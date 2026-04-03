import { CheckCircle } from 'lucide-react';
import { ToolType, StitchType } from '../types/embroidery';

interface StatusBarProps {
  mouseX: number;
  mouseY: number;
  stitchCount: number;
  activeTool: ToolType;
  stitchType: StitchType;
  pathCount: number;
  zoom: number;
}

const toolLabels: Record<ToolType, string> = {
  select: 'Select',
  reshape: 'Reshape',
  inputA: 'Input A (Satin)',
  inputB: 'Input B (Run)',
  complexFill: 'Complex Fill (Tatami)',
  text: 'Text',
  shapes: 'Shapes',
  knife: 'Knife',
};

export default function StatusBar({
  mouseX,
  mouseY,
  stitchCount,
  activeTool,
  stitchType,
  pathCount,
  zoom,
}: StatusBarProps) {
  return (
    <footer className="h-7 bg-[#007acc] flex items-center px-3 text-xs justify-between select-none shrink-0 text-white">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <CheckCircle size={12} />
          Ready
        </span>
        <span className="opacity-70">
          Tool: <strong>{toolLabels[activeTool]}</strong>
        </span>
        <span className="opacity-70">
          Stitch: <strong className="capitalize">{stitchType}</strong>
        </span>
      </div>
      <div className="flex items-center gap-4 font-mono">
        <span>
          X: <strong>{mouseX.toFixed(2)}</strong> mm
        </span>
        <span>
          Y: <strong>{mouseY.toFixed(2)}</strong> mm
        </span>
        <span className="opacity-60">|</span>
        <span>
          Stitches: <strong>{stitchCount.toLocaleString()}</strong>
        </span>
        <span>
          Objects: <strong>{pathCount}</strong>
        </span>
        <span>
          Zoom: <strong>{Math.round(zoom * 100)}%</strong>
        </span>
      </div>
    </footer>
  );
}
