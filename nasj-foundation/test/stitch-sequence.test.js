import test from "node:test";
import assert from "node:assert/strict";
import {
  createStitchSequence,
  simulateStitchSequence,
  validateStitchSequence,
  MAX_SEQUENCE_BLOCKS,
  STITCH_SEQUENCE_FORMAT,
} from "../src/stitch-sequence.js";
import { createStitchPlan } from "../src/stitch-plan-json.js";
import { generateRunningStitches } from "../src/stitch-engine.js";

const bounds = { widthMm: 50, heightMm: 50 };

function makePlan(points, maxStitchLengthMm = 5) {
  const stitchResult = generateRunningStitches(points, { ...bounds, maxStitchLengthMm });
  return createStitchPlan({ designBounds: bounds, stitchResult });
}

function makeBlocks() {
  return [
    {
      id: "outline",
      thread: { id: "red-01", name: "Red", hex: "#cc0011" },
      stitchPlan: makePlan([{ xMm: 0, yMm: 0 }, { xMm: 10, yMm: 0 }]),
    },
    {
      id: "detail",
      thread: { id: "blue-01", name: "Blue", hex: "#0033CC" },
      stitchPlan: makePlan([{ xMm: 20, yMm: 0 }, { xMm: 20, yMm: 10 }]),
    },
  ];
}

function makeSequence() {
  return createStitchSequence({ designBounds: bounds, blocks: makeBlocks() });
}

function mutateSequence(mutator) {
  const sequence = structuredClone(makeSequence());
  mutator(sequence);
  return sequence;
}

test("creates a versioned sequence and normalizes thread hex without mutating inputs", () => {
  const blocks = makeBlocks();
  const before = structuredClone(blocks);
  const sequence = createStitchSequence({ designBounds: bounds, blocks });
  assert.equal(sequence.format, STITCH_SEQUENCE_FORMAT);
  assert.equal(sequence.formatVersion, 1);
  assert.equal(sequence.blocks[0].thread.hex, "#CC0011");
  assert.deepEqual(blocks, before);
});

test("simulation emits deterministic thread changes, stitches, and an unstitched jump", () => {
  const timeline = simulateStitchSequence(makeSequence());
  assert.deepEqual(timeline.events.map((event) => event.type), [
    "thread-change", "start", "stitch", "stitch", "thread-change", "jump", "stitch", "stitch",
  ]);
  assert.deepEqual(timeline.summary, {
    blockCount: 2,
    uniqueThreadCount: 2,
    threadChangeCount: 2,
    stitchCount: 4,
    jumpCount: 1,
    stitchedLengthMm: 20,
    jumpLengthMm: 10,
    totalTravelLengthMm: 30,
  });
  assert.equal(timeline.events.find((event) => event.type === "jump").lengthMm, 10);
});

test("does not emit redundant thread changes for adjacent blocks using the same thread", () => {
  const blocks = makeBlocks();
  blocks[1].thread = { ...blocks[0].thread };
  const timeline = simulateStitchSequence(createStitchSequence({ designBounds: bounds, blocks }));
  assert.equal(timeline.summary.threadChangeCount, 1);
  assert.equal(timeline.summary.uniqueThreadCount, 1);
});

test("does not emit a jump when adjacent blocks meet at the same point", () => {
  const blocks = makeBlocks();
  blocks[1].stitchPlan = makePlan([{ xMm: 10, yMm: 0 }, { xMm: 10, yMm: 10 }]);
  const timeline = simulateStitchSequence(createStitchSequence({ designBounds: bounds, blocks }));
  assert.equal(timeline.summary.jumpCount, 0);
  assert.equal(timeline.summary.jumpLengthMm, 0);
});

test("rejects a block whose plan uses different design bounds", () => {
  const blocks = makeBlocks();
  const otherBounds = { widthMm: 40, heightMm: 40 };
  const result = generateRunningStitches([{ xMm: 0, yMm: 0 }, { xMm: 5, yMm: 0 }], {
    ...otherBounds,
    maxStitchLengthMm: 5,
  });
  blocks[1].stitchPlan = createStitchPlan({ designBounds: otherBounds, stitchResult: result });
  assert.throws(() => createStitchSequence({ designBounds: bounds, blocks }), /BOUNDS_MISMATCH/u);
});

