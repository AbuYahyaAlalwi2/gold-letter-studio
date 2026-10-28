/**
 * Deterministic event cursor for the logical simulation timeline.
 * This is UI-independent playback state, not physical needle or machine state.
 */
import { MAX_SEQUENCE_BLOCKS, MAX_SEQUENCE_STITCHES } from "./stitch-sequence.js";

export const SIMULATION_TIMELINE_FORMAT = "nasj-simulation-timeline";
export const SIMULATION_TIMELINE_VERSION = 1;
export const MAX_PLAYBACK_EVENTS = MAX_SEQUENCE_STITCHES + (MAX_SEQUENCE_BLOCKS * 2) + 1;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/u;
const LENGTH_TOLERANCE_MM = 1e-7;

const SUMMARY_KEYS = [
  "blockCount",
  "uniqueThreadCount",
  "threadChangeCount",
  "stitchCount",
  "jumpCount",
  "stitchedLengthMm",
  "jumpLengthMm",
  "totalTravelLengthMm",
];

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactKeys(value, expected, path) {
  if (!isPlainObject(value)) throw new TypeError(`${path}: expected an object`);
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string" || !expected.includes(key))) {
    throw new TypeError(`${path}: unknown fields are not allowed`);
  }
  const missing = expected.find((key) => !Object.hasOwn(value, key));
  if (missing) throw new TypeError(`${path}.${missing}: required field is missing`);
}

function requireId(value, path) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new TypeError(`${path}: invalid identifier`);
  }
}

function requirePoint(value, path) {
  requireExactKeys(value, ["xMm", "yMm"], path);
  for (const axis of ["xMm", "yMm"]) {
    if (typeof value[axis] !== "number" || !Number.isFinite(value[axis])) {
      throw new TypeError(`${path}.${axis}: expected a finite millimetre coordinate`);
    }
  }
}

function requireThread(value, path) {
  requireExactKeys(value, ["id", "name", "hex"], path);
  requireId(value.id, `${path}.id`);
  if (typeof value.name !== "string" || value.name.trim().length === 0 || value.name.length > 80) {
    throw new TypeError(`${path}.name: invalid thread name`);
  }
  if (typeof value.hex !== "string" || !HEX_COLOR_PATTERN.test(value.hex)) {
    throw new TypeError(`${path}.hex: expected a normalized #RRGGBB color`);
  }
}

