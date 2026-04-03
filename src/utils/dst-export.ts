import { DSTCommand, StitchPath, DesignData } from '../types/embroidery';
import { convertPathToStitches, calculateTotalStitches } from './stitch-converter';

/**
 * Convert mm coordinates to DST units (1 DST unit = 0.1mm)
 */
function mmToDst(mm: number): number {
  return Math.round(mm * 10);
}

/**
 * Convert paths to DST command array.
 * Uses the stitch-converter as the single source of truth for stitch generation.
 */
export function pathsToDSTCommands(paths: StitchPath[]): DSTCommand[] {
  const commands: DSTCommand[] = [];

  for (const path of paths) {
    const stitchPoints = convertPathToStitches(path);
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
