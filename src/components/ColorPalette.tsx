import { THREAD_COLORS, ThreadColor } from '../types/embroidery';

interface ColorPaletteProps {
  activeColor: string;
  onColorChange: (color: string) => void;
}

export default function ColorPalette({ activeColor, onColorChange }: ColorPaletteProps) {
  return (
    <div className="h-10 bg-[#2d2d2d] border-t border-[#111] flex items-center px-3 gap-1 select-none shrink-0">
      <span className="text-xs text-gray-500 mr-2 whitespace-nowrap">Thread:</span>
      <div className="flex items-center gap-0.5 overflow-x-auto">
        {THREAD_COLORS.map((color: ThreadColor) => {
          const isActive = activeColor === color.hex;
          return (
            <button
              key={color.hex}
              className={`
                w-6 h-6 rounded-sm cursor-pointer transition-all border-2 shrink-0
                ${isActive
                  ? 'border-white scale-110 shadow-lg'
                  : 'border-transparent hover:border-gray-500 hover:scale-105'
                }
              `}
              style={{ backgroundColor: color.hex }}
              title={color.name}
              onClick={() => onColorChange(color.hex)}
            />
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div
          className="w-5 h-5 rounded border border-gray-500"
          style={{ backgroundColor: activeColor }}
        />
        <span className="text-xs text-gray-400 font-mono">{activeColor}</span>
      </div>
    </div>
  );
}
