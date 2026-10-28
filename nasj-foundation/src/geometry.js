/**
 * Small, UI-independent geometry contracts for NASJ.
 * Coordinates and dimensions are expressed in millimetres.
 */

export const MAX_DESIGN_DIMENSION_MM = 5000;
export const MAX_POLYLINE_POINTS = 10_000;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertDimension(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_DESIGN_DIMENSION_MM) {
    throw new RangeError(`${name} must be a finite number greater than 0 and no more than ${MAX_DESIGN_DIMENSION_MM} mm.`);
  }
}

/** Validate design bounds and return a fresh normalized object. */
export function validateDesignBounds(bounds) {
  if (!isPlainObject(bounds)) throw new TypeError("Design bounds must be an object.");
  const keys = Reflect.ownKeys(bounds);
  if (keys.length !== 2 || !keys.includes("widthMm") || !keys.includes("heightMm")) {
    throw new TypeError("Design bounds must contain only widthMm and heightMm.");
  }
  assertDimension(bounds.widthMm, "widthMm");
  assertDimension(bounds.heightMm, "heightMm");
  return { widthMm: bounds.widthMm, heightMm: bounds.heightMm };
}

/** Euclidean distance between two finite millimetre coordinates. */
export function distanceMm(a, b) {
  assertPointShape(a, "start point");
  assertPointShape(b, "end point");
  const distance = Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
  if (!Number.isFinite(distance)) throw new RangeError("Distance is outside the finite numeric range.");
  return distance;
}

function assertPointShape(point, label) {
  if (!isPlainObject(point)) throw new TypeError(`${label} must be an object.`);
  const keys = Reflect.ownKeys(point);
  if (keys.length !== 2 || !keys.includes("xMm") || !keys.includes("yMm")) {
    throw new TypeError(`${label} must contain only xMm and yMm.`);
  }
  if (typeof point.xMm !== "number" || !Number.isFinite(point.xMm)
      || typeof point.yMm !== "number" || !Number.isFinite(point.yMm)) {
    throw new TypeError(`${label} coordinates must be finite numbers in millimetres.`);
  }
}

/**
 * Validate and copy a polyline whose points must lie within the design rectangle.
 * Consecutive duplicate points are rejected instead of silently producing zero-length moves.
 */
export function validatePolyline(points, bounds) {
  const normalizedBounds = validateDesignBounds(bounds);
  if (!Array.isArray(points)) throw new TypeError("Polyline points must be an array.");
  if (points.length < 2) throw new RangeError("A polyline must contain at least two points.");
  if (points.length > MAX_POLYLINE_POINTS) {
    throw new RangeError(`A polyline cannot contain more than ${MAX_POLYLINE_POINTS} points.`);
  }

  const normalizedPoints = points.map((point, index) => {
    assertPointShape(point, `Point ${index}`);
    if (point.xMm < 0 || point.xMm > normalizedBounds.widthMm
        || point.yMm < 0 || point.yMm > normalizedBounds.heightMm) {
      throw new RangeError(`Point ${index} lies outside the design bounds.`);
    }
    return { xMm: point.xMm, yMm: point.yMm };
  });

  for (let index = 1; index < normalizedPoints.length; index += 1) {
    if (normalizedPoints[index - 1].xMm === normalizedPoints[index].xMm
        && normalizedPoints[index - 1].yMm === normalizedPoints[index].yMm) {
      throw new RangeError(`Points ${index - 1} and ${index} are identical; zero-length segments are not allowed.`);
    }
  }

  return normalizedPoints;
}
