import test from "node:test";
import assert from "node:assert/strict";
import { createPlaybackController, validateSimulationTimeline } from "../src/playback-controller.js";
import { createStitchSequence, simulateStitchSequence } from "../src/stitch-sequence.js";
import { createStitchPlan } from "../src/stitch-plan-json.js";
import { generateRunningStitches } from "../src/stitch-engine.js";

const bounds = { widthMm: 50, heightMm: 50 };

function makePlan(points) {
  const stitchResult = generateRunningStitches(points, { ...bounds, maxStitchLengthMm: 5 });
  return createStitchPlan({ designBounds: bounds, stitchResult });
}

function makeTimeline() {
  const sequence = createStitchSequence({
    designBounds: bounds,
    blocks: [
      {
        id: "outline",
        thread: { id: "red-01", name: "Red", hex: "#CC0011" },
        stitchPlan: makePlan([{ xMm: 0, yMm: 0 }, { xMm: 10, yMm: 0 }]),
      },
      {
        id: "detail",
        thread: { id: "blue-01", name: "Blue", hex: "#0033CC" },
        stitchPlan: makePlan([{ xMm: 20, yMm: 0 }, { xMm: 20, yMm: 10 }]),
      },
    ],
  });
  return simulateStitchSequence(sequence);
}

test("validates a generated timeline and rejects unsupported timeline versions", () => {
  const timeline = makeTimeline();
  assert.equal(validateSimulationTimeline(timeline), true);
  assert.throws(() => validateSimulationTimeline({ ...timeline, formatVersion: 2 }), /unsupported version/u);
});

test("starts before the first event with an empty preview state", () => {
  const controller = createPlaybackController(makeTimeline());
  assert.deepEqual(controller.getState(), {
    eventIndex: -1,
    eventCount: 8,
    appliedEventCount: 0,
    progress: 0,
    stitchProgress: 0,
    currentEvent: null,
    activeThread: null,
    positionMm: null,
    appliedStitchCount: 0,
    totalStitchCount: 4,
    appliedJumpCount: 0,
    totalJumpCount: 1,
    appliedThreadChangeCount: 0,
    totalThreadChangeCount: 2,
    canStepBackward: false,
    canStepForward: true,
    isComplete: false,
  });
});

test("next applies the first thread and start events to the preview frame", () => {
  const controller = createPlaybackController(makeTimeline());
  const first = controller.next();
  assert.equal(first.currentEvent.type, "thread-change");
  assert.equal(first.activeThread.id, "red-01");
  assert.equal(first.positionMm, null);
  assert.equal(first.progress, 1 / 8);
  const second = controller.next();
  assert.equal(second.currentEvent.type, "start");
  assert.deepEqual(second.positionMm, { xMm: 0, yMm: 0 });
  assert.equal(second.progress, 2 / 8);
});

test("stitch and jump events update position and separate applied counters", () => {
  const controller = createPlaybackController(makeTimeline());
  const state = controller.seek(5);
  assert.equal(state.currentEvent.type, "jump");
  assert.deepEqual(state.positionMm, { xMm: 20, yMm: 0 });
  assert.equal(state.appliedStitchCount, 2);
  assert.equal(state.appliedJumpCount, 1);
  assert.equal(state.stitchProgress, 0.5);
  const afterStitch = controller.next();
  assert.equal(afterStitch.currentEvent.type, "stitch");
  assert.deepEqual(afterStitch.positionMm, { xMm: 20, yMm: 5 });
  assert.equal(afterStitch.appliedStitchCount, 3);
});

test("previous restores the exact prior state and can return before event zero", () => {
  const controller = createPlaybackController(makeTimeline());
  controller.seek(3);
  const before = controller.getState();
  const steppedBack = controller.previous();
  assert.equal(steppedBack.eventIndex, 2);
  assert.equal(steppedBack.appliedStitchCount, 1);
  assert.deepEqual(steppedBack.positionMm, { xMm: 5, yMm: 0 });
  controller.seek(before.eventIndex);
  assert.deepEqual(controller.getState(), before);
  controller.reset();
  assert.equal(controller.getState().eventIndex, -1);
  assert.equal(controller.getState().activeThread, null);
});

test("seek clamps neither invalid indexes nor fractional indexes silently", () => {
  const controller = createPlaybackController(makeTimeline());
  assert.throws(() => controller.seek(-2), RangeError);
  assert.throws(() => controller.seek(8), RangeError);
  assert.throws(() => controller.seek(1.5), RangeError);
  assert.throws(() => controller.seek(Number.NaN), RangeError);
});

test("next and previous are stable at the timeline boundaries", () => {
  const controller = createPlaybackController(makeTimeline());
  assert.equal(controller.previous().eventIndex, -1);
  const complete = controller.seek(7);
  assert.equal(complete.isComplete, true);
  assert.equal(complete.canStepForward, false);
  assert.equal(complete.progress, 1);
  assert.equal(controller.next().eventIndex, 7);
  assert.equal(controller.previous().eventIndex, 6);
});

test("rejects malformed events, unknown fields, and inconsistent summary totals", () => {
  const timeline = makeTimeline();
  const unknownField = structuredClone(timeline);
  unknownField.events[0].surprise = true;
  assert.throws(() => createPlaybackController(unknownField), /unknown fields/u);
  const badPosition = structuredClone(timeline);
  badPosition.events[1].position.xMm = Number.POSITIVE_INFINITY;
  assert.throws(() => createPlaybackController(badPosition), /finite millimetre coordinate/u);
  const badSummary = structuredClone(timeline);
  badSummary.summary.stitchCount += 1;
  assert.throws(() => createPlaybackController(badSummary), /event counts are inconsistent/u);
  const badTransition = structuredClone(timeline);
  badTransition.events[4].fromThreadId = null;
  assert.throws(() => createPlaybackController(badTransition), /source thread does not match/u);
  const badLength = structuredClone(timeline);
  badLength.events[2].lengthMm = 99;
  assert.throws(() => createPlaybackController(badLength), /inconsistent with the event coordinates/u);
});

test("controller snapshots input and returned state so caller mutation cannot corrupt it", () => {
  const timeline = makeTimeline();
  const controller = createPlaybackController(timeline);
  timeline.events[0].thread.hex = "#FFFFFF";
  const state = controller.next();
  assert.equal(state.activeThread.hex, "#CC0011");
  state.activeThread.hex = "#000000";
  state.currentEvent.thread.hex = "#000000";
  assert.equal(controller.getState().activeThread.hex, "#CC0011");
});

test("controller state remains consistent after repeated seek, reset, and stepping", () => {
  const controller = createPlaybackController(makeTimeline());
  controller.seek(6);
  controller.seek(2);
  assert.equal(controller.getState().appliedStitchCount, 1);
  controller.seek(7);
  assert.equal(controller.getState().appliedStitchCount, 4);
  controller.reset();
  for (let index = 0; index < 8; index += 1) controller.next();
  assert.equal(controller.getState().eventIndex, 7);
  assert.equal(controller.getState().isComplete, true);
});
