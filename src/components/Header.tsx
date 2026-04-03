import { ChevronDown } from 'lucide-react';

const menuItems = ['File', 'Edit', 'View', 'Stitch', 'Arrange', 'Help'];

interface HeaderProps {
  onExport: () => void;
  onNew: () => void;
}

export default function Header({ onExport, onNew }: HeaderProps) {
  return (
    <nav className="h-9 bg-[#333] flex items-center px-3 text-xs border-b border-[#444] select-none shrink-0">
      <span className="text-[#D4AF37] font-bold tracking-widest mr-6 text-sm">
        GOLD LETTER STUDIO
      </span>
      {menuItems.map((item) => (
        <button
          key={item}
          className="relative px-3 py-1 text-gray-300 hover:text-white hover:bg-[#444] rounded transition-colors group"
          onClick={() => {
            if (item === 'File') {
              // Simple dropdown behavior placeholder
            }
          }}
        >
          {item}
          <ChevronDown className="inline-block w-3 h-3 ml-0.5 opacity-50" />
          {item === 'File' && (
            <div className="hidden group-hover:block absolute top-full left-0 bg-[#2d2d2d] border border-[#444] rounded shadow-xl z-50 min-w-40">
              <button
                onClick={(e) => { e.stopPropagation(); onNew(); }}
                className="block w-full text-left px-4 py-2 hover:bg-[#444] text-gray-300"
              >
                New Design
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onExport(); }}
                className="block w-full text-left px-4 py-2 hover:bg-[#444] text-gray-300"
              >
                Export DST Data...
              </button>
            </div>
          )}
        </button>
      ))}
    </nav>
  );
}
