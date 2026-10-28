/**
 * Strict JSON interchange contract for generated NASJ stitch plans.
 * This is an application-level interchange format, not DST/PES or a machine file.
 */
import { distanceMm, validateDesignBounds } from "./geometry.js";

export const STITCH_PLAN_FORMAT = "nasj-stitch-plan";
export const STITCH_PLAN_FORMAT_VERSION = 1;
export const MAX_STITCH_PLAN_MOVES = 100_000;
export const DEFAULT_MAX_STITCH_PLAN_BYTES = 8 * 1024 * 1024;
const NUMERIC_TOLERANCE = 1e-8;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addError(errors, path, code, message) {
  errors.push({ path, code, message });
}

function checkExactKeys(value, expectedKeys, path, errors) {
  if (!isPlainObject(value)) {
    addError(errors, path, "INVALID_TYPE", "Expected an object.");
    return false;
  }
  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) addError(errors, `${path}${path ? "." : ""}${key}`, "MISSING_FIELD", "Required field is missing.");
  }
  const allowed = new Set(expectedKeys);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) {
      addError(errors, `${path}${path ? "." : ""}${String(key)}`, "UNKNOWN_FIELD", "Unknown fields are not allowed.");
    }
  }
  return true;
}

function finitePositive(value, path, errors) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    addError(errors, path, "INVALID_VALUE", "Expected a finite number greater than zero.");
    return false;
  }
  return true;
}

function validatePlan(input) {
  const errors = [];
  const topKeys = ["format", "formatVersion", "units", "designBounds", "stitches", "stitchCount", "totalLengthMm", "maxStitchLengthMm"];
  if (!checkExactKeys(input, topKeys, "", errors)) return { ok: false, errors };

  if (input.format !== STITCH_PLAN_FORMAT) {
    addError(errors, "format", "UNSUPPORTED_FORMAT", `Expected format "${STITCH_PLAN_FORMAT}".`);
  }
  if (input.formatVersion !== STITCH_PLAN_FORMAT_VERSION) {
    addError(errors, "formatVersion", "UNSUPPORTED_FORMAT_VERSION", `Only stitch-plan format version ${STITCH_PLAN_FORMAT_VERSION} is supported.`);
  }
  if (input.units !== "mm") addError(errors, "units", "UNSUPPORTED_UNITS", "Coordinates and lengths must use millimetres (mm).");

  let bounds;
  try {
    bounds = validateDesignBounds(input.designBounds);
  } catch (error) {
    addError(errors, "designBounds", "INVALID_BOUNDS", error.message);
  }

  if (!Array.isArray(input.stitches)) {
    addError(errors, "stitches", "INVALID_TYPE", "Expected an array of needle positions.");
  } else {
    if (input.stitches.length < 2) {
      addError(errors, "stitches", "TOO_FEW_POSITIONS", "A stitch plan must contain at least two positions.");
    }
    if (input.stitches.length > MAX_STITCH_PLAN_MOVES + 1) {
      addError(errors, "stitches", "TOO_MANY_POSITIONS", `A stitch plan cannot exceed ${MAX_STITCH_PLAN_MOVES} moves.`);
    }
  }

  if (!Number.isSafeInteger(input.stitchCount) || input.stitchCount < 1 || input.stitchCount > MAX_STITCH_PLAN_MOVES) {
    addError(errors, "stitchCount", "INVALID_VALUE", `stitchCount must be an integer from 1 to ${MAX_STITCH_PLAN_MOVES}.`);
  }
  finitePositive(input.totalLengthMm, "totalLengthMm", errors);
  finitePositive(input.maxStitchLengthMm, "maxStitchLengthMm", errors);

  let recomputedLength = 0;
  if (Array.isArray(input.stitches) && bounds && input.stitches.length >= 2
      && input.stitches.length <= MAX_STITCH_PLAN_MOVES + 1) {
    const points = [];
    input.stitches.forEach((point, index) => {
      const path = `stitches[${index}]`;
      if (!checkExactKeys(point, ["xMm", "yMm"], path, errors)) return;
      if (typeof point.xMm !== "number" || !Number.isFinite(point.xMm)
          || typeof point.yMm !== "number" || !Number.isFinite(point.yMm)) {
        addError(errors, path, "INVALID_COORDINATE", "Coordinates must be finite numbers.");
        return;
      }
      if (point.xMm < 0 || point.xMm > bounds.widthMm || point.yMm < 0 || point.yMm > bounds.heightMm) {
        addError(errors, path, "OUT_OF_BOUNDS", "Needle position lies outside design bounds.");
      }
      points.push({ xMm: point.xMm, yMm: point.yMm });
    });

    if (points.length === input.stitches.length) {
      for (let index = 1; index < points.length; index += 1) {
        const segmentLength = distanceMm(points[index - 1], points[index]);
        if (segmentLength === 0) {
          addError(errors, `stitches[${index}]`, "ZERO_LENGTH_MOVE", "Consecutive needle positions must not be identical.");
        }
        if (Number.isFinite(input.maxStitchLengthMm)
            && input.maxStitchLengthMm > 0
            && segmentLength > input.maxStitchLengthMm + NUMERIC_TOLERANCE) {
          addError(errors, `stitches[${index}]`, "STITCH_TOO_LONG", "A move exceeds maxStitchLengthMm.");
        }
        recomputedLength += segmentLength;
      }
    }
  }

  if (Array.isArray(input.stitches) && Number.isSafeInteger(input.stitchCount)
      && input.stitchCount !== input.stitches.length - 1) {
    addError(errors, "stitchCount", "COUNT_MISMATCH", "stitchCount must equal stitches.length - 1.");
  }
  if (Number.isFinite(input.totalLengthMm) && input.totalLengthMm > 0
      && Math.abs(input.totalLengthMm - recomputedLength) > Math.max(NUMERIC_TOLERANCE, recomputedLength * 1e-9)) {
    addError(errors, "totalLengthMm", "LENGTH_MISMATCH", "totalLengthMm does not match the positions in the plan.");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      format: STITCH_PLAN_FORMAT,
      formatVersion: STITCH_PLAN_FORMAT_VERSION,
      units: "mm",
      designBounds: { ...bounds },
      stitches: input.stitches.map(({ xMm, yMm }) => ({ xMm, yMm })),
      stitchCount: input.stitchCount,
      totalLengthMm: input.totalLengthMm,
      maxStitchLengthMm: input.maxStitchLengthMm,
    },
  };
}

