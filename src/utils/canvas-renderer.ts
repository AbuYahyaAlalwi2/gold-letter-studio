import { StitchPath, CanvasState, Point } from '../types/embroidery';
import { convertPathToStitches, stitchPointsToSegments } from './stitch-converter';

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
 * Draw a single stitch path using the stitch-converter for point generation.
 * All stitch types are rendered as connected stitch segments with needle-
 * penetration markers, giving a true embroidery preview.
 */
function drawStitchPath(
  ctx: CanvasRenderingContext2D,
  path: StitchPath,
  zoom: number
): void {
  if (path.points.length < 2) return;

  // Convert the user's vector path into discrete stitch points
  const stitchPts = convertPathToStitches(path);
  if (stitchPts.length < 2) return;

  const segments = stitchPointsToSegments(stitchPts);

  ctx.strokeStyle = path.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw stitch segments
  ctx.lineWidth = Math.max(1.2, 1.5 / zoom);
  for (const seg of segments) {
    ctx.beginPath();
    ctx.moveTo(seg.from.x * PX_PER_MM, seg.from.y * PX_PER_MM);
    ctx.lineTo(seg.to.x * PX_PER_MM, seg.to.y * PX_PER_MM);
    ctx.stroke();
  }

  // Draw needle penetration points
  ctx.fillStyle = path.color;
  const dotRadius = Math.max(0.8, 1.2 / zoom);
  for (const p of stitchPts) {
    ctx.beginPath();
    ctx.arc(p.x * PX_PER_MM, p.y * PX_PER_MM, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // For satin/tatami/zigzag, also draw a faint guide of the original user path
  if (path.stitchType !== 'run') {
    ctx.globalAlpha = 0.2;
    ctx.setLineDash([3 / zoom, 3 / zoom]);
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(path.points[0].x * PX_PER_MM, path.points[0].y * PX_PER_MM);
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x * PX_PER_MM, path.points[i].y * PX_PER_MM);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
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
