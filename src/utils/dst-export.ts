import { DSTCommand, StitchPath, DesignData, Point } from '../types/embroidery';
import { convertPathToStitches, calculateTotalStitches } from './stitch-converter';

/**
 * Convert mm coordinates to DST units (1 DST unit = 0.1mm)
 */
function mmToDst(mm: number): number {
  return Math.round(mm * 10);
}

/** Euclidean distance between two points in mm */
function distMm(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Minimum distance (mm) between objects to trigger a Trim command */
const TRIM_DISTANCE_MM = 5.0;

/**
 * Convert paths to DST command array.
 *
 * Color Change (Stop) commands are only inserted when consecutive objects
 * have different colorIndex values (i.e. an actual thread swap is needed).
 *
 * Trim commands are inserted between objects whose endpoints are more than
 * 5 mm apart (the machine needs to cut the thread and reposition).
 * Objects closer than 5 mm get a simple Jump (move) without trimming.
 */
export function pathsToDSTCommands(paths: StitchPath[]): DSTCommand[] {
  const commands: DSTCommand[] = [];

  // Pre-compute stitch points for all paths
  const allStitchPoints = paths.map((p) => convertPathToStitches(p));

  for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
    const path = paths[pathIdx];
    const stitchPoints = allStitchPoints[pathIdx];
    if (stitchPoints.length === 0) continue;

    // If this is not the first object, decide whether to insert Trim and/or Color Change
    if (pathIdx > 0) {
      const prevPoints = allStitchPoints[pathIdx - 1];
      const prevPath = paths[pathIdx - 1];

      if (prevPoints.length > 0) {
        const prevLast = prevPoints[prevPoints.length - 1];
        const currFirst = stitchPoints[0];
        const gap = distMm(prevLast, currFirst);

        // Trim if the gap between objects exceeds 5 mm
        if (gap > TRIM_DISTANCE_MM) {
          commands.push({
            type: 'trim',
            x: mmToDst(prevLast.x),
            y: mmToDst(prevLast.y),
          });
        }

        // Color Change (Stop) only when the thread color actually changes
        if (prevPath.colorIndex !== path.colorIndex) {
          commands.push({
            type: 'color_change',
            x: mmToDst(prevLast.x),
            y: mmToDst(prevLast.y),
          });
        }
      }
    }

    // Move (Jump) to the first point of this object
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
  }

  // End of design
  commands.push({ type: 'end', x: 0, y: 0 });

  return commands;
}

/**
 * Calculate total stitch count across all paths.
 * Delegates to the stitch-converter.
 */
export function calculateStitchCount(paths: StitchPath[]): number {
  return calculateTotalStitches(paths);
}

/**
 * Export design data as a JSON structure ready for .dst conversion
 */
export function exportDesignData(paths: StitchPath[], canvasWidth: number, canvasHeight: number): DesignData {
  const commands = pathsToDSTCommands(paths);
  const stitchCount = calculateStitchCount(paths);

  // Count actual color changes (only when colorIndex differs between consecutive paths)
  let colorChanges = 0;
  for (let i = 1; i < paths.length; i++) {
    if (paths[i].colorIndex !== paths[i - 1].colorIndex) {
      colorChanges++;
    }
  }

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

// ── DST binary export via pyembroidery backend ──────────────────────────────

/** Backend URL — configurable via env var at build time */
const DST_BACKEND_URL = import.meta.env.VITE_DST_BACKEND_URL || 'http://localhost:8000';

interface DSTObjectPayload {
  color: string;
  colorIndex: number;
  points: { x: number; y: number }[];
}

/**
 * Build the payload that the backend expects: an array of stitch objects,
 * each with a colour, colorIndex, and the pre-computed stitch coordinates in mm.
 */
function buildDSTPayload(paths: StitchPath[]): DSTObjectPayload[] {
  return paths
    .map((path) => {
      const stitchPts = convertPathToStitches(path);
      return {
        color: path.color,
        colorIndex: path.colorIndex,
        points: stitchPts.map((p) => ({ x: p.x, y: p.y })),
      };
    })
    .filter((obj) => obj.points.length > 0);
}

/**
 * Request a .DST binary file from the pyembroidery backend and trigger
 * a browser download.
 *
 * The backend:
 *   1. Scales coordinates to 0.1 mm DST units.
 *   2. Adds JUMP commands between separate objects.
 *   3. Adds TRIM commands between objects >5 mm apart.
 *   4. Adds COLOR_CHANGE (Stop) only when the colorIndex changes.
 *   5. Returns the binary .DST file.
 */
export async function downloadDSTFile(
  paths: StitchPath[],
  filename: string = 'gold-letter-design.dst'
): Promise<void> {
  const objects = buildDSTPayload(paths);

  if (objects.length === 0) {
    throw new Error('No stitch data to export — draw some paths first.');
  }

  const response = await fetch(`${DST_BACKEND_URL}/api/generate-dst`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objects, filename }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DST generation failed: ${response.status} ${text}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
