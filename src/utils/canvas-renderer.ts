import { StitchPath, CanvasState, Point } from '../types/embroidery';

const GRID_SIZE_MM = 20;
const PX_PER_MM = 4; // 4 pixels per mm at 1x zoom
const GRID_SIZE_PX = GRID_SIZE_MM * PX_PER_MM;

/**
 * Draw the mm grid on the canvas
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: CanvasState
): void {
  const { zoom, panX, panY } = state;

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // Canvas background
  const canvasW = width / zoom;
  const canvasH = height / zoom;
  ctx.fillStyle = '#FAFAFA';
  ctx.fillRect(-panX / zoom, -panY / zoom, canvasW, canvasH);

  // Design area background (white)
  const designW = 200 * PX_PER_MM; // 200mm
  const designH = 150 * PX_PER_MM; // 150mm
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 20 / zoom;
  ctx.fillRect(0, 0, designW, designH);
  ctx.shadowBlur = 0;

  // Minor grid (5mm)
  ctx.strokeStyle = '#F0F0F0';
  ctx.lineWidth = 0.5 / zoom;
  const minorStep = 5 * PX_PER_MM;
  for (let x = 0; x <= designW; x += minorStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, designH);
    ctx.stroke();
  }
  for (let y = 0; y <= designH; y += minorStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(designW, y);
    ctx.stroke();
  }

  // Major grid (20mm)
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1 / zoom;
  for (let x = 0; x <= designW; x += GRID_SIZE_PX) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, designH);
    ctx.stroke();
  }
  for (let y = 0; y <= designH; y += GRID_SIZE_PX) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(designW, y);
    ctx.stroke();
  }

  // Grid labels (every 20mm)
  ctx.fillStyle = '#999';
  ctx.font = `${10 / zoom}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  for (let x = 0; x <= designW; x += GRID_SIZE_PX) {
    const mm = x / PX_PER_MM;
    ctx.fillText(`${mm}`, x, -4 / zoom);
  }
  ctx.textAlign = 'right';
  for (let y = GRID_SIZE_PX; y <= designH; y += GRID_SIZE_PX) {
    const mm = y / PX_PER_MM;
    ctx.fillText(`${mm}`, -4 / zoom, y + 3 / zoom);
  }

  // Design boundary
  ctx.strokeStyle = '#CCC';
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeRect(0, 0, designW, designH);

  ctx.restore();
}

/**
 * Draw a single stitch path
 */
function drawStitchPath(
  ctx: CanvasRenderingContext2D,
  path: StitchPath,
  zoom: number
): void {
  const points = path.points;
  if (points.length < 2) return;

  ctx.strokeStyle = path.color;
  ctx.lineWidth = Math.max(1.5, 2 / zoom);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (path.stitchType) {
    case 'run':
      drawRunStitch(ctx, points, path.density, zoom);
      break;
    case 'satin':
      drawSatinStitch(ctx, points, path.width, path.density, zoom);
      break;
    case 'tatami':
      drawTatamiStitch(ctx, points, path.width, path.density, zoom);
      break;
    case 'zigzag':
      drawZigzagStitch(ctx, points, path.width, path.density, zoom);
      break;
    default:
      drawRunStitch(ctx, points, path.density, zoom);
  }
}

/**
 * Run stitch: dashed line with 2.5mm segments
 */
function drawRunStitch(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  density: number,
  zoom: number
): void {
  const segmentPx = 2.5 * PX_PER_MM / density;
  ctx.setLineDash([segmentPx, segmentPx * 0.4]);
  ctx.lineWidth = Math.max(1.5, 2 / zoom);
  ctx.beginPath();
  ctx.moveTo(points[0].x * PX_PER_MM, points[0].y * PX_PER_MM);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * PX_PER_MM, points[i].y * PX_PER_MM);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw stitch points
  for (const p of points) {
    ctx.fillStyle = ctx.strokeStyle as string;
    ctx.beginPath();
    ctx.arc(p.x * PX_PER_MM, p.y * PX_PER_MM, 1.5 / zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Satin stitch: zigzag between two offset paths
 */
function drawSatinStitch(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  density: number,
  zoom: number
): void {
  if (points.length < 2) return;

  const satinWidth = (width || 3) * PX_PER_MM;
  const spacing = (0.4 / density) * PX_PER_MM;

  ctx.lineWidth = Math.max(1, 1.2 / zoom);

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = { x: points[i].x * PX_PER_MM, y: points[i].y * PX_PER_MM };
    const p2 = { x: points[i + 1].x * PX_PER_MM, y: points[i + 1].y * PX_PER_MM };

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) continue;

    const nx = -dy / dist;
    const ny = dx / dist;
    const steps = Math.max(1, Math.floor(dist / spacing));

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const cx = p1.x + dx * t;
      const cy = p1.y + dy * t;

      ctx.beginPath();
      ctx.moveTo(cx + nx * satinWidth / 2, cy + ny * satinWidth / 2);
      ctx.lineTo(cx - nx * satinWidth / 2, cy - ny * satinWidth / 2);
      ctx.stroke();
    }
  }

  // Draw center path guide
  ctx.globalAlpha = 0.3;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(points[0].x * PX_PER_MM, points[0].y * PX_PER_MM);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * PX_PER_MM, points[i].y * PX_PER_MM);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/**
 * Tatami stitch: fill pattern with offset rows
 */