function assertMaxBytes(maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }
}

function validationMessage(errors) {
  return errors.map(({ path, code }) => `${path || "$"}: ${code}`).join("; ");
}

/** Build a validated, portable JSON interchange object from running-stitch output. */
export function createStitchPlan({ designBounds, stitchResult } = {}) {
  if (!isPlainObject(stitchResult)) throw new TypeError("stitchResult must be an object returned by the stitch engine.");
  const expectedKeys = ["stitches", "stitchCount", "totalLengthMm", "maxStitchLengthMm"];
  const actualKeys = Reflect.ownKeys(stitchResult);
  if (actualKeys.length !== expectedKeys.length || expectedKeys.some((key) => !Object.hasOwn(stitchResult, key))
      || actualKeys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))) {
    throw new TypeError("stitchResult has an unexpected shape.");
  }
  const candidate = {
    format: STITCH_PLAN_FORMAT,
    formatVersion: STITCH_PLAN_FORMAT_VERSION,
    units: "mm",
    designBounds,
    stitches: stitchResult.stitches,
    stitchCount: stitchResult.stitchCount,
    totalLengthMm: stitchResult.totalLengthMm,
    maxStitchLengthMm: stitchResult.maxStitchLengthMm,
  };
  const result = validatePlan(candidate);
  if (!result.ok) throw new TypeError(`Cannot create invalid stitch plan: ${validationMessage(result.errors)}`);
  return result.value;
}

/** Export a validated plan as bounded UTF-8 JSON text. */
export function exportStitchPlanText(plan, { maxBytes = DEFAULT_MAX_STITCH_PLAN_BYTES } = {}) {
  assertMaxBytes(maxBytes);
  const validation = validatePlan(plan);
  if (!validation.ok) throw new TypeError(`Cannot export invalid stitch plan: ${validationMessage(validation.errors)}`);
  const text = `${JSON.stringify(validation.value, null, 2)}\n`;
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > maxBytes) throw new RangeError(`Stitch plan exceeds the ${maxBytes}-byte safety limit.`);
  return text;
}

/** Import JSON text without executing code or silently migrating format versions. */
export function importStitchPlanText(text, { maxBytes = DEFAULT_MAX_STITCH_PLAN_BYTES } = {}) {
  assertMaxBytes(maxBytes);
  if (typeof text !== "string") {
    return { ok: false, errors: [{ path: "$", code: "INVALID_TYPE", message: "Stitch plan contents must be text." }] };
  }
  const byteLength = new TextEncoder().encode(text).byteLength;
  if (byteLength > maxBytes) {
    return { ok: false, errors: [{ path: "$", code: "FILE_TOO_LARGE", message: `Stitch plan exceeds the ${maxBytes}-byte safety limit.` }] };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ path: "$", code: "INVALID_JSON", message: "Stitch plan contents are not valid JSON." }] };
  }
  return validatePlan(parsed);
}
