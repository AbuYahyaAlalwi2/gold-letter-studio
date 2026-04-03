/**
 * Stitch Converter — Conversion layer between Canvas vector paths and embroidery stitches.
 *
 * Converts user-drawn polylines/polygons into discrete stitch points that
 * represent real needle penetrations, ready for DST export or canvas rendering.
 *
 * Algorithms:
 *   - Run Stitch:   Divide any path into points every 2.5 mm.
 *   - Satin Stitch: Zig-Zag oscillating between two parallel offset paths
 *                   with a step density of 0.4 mm.
 *   - Tatami Fill:  Scanline step-stitch pattern filling closed polygons,
 *                   each row offset 90° (half-stitch shift) from the previous.
 *   - ZigZag:       Simple alternating zigzag along the path centerline.
 */

import { Point, StitchPath, StitchType } from '../types/embroidery';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default run-stitch segment length in mm */
const RUN_SEGMENT_MM = 2.5;

/** Default satin density (step spacing along path) in mm */
const SATIN_DENSITY_MM = 0.4;

/** Default tatami row spacing in mm */
const TATAMI_ROW_SPACING_MM = 0.4;

/** Default tatami stitch length within a row in mm */
const TATAMI_STITCH_LENGTH_MM = 2.0;

// ─── Geometry helpers ────────────────────────────────────────────────────────

/** Euclidean distance between two points */
function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Linear interpolation between two points at parameter t ∈ [0,1] */
function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Unit normal (perpendicular) to the segment a→b, rotated 90° CCW */
function normal(a: Point, b: Point): Point {
  const d = dist(a, b);
  if (d === 0) return { x: 0, y: -1 };
  return { x: -(b.y - a.y) / d, y: (b.x - a.x) / d };
}

/** Total polyline arc-length */
function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += dist(pts[i - 1], pts[i]);
  }
  return len;
}

/**
 * Walk along a polyline and sample a point at a given arc-length distance
 * from the start. Returns the point and the segment index it falls on.
 */
function sampleAtDistance(
  pts: Point[],
  targetDist: number
): { point: Point; segIndex: number } {
  let accumulated = 0;
  for (let i = 1; i < pts.length; i++) {
    const segLen = dist(pts[i - 1], pts[i]);
    if (accumulated + segLen >= targetDist - 1e-9) {
      const remainder = targetDist - accumulated;
      const t = segLen > 0 ? remainder / segLen : 0;
      return { point: lerp(pts[i - 1], pts[i], Math.min(t, 1)), segIndex: i - 1 };
    }
    accumulated += segLen;
  }
  // Past the end — clamp to last point
  return { point: { ...pts[pts.length - 1] }, segIndex: pts.length - 2 };
}

// ─── Run Stitch ──────────────────────────────────────────────────────────────

/**
 * Divide any polyline path into stitch points every `segmentMm` millimetres.
 *
 * The first and last user-placed points are always included. Intermediate
 * points are evenly spaced along the arc-length of the polyline.
 */
export function convertRunStitch(
  path: StitchPath,
  segmentMm: number = RUN_SEGMENT_MM
): Point[] {
  const pts = path.points;
  if (pts.length < 2) return [...pts];

  const effectiveSegment = segmentMm / path.density;
  const totalLen = polylineLength(pts);
  if (totalLen === 0) return [{ ...pts[0] }];

  const stitchPoints: Point[] = [{ ...pts[0] }];
  const steps = Math.max(1, Math.round(totalLen / effectiveSegment));

  for (let i = 1; i <= steps; i++) {
    const d = (i / steps) * totalLen;
    const { point } = sampleAtDistance(pts, d);
    stitchPoints.push(point);
  }

  return stitchPoints;
}

// ─── Satin Stitch ────────────────────────────────────────────────────────────

/**
 * Zig-Zag algorithm: oscillate the needle between two parallel paths that
 * run on either side of the user's centre-line, offset by ±(width / 2).
 *
 * Steps advance along the centre-line at `densityMm` intervals (default 0.4 mm).
 * Even steps stitch to the LEFT offset path, odd steps to the RIGHT.
 */
export function convertSatinStitch(
  path: StitchPath,
  densityMm: number = SATIN_DENSITY_MM
): Point[] {
  const pts = path.points;
  if (pts.length < 2) return [...pts];

  const halfWidth = (path.width || 3) / 2; // mm, half of satin column width
  const effectiveDensity = densityMm / path.density;
  const totalLen = polylineLength(pts);
  if (totalLen === 0) return [{ ...pts[0] }];

  const steps = Math.max(1, Math.round(totalLen / effectiveDensity));
  const stitchPoints: Point[] = [];

  for (let i = 0; i <= steps; i++) {
    const d = (i / steps) * totalLen;
    const { point: centre, segIndex } = sampleAtDistance(pts, d);

    // Compute the local perpendicular normal at this segment
    const n = normal(pts[segIndex], pts[Math.min(segIndex + 1, pts.length - 1)]);

    // Alternate sides: even → left, odd → right
    const side = i % 2 === 0 ? 1 : -1;
    stitchPoints.push({
      x: centre.x + n.x * halfWidth * side,
      y: centre.y + n.y * halfWidth * side,
    });
  }

  return stitchPoints;
}

// ─── Tatami Fill ─────────────────────────────────────────────────────────────