test("rejects malformed thread colors and unknown fields", () => {
  assert.throws(() => createStitchSequence({
    designBounds: bounds,
    blocks: mutateSequence((sequence) => { sequence.blocks[0].thread.hex = "red"; }).blocks,
  }), /INVALID_COLOR/u);
  const result = validateStitchSequence(mutateSequence((sequence) => { sequence.unreviewed = true; }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "UNKNOWN_FIELD"));
});

test("rejects duplicate block ids", () => {
  const result = validateStitchSequence(mutateSequence((sequence) => {
    sequence.blocks[1].id = sequence.blocks[0].id;
  }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "DUPLICATE_BLOCK_ID"));
});

test("rejects a thread id reused with conflicting metadata", () => {
  const result = validateStitchSequence(mutateSequence((sequence) => {
    sequence.blocks[1].thread.id = sequence.blocks[0].thread.id;
  }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "THREAD_ID_CONFLICT"));
});

test("rejects unsupported sequence versions without migration", () => {
  const result = validateStitchSequence(mutateSequence((sequence) => { sequence.formatVersion = 2; }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "UNSUPPORTED_FORMAT_VERSION"));
});

test("rejects malformed embedded stitch plans", () => {
  const blocks = makeBlocks();
  blocks[0].stitchPlan.maxStitchLengthMm = 0;
  assert.throws(() => createStitchSequence({ designBounds: bounds, blocks }), /INVALID_STITCH_PLAN/u);
});

test("rejects an unsupported embedded stitch-plan version explicitly", () => {
  const result = validateStitchSequence(mutateSequence((sequence) => {
    sequence.blocks[0].stitchPlan.formatVersion = 2;
  }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "UNSUPPORTED_STITCH_PLAN"));
});

test("enforces the maximum block count", () => {
  const base = makeBlocks()[0];
  const blocks = Array.from({ length: MAX_SEQUENCE_BLOCKS + 1 }, (_, index) => ({
    ...structuredClone(base),
    id: `block-${index}`,
  }));
  const result = validateStitchSequence({
    format: STITCH_SEQUENCE_FORMAT,
    formatVersion: 1,
    units: "mm",
    designBounds: bounds,
    blocks,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "TOO_MANY_BLOCKS"));
});

test("simulation rejects invalid sequences and does not mutate valid input", () => {
  const sequence = makeSequence();
  const before = structuredClone(sequence);
  simulateStitchSequence(sequence);
  assert.deepEqual(sequence, before);
  assert.throws(() => simulateStitchSequence({ ...sequence, units: "in" }), /UNSUPPORTED_UNITS/u);
});

test("enforces the aggregate stitched-move limit across blocks", () => {
  const largeBounds = { widthMm: 5000, heightMm: 100 };
  const firstResult = generateRunningStitches(
    [{ xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 }],
    { ...largeBounds, maxStitchLengthMm: 0.1, maxStitches: 100_000 },
  );
  const secondResult = generateRunningStitches(
    [{ xMm: 0, yMm: 10 }, { xMm: 5000, yMm: 10 }],
    { ...largeBounds, maxStitchLengthMm: 5000 / 50001, maxStitches: 100_000 },
  );
  assert.equal(firstResult.stitchCount, 50_000);
  assert.equal(secondResult.stitchCount, 50_001);
  const blocks = [
    {
      id: "large-a",
      thread: { id: "thread-a", name: "A", hex: "#112233" },
      stitchPlan: createStitchPlan({ designBounds: largeBounds, stitchResult: firstResult }),
    },
    {
      id: "large-b",
      thread: { id: "thread-b", name: "B", hex: "#445566" },
      stitchPlan: createStitchPlan({ designBounds: largeBounds, stitchResult: secondResult }),
    },
  ];
  const result = validateStitchSequence({
    format: STITCH_SEQUENCE_FORMAT,
    formatVersion: 1,
    units: "mm",
    designBounds: largeBounds,
    blocks,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "TOO_MANY_STITCHES"));
});
