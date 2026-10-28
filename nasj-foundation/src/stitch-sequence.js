/**
 * UI-independent thread sequencing and deterministic stitch simulation timeline.
 * This is an application-level model, not a machine command stream.
 */
import { distanceMm, validateDesignBounds } from "./geometry.js";
import { exportStitchPlanText, STITCH_PLAN_FORMAT, STITCH_PLAN_FORMAT_VERSION } from "./stitch-plan-json.js";

export const STITCH_SEQUENCE_FORMAT = "nasj-stitch-sequence";
export const STITCH_SEQUENCE_FORMAT_VERSION = 1;
export const MAX_SEQUENCE_BLOCKS = 256;
export const MAX_SEQUENCE_STITCHES = 100_000;
export const MAX_THREAD_NAME_LENGTH = 80;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/u;
const NUMERIC_TOLERANCE = 1e-8;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected, path, errors) {
  if (!isPlainObject(value)) {
    errors.push({ path, code: "INVALID_TYPE", message: "Expected an object." });
    return false;
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) {
      errors.push({ path: `${path}${path ? "." : ""}${key}`, code: "MISSING_FIELD", message: "Required field is missing." });
    }
  }
  const allowed = new Set(expected);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) {
      errors.push({ path: `${path}${path ? "." : ""}${String(key)}`, code: "UNKNOWN_FIELD", message: "Unknown fields are not allowed." });
    }
  }
  return true;
}

function sameBounds(left, right) {
  return left.widthMm === right.widthMm && left.heightMm === right.heightMm;
}

function sequenceErrorsMessage(errors) {
  return errors.map(({ path, code }) => `${path || "$"}: ${code}`).join("; ");
}

function normalizeThread(thread, path, errors) {
  if (!exactKeys(thread, ["id", "name", "hex"], path, errors)) return null;
  if (typeof thread.id !== "string" || !ID_PATTERN.test(thread.id)) {
    errors.push({ path: `${path}.id`, code: "INVALID_ID", message: "Thread id must be a 1–64 character identifier using letters, digits, dot, underscore, or hyphen." });
  }
  if (typeof thread.name !== "string" || thread.name.trim().length === 0 || thread.name.length > MAX_THREAD_NAME_LENGTH) {
    errors.push({ path: `${path}.name`, code: "INVALID_NAME", message: `Thread name must contain 1–${MAX_THREAD_NAME_LENGTH} characters.` });
  }
  if (typeof thread.hex !== "string" || !HEX_COLOR_PATTERN.test(thread.hex)) {
    errors.push({ path: `${path}.hex`, code: "INVALID_COLOR", message: "Thread color must be a six-digit hexadecimal value such as #A1B2C3." });
  }
  if (typeof thread.id !== "string" || !ID_PATTERN.test(thread.id)
      || typeof thread.name !== "string" || thread.name.trim().length === 0 || thread.name.length > MAX_THREAD_NAME_LENGTH
      || typeof thread.hex !== "string" || !HEX_COLOR_PATTERN.test(thread.hex)) return null;
  return { id: thread.id, name: thread.name.trim(), hex: thread.hex.toUpperCase() };
}