function drawTatamiStitch(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  density: number,
  zoom: number
): void {
  if (points.length < 2) return;

  const tatamiWidth = (width || 4) * PX_PER_MM;
  const rowSpacing = (0.5 / density) * PX_PER_MM;
  const stitchLen = 2 * PX_PER_MM;

  ctx.lineWidth = Math.max(1, 1 / zoom);

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = { x: points[i].x * PX_PER_MM, y: points[i].y * PX_PER_MM };
    const p2 = { x: points[i + 1].x * PX_PER_MM, y: points[i + 1].y * PX_PER_MM };

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) continue;

    const nx = -dy / dist;
    const ny = dx / dist;
    const rows = Math.max(1, Math.floor(tatamiWidth / rowSpacing));

    for (let r = 0; r < rows; r++) {
      const offset = (r / rows - 0.5) * tatamiWidth;
      const rowOffset = (r % 2) * stitchLen * 0.5;
      const rx = nx * offset;
      const ry = ny * offset;

      const numStitches = Math.floor(dist / stitchLen);
      for (let s = 0; s < numStitches; s++) {
        const t1 = (s * stitchLen + rowOffset) / dist;
        const t2 = Math.min(((s + 1) * stitchLen + rowOffset) / dist, 1);
        if (t1 >= 1) break;

        ctx.beginPath();
        ctx.moveTo(p1.x + dx * t1 + rx, p1.y + dy * t1 + ry);
        ctx.lineTo(p1.x + dx * t2 + rx, p1.y + dy * t2 + ry);
        ctx.stroke();
      }
    }
  }
}

/**
 * ZigZag stitch
 */
function drawZigzagStitch(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  density: number,
  zoom: number
): void {
  if (points.length < 2) return;

  const zzWidth = (width || 3) * PX_PER_MM;
  const spacing = (1.0 / density) * PX_PER_MM;

  ctx.lineWidth = Math.max(1.5, 1.8 / zoom);

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = { x: points[i].x * PX_PER_MM, y: points[i].y * PX_PER_MM };
    const p2 = { x: points[i + 1].x * PX_PER_MM, y: points[i + 1].y * PX_PER_MM };

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) continue;

    const nx = -dy / dist;
    const ny = dx / dist;
    const steps = Math.max(1, Math.floor(dist / spacing));

    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = p1.x + dx * t;
      const cy = p1.y + dy * t;
      const side = s % 2 === 0 ? 1 : -1;

      const px = cx + nx * zzWidth / 2 * side;
      const py = cy + ny * zzWidth / 2 * side;

      if (s === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }
}

/**
 * Draw all paths on the canvas
 */
export function drawPaths(
  ctx: CanvasRenderingContext2D,
  paths: StitchPath[],
  state: CanvasState
): void {
  const { zoom, panX, panY } = state;

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  for (const path of paths) {
    drawStitchPath(ctx, path, zoom);
  }

  ctx.restore();
}

/**
 * Draw active drawing path (in-progress)
 */
export function drawActivePath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  state: CanvasState
): void {
  if (points.length < 1) return;

  const { zoom, panX, panY } = state;

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // Draw the line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([5 / zoom, 3 / zoom]);
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x * PX_PER_MM, points[0].y * PX_PER_MM);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * PX_PER_MM, points[i].y * PX_PER_MM);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw point markers
  for (const p of points) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x * PX_PER_MM, p.y * PX_PER_MM, 3 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Convert screen coordinates to design coordinates (in mm)
 */
export function screenToDesign(
  screenX: number,
  screenY: number,
  state: CanvasState
): Point {
  return {
    x: (screenX - state.panX) / (state.zoom * PX_PER_MM),
    y: (screenY - state.panY) / (state.zoom * PX_PER_MM),
  };
}

/**
 * Get the design area dimensions in pixels (for boundary checking)
 */
export function getDesignAreaPx(): { width: number; height: number } {
  return {
    width: 200 * PX_PER_MM,
    height: 150 * PX_PER_MM,
  };
}
