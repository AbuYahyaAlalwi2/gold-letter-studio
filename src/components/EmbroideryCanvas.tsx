import { useRef, useEffect, useCallback, useState } from 'react';
import { Canvas as FabricCanvas, Line, Circle, Group, Rect, Polyline, PencilBrush, FabricObject } from 'fabric';
import { CanvasState, Point, StitchPath, ToolType, StitchType } from '../types/embroidery';
import { convertPathToStitches, stitchPointsToSegments } from '../utils/stitch-converter';

/** WeakSet used to tag Fabric objects that represent stitch paths */
const stitchObjects = new WeakSet<FabricObject>();

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

const PX_PER_MM = 4;
const DESIGN_W_PX = 200 * PX_PER_MM;
const DESIGN_H_PX = 150 * PX_PER_MM;
const GRID_MAJOR_MM = 20;
const GRID_MINOR_MM = 5;

let pathIdCounter = 0;

/** Build the static grid group (design area, minor + major grid lines, border) */
function buildGridGroup(): Group {
  const objects: (Line | Rect)[] = [];

  // Design area background
  objects.push(
    new Rect({
      left: 0,
      top: 0,
      width: DESIGN_W_PX,
      height: DESIGN_H_PX,
      fill: '#FFFFFF',
      selectable: false,
      evented: false,
    })
  );

  // Minor grid (5mm)
  const minorStep = GRID_MINOR_MM * PX_PER_MM;
  for (let x = 0; x <= DESIGN_W_PX; x += minorStep) {
    objects.push(
      new Line([x, 0, x, DESIGN_H_PX], {
        stroke: '#F0F0F0',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
      })
    );
  }
  for (let y = 0; y <= DESIGN_H_PX; y += minorStep) {
    objects.push(
      new Line([0, y, DESIGN_W_PX, y], {
        stroke: '#F0F0F0',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
      })
    );
  }

  // Major grid (20mm)
  const majorStep = GRID_MAJOR_MM * PX_PER_MM;
  for (let x = 0; x <= DESIGN_W_PX; x += majorStep) {
    objects.push(
      new Line([x, 0, x, DESIGN_H_PX], {
        stroke: '#E0E0E0',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      })
    );
  }
  for (let y = 0; y <= DESIGN_H_PX; y += majorStep) {
    objects.push(
      new Line([0, y, DESIGN_W_PX, y], {
        stroke: '#E0E0E0',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      })
    );
  }

  // Border
  objects.push(
    new Rect({
      left: 0,
      top: 0,
      width: DESIGN_W_PX,
      height: DESIGN_H_PX,
      fill: 'transparent',
      stroke: '#CCC',
      strokeWidth: 1.5,
      selectable: false,
      evented: false,
    })
  );

  return new Group(objects, {
    selectable: false,
    evented: false,
    objectCaching: true,
  });
}

/** Build a Fabric Group that renders a single StitchPath */
function buildStitchGroup(path: StitchPath): Group {
  if (path.points.length < 2) {
    return new Group([], { selectable: false, evented: false });
  }

  const stitchPts = convertPathToStitches(path);
  if (stitchPts.length < 2) {
    return new Group([], { selectable: false, evented: false });
  }

  const segments = stitchPointsToSegments(stitchPts);
  const objects: (Line | Circle | Polyline)[] = [];

  // Draw stitch segments
  for (const seg of segments) {
    objects.push(
      new Line(
        [
          seg.from.x * PX_PER_MM,
          seg.from.y * PX_PER_MM,
          seg.to.x * PX_PER_MM,
          seg.to.y * PX_PER_MM,
        ],
        {
          stroke: path.color,
          strokeWidth: 1.5,
          strokeLineCap: 'round',
          selectable: false,
          evented: false,
        }
      )
    );
  }

  // Draw needle penetration dots
  for (const p of stitchPts) {
    objects.push(
      new Circle({
        left: p.x * PX_PER_MM - 1,
        top: p.y * PX_PER_MM - 1,
        radius: 1,
        fill: path.color,
        selectable: false,
        evented: false,
      })
    );
  }

  // For non-run stitch types, show faint guide of original path
  if (path.stitchType !== 'run' && path.points.length >= 2) {
    const guidePoints = path.points.map((p) => ({
      x: p.x * PX_PER_MM,
      y: p.y * PX_PER_MM,
    }));
    objects.push(
      new Polyline(guidePoints, {
        stroke: path.color,
        strokeWidth: 1,
        fill: 'transparent',
        strokeDashArray: [3, 3],
        opacity: 0.2,
        selectable: false,
        evented: false,
      })
    );
  }

  const group = new Group(objects, {
    selectable: true,
    evented: true,
  });
  stitchObjects.add(group);
  return group;
}

