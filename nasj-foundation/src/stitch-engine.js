/**
 * Initial deterministic running-stitch generator.
 * This is a geometry primitive, not a machine-format exporter or a full digitizer.
 */
import { distanceMm, validatePolyline } from "./geometry.js";

export const DEFAULT_MAX_STITCH_LENGTH_MM = 4;
export const MAX_GENERATED_STITCHES = 100_000;

/**
 * Convert a validated polyline into needle positions with no move longer than
 * maxStitchLengthMm. The returned `stitches` includes the starting position;
 * `stitchCount` counts moves between positions, not the initial needle placement.
 */
export function generateRunningStitches(points, {
  widthMm,
  heightMm,
  maxStitchLengthMm = DEFAULT_MAX_STITCH_LENGTH_MM,
  maxStitches = MAX_GENERATED_STITCHES,
} = {}) {
  if (typeof maxStitchLengthMm !== "number" || !Number.isFinite(maxStitchLengthMm) || maxStitchLengthMm <= 0) {
    throw new RangeError("maxStitchLengthMm must be a finite number greater than 0.");
  }
  if (!Number.isSafeInteger(maxStitches) || maxStitches < 1 || maxStitches > MAX_GENERATED_STITCHES) {
    throw new RangeError(`maxStitches must be an integer between 1 and ${MAX_GENERATED_STITCHES}.`);
  }

  const polyline = validatePolyline(points, { widthMm, heightMm });
  const segmentLengths = [];
  let totalLengthMm = 0;
  let requiredStitches = 0;

  for (let index = 1; index < polyline.length; index += 1) {
    const length = distanceMm(polyline[index - 1], polyline[index]);
    const steps = Math.ceil(length / maxStitchLengthMm);
    segmentLengths.push({ length, steps });
    totalLengthMm += length;
    requiredStitches += steps;
    if (requiredStitches > maxStitches) {
      throw new RangeError(`Generated path would exceed the ${maxStitches}-stitch safety limit.`);
    }
  }

  const stitches = [{ ...polyline[0] }];
  for (let index = 1; index < polyline.length; index += 1) {
    const start = polyline[index - 1];
    const end = polyline[index];
    const { steps } = segmentLengths[index - 1];

    for (let step = 1; step <= steps; step += 1) {
      if (step === steps) {
        // Preserve each authored vertex exactly rather than accumulating interpolation drift.
        stitches.push({ ...end });
      } else {
        const ratio = step / steps;
        stitches.push({
          xMm: start.xMm + (end.xMm - start.xMm) * ratio,
          yMm: start.yMm + (end.yMm - start.yMm) * ratio,
        });
      }
    }
  }

  return {
    stitches,
    stitchCount: stitches.length - 1,
    totalLengthMm,
    maxStitchLengthMm,
  };
}
