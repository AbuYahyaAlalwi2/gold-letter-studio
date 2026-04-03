import { DSTCommand, StitchPath, Point, DesignData } from '../types/embroidery';

/**
 * Convert mm coordinates to DST units (1 DST unit = 0.1mm)
 */
function mmToDst(mm: number): number {
  return Math.round(mm * 10);
}

/**
 * Generate stitch coordinates along a path based on stitch type
 */
function generateStitchPoints(path: StitchPath): Point[] {
  const points = path.points;
  if (points.length < 2) return points;

  const stitchPoints: Point[] = [];
  const segmentLength = 2.5 / path.density; // Base 2.5mm segments, modified by density

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(dist / segmentLength));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      stitchPoints.push({
        x: start.x + dx * t,
        y: start.y + dy * t,
      });
    }
  }

  return stitchPoints;
}

/**
 * Generate satin stitch coordinates (zigzag between two offset paths)
 */
function generateSatinStitches(path: StitchPath): Point[] {
  const points = path.points;
  if (points.length < 2) return points;

  const stitchPoints: Point[] = [];
  const width = path.width || 3; // Default 3mm satin width
  const spacing = 0.4 / path.density;

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(dist / spacing));

    // Normal vector perpendicular to the path
    const nx = -dy / dist;
    const ny = dx / dist;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = start.x + dx * t;
      const cy = start.y + dy * t;

      if (s % 2 === 0) {
        stitchPoints.push({ x: cx + nx * width / 2, y: cy + ny * width / 2 });
      } else {
        stitchPoints.push({ x: cx - nx * width / 2, y: cy - ny * width / 2 });
      }
    }
  }

  return stitchPoints;
}

/**
 * Convert paths to DST command array
 */
export function pathsToDSTCommands(paths: StitchPath[]): DSTCommand[] {
  const commands: DSTCommand[] = [];

  for (const path of paths) {
    let stitchPoints: Point[];

    switch (path.stitchType) {
      case 'satin':
        stitchPoints = generateSatinStitches(path);
        break;
      case 'run':
      case 'tatami':
      case 'zigzag':
      default:
        stitchPoints = generateStitchPoints(path);
        break;
    }

    if (stitchPoints.length === 0) continue;

    // Move to the first point
    commands.push({
      type: 'move',
      x: mmToDst(stitchPoints[0].x),
      y: mmToDst(stitchPoints[0].y),
    });

    // Stitch through remaining points
    for (let i = 1; i < stitchPoints.length; i++) {
      commands.push({
        type: 'stitch',
        x: mmToDst(stitchPoints[i].x),
        y: mmToDst(stitchPoints[i].y),
      });
    }

    // Trim after each path
    commands.push({
      type: 'trim',
      x: mmToDst(stitchPoints[stitchPoints.length - 1].x),
      y: mmToDst(stitchPoints[stitchPoints.length - 1].y),
    });

    // Color stop
    commands.push({
      type: 'stop',
      x: mmToDst(stitchPoints[stitchPoints.length - 1].x),
      y: mmToDst(stitchPoints[stitchPoints.length - 1].y),
    });
  }

  // End of design
  commands.push({ type: 'end', x: 0, y: 0 });

  return commands;
}

/**
 * Calculate total stitch count across all paths
 */
export function calculateStitchCount(paths: StitchPath[]): number {
  let count = 0;
  for (const path of paths) {
    let stitchPoints: Point[];
    switch (path.stitchType) {
      case 'satin':
        stitchPoints = generateSatinStitches(path);
        break;
      default:
        stitchPoints = generateStitchPoints(path);
        break;
    }
    count += stitchPoints.length;
  }
  return count;
}

/**
 * Export design data as a JSON structure ready for .dst conversion
 */
export function exportDesignData(paths: StitchPath[], canvasWidth: number, canvasHeight: number): DesignData {
  const commands = pathsToDSTCommands(paths);
  const stitchCount = calculateStitchCount(paths);
  const colorChanges = paths.length > 0 ? paths.length - 1 : 0;

  return {
    paths,
    width: canvasWidth,
    height: canvasHeight,
    stitchCount,
    colorChanges,
    commands,
  };
}

/**
 * Download design data as JSON file
 */
export function downloadDesignJSON(design: DesignData, filename: string = 'design.json'): void {
  const json = JSON.stringify(design, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