export default function EmbroideryCanvas({
  paths,
  activeTool,
  activeColor,
  stitchType: _stitchType,
  density: _density,
  stitchWidth: _stitchWidth,
  onAddPath,
  onMouseMove,
  canvasState,
  onCanvasStateChange,
}: EmbroideryCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);

  // Track Input-A click points
  const [activePoints, setActivePoints] = useState<Point[]>([]);
  const activePointsRef = useRef<Point[]>([]);
  activePointsRef.current = activePoints;

  // Active preview group on the canvas
  const activeGroupRef = useRef<Group | null>(null);

  // Keep ref-copies of props for Fabric event handlers
  const propsRef = useRef({
    activeTool,
    activeColor,
    stitchType: _stitchType,
    density: _density,
    stitchWidth: _stitchWidth,
    canvasState,
  });
  propsRef.current = {
    activeTool,
    activeColor,
    stitchType: _stitchType,
    density: _density,
    stitchWidth: _stitchWidth,
    canvasState,
  };

  // ─── Initialise Fabric canvas (once) ──────────────────────────────────────
  useEffect(() => {
    const el = canvasElRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const rect = container.getBoundingClientRect();
    const fc = new FabricCanvas(el, {
      width: rect.width,
      height: rect.height,
      backgroundColor: '#111111',
      selection: false,
    });

    fabricRef.current = fc;

    // Add grid
    const grid = buildGridGroup();
    fc.add(grid);
    fc.sendObjectToBack(grid);

    // Apply initial pan/zoom
    const vpt = fc.viewportTransform;
    if (vpt) {
      vpt[0] = canvasState.zoom;
      vpt[3] = canvasState.zoom;
      vpt[4] = canvasState.panX;
      vpt[5] = canvasState.panY;
      fc.setViewportTransform(vpt);
    }

    fc.renderAll();

    return () => {
      fc.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Sync paths → Fabric objects ──────────────────────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    // Remove old stitch groups (keep grid at index 0)
    const toRemove = fc.getObjects().filter((o) => stitchObjects.has(o));
    toRemove.forEach((o) => fc.remove(o));

    // Re-add each path
    for (const p of paths) {
      fc.add(buildStitchGroup(p));
    }

    fc.renderAll();
  }, [paths]);

  // ─── Sync pan / zoom → Fabric viewport ───────────────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    const vpt = fc.viewportTransform;
    if (vpt) {
      vpt[0] = canvasState.zoom;
      vpt[3] = canvasState.zoom;
      vpt[4] = canvasState.panX;
      vpt[5] = canvasState.panY;
      fc.setViewportTransform(vpt);
    }
    fc.renderAll();
  }, [canvasState.zoom, canvasState.panX, canvasState.panY]);

  // ─── Resize observer ──────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const fc = fabricRef.current;
    if (!container || !fc) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      fc.setDimensions({ width, height });
      fc.renderAll();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ─── Draw Input-A preview ─────────────────────────────────────────────────
  const drawActivePreview = useCallback((points: Point[]) => {
    const fc = fabricRef.current;
    if (!fc) return;

    // Remove old preview
    if (activeGroupRef.current) {
      fc.remove(activeGroupRef.current);
      activeGroupRef.current = null;
    }

    if (points.length < 1) {
      fc.renderAll();
      return;
    }

    const objects: (Line | Circle)[] = [];
    const color = propsRef.current.activeColor;

    // Lines between points
    for (let i = 1; i < points.length; i++) {
      objects.push(
        new Line(
          [
            points[i - 1].x * PX_PER_MM,
            points[i - 1].y * PX_PER_MM,
            points[i].x * PX_PER_MM,
            points[i].y * PX_PER_MM,
          ],
          {
            stroke: color,
            strokeWidth: 2,
            strokeDashArray: [5, 3],
            strokeLineCap: 'round',
            selectable: false,
            evented: false,
          }
        )
      );
    }

    // Point markers
    for (const p of points) {
      objects.push(
        new Circle({
          left: p.x * PX_PER_MM - 3,
          top: p.y * PX_PER_MM - 3,
          radius: 3,
          fill: color,
          stroke: '#FFF',
          strokeWidth: 1,
          selectable: false,
          evented: false,
        })
      );
    }

    const group = new Group(objects, {
      selectable: false,
      evented: false,
    });
    // (tracked via activeGroupRef, not in stitchObjects)
    activeGroupRef.current = group;
    fc.add(group);
    fc.renderAll();
  }, []);

  // ─── Finalize path ────────────────────────────────────────────────────────
  const finalizePath = useCallback(
    (points: Point[]) => {
      if (points.length >= 2) {
        const {
          stitchType: st,
          activeColor: col,
          density: d,
          stitchWidth: sw,
        } = propsRef.current;
        const newPath: StitchPath = {
          id: `path-${++pathIdCounter}`,
          points: [...points],
          stitchType: st,
          color: col,
          density: d,
          width: sw,
        };
        onAddPath(newPath);
      }
      setActivePoints([]);
      // Clear preview
      const fc = fabricRef.current;
      if (fc && activeGroupRef.current) {
        fc.remove(activeGroupRef.current);
        activeGroupRef.current = null;
        fc.renderAll();
      }
    },
    [onAddPath]
  );

  // ─── Configure tool mode ─────────────────────────────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    fc.isDrawingMode = false;
    fc.selection = false;

    if (activeTool === 'select') {
      fc.selection = true;
      fc.getObjects().forEach((o) => {
        if (stitchObjects.has(o)) {
          o.selectable = true;
          o.evented = true;
        }
      });
    } else if (activeTool === 'inputB') {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.color = activeColor;
      brush.width = 2;
      fc.freeDrawingBrush = brush;
      fc.getObjects().forEach((o) => {
        if (stitchObjects.has(o)) {
          o.selectable = false;
          o.evented = false;
        }
      });
    } else {
      fc.getObjects().forEach((o) => {
        if (stitchObjects.has(o)) {
          o.selectable = false;
          o.evented = false;
        }
      });
    }

    fc.renderAll();
  }, [activeTool, activeColor]);

  // ─── Handle Fabric path:created (freehand Input B) ────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    const handler = (e: { path: { path: Array<[string, ...number[]]> } }) => {
      const fabricPath = e.path;
      const cs = propsRef.current.canvasState;
      const points: Point[] = [];

      for (const cmd of fabricPath.path) {
        if (cmd[0] === 'M' || cmd[0] === 'L' || cmd[0] === 'Q') {
          const x = cmd[cmd.length - 2] as number;
          const y = cmd[cmd.length - 1] as number;
          // Convert from canvas-space back to design mm
          const mmX = (x * cs.zoom + cs.panX - cs.panX) / (cs.zoom * PX_PER_MM);
          const mmY = (y * cs.zoom + cs.panY - cs.panY) / (cs.zoom * PX_PER_MM);
          const designPt = { x: mmX, y: mmY };
          // Downsample
          const last = points[points.length - 1];
          if (
            !last ||
            Math.hypot(designPt.x - last.x, designPt.y - last.y) > 0.3
          ) {
            points.push(designPt);
          }
        }
      }

      // Remove the raw Fabric path object
      const objs = fc.getObjects();
      const lastObj = objs[objs.length - 1];
      if (lastObj && !stitchObjects.has(lastObj) && lastObj !== activeGroupRef.current) {
        fc.remove(lastObj);
      }

      if (points.length >= 2) {
        const {
          stitchType: st,
          activeColor: col,
          density: d,
          stitchWidth: sw,
        } = propsRef.current;
        const newPath: StitchPath = {
          id: `path-${++pathIdCounter}`,
          points,
          stitchType: st,
          color: col,
          density: d,
          width: sw,
        };
        onAddPath(newPath);
      }

      fc.renderAll();
    };

    fc.on('path:created', handler as never);
    return () => {
      fc.off('path:created', handler as never);
    };
  }, [onAddPath]);

  // ─── Mouse events: Input-A clicks, panning, coordinate tracking, zoom ────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    let isPanning = false;
    let lastPanX = 0;
    let lastPanY = 0;

    const onMouseDown = (opt: { e: MouseEvent }) => {
      const evt = opt.e;
      const tool = propsRef.current.activeTool;

      // Middle button or Alt+click → pan
      if (evt.button === 1 || (evt.button === 0 && evt.altKey)) {
        isPanning = true;
        lastPanX = evt.clientX;
        lastPanY = evt.clientY;
        evt.preventDefault();
        return;
      }

      if (evt.button !== 0) return;

      if (tool === 'inputA') {
        const pointer = fc.getScenePoint(evt);
        const designPt: Point = {
          x: pointer.x / PX_PER_MM,
          y: pointer.y / PX_PER_MM,
        };
        const newPoints = [...activePointsRef.current, designPt];
        setActivePoints(newPoints);
        drawActivePreview(newPoints);
      }
    };

    const onFabricMouseMove = (opt: { e: MouseEvent }) => {
      const evt = opt.e;

      if (isPanning) {
        const dx = evt.clientX - lastPanX;
        const dy = evt.clientY - lastPanY;
        lastPanX = evt.clientX;
        lastPanY = evt.clientY;
        const cs = propsRef.current.canvasState;
        onCanvasStateChange({
          ...cs,
          panX: cs.panX + dx,
          panY: cs.panY + dy,
        });
        return;
      }

      // Report design coordinates
      const pointer = fc.getScenePoint(evt);
      onMouseMove(pointer.x / PX_PER_MM, pointer.y / PX_PER_MM);
    };

    const onMouseUp = (opt: { e: MouseEvent }) => {
      if (isPanning) {
        isPanning = false;
        opt.e.preventDefault();
      }
    };

    const onDoubleClick = () => {
      const tool = propsRef.current.activeTool;
      if (tool === 'inputA' && activePointsRef.current.length >= 2) {
        finalizePath(activePointsRef.current);
      }
    };

    const onWheel = (opt: { e: WheelEvent }) => {
      const evt = opt.e;
      evt.preventDefault();

      const cs = propsRef.current.canvasState;
      const el = evt.target as HTMLCanvasElement;
      const rect = el.getBoundingClientRect();
      const px = evt.clientX - rect.left;
      const py = evt.clientY - rect.top;

      const zoomFactor = evt.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.1, Math.min(10, cs.zoom * zoomFactor));
      const newPanX = px - (px - cs.panX) * (newZoom / cs.zoom);
      const newPanY = py - (py - cs.panY) * (newZoom / cs.zoom);

      onCanvasStateChange({
        ...cs,
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY,
      });
    };

    fc.on('mouse:down', onMouseDown as never);
    fc.on('mouse:move', onFabricMouseMove as never);
    fc.on('mouse:up', onMouseUp as never);
    fc.on('mouse:dblclick', onDoubleClick as never);
    fc.on('mouse:wheel', onWheel as never);

    return () => {
      fc.off('mouse:down', onMouseDown as never);
      fc.off('mouse:move', onFabricMouseMove as never);
      fc.off('mouse:up', onMouseUp as never);
      fc.off('mouse:dblclick', onDoubleClick as never);
      fc.off('mouse:wheel', onWheel as never);
    };
  }, [onMouseMove, onCanvasStateChange, finalizePath, drawActivePreview]);

  // ─── Keyboard: Enter/Escape to finish Input-A paths ───────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        if (activePointsRef.current.length >= 2) {
          finalizePath(activePointsRef.current);
        } else {
          setActivePoints([]);
          drawActivePreview([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finalizePath, drawActivePreview]);

  const cursorStyle =
    activeTool === 'select'
      ? 'default'
      : activeTool === 'inputA' || activeTool === 'inputB'
        ? 'crosshair'
        : 'crosshair';

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative bg-[#111]">
      <canvas ref={canvasElRef} style={{ cursor: cursorStyle }} />
      {/* Drawing mode indicator */}
      {(activeTool === 'inputA' || activeTool === 'inputB') &&
        activePoints.length > 0 && (
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
