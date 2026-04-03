import { useRef, useEffect, useCallback, useState } from 'react';
import { CanvasState, Point, StitchPath, ToolType, StitchType } from '../types/embroidery';
import { drawGrid, drawPaths, drawActivePath, screenToDesign } from '../utils/canvas-renderer';

interface EmbroideryCanvasProps {
  paths: StitchPath[];
  activeTool: ToolType;
  activeColor: string;
  stitchType: StitchType;
  density: number;
  stitchWidth: number;
  onAddPath: (path: StitchPath) => void;
  onMouseMove: (x: number, y: number) => void;
  canvasState: CanvasState;
  onCanvasStateChange: (state: CanvasState) => void;
}

let pathIdCounter = 0;

export default function EmbroideryCanvas({
  paths,
  activeTool,
  activeColor,
  stitchType,
  density,
  stitchWidth,
  onAddPath,
  onMouseMove,
  canvasState,
  onCanvasStateChange,
}: EmbroideryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activePoints, setActivePoints] = useState<Point[]>([]);
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);
  const animFrameRef = useRef<number>(0);

  // Resize canvas to fill container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx, width, height, canvasState);

    // Draw all completed paths
    drawPaths(ctx, paths, canvasState);

    // Draw active path being drawn
    if (activePoints.length > 0) {
      drawActivePath(ctx, activePoints, activeColor, canvasState);
    }

    ctx.restore();
  }, [canvasState, paths, activePoints, activeColor]);

  // Animation frame loop
  useEffect(() => {
    const animate = () => {
      render();
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [render]);

  // Handle resize
  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Finalize the current path
  const finalizePath = useCallback(() => {
    if (activePoints.length >= 2) {
      const newPath: StitchPath = {
        id: `path-${++pathIdCounter}`,
        points: [...activePoints],
        stitchType,
        color: activeColor,
        density,
        width: stitchWidth,
      };
      onAddPath(newPath);
    }
    setActivePoints([]);
    setIsDrawingFreehand(false);
  }, [activePoints, stitchType, activeColor, density, stitchWidth, onAddPath]);

  // Get canvas-relative position
  const getCanvasPos = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // Mouse down handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = getCanvasPos(e);

      // Middle mouse button or Space+click for panning
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        onCanvasStateChange({
          ...canvasState,
          isPanning: true,
          lastPanPoint: { x: pos.x, y: pos.y },
        });
        e.preventDefault();
        return;
      }

      if (e.button !== 0) return;

      const designPos = screenToDesign(pos.x, pos.y, canvasState);

      switch (activeTool) {
        case 'inputA':
          // Click-to-place mode: add one point per click
          setActivePoints((prev) => [...prev, designPos]);
          break;

        case 'inputB':
          // Freehand drawing mode
          setIsDrawingFreehand(true);
          setActivePoints([designPos]);
          break;

        default:
          break;
      }
    },
    [activeTool, canvasState, getCanvasPos, onCanvasStateChange]
  );

  // Mouse move handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = getCanvasPos(e);
      const designPos = screenToDesign(pos.x, pos.y, canvasState);

      // Report position in mm
      onMouseMove(designPos.x, designPos.y);

      // Panning
      if (canvasState.isPanning && canvasState.lastPanPoint) {
        const dx = pos.x - canvasState.lastPanPoint.x;
        const dy = pos.y - canvasState.lastPanPoint.y;
        onCanvasStateChange({
          ...canvasState,
          panX: canvasState.panX + dx,
          panY: canvasState.panY + dy,
          lastPanPoint: { x: pos.x, y: pos.y },
        });
        return;
      }

      // Freehand drawing
      if (isDrawingFreehand && activeTool === 'inputB') {
        // Downsample: only add if moved enough
        const lastPt = activePoints[activePoints.length - 1];
        if (lastPt) {
          const dx = designPos.x - lastPt.x;
          const dy = designPos.y - lastPt.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.5) {
            setActivePoints((prev) => [...prev, designPos]);
          }
        }
      }
    },
    [
      activeTool,
      activePoints,
      canvasState,
      getCanvasPos,
      isDrawingFreehand,
      onCanvasStateChange,
      onMouseMove,
    ]
  );

  // Mouse up handler
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // End panning
      if (canvasState.isPanning) {
        onCanvasStateChange({
          ...canvasState,
          isPanning: false,
          lastPanPoint: null,
        });
        return;
      }

      // End freehand drawing
      if (isDrawingFreehand && e.button === 0) {
        finalizePath();
      }
    },
    [canvasState, isDrawingFreehand, finalizePath, onCanvasStateChange]
  );

  // Double click to finalize Input A path
  const handleDoubleClick = useCallback(() => {
    if (activeTool === 'inputA' && activePoints.length >= 2) {
      finalizePath();
    }
  }, [activeTool, activePoints.length, finalizePath]);

  // Scroll to zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const pos = getCanvasPos(e);
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.1, Math.min(10, canvasState.zoom * zoomFactor));

      // Zoom toward mouse position
      const newPanX = pos.x - (pos.x - canvasState.panX) * (newZoom / canvasState.zoom);
      const newPanY = pos.y - (pos.y - canvasState.panY) * (newZoom / canvasState.zoom);

      onCanvasStateChange({
        ...canvasState,
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY,
      });
    },
    [canvasState, getCanvasPos, onCanvasStateChange]
  );

  // Keyboard handler for finishing paths
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        if (activePoints.length >= 2) {
          finalizePath();
        } else {
          setActivePoints([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePoints, finalizePath]);

  const cursorStyle =
    activeTool === 'select'
      ? 'default'
      : activeTool === 'inputA' || activeTool === 'inputB'
        ? 'crosshair'
        : 'crosshair';

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative bg-[#111]">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ cursor: canvasState.isPanning ? 'grabbing' : cursorStyle }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Drawing mode indicator */}
      {(activeTool === 'inputA' || activeTool === 'inputB') && activePoints.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
          {activeTool === 'inputA'
            ? `${activePoints.length} points — Double-click or Enter to finish`
            : 'Release to finish freehand path'}
        </div>
      )}
      {/* Tool hint */}
      {activeTool !== 'select' &&
        activeTool !== 'inputA' &&
        activeTool !== 'inputB' &&
        activePoints.length === 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-gray-400 text-xs px-3 py-1.5 rounded-full pointer-events-none">
            Use Input A or Input B tools to draw stitch paths
          </div>
        )}
    </div>
  );
}
