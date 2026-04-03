import React, { useState, useRef, useEffect, useCallback } from 'react';

// ------------------------------
// Types & Constants
// ------------------------------
type Point = { x: number; y: number }; // in mm (design coordinates)

type StitchObject = 
  | { type: 'satin'; lines: { start: Point; end: Point }[]; id: string }
  | { type: 'running'; segments: { start: Point; end: Point }[]; id: string };

const MM_TO_PX = 3.78; // 1mm = 3.78px
const DEFAULT_DENSITY_MM = 0.4; // 0.4mm stitch density
const GRID_MAJOR_MM = 10; // 10mm major grid lines
const GRID_MINOR_MM = 1;   // 1mm minor grid lines (light)

// Helper: convert mm to screen pixels (with zoom and pan)
const mmToScreen = (p: Point, pan: Point, zoom: number): { x: number; y: number } => ({
  x: (p.x * MM_TO_PX * zoom) + pan.x,
  y: (p.y * MM_TO_PX * zoom) + pan.y,
});

const screenToMm = (screenX: number, screenY: number, pan: Point, zoom: number): Point => ({
  x: (screenX - pan.x) / (MM_TO_PX * zoom),
  y: (screenY - pan.y) / (MM_TO_PX * zoom),
});

// Polyline helpers
const polylineLength = (points: Point[]): number => {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    len += Math.hypot(dx, dy);
  }
  return len;
};

const getPointAtLength = (points: Point[], targetLen: number): Point => {
  if (points.length < 2) return points[0] || { x: 0, y: 0 };
  let accumulated = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    const segLen = Math.hypot(dx, dy);
    if (targetLen <= accumulated + segLen) {
      const t = (targetLen - accumulated) / segLen;
      return {
        x: points[i-1].x + dx * t,
        y: points[i-1].y + dy * t,
      };
    }
    accumulated += segLen;
  }
  return points[points.length-1];
};

// Generate satin stitch lines between two boundaries
const generateSatinStitches = (boundaryA: Point[], boundaryB: Point[], spacingMm: number): { start: Point; end: Point }[] => {
  if (boundaryA.length < 2 || boundaryB.length < 2) return [];
  const lenA = polylineLength(boundaryA);
  const lenB = polylineLength(boundaryB);
  const maxLen = Math.max(lenA, lenB);
  if (maxLen < 0.001) return [];
  const steps = Math.max(2, Math.floor(maxLen / spacingMm));
  const stitches: { start: Point; end: Point }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const distA = t * lenA;
    const distB = t * lenB;
    const start = getPointAtLength(boundaryA, distA);
    const end = getPointAtLength(boundaryB, distB);
    stitches.push({ start, end });
  }
  return stitches;
};

// Generate running stitch segments along a path with fixed step distance
const generateRunningStitch = (pathPoints: Point[], stepMm: number): { start: Point; end: Point }[] => {
  if (pathPoints.length < 2) return [];
  const totalLen = polylineLength(pathPoints);
  if (totalLen < stepMm) return [];
  const segments: { start: Point; end: Point }[] = [];
  let distance = 0;
  let prevPoint = pathPoints[0];
  let currentIndex = 1;
  let accumulated = 0;
  
  while (distance < totalLen) {
    const targetDist = distance + stepMm;
    if (targetDist >= totalLen) {
      segments.push({ start: prevPoint, end: pathPoints[pathPoints.length-1] });
      break;
    }
    // walk along polyline to find point at targetDist
    let remaining = targetDist - accumulated;
    while (currentIndex < pathPoints.length) {
      const dx = pathPoints[currentIndex].x - pathPoints[currentIndex-1].x;
      const dy = pathPoints[currentIndex].y - pathPoints[currentIndex-1].y;
      const segLen = Math.hypot(dx, dy);
      if (remaining <= segLen) {
        const t = remaining / segLen;
        const newPoint: Point = {
          x: pathPoints[currentIndex-1].x + dx * t,
          y: pathPoints[currentIndex-1].y + dy * t,
        };
        segments.push({ start: prevPoint, end: newPoint });
        prevPoint = newPoint;
        accumulated = targetDist;
        break;
      }
      remaining -= segLen;
      accumulated += segLen;
      currentIndex++;
    }
    distance = targetDist;
  }
  return segments;
};

