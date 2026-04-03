"use client";

import { useRef, useEffect, useCallback, useState } from "react";

const PIXELS_PER_MM = 3.7795275591;
const GRID_SIZE_MM = 10;
const RULER_SIZE = 28; // Increased for better visibility

interface Point {
  x: number;
  y: number;
}

interface StitchPath {
  points: Point[];
  tool: "satin" | "running";
  color: string;
  spacing: number;
  satinWidth: number;
}

export interface EmbroideryCanvasRef {
  getStitchData: () => StitchPath[];
  clearCanvas: () => void;
  getStitchCount: () => number;
}

interface EmbroideryCanvasProps {
  tool: "select" | "satin" | "running";
  color: string;
  spacing: number;
  satinWidth: number;
  onStitchCountChange: (count: number) => void;
  onCoordsChange: (x: number, y: number) => void;
  canvasRef?: React.RefObject<EmbroideryCanvasRef | null>;
}

export default function EmbroideryCanvas({
  tool,
  color,
  spacing,
  satinWidth,
  onStitchCountChange,
  onCoordsChange,
  canvasRef,
}: EmbroideryCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const rulerTopRef = useRef<HTMLCanvasElement>(null);
  const rulerLeftRef = useRef<HTMLCanvasElement>(null);

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [drawing, setDrawing] = useState(false);
  const currentPathRef = useRef<Point[]>([]);
  const stitchCountRef = useRef(0);
  const stitchPathsRef = useRef<StitchPath[]>([]);

  // Draw rulers with 10mm markings prominently displayed
  const drawRulers = useCallback(() => {
    const topCanvas = rulerTopRef.current;
    const leftCanvas = rulerLeftRef.current;
    if (!topCanvas || !leftCanvas) return;

    const topCtx = topCanvas.getContext("2d");
    const leftCtx = leftCanvas.getContext("2d");
    if (!topCtx || !leftCtx) return;

    // Top ruler - Light gray background
    topCtx.fillStyle = "#e8e8e8";
    topCtx.fillRect(0, 0, topCanvas.width, topCanvas.height);

    // Bottom border
    topCtx.strokeStyle = "#666";
    topCtx.lineWidth = 2;
    topCtx.beginPath();
    topCtx.moveTo(0, RULER_SIZE - 1);
    topCtx.lineTo(topCanvas.width, RULER_SIZE - 1);
    topCtx.stroke();

    topCtx.strokeStyle = "#333";
    topCtx.fillStyle = "#333";
    topCtx.font = "bold 10px Arial";
    topCtx.textAlign = "center";
    topCtx.lineWidth = 1;

    // Draw 10mm major markings with numbers
    for (let mm = 0; mm <= canvasSize.width / PIXELS_PER_MM; mm += 10) {
      const px = mm * PIXELS_PER_MM;

      // Major tick (10mm) - tall and bold
      topCtx.strokeStyle = "#000";
      topCtx.lineWidth = 2;
      topCtx.beginPath();
      topCtx.moveTo(px, RULER_SIZE - 12);
      topCtx.lineTo(px, RULER_SIZE - 1);
      topCtx.stroke();

      // Number label
      topCtx.fillStyle = "#000";
      topCtx.font = "bold 10px Arial";
      topCtx.fillText(String(mm), px, 11);

      // Sub-ticks (1mm increments)
      topCtx.strokeStyle = "#666";
      topCtx.lineWidth = 1;
      for (let sub = 1; sub < 10; sub++) {
        const subPx = (mm + sub) * PIXELS_PER_MM;
        if (subPx > canvasSize.width) break;

        const tickHeight = sub === 5 ? 8 : 4; // 5mm tick is medium height
        topCtx.beginPath();
        topCtx.moveTo(subPx, RULER_SIZE - tickHeight - 1);
        topCtx.lineTo(subPx, RULER_SIZE - 1);
        topCtx.stroke();
      }
    }

    // Left ruler - Light gray background
    leftCtx.fillStyle = "#e8e8e8";
    leftCtx.fillRect(0, 0, leftCanvas.width, leftCanvas.height);

    // Right border
    leftCtx.strokeStyle = "#666";
    leftCtx.lineWidth = 2;
    leftCtx.beginPath();
    leftCtx.moveTo(RULER_SIZE - 1, 0);
    leftCtx.lineTo(RULER_SIZE - 1, leftCanvas.height);
    leftCtx.stroke();

    leftCtx.strokeStyle = "#333";
    leftCtx.fillStyle = "#333";
    leftCtx.font = "bold 10px Arial";
    leftCtx.textAlign = "center";
    leftCtx.lineWidth = 1;

    // Draw 10mm major markings with numbers
    for (let mm = 0; mm <= canvasSize.height / PIXELS_PER_MM; mm += 10) {
      const px = mm * PIXELS_PER_MM;

      // Major tick (10mm) - tall and bold
      leftCtx.strokeStyle = "#000";
      leftCtx.lineWidth = 2;
      leftCtx.beginPath();
      leftCtx.moveTo(RULER_SIZE - 12, px);
      leftCtx.lineTo(RULER_SIZE - 1, px);
      leftCtx.stroke();

      // Number label (rotated)
      leftCtx.save();
      leftCtx.translate(10, px + 3);
      leftCtx.rotate(-Math.PI / 2);
      leftCtx.fillStyle = "#000";
      leftCtx.font = "bold 10px Arial";
      leftCtx.fillText(String(mm), 0, 0);
      leftCtx.restore();

      // Sub-ticks (1mm increments)
      leftCtx.strokeStyle = "#666";
      leftCtx.lineWidth = 1;
      for (let sub = 1; sub < 10; sub++) {
        const subPx = (mm + sub) * PIXELS_PER_MM;
        if (subPx > canvasSize.height) break;

        const tickHeight = sub === 5 ? 8 : 4;
        leftCtx.beginPath();
        leftCtx.moveTo(RULER_SIZE - tickHeight - 1, subPx);
        leftCtx.lineTo(RULER_SIZE - 1, subPx);
        leftCtx.stroke();
      }
    }
  }, [canvasSize]);

  // Draw 10mm grid on canvas
  const drawGrid = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 10mm major grid lines
    ctx.strokeStyle = "#d0d0d0";
    ctx.lineWidth = 1;
    const gridPx = GRID_SIZE_MM * PIXELS_PER_MM;

    for (let i = 0; i <= canvas.width; i += gridPx) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }

    for (let i = 0; i <= canvas.height; i += gridPx) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // 5mm sub-grid lines (lighter)
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 0.5;
    const subGrid = gridPx / 2;

    for (let i = subGrid; i <= canvas.width; i += gridPx) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = subGrid; i <= canvas.height; i += gridPx) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }
  }, []);

  const drawRunningStitch = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      stitchColor: string,
      stitchSpacing: number
    ) => {
      const distance = Math.sqrt(
        Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2)
      );
      const stitches = Math.max(
        Math.floor(distance / (stitchSpacing * PIXELS_PER_MM)),
        1
      );

      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.shadowBlur = 0.5;
      ctx.shadowOffsetX = 0.3;
      ctx.shadowOffsetY = 0.3;

      ctx.strokeStyle = stitchColor;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";

      for (let i = 0; i < stitches; i++) {
        const t = i / stitches;
        const t2 = (i + 0.5) / stitches;
        const x1 = fromX + (toX - fromX) * t;
        const y1 = fromY + (toY - fromY) * t;
        const x2 = fromX + (toX - fromX) * t2;
        const y2 = fromY + (toY - fromY) * t2;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.shadowColor = "transparent";
      return stitches;
    },
    []
  );

  const drawSatinStitch = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      stitchColor: string,
      stitchSpacing: number,
      width: number
    ) => {
      const distance = Math.sqrt(
        Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2)
      );
      const stitches = Math.max(
        Math.floor(distance / (stitchSpacing * PIXELS_PER_MM)),
        1
      );

      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 1;
      ctx.shadowOffsetX = 0.5;
      ctx.shadowOffsetY = 0.5;

      const lineAngle = Math.atan2(toY - fromY, toX - fromX);
      const perpAngle = lineAngle + Math.PI / 2;
      const widthPx = (width * PIXELS_PER_MM) / 2;

      ctx.strokeStyle = stitchColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      let prevX1 = 0,
        prevY1 = 0,
        prevX2 = 0,
        prevY2 = 0;

      for (let i = 0; i <= stitches; i++) {
        const t = i / stitches;
        const x = fromX + (toX - fromX) * t;
        const y = fromY + (toY - fromY) * t;

        const offset = Math.sin((i * Math.PI) / 4) * 0.4;
        const x1 = x + Math.cos(perpAngle) * (widthPx + offset);
        const y1 = y + Math.sin(perpAngle) * (widthPx + offset);
        const x2 = x - Math.cos(perpAngle) * (widthPx + offset);
        const y2 = y - Math.sin(perpAngle) * (widthPx + offset);

        if (i > 0) {
          ctx.beginPath();
          ctx.moveTo(prevX1, prevY1);
          ctx.lineTo(x1, y1);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(prevX2, prevY2);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        prevX1 = x1;
        prevY1 = y1;
        prevX2 = x2;
        prevY2 = y2;
      }

      ctx.shadowColor = "transparent";
      return stitches;
    },
    []
  );

  const redrawAllStitches = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawGrid();

    let totalStitches = 0;
    for (const path of stitchPathsRef.current) {
      for (let i = 1; i < path.points.length; i++) {
        const from = path.points[i - 1];
        const to = path.points[i];
        if (path.tool === "running") {
          totalStitches += drawRunningStitch(
            ctx,
            from.x,
            from.y,
            to.x,
            to.y,
            path.color,
            path.spacing
          );
        } else if (path.tool === "satin") {
          totalStitches += drawSatinStitch(
            ctx,
            from.x,
            from.y,
            to.x,
            to.y,
            path.color,
            path.spacing,
            path.satinWidth
          );
        }
      }
    }
    stitchCountRef.current = totalStitches;
  }, [drawGrid, drawRunningStitch, drawSatinStitch]);

  const getCoords = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return { x: 0, y: 0 };
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const handleStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (tool === "select") return;
      e.preventDefault();
      setDrawing(true);
      const { x, y } = getCoords(e);
      currentPathRef.current = [{ x, y }];
    },
    [tool, getCoords]
  );

  const handleMove = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const { x, y } = getCoords(e);
      const mmX = x / PIXELS_PER_MM;
      const mmY = y / PIXELS_PER_MM;
      onCoordsChange(mmX, mmY);

      if (!drawing || tool === "select") return;
      e.preventDefault();

      const canvas = mainCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (currentPathRef.current.length > 0) {
        const lastPoint =
          currentPathRef.current[currentPathRef.current.length - 1];
        let newStitches = 0;

        if (tool === "running") {
          newStitches = drawRunningStitch(
            ctx,
            lastPoint.x,
            lastPoint.y,
            x,
            y,
            color,
            spacing
          );
        } else if (tool === "satin") {
          newStitches = drawSatinStitch(
            ctx,
            lastPoint.x,
            lastPoint.y,
            x,
            y,
            color,
            spacing,
            satinWidth
          );
        }

        stitchCountRef.current += newStitches;
        onStitchCountChange(stitchCountRef.current);
        currentPathRef.current.push({ x, y });
      }
    },
    [
      drawing,
      tool,
      color,
      spacing,
      satinWidth,
      getCoords,
      onCoordsChange,
      onStitchCountChange,
      drawRunningStitch,
      drawSatinStitch,
    ]
  );

  const handleEnd = useCallback(() => {
    if (currentPathRef.current.length > 1 && tool !== "select") {
      stitchPathsRef.current.push({
        points: [...currentPathRef.current],
        tool: tool as "satin" | "running",
        color,
        spacing,
        satinWidth,
      });
    }
    setDrawing(false);
    currentPathRef.current = [];
  }, [tool, color, spacing, satinWidth]);

  // Resize handler - maximize canvas for mobile
  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const availableWidth = rect.width - RULER_SIZE - 4;
      const availableHeight = rect.height - RULER_SIZE - 4;

      // Use more of the available space on mobile
      let width = availableWidth;
      let height = (width * 3) / 4;

      if (height > availableHeight) {
        height = availableHeight;
        width = (height * 4) / 3;
      }

      setCanvasSize({
        width: Math.floor(Math.max(width, 200)),
        height: Math.floor(Math.max(height, 150)),
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Initialize canvas
  useEffect(() => {
    const topCanvas = rulerTopRef.current;
    const leftCanvas = rulerLeftRef.current;
    if (topCanvas && leftCanvas) {
      topCanvas.width = canvasSize.width;
      topCanvas.height = RULER_SIZE;
      leftCanvas.width = RULER_SIZE;
      leftCanvas.height = canvasSize.height;
    }
    drawRulers();
    redrawAllStitches();
  }, [canvasSize, drawRulers, redrawAllStitches]);

  // Expose methods via ref
  useEffect(() => {
    if (canvasRef?.current !== undefined) {
      (
        canvasRef as React.MutableRefObject<EmbroideryCanvasRef | null>
      ).current = {
        getStitchData: () => stitchPathsRef.current,
        clearCanvas: () => {
          stitchPathsRef.current = [];
          stitchCountRef.current = 0;
          onStitchCountChange(0);
          redrawAllStitches();
        },
        getStitchCount: () => stitchCountRef.current,
      };
    }
  }, [canvasRef, onStitchCountChange, redrawAllStitches]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center p-1 sm:p-2 overflow-hidden"
      style={{ background: "#111" }}
    >
      <div
        className="relative bg-white shadow-2xl rounded-sm overflow-hidden"
        style={{
          width: canvasSize.width + RULER_SIZE,
          height: canvasSize.height + RULER_SIZE,
        }}
      >
        {/* Corner square with mm label */}
        <div
          className="absolute top-0 left-0 flex items-center justify-center text-[8px] font-bold text-gray-500"
          style={{
            width: RULER_SIZE,
            height: RULER_SIZE,
            background: "#d8d8d8",
          }}
        >
          mm
        </div>

        {/* Top ruler */}
        <canvas
          ref={rulerTopRef}
          className="absolute"
          style={{ top: 0, left: RULER_SIZE }}
        />

        {/* Left ruler */}
        <canvas
          ref={rulerLeftRef}
          className="absolute"
          style={{ top: RULER_SIZE, left: 0 }}
        />

        {/* Main canvas */}
        <canvas
          ref={mainCanvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="absolute"
          style={{
            top: RULER_SIZE,
            left: RULER_SIZE,
            touchAction: "none",
            cursor: tool === "select" ? "default" : "crosshair",
          }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>
    </div>
  );
}
