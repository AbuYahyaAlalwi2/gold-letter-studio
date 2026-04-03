"use client";

import { useState, useRef, useCallback } from "react";
import {
  MousePointer2,
  Paintbrush,
  Pen,
  Download,
  Trash2,
  Palette,
  Settings2,
} from "lucide-react";
import EmbroideryCanvas, {
  EmbroideryCanvasRef,
} from "@/components/embroidery-canvas";

type Tool = "select" | "satin" | "running";

const QUICK_COLORS = [
  { color: "#D4AF37", name: "Gold" },
  { color: "#000000", name: "Black" },
  { color: "#FFFFFF", name: "White" },
  { color: "#e74c3c", name: "Red" },
  { color: "#3498db", name: "Blue" },
  { color: "#2ecc71", name: "Green" },
];

const PIXELS_PER_MM = 3.7795275591;

export default function EmbroideryWorkspace() {
  const [tool, setTool] = useState<Tool>("satin");
  const [color, setColor] = useState("#D4AF37");
  const [spacing, setSpacing] = useState(0.4);
  const [satinWidth, setSatinWidth] = useState(3);
  const [stitchCount, setStitchCount] = useState(0);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [showSettings, setShowSettings] = useState(false);

  const canvasRef = useRef<EmbroideryCanvasRef | null>(null);

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
    if (confirm("Clear all stitches?")) {
      canvasRef.current?.clearCanvas();
    }
  }, []);

  return (
    <div className="h-dvh flex flex-col bg-[#1a1a1a] overflow-hidden select-none">
      {/* Header - compact for mobile */}
      <header className="h-12 bg-[#2d2d2d] flex items-center justify-between px-2 sm:px-4 border-b border-[#444] shrink-0">
        <span className="text-[#D4AF37] font-bold text-xs sm:text-sm tracking-wide">
          GOLD LETTER
        </span>
        
        {/* Export DST Button - Prominent */}
        <button
          onClick={handleExportDST}
          className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation"
          style={{ background: "#D4AF37", color: "#000" }}
        >
          <Download size={16} />
          <span>Export DST</span>
        </button>
      </header>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tool Palette - Optimized for mobile touch */}
        <aside className="w-20 sm:w-24 bg-[#2d2d2d] border-r border-[#444] flex flex-col shrink-0">
          {/* Section label */}
          <div className="px-2 py-2 text-[10px] text-[#999] font-medium uppercase tracking-wider text-center border-b border-[#444]">
            Tools
          </div>

          {/* Tool buttons - Large touch targets */}
          <div className="flex flex-col items-center gap-3 p-2 sm:p-3">
            {/* Select Tool */}
            <button
              onClick={() => setTool("select")}
              className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 touch-manipulation ${
                tool === "select"
                  ? "bg-[#D4AF37] text-black ring-2 ring-white"
                  : "bg-[#3c3c3c] text-[#ccc] border-2 border-transparent hover:bg-[#444]"
              }`}
            >
              <MousePointer2 size={24} />
              <span className="text-[10px] font-semibold">Select</span>
            </button>

            {/* Divider */}
            <div className="w-full h-px bg-[#444]" />

            {/* Input A - Satin Tool */}
            <button
              onClick={() => setTool("satin")}
              className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 touch-manipulation ${
                tool === "satin"
                  ? "bg-[#D4AF37] text-black ring-2 ring-white"
                  : "bg-[#3c3c3c] text-[#ccc] border-2 border-transparent hover:bg-[#444]"
              }`}
            >
              <Paintbrush size={24} />
              <span className="text-[11px] font-bold">Input A</span>
              <span className="text-[9px] opacity-80">(Satin)</span>
            </button>

            {/* Running Stitch Tool */}
            <button
              onClick={() => setTool("running")}
              className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 touch-manipulation ${
                tool === "running"
                  ? "bg-[#D4AF37] text-black ring-2 ring-white"
                  : "bg-[#3c3c3c] text-[#ccc] border-2 border-transparent hover:bg-[#444]"
              }`}
            >
              <Pen size={24} />
              <span className="text-[11px] font-bold">Running</span>
              <span className="text-[9px] opacity-80">Stitch</span>
            </button>
          </div>

          {/* Divider */}
          <div className="mx-2 h-px bg-[#444]" />

          {/* Quick Color selector */}
          <div className="p-2 sm:p-3">
            <div className="text-[9px] text-[#999] font-medium uppercase mb-2 text-center">
              Color
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_COLORS.map((c) => (
                <button
                  key={c.color}
                  onClick={() => setColor(c.color)}
                  className={`aspect-square rounded-lg transition-all active:scale-95 touch-manipulation ${
                    color === c.color
                      ? "ring-2 ring-white scale-105"
                      : "ring-1 ring-[#555]"
                  }`}
                  style={{ backgroundColor: c.color }}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`mx-2 mb-2 p-3 rounded-lg transition-all active:scale-95 touch-manipulation ${
              showSettings ? "bg-[#D4AF37] text-black" : "bg-[#3c3c3c] text-[#ccc]"
            }`}
          >
            <Settings2 size={20} className="mx-auto" />
          </button>

          {/* Clear button */}
          <button
            onClick={handleClear}
            className="mx-2 mb-2 p-3 rounded-lg bg-[#3c3c3c] text-[#e74c3c] transition-all active:scale-95 touch-manipulation hover:bg-[#444]"
          >
            <Trash2 size={20} className="mx-auto" />
          </button>
        </aside>

        {/* Canvas area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <EmbroideryCanvas
            tool={tool}
            color={color}
            spacing={spacing}
            satinWidth={satinWidth}
            onStitchCountChange={setStitchCount}
            onCoordsChange={(x, y) => setCoords({ x, y })}
            canvasRef={canvasRef}
          />
        </div>

        {/* Settings Panel - Slides in from right */}
        {showSettings && (
          <aside className="w-48 sm:w-56 bg-[#2d2d2d] border-l border-[#444] flex flex-col shrink-0 overflow-y-auto">
            <div className="px-3 py-2 text-xs font-semibold text-[#D4AF37] bg-[#3c3c3c] border-b border-[#444]">
              Stitch Settings
            </div>
            <div className="p-3 space-y-4">
              {/* Spacing */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[11px] text-[#999]">Spacing</label>
                  <span className="text-[11px] text-[#D4AF37] font-mono">
                    {spacing.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2"
                  step="0.1"
                  value={spacing}
                  onChange={(e) => setSpacing(parseFloat(e.target.value))}
                  className="w-full h-8 cursor-pointer accent-[#D4AF37] touch-manipulation"
                />
              </div>

              {/* Satin Width - only for satin tool */}
              {tool === "satin" && (
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[11px] text-[#999]">Satin Width</label>
                    <span className="text-[11px] text-[#D4AF37] font-mono">
                      {satinWidth.toFixed(1)} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={satinWidth}
                    onChange={(e) => setSatinWidth(parseFloat(e.target.value))}
                    className="w-full h-8 cursor-pointer accent-[#D4AF37] touch-manipulation"
                  />
                </div>
              )}

              {/* Custom color picker */}
              <div>
                <label className="text-[11px] text-[#999] block mb-1">
                  Custom Color
                </label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-10 rounded cursor-pointer touch-manipulation"
                />
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Footer status bar */}
      <footer className="h-8 bg-[#007acc] flex items-center justify-between px-3 text-[11px] text-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
          <span>Ready</span>
        </div>
        <div className="font-mono text-[10px] sm:text-[11px]">
          X: {coords.x.toFixed(1)}mm | Y: {coords.y.toFixed(1)}mm | Stitches: {stitchCount}
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