// ------------------------------
// Main Component
// ------------------------------
const EmbroideryCanvas: React.FC = () => {
  // Canvas & transform
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<Point>({ x: 200, y: 150 }); // screen offset
  const [zoom, setZoom] = useState(1.0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  // Design data
  const [stitches, setStitches] = useState<StitchObject[]>([]);
  const [densityMm, setDensityMm] = useState(DEFAULT_DENSITY_MM); // stitch spacing mm

  // Satin boundaries (Input A and Input B)
  const [satinBoundaryA, setSatinBoundaryA] = useState<Point[]>([]);
  const [satinBoundaryB, setSatinBoundaryB] = useState<Point[]>([]);
  const [satinEditMode, setSatinEditMode] = useState<'A' | 'B' | null>(null);

  // Running stitch temporary path
  const [runningTempPoints, setRunningTempPoints] = useState<Point[]>([]);

  // Current tool: 'satin' or 'running'
  const [activeTool, setActiveTool] = useState<'satin' | 'running'>('satin');

  // UI selection & helpers
  const [selectedStitchId, setSelectedStitchId] = useState<string | null>(null);

  // ------------------------------
  // Drawing functions (canvas)
  // ------------------------------
  const drawGridAndRulers = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fdfdfd';
    ctx.fillRect(0, 0, width, height);
    
    // Get visible mm range
    const topLeftMm = screenToMm(0, 0, pan, zoom);
    const bottomRightMm = screenToMm(width, height, pan, zoom);
    const minX = Math.floor(topLeftMm.x / GRID_MAJOR_MM) * GRID_MAJOR_MM;
    const maxX = Math.ceil(bottomRightMm.x / GRID_MAJOR_MM) * GRID_MAJOR_MM;
    const minY = Math.floor(topLeftMm.y / GRID_MAJOR_MM) * GRID_MAJOR_MM;
    const maxY = Math.ceil(bottomRightMm.y / GRID_MAJOR_MM) * GRID_MAJOR_MM;

    // Draw minor grid (1mm)
    ctx.beginPath();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let x = minX; x <= maxX; x += GRID_MINOR_MM) {
      const sx = mmToScreen({ x, y: 0 }, pan, zoom).x;
      if (sx >= 0 && sx <= width) {
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
      }
    }
    for (let y = minY; y <= maxY; y += GRID_MINOR_MM) {
      const sy = mmToScreen({ x: 0, y }, pan, zoom).y;
      if (sy >= 0 && sy <= height) {
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
      }
    }
    ctx.stroke();

    // Draw major grid (10mm) & ruler ticks
    ctx.beginPath();
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    for (let x = minX; x <= maxX; x += GRID_MAJOR_MM) {
      const sx = mmToScreen({ x, y: 0 }, pan, zoom).x;
      if (sx >= 0 && sx <= width) {
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
      }
    }
    for (let y = minY; y <= maxY; y += GRID_MAJOR_MM) {
      const sy = mmToScreen({ x: 0, y }, pan, zoom).y;
      if (sy >= 0 && sy <= height) {
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
      }
    }
    ctx.stroke();

    // Draw ruler text and ticks (top and left edges)
    ctx.font = '10px monospace';
    ctx.fillStyle = '#333';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = minX; x <= maxX; x += GRID_MAJOR_MM) {
      const sx = mmToScreen({ x, y: 0 }, pan, zoom).x;
      if (sx >= 0 && sx <= width) {
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, 8);
        ctx.stroke();
        if (x !== 0) ctx.fillText(`${x}mm`, sx + 2, 18);
        else ctx.fillText('0', sx + 2, 18);
      }
    }
    for (let y = minY; y <= maxY; y += GRID_MAJOR_MM) {
      const sy = mmToScreen({ x: 0, y }, pan, zoom).y;
      if (sy >= 0 && sy <= height) {
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(8, sy);
        ctx.stroke();
        if (y !== 0) ctx.fillText(`${y}mm`, 12, sy - 2);
        else ctx.fillText('0', 12, sy - 2);
      }
    }

    // Draw origin marker
    const originScreen = mmToScreen({ x: 0, y: 0 }, pan, zoom);
    ctx.beginPath();
    ctx.arc(originScreen.x, originScreen.y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff5722';
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('(0,0)', originScreen.x + 5, originScreen.y - 2);
    
    ctx.restore();
  }, [pan, zoom]);

  const drawBoundaries = useCallback((ctx: CanvasRenderingContext2D) => {
    // Draw Satin Boundary A (Input A)
    if (satinBoundaryA.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#2c7da0';
      ctx.lineWidth = 2;
      for (let i = 0; i < satinBoundaryA.length - 1; i++) {
        const p1 = mmToScreen(satinBoundaryA[i], pan, zoom);
        const p2 = mmToScreen(satinBoundaryA[i+1], pan, zoom);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      // draw points
      ctx.fillStyle = '#2c7da0';
      satinBoundaryA.forEach(p => {
        const sp = mmToScreen(p, pan, zoom);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 3, 0, 2*Math.PI);
        ctx.fill();
      });
      ctx.fillStyle = '#0b3b4f';
      ctx.font = 'bold 12px sans-serif';
      const labelPos = mmToScreen(satinBoundaryA[0], pan, zoom);
      ctx.fillText('Input A', labelPos.x+5, labelPos.y-5);
      ctx.restore();
    }

    // Boundary B
    if (satinBoundaryB.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#1e6f5c';
      ctx.lineWidth = 2;
      for (let i = 0; i < satinBoundaryB.length - 1; i++) {
        const p1 = mmToScreen(satinBoundaryB[i], pan, zoom);
        const p2 = mmToScreen(satinBoundaryB[i+1], pan, zoom);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.fillStyle = '#1e6f5c';
      satinBoundaryB.forEach(p => {
        const sp = mmToScreen(p, pan, zoom);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 3, 0, 2*Math.PI);
        ctx.fill();
      });
      ctx.fillStyle = '#0f4c3a';
      const labelPos = mmToScreen(satinBoundaryB[0], pan, zoom);
      ctx.fillText('Input B', labelPos.x+5, labelPos.y-5);
      ctx.restore();
    }
  }, [satinBoundaryA, satinBoundaryB, pan, zoom]);

  const drawRunningTemp = useCallback((ctx: CanvasRenderingContext2D) => {
    if (runningTempPoints.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    for (let i = 0; i < runningTempPoints.length - 1; i++) {
      const p1 = mmToScreen(runningTempPoints[i], pan, zoom);
      const p2 = mmToScreen(runningTempPoints[i+1], pan, zoom);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.fillStyle = '#e67e22';
    runningTempPoints.forEach(p => {
      const sp = mmToScreen(p, pan, zoom);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4, 0, 2*Math.PI);
      ctx.fill();
    });
    ctx.restore();
  }, [runningTempPoints, pan, zoom]);

  const drawStitches = useCallback((ctx: CanvasRenderingContext2D) => {
    stitches.forEach(stitch => {
      ctx.save();
      if (selectedStitchId === stitch.id) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#f4d03f';
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = stitch.type === 'satin' ? '#c44569' : '#2d3436';
        ctx.lineWidth = 1.8;
      }
      ctx.setLineDash([]);
      if (stitch.type === 'satin') {
        for (const line of stitch.lines) {
          const p1 = mmToScreen(line.start, pan, zoom);
          const p2 = mmToScreen(line.end, pan, zoom);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      } else if (stitch.type === 'running') {
        for (const seg of stitch.segments) {
          const p1 = mmToScreen(seg.start, pan, zoom);
          const p2 = mmToScreen(seg.end, pan, zoom);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    });
  }, [stitches, pan, zoom, selectedStitchId]);

  const fullRedraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawGridAndRulers(ctx, canvas.width, canvas.height);
    drawBoundaries(ctx);
    drawRunningTemp(ctx);
    drawStitches(ctx);
  }, [drawGridAndRulers, drawBoundaries, drawRunningTemp, drawStitches]);

  useEffect(() => {
    fullRedraw();
    window.addEventListener('resize', fullRedraw);
    return () => window.removeEventListener('resize', fullRedraw);
  }, [fullRedraw]);

  // Re-draw on any relevant state change
  useEffect(() => {
    fullRedraw();
  }, [fullRedraw, satinBoundaryA, satinBoundaryB, runningTempPoints, stitches, pan, zoom]);

  // ------------------------------
  // Mouse & Interaction
  // ------------------------------
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning && canvasRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      fullRedraw();
    }
  };

  const handleMouseUp = () => setIsPanning(false);
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(5, Math.max(0.2, prev * delta)));
  };

  const addPointToCurrent = (mmPoint: Point) => {
    if (activeTool === 'satin' && satinEditMode) {
      if (satinEditMode === 'A') {
        setSatinBoundaryA(prev => [...prev, mmPoint]);
      } else {
        setSatinBoundaryB(prev => [...prev, mmPoint]);
      }
    } else if (activeTool === 'running') {
      setRunningTempPoints(prev => [...prev, mmPoint]);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const mmPoint = screenToMm(screenX, screenY, pan, zoom);
    addPointToCurrent(mmPoint);
  };

  // ------------------------------
  // Stitch Generation Actions
  // ------------------------------
  const generateSatinFromBoundaries = () => {
    if (satinBoundaryA.length < 2 || satinBoundaryB.length < 2) {
      alert('Both Input A and Input B need at least 2 points.');
      return;
    }
    const satinLines = generateSatinStitches(satinBoundaryA, satinBoundaryB, densityMm);
    if (satinLines.length === 0) return;
    const newStitch: StitchObject = {
      type: 'satin',
      lines: satinLines,
      id: Date.now() + Math.random().toString(36),
    };
    setStitches(prev => [...prev, newStitch]);
  };

  const generateRunningFromTemp = () => {
    if (runningTempPoints.length < 2) {
      alert('Draw a path with at least 2 points for running stitch.');
      return;
    }
    const segments = generateRunningStitch(runningTempPoints, densityMm);
    if (segments.length === 0) return;
    const newStitch: StitchObject = {
      type: 'running',
      segments,
      id: Date.now() + Math.random().toString(36),
    };
    setStitches(prev => [...prev, newStitch]);
    setRunningTempPoints([]); // clear temp path after generation
  };

  const deleteSelectedStitch = () => {
    if (!selectedStitchId) return;
    setStitches(prev => prev.filter(s => s.id !== selectedStitchId));
    setSelectedStitchId(null);
  };

  const clearAll = () => {
    setStitches([]);
    setSatinBoundaryA([]);
    setSatinBoundaryB([]);
    setRunningTempPoints([]);
    setSelectedStitchId(null);
  };

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      {/* Sidebar - Tools */}
      <div style={{ width: 240, backgroundColor: '#2c3e50', color: 'white', display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>
        <h3 style={{ margin: 0 }}>🧵 Embroidery Tools</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTool('satin')}
            style={{ background: activeTool === 'satin' ? '#e67e22' : '#34495e', border: 'none', color: 'white', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}
          >
            Satin (Input A/B)
          </button>
          <button
            onClick={() => setActiveTool('running')}
            style={{ background: activeTool === 'running' ? '#e67e22' : '#34495e', border: 'none', color: 'white', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}
          >
            Running Stitch
          </button>
        </div>

        {activeTool === 'satin' && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 'bold' }}>📐 Satin Boundaries</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSatinEditMode('A')} style={{ background: satinEditMode === 'A' ? '#f39c12' : '#1abc9c', border: 'none', padding: 6, borderRadius: 4, color: 'white', cursor: 'pointer' }}>✏️ Edit Input A</button>
              <button onClick={() => setSatinEditMode('B')} style={{ background: satinEditMode === 'B' ? '#f39c12' : '#1abc9c', border: 'none', padding: 6, borderRadius: 4, color: 'white', cursor: 'pointer' }}>✏️ Edit Input B</button>
            </div>
            <button onClick={() => { setSatinBoundaryA([]); setSatinBoundaryB([]); }} style={{ background: '#e74c3c', border: 'none', padding: 6, borderRadius: 4, color: 'white', cursor: 'pointer' }}>Clear Boundaries</button>
            <button onClick={generateSatinFromBoundaries} style={{ background: '#2ecc71', border: 'none', padding: 8, borderRadius: 6, fontWeight: 'bold', marginTop: 4 }}>✨ Generate Satin Stitch</button>
          </div>
        )}

        {activeTool === 'running' && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 'bold' }}>✏️ Running Path</div>
            <button onClick={() => setRunningTempPoints([])} style={{ background: '#e67e22', border: 'none', padding: 6, borderRadius: 4, color: 'white' }}>Clear Path Points</button>
            <button onClick={generateRunningFromTemp} style={{ background: '#2ecc71', border: 'none', padding: 8, borderRadius: 6, fontWeight: 'bold' }}>🧵 Generate Running Stitch</button>
          </div>
        )}

        <hr style={{ margin: '8px 0', borderColor: '#4a627a' }} />
        <button onClick={clearAll} style={{ background: '#c0392b', border: 'none', padding: 10, borderRadius: 6, color: 'white', fontWeight: 'bold' }}>🗑️ Clear All</button>
        <div style={{ fontSi
