"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  MousePointer2,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Undo,
  Redo,
  Save,
  FolderOpen,
  ChevronRight,
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from "lucide-react";
import EmbroideryCanvas, {
  EmbroideryCanvasRef,
} from "@/components/embroidery-canvas";

type Tool = "select" | "inputA" | "inputB" | "running" | "fill";
type PointType = "curve" | "straight";

interface ToolInfo {
  id: Tool;
  name: string;
  shortName: string;
  description: string;
  hotkey: string;
  icon: React.ReactNode;
}

const TOOLS: ToolInfo[] = [
  {
    id: "select",
    name: "Select",
    shortName: "Select",
    description: "Select and move objects",
    hotkey: "V",
    icon: <MousePointer2 size={20} />,
  },
  {
    id: "inputA",
    name: "Input A - Satin",
    shortName: "Input A",
    description: "Column stitch with satin fill. Left-click: straight point, Right-click: curve point",
    hotkey: "A",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 20 L12 4 L20 20" />
        <line x1="7" y1="14" x2="17" y2="14" />
      </svg>
    ),
  },
  {
    id: "inputB",
    name: "Input B - Complex Fill",
    shortName: "Input B",
    description: "Complex fill with variable density. Left-click: straight point, Right-click: curve point",
    hotkey: "B",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 20 L8 8 L12 16 L16 4 L20 20" />
      </svg>
    ),
  },
  {
    id: "running",
    name: "Running Stitch",
    shortName: "Run",
    description: "Simple running stitch along a path",
    hotkey: "R",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2">
        <path d="M4 12 L20 12" />
      </svg>
    ),
  },
  {
    id: "fill",
    name: "Fill Stitch",
    shortName: "Fill",
    description: "Area fill with tatami or complex patterns",
    hotkey: "F",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <line x1="4" y1="8" x2="20" y2="8" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="16" x2="20" y2="16" />
      </svg>
    ),
  },
];

const THREAD_COLORS = [
  { color: "#D4AF37", name: "Metallic Gold" },
  { color: "#C0C0C0", name: "Silver" },
  { color: "#000000", name: "Black" },
  { color: "#FFFFFF", name: "White" },
  { color: "#8B0000", name: "Burgundy" },
  { color: "#DC143C", name: "Crimson" },
  { color: "#FF6347", name: "Coral" },
  { color: "#FF8C00", name: "Dark Orange" },
  { color: "#FFD700", name: "Gold" },
  { color: "#228B22", name: "Forest Green" },
  { color: "#006400", name: "Dark Green" },
  { color: "#20B2AA", name: "Teal" },
  { color: "#000080", name: "Navy" },
  { color: "#4169E1", name: "Royal Blue" },
  { color: "#9932CC", name: "Orchid" },
  { color: "#8B4513", name: "Saddle Brown" },
];

const PIXELS_PER_MM = 3.7795275591;

