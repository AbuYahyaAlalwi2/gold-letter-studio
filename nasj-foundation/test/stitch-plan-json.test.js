import test from "node:test";
import assert from "node:assert/strict";
import {
  createStitchPlan,
  exportStitchPlanText,
  importStitchPlanText,
  STITCH_PLAN_FORMAT,
  STITCH_PLAN_FORMAT_VERSION,
} from "../src/stitch-plan-json.js";
import { generateRunningStitches } from "../src/stitch-engine.js";

function makePlan() {
  const stitchResult = generateRunningStitches([
    { xMm: 0, yMm: 0 },
    { xMm: 10, yMm: 0 },
    { xMm: 10, yMm: 6 },
  ], { widthMm: 20, heightMm: 20, maxStitchLengthMm: 4 });
  return createStitchPlan({ designBounds: { widthMm: 20, heightMm: 20 }, stitchResult });
}

function parseMutatedPlan(mutator) {
  const plan = structuredClone(makePlan());
  mutator(plan);
  return JSON.stringify(plan);
}

test("creates an explicit v1 JSON interchange plan from engine output", () => {
  const plan = makePlan();
  assert.equal(plan.format, STITCH_PLAN_FORMAT);
  assert.equal(plan.formatVersion, STITCH_PLAN_FORMAT_VERSION);
  assert.equal(plan.units, "mm");
  assert.equal(plan.stitchCount, plan.stitches.length - 1);
  assert.deepEqual(plan.designBounds, { widthMm: 20, heightMm: 20 });
});

test("export/import round trip preserves validated plan data", () => {
  const plan = makePlan();
  const text = exportStitchPlanText(plan);
  const imported = importStitchPlanText(text);
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.value, plan);
});

test("export rejects malformed plans instead of serializing them", () => {
  const plan = makePlan();
  plan.unreviewed = true;
  assert.throws(() => exportStitchPlanText(plan), /Cannot export invalid stitch plan/u);
});

test("import rejects malformed JSON", () => {
  const result = importStitchPlanText("{broken");
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "INVALID_JSON");
});

test("import rejects text larger than the configured byte limit", () => {
  const result = importStitchPlanText(" ".repeat(20), { maxBytes: 10 });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "FILE_TOO_LARGE");
});

test("export rejects output larger than the configured byte limit", () => {
  assert.throws(() => exportStitchPlanText(makePlan(), { maxBytes: 10 }), /safety limit/u);
});

test("import rejects unsupported format versions without attempting migration", () => {
  const result = importStitchPlanText(parseMutatedPlan((plan) => { plan.formatVersion = 2; }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "UNSUPPORTED_FORMAT_VERSION"));
});

test("import rejects unknown fields", () => {
  const result = importStitchPlanText(parseMutatedPlan((plan) => { plan.machineReady = true; }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "UNKNOWN_FIELD"));
});

test("import rejects units other than millimetres", () => {
  const result = importStitchPlanText(parseMutatedPlan((plan) => { plan.units = "in"; }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "UNSUPPORTED_UNITS"));
});

test("import rejects coordinates outside declared design bounds", () => {
  const result = importStitchPlanText(parseMutatedPlan((plan) => { plan.stitches[1].xMm = 21; }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "OUT_OF_BOUNDS"));
});

test("import rejects inconsistent move counts", () => {
  const result = importStitchPlanText(parseMutatedPlan((plan) => { plan.stitchCount += 1; }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "COUNT_MISMATCH"));
});

test("import rejects inconsistent declared total length", () => {
  const result = importStitchPlanText(parseMutatedPlan((plan) => { plan.totalLengthMm += 1; }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "LENGTH_MISMATCH"));
});

test("import rejects any move longer than the declared maximum", () => {
  const result = importStitchPlanText(parseMutatedPlan((plan) => {
    plan.maxStitchLengthMm = 1;
  }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "STITCH_TOO_LONG"));
});

test("import rejects consecutive duplicate needle positions", () => {
  const result = importStitchPlanText(parseMutatedPlan((plan) => {
    plan.stitches[1] = { ...plan.stitches[0] };
    plan.totalLengthMm = plan.stitches.slice(1).reduce((sum, point, index) => {
      const previous = plan.stitches[index];
      return sum + Math.hypot(point.xMm - previous.xMm, point.yMm - previous.yMm);
    }, 0);
  }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "ZERO_LENGTH_MOVE"));
});

test("createStitchPlan does not mutate engine output", () => {
  const stitchResult = generateRunningStitches([
    { xMm: 0, yMm: 0 },
    { xMm: 5, yMm: 0 },
  ], { widthMm: 10, heightMm: 10, maxStitchLengthMm: 2 });
  const before = structuredClone(stitchResult);
  createStitchPlan({ designBounds: { widthMm: 10, heightMm: 10 }, stitchResult });
  assert.deepEqual(stitchResult, before);
});

test("rejects a stitch result with an unexpected shape", () => {
  const stitchResult = generateRunningStitches([
    { xMm: 0, yMm: 0 },
    { xMm: 5, yMm: 0 },
  ], { widthMm: 10, heightMm: 10, maxStitchLengthMm: 2 });
  stitchResult.extra = true;
  assert.throws(() => createStitchPlan({ designBounds: { widthMm: 10, heightMm: 10 }, stitchResult }), /unexpected shape/u);
});
