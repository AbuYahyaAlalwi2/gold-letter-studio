import test from "node:test";
import assert from "node:assert/strict";
import { distanceMm, validateDesignBounds, validatePolyline } from "../src/geometry.js";

const bounds = { widthMm: 20, heightMm: 10 };

test("distanceMm computes Euclidean distance in millimetres", () => {
  assert.equal(distanceMm({ xMm: 0, yMm: 0 }, { xMm: 3, yMm: 4 }), 5);
  assert.throws(() => distanceMm({ xMm: -1e308, yMm: 0 }, { xMm: 1e308, yMm: 0 }), /finite numeric range/);
});

test("validateDesignBounds returns a fresh, valid rectangle", () => {
  const result = validateDesignBounds(bounds);
  assert.deepEqual(result, bounds);
  assert.notEqual(result, bounds);
  assert.throws(() => validateDesignBounds({ widthMm: 20, heightMm: 10, unit: "mm" }), /only widthMm and heightMm/);
  assert.throws(() => validateDesignBounds({ widthMm: Infinity, heightMm: 10 }), /finite number/);
});

test("validatePolyline copies valid points and accepts boundary coordinates", () => {
  const source = [{ xMm: 0, yMm: 0 }, { xMm: 20, yMm: 10 }];
  const result = validatePolyline(source, bounds);
  assert.deepEqual(result, source);
  assert.notEqual(result, source);
  assert.notEqual(result[0], source[0]);
});

test("validatePolyline rejects invalid point counts, fields, coordinates and duplicate neighbours", () => {
  assert.throws(() => validatePolyline([], bounds), /at least two points/);
  assert.throws(() => validatePolyline([{ xMm: 1, yMm: 1 }], bounds), /at least two points/);
  assert.throws(() => validatePolyline([{ xMm: 1, yMm: 1 }, { xMm: 2, yMm: 2, z: 0 }], bounds), /only xMm and yMm/);
  assert.throws(() => validatePolyline([{ xMm: -1, yMm: 1 }, { xMm: 2, yMm: 2 }], bounds), /outside the design bounds/);
  assert.throws(() => validatePolyline([{ xMm: 1, yMm: 1 }, { xMm: 1, yMm: 1 }], bounds), /zero-length segments/);
  assert.throws(() => validatePolyline([{ xMm: NaN, yMm: 1 }, { xMm: 2, yMm: 2 }], bounds), /finite numbers/);
});