export default function EmbroideryStudio() {
  // Tool state
  const [tool, setTool] = useState<Tool>("inputA");
  const [pointType, setPointType] = useState<PointType>("straight");
  
  // Thread settings
  const [threadColor, setThreadColor] = useState("#D4AF37");
  const [threadWeight, setThreadWeight] = useState(40);
  
  // Stitch properties
  const [density, setDensity] = useState(4.0); // lines per mm
  const [pullCompensation, setPullCompensation] = useState(0.3); // mm
  const [satinWidth, setSatinWidth] = useState(3.0); // mm
  const [underlay, setUnderlay] = useState(true);
  const [runningLength, setRunningLength] = useState(2.5); // mm
  
  // Canvas state
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [stitchCount, setStitchCount] = useState(0);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  
  // Layers
  const [layers, setLayers] = useState([
    { id: 1, name: "Layer 1", visible: true, locked: false, color: "#D4AF37" },
  ]);
  const [activeLayer, setActiveLayer] = useState(1);
  
  // UI state
  const [expandedPanel, setExpandedPanel] = useState<string | null>("properties");
  
  const canvasRef = useRef<EmbroideryCanvasRef | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      const key = e.key.toUpperCase();
      
      // Tool shortcuts
      if (key === "V") setTool("select");
      if (key === "A") setTool("inputA");
      if (key === "B") setTool("inputB");
      if (key === "R") setTool("running");
      if (key === "F") setTool("fill");
      
      // Zoom
      if (e.ctrlKey || e.metaKey) {
        if (key === "=" || key === "+") {
          e.preventDefault();
          setZoom((z) => Math.min(400, z + 25));
        }
        if (key === "-") {
          e.preventDefault();
          setZoom((z) => Math.max(25, z - 25));
        }
        if (key === "0") {
          e.preventDefault();
          setZoom(100);
        }
        if (key === "G") {
          e.preventDefault();
          setShowGrid((g) => !g);
        }
      }
      
      // Delete
      if (key === "DELETE" || key === "BACKSPACE") {
        // Would delete selected objects
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle right-click for curve points
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (tool === "inputA" || tool === "inputB") {
        e.preventDefault();
        setPointType("curve");
      }
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        setPointType("straight");
      }
    };
    
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("mousedown", handleMouseDown);
    
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [tool]);

  const handleExportDST = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stitchData = canvas.getStitchData();
    if (stitchData.length === 0) {
      alert("No stitches to export. Draw something first!");
      return;
    }

    const dstContent = generateDST(stitchData);
    const blob = new Blob([dstContent], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `embroidery-${Date.now()}.dst`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleClear = useCallback(() => {
    if (confirm("Clear all stitches? This cannot be undone.")) {
      canvasRef.current?.clearCanvas();
    }
  }, []);

  const togglePanel = (panel: string) => {
    setExpandedPanel(expandedPanel === panel ? null : panel);
  };

  // Map tool to canvas tool type
  const getCanvasTool = (): "select" | "satin" | "running" => {
    if (tool === "select") return "select";
    if (tool === "running") return "running";
    return "satin";
  };

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] overflow-hidden select-none">
      {/* Menu Bar */}
      <header className="h-8 bg-[#2d2d2d] flex items-center px-2 border-b border-[#3c3c3c] text-xs">
        <div className="flex items-center gap-1">
          <span className="text-[#D4AF37] font-bold text-sm tracking-wide mr-4">GOLD LETTER STUDIO</span>
          <button className="px-3 py-1 text-[#ccc] hover:bg-[#3c3c3c] rounded">File</button>
          <button className="px-3 py-1 text-[#ccc] hover:bg-[#3c3c3c] rounded">Edit</button>
          <button className="px-3 py-1 text-[#ccc] hover:bg-[#3c3c3c] rounded">View</button>
          <button className="px-3 py-1 text-[#ccc] hover:bg-[#3c3c3c] rounded">Stitch</button>
          <button className="px-3 py-1 text-[#ccc] hover:bg-[#3c3c3c] rounded">Design</button>
          <button className="px-3 py-1 text-[#ccc] hover:bg-[#3c3c3c] rounded">Help</button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="h-10 bg-[#252526] flex items-center px-2 gap-1 border-b border-[#3c3c3c]">
        {/* File operations */}
        <div className="flex items-center gap-1 pr-3 border-r border-[#3c3c3c]">
          <button className="p-1.5 text-[#ccc] hover:bg-[#3c3c3c] rounded" title="Open (Ctrl+O)">
            <FolderOpen size={18} />
          </button>
          <button className="p-1.5 text-[#ccc] hover:bg-[#3c3c3c] rounded" title="Save (Ctrl+S)">
            <Save size={18} />
          </button>
        </div>
        
        {/* Undo/Redo */}
        <div className="flex items-center gap-1 px-3 border-r border-[#3c3c3c]">
          <button className="p-1.5 text-[#555] cursor-not-allowed rounded" title="Undo (Ctrl+Z)">
            <Undo size={18} />
          </button>
          <button className="p-1.5 text-[#555] cursor-not-allowed rounded" title="Redo (Ctrl+Y)">
            <Redo size={18} />
          </button>
        </div>
        
        {/* Zoom */}
        <div className="flex items-center gap-1 px-3 border-r border-[#3c3c3c]">
          <button 
            onClick={() => setZoom((z) => Math.max(25, z - 25))} 
            className="p-1.5 text-[#ccc] hover:bg-[#3c3c3c] rounded"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs text-[#ccc] w-12 text-center font-mono">{zoom}%</span>
          <button 
            onClick={() => setZoom((z) => Math.min(400, z + 25))} 
            className="p-1.5 text-[#ccc] hover:bg-[#3c3c3c] rounded"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
        </div>
        
        {/* Grid toggle */}
        <div className="flex items-center gap-1 px-3 border-r border-[#3c3c3c]">
          <button 
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded ${showGrid ? "bg-[#D4AF37] text-black" : "text-[#ccc] hover:bg-[#3c3c3c]"}`}
            title="Toggle Grid (Ctrl+G)"
          >
            <Grid3X3 size={18} />
          </button>
        </div>
        
        {/* Export DST - Prominent */}
        <div className="flex-1" />
        <button
          onClick={handleExportDST}
          className="flex items-center gap-2 px-4 py-1.5 rounded font-bold text-sm transition-all hover:brightness-110 active:scale-95"
          style={{ background: "#D4AF37", color: "#000" }}
        >
          <Download size={16} />
          Export to DST
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tools */}
        <aside className="w-14 bg-[#252526] border-r border-[#3c3c3c] flex flex-col py-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`relative mx-1 mb-1 p-2.5 rounded flex flex-col items-center justify-center transition-all group ${
                tool === t.id
                  ? "bg-[#D4AF37] text-black"
                  : "text-[#ccc] hover:bg-[#3c3c3c]"
              }`}
              title={`${t.name} (${t.hotkey})`}
            >
              {t.icon}
              <span className="text-[8px] mt-0.5 font-medium">{t.shortName}</span>
              
              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded text-xs text-[#ccc] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                <div className="font-medium">{t.name}</div>
                <div className="text-[#888] text-[10px]">{t.description}</div>
                <div className="text-[#D4AF37] text-[10px] mt-0.5">Hotkey: {t.hotkey}</div>
              </div>
            </button>
          ))}
          
          <div className="flex-1" />
          
          {/* Clear */}
          <button
            onClick={handleClear}
            className="mx-1 p-2.5 rounded text-[#e74c3c] hover:bg-[#3c3c3c] transition-all"
            title="Clear Canvas"
          >
            <Trash2 size={20} />
          </button>
        </aside>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col bg-[#1a1a1a] overflow-hidden">
          {/* Point type indicator for Input tools */}
          {(tool === "inputA" || tool === "inputB") && (
            <div className="h-7 bg-[#2d2d2d] border-b border-[#3c3c3c] flex items-center px-3 gap-4 text-xs">
              <span className="text-[#888]">Point Mode:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={pointType === "straight"}
                  onChange={() => setPointType("straight")}
                  className="accent-[#D4AF37]"
                />
                <span className="text-[#ccc]">Straight (Left-Click)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={pointType === "curve"}
                  onChange={() => setPointType("curve")}
                  className="accent-[#D4AF37]"
                />
                <span className="text-[#ccc]">Curve (Right-Click)</span>
              </label>
            </div>
          )}
          
          {/* Canvas */}
          <EmbroideryCanvas
            tool={getCanvasTool()}
            color={threadColor}
            spacing={1 / density}
            satinWidth={satinWidth + pullCompensation}
            onStitchCountChange={setStitchCount}
            onCoordsChange={(x, y) => setCoords({ x, y })}
            canvasRef={canvasRef}
            zoom={zoom}
            showGrid={showGrid}
          />
        </div>

        {/* Right Panel - Properties */}
        <aside className="w-64 bg-[#252526] border-l border-[#3c3c3c] flex flex-col overflow-hidden">
          {/* Thread Color Panel */}
          <div className="border-b border-[#3c3c3c]">
            <button
              onClick={() => togglePanel("colors")}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-[#ccc] hover:bg-[#2d2d2d]"
            >
              <span>Thread Colors</span>
              <ChevronRight
                size={14}
                className={`transform transition-transform ${expandedPanel === "colors" ? "rotate-90" : ""}`}
              />
            </button>
            {expandedPanel === "colors" && (
              <div className="p-3 bg-[#1e1e1e]">
                <div className="grid grid-cols-8 gap-1 mb-3">
                  {THREAD_COLORS.map((c) => (
                    <button
                      key={c.color}
                      onClick={() => setThreadColor(c.color)}
                      className={`aspect-square rounded transition-all ${
                        threadColor === c.color
                          ? "ring-2 ring-white scale-110"
                          : "ring-1 ring-[#3c3c3c] hover:ring-[#555]"
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.name}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={threadColor}
                    onChange={(e) => setThreadColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={threadColor}
                    onChange={(e) => setThreadColor(e.target.value)}
                    className="flex-1 h-7 px-2 bg-[#3c3c3c] border border-[#555] rounded text-xs text-[#ccc] font-mono"
                  />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[10px] text-[#888]">Weight:</label>
                  <select
                    value={threadWeight}
                    onChange={(e) => setThreadWeight(Number(e.target.value))}
                    className="flex-1 h-6 px-1 bg-[#3c3c3c] border border-[#555] rounded text-xs text-[#ccc]"
                  >
                    <option value={30}>30 wt (Heavy)</option>
                    <option value={40}>40 wt (Standard)</option>
                    <option value={50}>50 wt (Fine)</option>
                    <option value={60}>60 wt (Extra Fine)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Stitch Properties Panel */}
          <div className="border-b border-[#3c3c3c]">
            <button
              onClick={() => togglePanel("properties")}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-[#ccc] hover:bg-[#2d2d2d]"
            >
              <span>Stitch Properties</span>
              <ChevronRight
                size={14}
                className={`transform transition-transform ${expandedPanel === "properties" ? "rotate-90" : ""}`}
              />
            </button>
            {expandedPanel === "properties" && (
              <div className="p-3 bg-[#1e1e1e] space-y-4">
                {/* Density */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[10px] text-[#888] uppercase tracking-wider">Density</label>
                    <span className="text-[11px] text-[#D4AF37] font-mono">
                      {density.toFixed(1)} lines/mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    step="0.1"
                    value={density}
                    onChange={(e) => setDensity(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-[#3c3c3c] cursor-pointer accent-[#D4AF37]"
                  />
                  <div className="flex justify-between text-[9px] text-[#555] mt-0.5">
                    <span>Loose</span>
                    <span>Dense</span>
                  </div>
                </div>

                {/* Pull Compensation */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[10px] text-[#888] uppercase tracking-wider">Pull Compensation</label>
                    <span className="text-[11px] text-[#D4AF37] font-mono">
                      {pullCompensation.toFixed(2)} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={pullCompensation}
                    onChange={(e) => setPullCompensation(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-[#3c3c3c] cursor-pointer accent-[#D4AF37]"
                  />
                  <div className="flex justify-between text-[9px] text-[#555] mt-0.5">
                    <span>None</span>
                    <span>Max</span>
                  </div>
                </div>

                {/* Satin Width (for satin tools) */}
                {(tool === "inputA" || tool === "inputB") && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-[10px] text-[#888] uppercase tracking-wider">Satin Width</label>
                      <span className="text-[11px] text-[#D4AF37] font-mono">
                        {satinWidth.toFixed(1)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="12"
                      step="0.1"
                      value={satinWidth}
                      onChange={(e) => setSatinWidth(parseFloat(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-[#3c3c3c] cursor-pointer accent-[#D4AF37]"
                    />
                  </div>
                )}

                {/* Running Stitch Length (for running tool) */}
                {tool === "running" && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-[10px] text-[#888] uppercase tracking-wider">Stitch Length</label>
                      <span className="text-[11px] text-[#D4AF37] font-mono">
                        {runningLength.toFixed(1)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.1"
                      value={runningLength}
                      onChange={(e) => setRunningLength(parseFloat(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-[#3c3c3c] cursor-pointer accent-[#D4AF37]"
                    />
                  </div>
                )}

                {/* Underlay */}
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[#888] uppercase tracking-wider">Underlay</label>
                  <button
                    onClick={() => setUnderlay(!underlay)}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      underlay ? "bg-[#D4AF37]" : "bg-[#3c3c3c]"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                        underlay ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Layers Panel */}
          <div className="border-b border-[#3c3c3c]">
            <button
              onClick={() => togglePanel("layers")}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-[#ccc] hover:bg-[#2d2d2d]"
            >
              <span className="flex items-center gap-1.5">
                <Layers size={14} />
                Layers
              </span>
              <ChevronRight
                size={14}
                className={`transform transition-transform ${expandedPanel === "layers" ? "rotate-90" : ""}`}
              />
            </button>
            {expandedPanel === "layers" && (
              <div className="bg-[#1e1e1e]">
                {layers.map((layer) => (
                  <div
                    key={layer.id}
                    onClick={() => setActiveLayer(layer.id)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                      activeLayer === layer.id
                        ? "bg-[#2d2d2d]"
                        : "hover:bg-[#252526]"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="flex-1 text-xs text-[#ccc]">{layer.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLayers(
                          layers.map((l) =>
                            l.id === layer.id ? { ...l, visible: !l.visible } : l
                          )
                        );
                      }}
                      className="p-1 text-[#888] hover:text-[#ccc]"
                    >
                      {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLayers(
                          layers.map((l) =>
                            l.id === layer.id ? { ...l, locked: !l.locked } : l
                          )
                        );
                      }}
                      className="p-1 text-[#888] hover:text-[#ccc]"
                    >
                      {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Panel - Always visible at bottom */}
          <div className="mt-auto p-3 bg-[#1e1e1e] border-t border-[#3c3c3c]">
            <div className="text-[10px] text-[#888] uppercase tracking-wider mb-2">Design Info</div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-[#888]">Stitches:</span>
              <span className="text-[#D4AF37] font-mono text-right">{stitchCount.toLocaleString()}</span>
              <span className="text-[#888]">Colors:</span>
              <span className="text-[#ccc] font-mono text-right">1</span>
              <span className="text-[#888]">Est. Time:</span>
              <span className="text-[#ccc] font-mono text-right">
                {Math.ceil(stitchCount / 800)} min
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="h-6 bg-[#007acc] flex items-center justify-between px-3 text-[10px] text-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
            <span>Ready</span>
          </div>
          <span className="text-white/70">|</span>
          <span>Tool: {TOOLS.find((t) => t.id === tool)?.name}</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span>X: {coords.x.toFixed(2)} mm</span>
          <span>Y: {coords.y.toFixed(2)} mm</span>
          <span className="text-white/70">|</span>
          <span>Stitches: {stitchCount.toLocaleString()}</span>
          <span className="text-white/70">|</span>
          <span>Zoom: {zoom}%</span>
        </div>
      </footer>
    </div>
  );
}

// DST file generator
interface StitchPath {
  points: { x: number; y: number }[];
  tool: "satin" | "running";
  color: string;
  spacing: number;
  satinWidth: number;
}

function generateDST(stitchPaths: StitchPath[]): Uint8Array {
  const stitches: { x: number; y: number; jump: boolean }[] = [];

  for (const path of stitchPaths) {
    if (path.points.length < 2) continue;

    const firstPoint = path.points[0];
    stitches.push({
      x: Math.round((firstPoint.x / PIXELS_PER_MM) * 10),
      y: Math.round((firstPoint.y / PIXELS_PER_MM) * 10),
      jump: true,
    });

    for (let i = 1; i < path.points.length; i++) {
      const point = path.points[i];
      stitches.push({
        x: Math.round((point.x / PIXELS_PER_MM) * 10),
        y: Math.round((point.y / PIXELS_PER_MM) * 10),
        jump: false,
      });
    }
  }

  // DST Header (512 bytes)
  const header = new Uint8Array(512);
  const label = "LA:GoldLetter  \r";
  for (let i = 0; i < label.length && i < 20; i++) {
    header[i] = label.charCodeAt(i);
  }

  const stitchCountStr = `ST:${stitches.length.toString().padStart(7, " ")}\r`;
  for (let i = 0; i < stitchCountStr.length; i++) {
    header[20 + i] = stitchCountStr.charCodeAt(i);
  }

  for (let i = 30; i < 512; i++) {
    header[i] = 0x20;
  }

  header[510] = 0x1a;
  header[511] = 0x00;

  const stitchData: number[] = [];
  let lastX = 0;
  let lastY = 0;

  for (const stitch of stitches) {
    let dx = stitch.x - lastX;
    let dy = stitch.y - lastY;

    dx = Math.max(-121, Math.min(121, dx));
    dy = Math.max(-121, Math.min(121, dy));

    const byte1 = encodeDSTByte1(dx, dy);
    const byte2 = encodeDSTByte2(dx, dy);
    const byte3 = encodeDSTByte3(dx, dy, stitch.jump);

    stitchData.push(byte1, byte2, byte3);

    lastX = stitch.x;
    lastY = stitch.y;
  }

  stitchData.push(0x00, 0x00, 0xf3);

  const result = new Uint8Array(header.length + stitchData.length);
  result.set(header, 0);
  result.set(new Uint8Array(stitchData), header.length);

  return result;
}

function encodeDSTByte1(dx: number, dy: number): number {
  let b = 0;
  if (dy > 40) b |= 0x80;
  if (dy < -40) b |= 0x40;
  if (dy > 0 && dy <= 40) b |= 0x20;
  if (dy < 0 && dy >= -40) b |= 0x10;
  if (dx < -40) b |= 0x08;
  if (dx > 40) b |= 0x04;
  if (dx < 0 && dx >= -40) b |= 0x02;
  if (dx > 0 && dx <= 40) b |= 0x01;
  return b;
}

function encodeDSTByte2(dx: number, dy: number): number {
  let b = 0;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (ady > 10 && ady <= 40) b |= 0x80;
  if (ady > 0 && ady <= 10) b |= 0x40;
  if (adx > 10 && adx <= 40) b |= 0x20;
  if (adx > 0 && adx <= 10) b |= 0x10;
  if (ady % 10 > 3) b |= 0x08;
  if (ady % 10 > 0 && ady % 10 <= 3) b |= 0x04;
  if (adx % 10 > 3) b |= 0x02;
  if (adx % 10 > 0 && adx % 10 <= 3) b |= 0x01;

  return b;
}

function encodeDSTByte3(dx: number, dy: number, jump: boolean): number {
  let b = 0x03;

  if (jump) {
    b = 0x83;
  }

  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (ady % 3 >= 2) b |= 0x20;
  if (ady % 3 >= 1) b |= 0x10;
  if (adx % 3 >= 2) b |= 0x08;
  if (adx % 3 >= 1) b |= 0x04;

  return b;
}