/**
 * Fill a closed polygon with horizontal scanline rows of run stitches.
 * Each subsequent row is offset by 90° (half a stitch length) to produce
 * the characteristic brick / step-stitch pattern of tatami embroidery.
 *
 * If the input path is not explicitly closed (first ≠ last point), it is
 * treated as closed automatically.
 */
export function convertTatamiStitch(
  path: StitchPath,
  rowSpacingMm: number = TATAMI_ROW_SPACING_MM,
  stitchLengthMm: number = TATAMI_STITCH_LENGTH_MM
): Point[] {
  const pts = path.points;
  if (pts.length < 3) {
    // Not enough points for a polygon — fall back to run stitch
    return convertRunStitch(path);
  }

  // Close the polygon if not already closed
  const polygon = [...pts];
  if (dist(polygon[0], polygon[polygon.length - 1]) > 0.01) {
    polygon.push({ ...polygon[0] });
  }

  const effectiveRowSpacing = rowSpacingMm / path.density;
  const effectiveStitchLen = stitchLengthMm;

  // Bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const stitchPoints: Point[] = [];
  let rowIndex = 0;

  for (let y = minY + effectiveRowSpacing; y < maxY; y += effectiveRowSpacing) {
    // Find all x-intersections of the scanline y with polygon edges
    const intersections: number[] = [];
    for (let i = 0; i < polygon.length - 1; i++) {
      const a = polygon[i];
      const b = polygon[i + 1];

      // Check if this edge crosses the scanline
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        intersections.push(a.x + t * (b.x - a.x));
      }
    }

    // Sort intersections left to right
    intersections.sort((a, b) => a - b);

    // Process intersection pairs (inside spans)
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const xStart = intersections[i];
      const xEnd = intersections[i + 1];
      const spanWidth = xEnd - xStart;
      if (spanWidth < 0.01) continue;

      // 90-degree row offset: shift even rows by half a stitch length
      const rowOffset = (rowIndex % 2) * (effectiveStitchLen / 2);

      // Generate stitch points along this span
      const numStitches = Math.max(1, Math.ceil(spanWidth / effectiveStitchLen));
      const actualStitchLen = spanWidth / numStitches;

      // Alternate direction for each row to minimize jump stitches
      const leftToRight = rowIndex % 2 === 0;

      for (let s = 0; s <= numStitches; s++) {
        let x: number;
        if (leftToRight) {
          x = xStart + s * actualStitchLen + rowOffset;
        } else {
          x = xEnd - s * actualStitchLen + rowOffset;
        }
        // Clamp to span boundaries
        x = Math.max(xStart, Math.min(xEnd, x));
        stitchPoints.push({ x, y });
      }
    }
    rowIndex++;
  }

  // If no fill was generated (degenerate polygon), fall back to run stitch
  if (stitchPoints.length === 0) {
    return convertRunStitch(path);
  }

  return stitchPoints;
}

// ─── ZigZag Stitch ───────────────────────────────────────────────────────────

/**
 * Simple zigzag along the path centre-line, alternating between left and
 * right offsets at regular intervals.
 */
export function convertZigzagStitch(path: StitchPath): Point[] {
  const pts = path.points;
  if (pts.length < 2) return [...pts];

  const halfWidth = (path.width || 3) / 2;
  const spacing = 1.0 / path.density; // mm between zigzag points
  const totalLen = polylineLength(pts);
  if (totalLen === 0) return [{ ...pts[0] }];

  const steps = Math.max(1, Math.round(totalLen / spacing));
  const stitchPoints: Point[] = [];

  for (let i = 0; i <= steps; i++) {
    const d = (i / steps) * totalLen;
    const { point: centre, segIndex } = sampleAtDistance(pts, d);
    const n = normal(pts[segIndex], pts[Math.min(segIndex + 1, pts.length - 1)]);
    const side = i % 2 === 0 ? 1 : -1;
    stitchPoints.push({
      x: centre.x + n.x * halfWidth * side,
      y: centre.y + n.y * halfWidth * side,
    });
  }

  return stitchPoints;
}

// ─── Unified dispatcher ─────────────────────────────────────────────────────

/**
 * Convert a StitchPath to an array of stitch Points using the appropriate
 * algorithm based on `path.stitchType`.
 *
 * This is the single entry-point that both the canvas renderer and the DST
 * exporter should call.
 */
export function convertPathToStitches(path: StitchPath): Point[] {
  switch (path.stitchType) {
    case 'run':
      return convertRunStitch(path);
    case 'satin':
      return convertSatinStitch(path);
    case 'tatami':
      return convertTatamiStitch(path);
    case 'zigzag':
      return convertZigzagStitch(path);
    default:
      return convertRunStitch(path);
  }
}

/**
 * Calculate total stitch count for an array of paths.
 */
export function calculateTotalStitches(paths: StitchPath[]): number {
  let count = 0;
  for (const path of paths) {
    count += convertPathToStitches(path).length;
  }
  return count;
}

// ─── Utility: stitch points → visual rendering data ─────────────────────────

export interface StitchSegment {
  from: Point;
  to: Point;
}

/**
 * Convert stitch points into line segments for canvas rendering.
 * Each consecutive pair of points becomes a segment.
 */
export function stitchPointsToSegments(points: Point[]): StitchSegment[] {
  const segments: StitchSegment[] = [];
  for (let i = 1; i < points.length; i++) {
    segments.push({ from: points[i - 1], to: points[i] });
  }
  return segments;
}

// Re-export the StitchType for convenience
export type { StitchType };