function normalizeSequence(input) {
  const errors = [];
  const rootKeys = ["format", "formatVersion", "units", "designBounds", "blocks"];
  if (!exactKeys(input, rootKeys, "", errors)) return { ok: false, errors };

  if (input.format !== STITCH_SEQUENCE_FORMAT) {
    errors.push({ path: "format", code: "UNSUPPORTED_FORMAT", message: `Expected format "${STITCH_SEQUENCE_FORMAT}".` });
  }
  if (input.formatVersion !== STITCH_SEQUENCE_FORMAT_VERSION) {
    errors.push({ path: "formatVersion", code: "UNSUPPORTED_FORMAT_VERSION", message: `Only sequence format version ${STITCH_SEQUENCE_FORMAT_VERSION} is supported.` });
  }
  if (input.units !== "mm") {
    errors.push({ path: "units", code: "UNSUPPORTED_UNITS", message: "All coordinates and lengths must use millimetres (mm)." });
  }

  let bounds = null;
  try {
    bounds = validateDesignBounds(input.designBounds);
  } catch (error) {
    errors.push({ path: "designBounds", code: "INVALID_BOUNDS", message: error.message });
  }

  if (!Array.isArray(input.blocks)) {
    errors.push({ path: "blocks", code: "INVALID_TYPE", message: "Blocks must be an array." });
    return { ok: false, errors };
  }
  if (input.blocks.length < 1) {
    errors.push({ path: "blocks", code: "EMPTY_SEQUENCE", message: "At least one stitch block is required." });
  }
  if (input.blocks.length > MAX_SEQUENCE_BLOCKS) {
    errors.push({ path: "blocks", code: "TOO_MANY_BLOCKS", message: `A sequence cannot exceed ${MAX_SEQUENCE_BLOCKS} blocks.` });
    return { ok: false, errors };
  }

  const blockIds = new Set();
  const threadsById = new Map();
  const normalizedBlocks = [];
  let totalStitches = 0;

  input.blocks.forEach((block, index) => {
    const path = `blocks[${index}]`;
    if (!exactKeys(block, ["id", "thread", "stitchPlan"], path, errors)) return;

    if (typeof block.id !== "string" || !ID_PATTERN.test(block.id)) {
      errors.push({ path: `${path}.id`, code: "INVALID_ID", message: "Block id must be a 1–64 character identifier using letters, digits, dot, underscore, or hyphen." });
    } else if (blockIds.has(block.id)) {
      errors.push({ path: `${path}.id`, code: "DUPLICATE_BLOCK_ID", message: "Block ids must be unique within a sequence." });
    } else {
      blockIds.add(block.id);
    }

    const thread = normalizeThread(block.thread, `${path}.thread`, errors);
    if (thread) {
      const priorThread = threadsById.get(thread.id);
      if (priorThread && (priorThread.name !== thread.name || priorThread.hex !== thread.hex)) {
        errors.push({ path: `${path}.thread`, code: "THREAD_ID_CONFLICT", message: "A thread id must keep the same name and color throughout the sequence." });
      } else {
        threadsById.set(thread.id, thread);
      }
    }

    let stitchPlan = null;
    try {
      if (isPlainObject(block.stitchPlan)
          && block.stitchPlan.format === STITCH_PLAN_FORMAT
          && block.stitchPlan.formatVersion !== STITCH_PLAN_FORMAT_VERSION) {
        errors.push({ path: `${path}.stitchPlan.formatVersion`, code: "UNSUPPORTED_STITCH_PLAN", message: "Only stitch-plan JSON format version 1 is supported." });
      } else {
        // Reuse the strict v1 plan contract rather than duplicating its geometry checks.
        stitchPlan = JSON.parse(exportStitchPlanText(block.stitchPlan));
        if (bounds && !sameBounds(stitchPlan.designBounds, bounds)) {
          errors.push({ path: `${path}.stitchPlan.designBounds`, code: "BOUNDS_MISMATCH", message: "Every stitch plan must use the sequence design bounds." });
          stitchPlan = null;
        }
      }
    } catch (error) {
      errors.push({ path: `${path}.stitchPlan`, code: "INVALID_STITCH_PLAN", message: error.message });
    }

    if (stitchPlan) {
      totalStitches += stitchPlan.stitchCount;
      if (totalStitches > MAX_SEQUENCE_STITCHES) {
        errors.push({ path: "blocks", code: "TOO_MANY_STITCHES", message: `A sequence cannot exceed ${MAX_SEQUENCE_STITCHES} stitched moves in total.` });
      }
    }
    if (thread && stitchPlan && typeof block.id === "string" && ID_PATTERN.test(block.id)) {
      normalizedBlocks.push({ id: block.id, thread, stitchPlan });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      format: STITCH_SEQUENCE_FORMAT,
      formatVersion: STITCH_SEQUENCE_FORMAT_VERSION,
      units: "mm",
      designBounds: bounds,
      blocks: normalizedBlocks,
    },
  };
}

/** Validate a complete sequence and return a normalized defensive copy. */
export function validateStitchSequence(input) {
  return normalizeSequence(input);
}

/**
 * Build a versioned, UI-independent thread sequence from validated v1 stitch plans.
 * The input shape is exactly { designBounds, blocks }.
 */
export function createStitchSequence(input = {}) {
  const errors = [];
  exactKeys(input, ["designBounds", "blocks"], "", errors);
  if (errors.length > 0) {
    throw new TypeError(`Cannot create stitch sequence: ${sequenceErrorsMessage(errors)}`);
  }
  const candidate = {
    format: STITCH_SEQUENCE_FORMAT,
    formatVersion: STITCH_SEQUENCE_FORMAT_VERSION,
    units: "mm",
    designBounds: input.designBounds,
    blocks: input.blocks,
  };
  const result = normalizeSequence(candidate);
  if (!result.ok) throw new TypeError(`Cannot create stitch sequence: ${sequenceErrorsMessage(result.errors)}`);
  return result.value;
}

/**
 * Produce a deterministic event timeline for a future playback UI.
 * Events are semantic preview events, not machine instructions.
 */
export function simulateStitchSequence(input) {
  const validation = normalizeSequence(input);
  if (!validation.ok) throw new TypeError(`Cannot simulate invalid stitch sequence: ${sequenceErrorsMessage(validation.errors)}`);
  const sequence = validation.value;
  const events = [];
  let activeThreadId = null;
  let currentPosition = null;
  let stitchCount = 0;
  let jumpCount = 0;
  let threadChangeCount = 0;
  let stitchedLengthMm = 0;
  let jumpLengthMm = 0;
  const uniqueThreadIds = new Set();

  for (const block of sequence.blocks) {
    uniqueThreadIds.add(block.thread.id);
    const points = block.stitchPlan.stitches;

    if (activeThreadId !== block.thread.id) {
      events.push({
        type: "thread-change",
        blockId: block.id,
        fromThreadId: activeThreadId,
        toThreadId: block.thread.id,
        thread: { ...block.thread },
        position: currentPosition ? { ...currentPosition } : null,
      });
      activeThreadId = block.thread.id;
      threadChangeCount += 1;
    }

    const firstPoint = points[0];
    if (currentPosition === null) {
      events.push({ type: "start", blockId: block.id, threadId: block.thread.id, position: { ...firstPoint } });
      currentPosition = { ...firstPoint };
    } else if (currentPosition.xMm !== firstPoint.xMm || currentPosition.yMm !== firstPoint.yMm) {
      const lengthMm = distanceMm(currentPosition, firstPoint);
      events.push({
        type: "jump",
        blockId: block.id,
        threadId: block.thread.id,
        from: { ...currentPosition },
        to: { ...firstPoint },
        lengthMm,
      });
      jumpCount += 1;
      jumpLengthMm += lengthMm;
      currentPosition = { ...firstPoint };
    }

    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const lengthMm = distanceMm(from, to);
      events.push({
        type: "stitch",
        blockId: block.id,
        threadId: block.thread.id,
        from: { ...from },
        to: { ...to },
        lengthMm,
      });
      stitchCount += 1;
      stitchedLengthMm += lengthMm;
      currentPosition = { ...to };
    }
  }

  return {
    format: "nasj-simulation-timeline",
    formatVersion: 1,
    units: "mm",
    events,
    summary: {
      blockCount: sequence.blocks.length,
      uniqueThreadCount: uniqueThreadIds.size,
      threadChangeCount,
      stitchCount,
      jumpCount,
      stitchedLengthMm,
      jumpLengthMm,
      totalTravelLengthMm: stitchedLengthMm + jumpLengthMm,
    },
  };
}