function requireLength(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${path}: expected a finite non-negative length`);
  }
}

function nearlyEqual(left, right) {
  return Math.abs(left - right) <= LENGTH_TOLERANCE_MM * Math.max(1, Math.abs(left), Math.abs(right));
}

function samePoint(left, right) {
  return left === null || right === null
    ? left === right
    : nearlyEqual(left.xMm, right.xMm) && nearlyEqual(left.yMm, right.yMm);
}

function measuredDistance(left, right) {
  return Math.hypot(right.xMm - left.xMm, right.yMm - left.yMm);
}

/** Validate the complete v1 logical timeline before allowing playback. */
export function validateSimulationTimeline(timeline) {
  requireExactKeys(timeline, ["format", "formatVersion", "units", "events", "summary"], "timeline");
  if (timeline.format !== SIMULATION_TIMELINE_FORMAT) throw new TypeError("timeline.format: unsupported format");
  if (timeline.formatVersion !== SIMULATION_TIMELINE_VERSION) throw new TypeError("timeline.formatVersion: unsupported version");
  if (timeline.units !== "mm") throw new TypeError("timeline.units: only millimetres are supported");
  if (!Array.isArray(timeline.events) || timeline.events.length === 0) {
    throw new TypeError("timeline.events: expected a non-empty event array");
  }
  if (timeline.events.length > MAX_PLAYBACK_EVENTS) {
    throw new RangeError(`timeline.events: cannot exceed ${MAX_PLAYBACK_EVENTS} events`);
  }

  const counts = { "thread-change": 0, start: 0, stitch: 0, jump: 0 };
  const blockIds = new Set();
  const threadIds = new Set();
  let stitchedLengthMm = 0;
  let jumpLengthMm = 0;
  let activeThreadId = null;
  let currentPosition = null;
  let started = false;

  timeline.events.forEach((event, index) => {
    const path = `timeline.events[${index}]`;
    if (!isPlainObject(event) || typeof event.type !== "string") {
      throw new TypeError(`${path}: event must be an object with a type`);
    }
    const expectedByType = {
      "thread-change": ["type", "blockId", "fromThreadId", "toThreadId", "thread", "position"],
      start: ["type", "blockId", "threadId", "position"],
      stitch: ["type", "blockId", "threadId", "from", "to", "lengthMm"],
      jump: ["type", "blockId", "threadId", "from", "to", "lengthMm"],
    };
    const expected = expectedByType[event.type];
    if (!expected) throw new TypeError(`${path}.type: unsupported event type`);
    requireExactKeys(event, expected, path);
    requireId(event.blockId, `${path}.blockId`);
    blockIds.add(event.blockId);
    counts[event.type] += 1;

    if (event.type === "thread-change") {
      if (event.fromThreadId !== null) requireId(event.fromThreadId, `${path}.fromThreadId`);
      requireId(event.toThreadId, `${path}.toThreadId`);
      requireThread(event.thread, `${path}.thread`);
      if (event.thread.id !== event.toThreadId) throw new TypeError(`${path}: target thread id does not match thread metadata`);
      if (event.fromThreadId !== activeThreadId) throw new TypeError(`${path}: source thread does not match the active thread`);
      if (event.position !== null) requirePoint(event.position, `${path}.position`);
      if (!samePoint(event.position, currentPosition)) throw new TypeError(`${path}.position: inconsistent with the current preview position`);
      activeThreadId = event.toThreadId;
      threadIds.add(event.toThreadId);
    } else {
      requireId(event.threadId, `${path}.threadId`);
      threadIds.add(event.threadId);
      if (event.type === "start") {
        requirePoint(event.position, `${path}.position`);
        if (started || currentPosition !== null) throw new TypeError(`${path}: start event must occur exactly once before movement`);
        if (event.threadId !== activeThreadId) throw new TypeError(`${path}: start thread does not match the active thread`);
        currentPosition = { xMm: event.position.xMm, yMm: event.position.yMm };
        started = true;
      } else {
        requirePoint(event.from, `${path}.from`);
        requirePoint(event.to, `${path}.to`);
        requireLength(event.lengthMm, `${path}.lengthMm`);
        if (!started || currentPosition === null) throw new TypeError(`${path}: movement cannot occur before the start event`);
        if (event.threadId !== activeThreadId) throw new TypeError(`${path}: movement thread does not match the active thread`);
        if (!samePoint(event.from, currentPosition)) throw new TypeError(`${path}.from: does not match the previous preview position`);
        if (!nearlyEqual(event.lengthMm, measuredDistance(event.from, event.to))) {
          throw new TypeError(`${path}.lengthMm: inconsistent with the event coordinates`);
        }
        currentPosition = { xMm: event.to.xMm, yMm: event.to.yMm };
        if (event.type === "stitch") stitchedLengthMm += event.lengthMm;
        if (event.type === "jump") jumpLengthMm += event.lengthMm;
      }
    }
  });

  if (counts.start !== 1) throw new TypeError("timeline.events: exactly one start event is required");
  requireExactKeys(timeline.summary, SUMMARY_KEYS, "timeline.summary");
  for (const key of ["blockCount", "uniqueThreadCount", "threadChangeCount", "stitchCount", "jumpCount"]) {
    if (!Number.isSafeInteger(timeline.summary[key]) || timeline.summary[key] < 0) {
      throw new TypeError(`timeline.summary.${key}: expected a non-negative safe integer`);
    }
  }
  for (const key of ["stitchedLengthMm", "jumpLengthMm", "totalTravelLengthMm"]) {
    requireLength(timeline.summary[key], `timeline.summary.${key}`);
  }
  if (timeline.summary.blockCount !== blockIds.size) throw new TypeError("timeline.summary.blockCount: inconsistent with events");
  if (timeline.summary.uniqueThreadCount !== threadIds.size) throw new TypeError("timeline.summary.uniqueThreadCount: inconsistent with events");
  if (timeline.summary.threadChangeCount !== counts["thread-change"]
      || timeline.summary.stitchCount !== counts.stitch
      || timeline.summary.jumpCount !== counts.jump) {
    throw new TypeError("timeline.summary: event counts are inconsistent");
  }
  if (!nearlyEqual(timeline.summary.stitchedLengthMm, stitchedLengthMm)
      || !nearlyEqual(timeline.summary.jumpLengthMm, jumpLengthMm)
      || !nearlyEqual(timeline.summary.totalTravelLengthMm, stitchedLengthMm + jumpLengthMm)) {
    throw new TypeError("timeline.summary: length totals are inconsistent");
  }
  if (timeline.summary.blockCount < 1 || timeline.summary.blockCount > MAX_SEQUENCE_BLOCKS) {
    throw new RangeError("timeline.summary.blockCount: outside supported limits");
  }
  if (timeline.summary.stitchCount > MAX_SEQUENCE_STITCHES) {
    throw new RangeError("timeline.summary.stitchCount: outside supported limits");
  }

  return true;
}

function clonePoint(point) {
  return point === null ? null : { xMm: point.xMm, yMm: point.yMm };
}

function cloneThread(thread) {
  return thread === null ? null : { id: thread.id, name: thread.name, hex: thread.hex };
}

function cloneEvent(event) {
  return structuredClone(event);
}

function snapshotState(state) {
  return {
    activeThread: cloneThread(state.activeThread),
    positionMm: clonePoint(state.positionMm),
    appliedStitchCount: state.appliedStitchCount,
    appliedJumpCount: state.appliedJumpCount,
    appliedThreadChangeCount: state.appliedThreadChangeCount,
  };
}

function applyEvent(state, event) {
  switch (event.type) {
    case "thread-change":
      state.activeThread = cloneThread(event.thread);
      state.appliedThreadChangeCount += 1;
      break;
    case "start":
      state.positionMm = clonePoint(event.position);
      break;
    case "stitch":
      state.positionMm = clonePoint(event.to);
      state.appliedStitchCount += 1;
      break;
    case "jump":
      state.positionMm = clonePoint(event.to);
      state.appliedJumpCount += 1;
      break;
    default:
      // validateSimulationTimeline rejects unknown event types before this point.
      throw new TypeError(`Unsupported playback event: ${event.type}`);
  }
}

/**
 * Create a UI-independent cursor over a validated simulation timeline.
 * The cursor starts before event 0; next/previous/seek update a logical preview frame.
 */
export function createPlaybackController(inputTimeline) {
  validateSimulationTimeline(inputTimeline);
  // Snapshot the input so later caller mutations cannot silently alter playback.
  const timeline = structuredClone(inputTimeline);
  let eventIndex = -1;
  let state = {
    activeThread: null,
    positionMm: null,
    appliedStitchCount: 0,
    appliedJumpCount: 0,
    appliedThreadChangeCount: 0,
  };
  const history = [];

  function getState() {
    const appliedEventCount = eventIndex + 1;
    return {
      eventIndex,
      eventCount: timeline.events.length,
      appliedEventCount,
      progress: appliedEventCount / timeline.events.length,
      stitchProgress: timeline.summary.stitchCount === 0
        ? 0
        : state.appliedStitchCount / timeline.summary.stitchCount,
      currentEvent: eventIndex < 0 ? null : cloneEvent(timeline.events[eventIndex]),
      activeThread: cloneThread(state.activeThread),
      positionMm: clonePoint(state.positionMm),
      appliedStitchCount: state.appliedStitchCount,
      totalStitchCount: timeline.summary.stitchCount,
      appliedJumpCount: state.appliedJumpCount,
      totalJumpCount: timeline.summary.jumpCount,
      appliedThreadChangeCount: state.appliedThreadChangeCount,
      totalThreadChangeCount: timeline.summary.threadChangeCount,
      canStepBackward: eventIndex >= 0,
      canStepForward: eventIndex < timeline.events.length - 1,
      isComplete: eventIndex === timeline.events.length - 1,
    };
  }

  function advanceOne() {
    if (eventIndex >= timeline.events.length - 1) return;
    history.push(snapshotState(state));
    eventIndex += 1;
    applyEvent(state, timeline.events[eventIndex]);
  }

  function rewindOne() {
    if (eventIndex < 0) return;
    state = history.pop();
    eventIndex -= 1;
  }

  function next() {
    advanceOne();
    return getState();
  }

  function previous() {
    rewindOne();
    return getState();
  }

  function seek(targetIndex) {
    if (!Number.isSafeInteger(targetIndex) || targetIndex < -1 || targetIndex >= timeline.events.length) {
      throw new RangeError(`eventIndex must be an integer from -1 to ${timeline.events.length - 1}`);
    }
    while (eventIndex < targetIndex) advanceOne();
    while (eventIndex > targetIndex) rewindOne();
    return getState();
  }

  function reset() {
    return seek(-1);
  }

  return Object.freeze({
    getState,
    next,
    previous,
    seek,
    reset,
  });
}
