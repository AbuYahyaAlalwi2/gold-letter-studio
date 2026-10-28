import test from "node:test";
import assert from "node:assert/strict";
import { distanceMm } from "../src/geometry.js";
import { generateRunningStitches, MAX_GENERATED_STITCHES } from "../src/stitch-engine.js";

function assertAllMovesWithinLimit(stitches, limit) {
  for (let index = 1; index < stitches.length; index += 1) {
    assert.ok(distanceMm(stitches[index - 1], stitches[index]) <= limit + 1e-10);
  }
}

test("running stitch splits a long segment and preserves exact endpoints", () => {
  const input = [{ xMm: 0, yMm: 0 }, { xMm: 10, yMm: 0 }];
  const result = generateRunningStitches(input, { widthMm: 10, heightMm: 10, maxStitchLengthMm: 4 });
  assert.equal(result.stitchCount, 3);
  assert.equal(result.stitches.length, 4);
  assert.deepEqual(result.stitches[0], input[0]);
  assert.deepEqual(result.stitches.at(-1), input[1]);
  assert.equal(result.totalLengthMm, 10);
  assertAllMovesWithinLimit(result.stitches, 4);
  assert.deepEqual(input, [{ xMm: 0, yMm: 0 }, { xMm: 10, yMm: 0 }], "source path must not be mutated");
});

test("running stitch handles multiple segments and retains authored vertices", () => {
  const points = [{ xMm: 0, yMm: 0 }, { xMm: 3, yMm: 0 }, { xMm: 3, yMm: 4 }];
  const result = generateRunningStitches(points, { widthMm: 10, heightMm: 10, maxStitchLengthMm: 2 });
  assert.equal(result.totalLengthMm, 7);
  assert.equal(result.stitchCount, 4);
  assert.ok(result.stitches.some((point) => point.xMm === 3 && point.yMm === 0));
  assert.ok(result.stitches.some((point) => point.xMm === 3 && point.yMm === 4));
  assertAllMovesWithinLimit(result.stitches, 2);
});

test("running stitch rejects invalid limits, out-of-bounds paths and excessive output", () => {
  const path = [{ xMm: 0, yMm: 0 }, { xMm: 10, yMm: 0 }];
  assert.throws(() => generateRunningStitches(path, { widthMm: 10, heightMm: 10, maxStitchLengthMm: 0 }), /greater than 0/);
  assert.throws(() => generateRunningStitches(path, { widthMm: 10, heightMm: 10, maxStitches: 2 }), /safety limit/);
  assert.throws(() => generateRunningStitches(path, { widthMm: 10, heightMm: 10, maxStitches: MAX_GENERATED_STITCHES + 1 }), /between 1 and/);
  assert.throws(() => generateRunningStitches([{ xMm: 0, yMm: 0 }, { xMm: 11, yMm: 0 }], { widthMm: 10, heightMm: 10 }), /outside the design bounds/);
});
