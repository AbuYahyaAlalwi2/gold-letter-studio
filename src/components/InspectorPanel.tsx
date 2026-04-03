import { StitchType } from '../types/embroidery';

interface InspectorPanelProps {
  stitchType: StitchType;
  onStitchTypeChange: (type: StitchType) => void;
  density: number;
  onDensityChange: (density: number) => void;
  stitchWidth: number;
  onStitchWidthChange: (width: number) => void;
  selectedPathCount: number;
  totalPaths: number;
}

const stitchTypes: { value: StitchType; label: string }[] = [
  { value: 'satin', label: 'Satin' },
  { value: 'tatami', label: 'Tatami' },
  { value: 'run', label: 'Run' },
  { value: 'zigzag', label: 'ZigZag' },
];

export default function InspectorPanel({
  stitchType,
  onStitchTypeChange,
  density,
  onDensityChange,
  stitchWidth,
  onStitchWidthChange,
  selectedPathCount,
  totalPaths,
}: InspectorPanelProps) {
  return (
    <aside className="w-56 bg-[#2d2d2d] border-l border-[#111] flex flex-col select-none shrink-0 overflow-y-auto">
      {/* Object Properties */}
      <div className="border-b border-[#222]">
        <div className="bg-[#3c3c3c] px-3 py-2 text-xs font-bold text-[#D4AF37] border-b border-[#222]">
          Object Properties
        </div>
        <div className="p-3 space-y-4 text-xs">
          {/* Stitch Type */}
          <div>
            <label className="block text-gray-400 mb-1.5 font-medium">Stitch Type</label>
            <select
              value={stitchType}
              onChange={(e) => onStitchTypeChange(e.target.value as StitchType)}
              className="w-full bg-[#1a1a1a] text-gray-200 border border-[#444] rounded px-2 py-1.5 text-xs focus:border-[#D4AF37] focus:outline-none transition-colors"
            >
              {stitchTypes.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Stitch Density */}
          <div>
            <label className="block text-gray-400 mb-1.5 font-medium">
              Stitch Density
              <span className="float-right text-[#D4AF37]">{density.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min="0.3"
              max="3.0"
              step="0.1"
              value={density}
              onChange={(e) => onDensityChange(parseFloat(e.target.value))}
              className="w-full accent-[#D4AF37] h-1.5"
            />
            <div className="flex justify-between text-gray-600 mt-0.5">
              <span>Sparse</span>
              <span>Dense</span>
            </div>
          </div>

          {/* Stitch Width (for satin/tatami/zigzag) */}
          {stitchType !== 'run' && (
            <div>
              <label className="block text-gray-400 mb-1.5 font-medium">
                Stitch Width
                <span className="float-right text-[#D4AF37]">{stitchWidth.toFixed(1)}mm</span>
              </label>
              <input
                type="range"
                min="1"
                max="12"
                step="0.5"
                value={stitchWidth}
                onChange={(e) => onStitchWidthChange(parseFloat(e.target.value))}
                className="w-full accent-[#D4AF37] h-1.5"
              />
              <div className="flex justify-between text-gray-600 mt-0.5">
                <span>1mm</span>
                <span>12mm</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Design Info */}
      <div className="border-b border-[#222]">
        <div className="bg-[#3c3c3c] px-3 py-2 text-xs font-bold text-[#D4AF37] border-b border-[#222]">
          Design Info
        </div>
        <div className="p-3 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Objects</span>
            <span className="text-gray-200">{totalPaths}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Selected</span>
            <span className="text-gray-200">{selectedPathCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Design Size</span>
            <span className="text-gray-200">200 x 150 mm</span>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div>
        <div className="bg-[#3c3c3c] px-3 py-2 text-xs font-bold text-[#D4AF37] border-b border-[#222]">
          Shortcuts
        </div>
        <div className="p-3 text-xs space-y-1.5 text-gray-500">
          <div className="flex justify-between">
            <span>Input A</span>
            <kbd className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-400">A</kbd>
          </div>
          <div className="flex justify-between">
            <span>Input B</span>
            <kbd className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-400">B</kbd>
          </div>
          <div className="flex justify-between">
            <span>Select</span>
            <kbd className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-400">V</kbd>
          </div>
          <div className="flex justify-between">
            <span>Undo</span>
            <kbd className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-400">Ctrl+Z</kbd>
          </div>
          <div className="flex justify-between">
            <span>Redo</span>
            <kbd className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-400">Ctrl+Y</kbd>
          </div>
          <div className="flex justify-between">
            <span>Pan</span>
            <kbd className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-400">Middle Drag</kbd>
          </div>
          <div className="flex justify-between">
            <span>Zoom</span>
            <kbd className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-400">Scroll</kbd>
          </div>
          <div className="flex justify-between">
            <span>Finish Path</span>
            <kbd className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-400">Enter / Dbl</kbd>
          </div>
        </div>
      </div>
    </aside>
  );
}
