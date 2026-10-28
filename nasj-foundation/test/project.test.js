import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyProject,
  LEGACY_PROJECT_SCHEMA_VERSION,
  PROJECT_FORMAT,
  PROJECT_SCHEMA_VERSION,
  validateProject,
  validateProjectText,
  validateProjectV1,
} from "../src/project.js";

const NOW = "2026-10-23T12:00:00.000Z";

function validProject(overrides = {}) {
  return {
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    metadata: {
      id: "nasj-test-project",
      name: "Sample embroidery",
      createdAt: NOW,
      updatedAt: NOW,
      lastSavedAt: NOW,
    },
    design: {
      widthMm: 80,
      heightMm: 60,
      hoop: { widthMm: 100, heightMm: 100 },
      palette: [{ id: "thread-black", name: "Black", colorHex: "#000000" }],
    },
    ...overrides,
  };
}

function validV1Project() {
  const project = validProject({ schemaVersion: LEGACY_PROJECT_SCHEMA_VERSION });
  delete project.metadata.lastSavedAt;
  return project;
}

function hasError(result, code, path) {
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === code && (path === undefined || error.path === path)), JSON.stringify(result.errors));
}

test("accepts a valid version-2 project without mutating it", () => {
  const project = validProject();
  const result = validateProject(project);
  assert.equal(result.ok, true);
  assert.equal(result.value, project);
});

test("creates a minimal valid version-2 project", () => {
  const project = createEmptyProject({ id: "p-1", name: "First", now: NOW });
  assert.equal(validateProject(project).ok, true);
  assert.deepEqual(project.design.palette, []);
  assert.equal(project.metadata.lastSavedAt, NOW);
});

test("accepts the exact legacy version-1 contract only through its legacy validator", () => {
  const project = validV1Project();
  assert.equal(validateProjectV1(project).ok, true);
  hasError(validateProject(project), "UNSUPPORTED_SCHEMA_VERSION", "schemaVersion");
});

test("rejects a non-object root", () => {
  hasError(validateProject(null), "INVALID_TYPE", "");
  hasError(validateProject([]), "INVALID_TYPE", "");
});

test("rejects missing and unknown fields", () => {
  const missing = validProject();
  delete missing.metadata.name;
  hasError(validateProject(missing), "MISSING_FIELD", "metadata.name");

  const unknown = validProject({ surprise: true });
  hasError(validateProject(unknown), "UNKNOWN_FIELD", "surprise");
});

test("rejects unsupported schema versions without attempting migration", () => {
  hasError(validateProject(validProject({ schemaVersion: 0 })), "UNSUPPORTED_SCHEMA_VERSION", "schemaVersion");
  hasError(validateProject(validProject({ schemaVersion: 1 })), "UNSUPPORTED_SCHEMA_VERSION", "schemaVersion");
  hasError(validateProject(validProject({ schemaVersion: 3 })), "UNSUPPORTED_SCHEMA_VERSION", "schemaVersion");
});

test("rejects non-finite, zero, negative, and over-limit dimensions", () => {
  for (const widthMm of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 5000.1]) {
    const result = validateProject(validProject({
      design: { ...validProject().design, widthMm },
    }));
    assert.equal(result.ok, false, `expected width ${String(widthMm)} to fail`);
  }
});

test("requires canonical UTC timestamps and ordered metadata dates", () => {
  const nonCanonical = validProject();
  nonCanonical.metadata.createdAt = "2026-10-23T12:00:00Z";
  hasError(validateProject(nonCanonical), "INVALID_VALUE", "metadata.createdAt");

  const reversed = validProject();
  reversed.metadata.updatedAt = "2026-10-22T12:00:00.000Z";
  hasError(validateProject(reversed), "INVALID_VALUE", "metadata.updatedAt");

  const invalidSaveTime = validProject();
  invalidSaveTime.metadata.lastSavedAt = "yesterday";
  hasError(validateProject(invalidSaveTime), "INVALID_VALUE", "metadata.lastSavedAt");
});

test("rejects duplicate palette IDs and malformed color values", () => {
  const duplicate = validProject();
  duplicate.design.palette.push({ id: "thread-black", name: "Again", colorHex: "#FFFFFF" });
  hasError(validateProject(duplicate), "DUPLICATE_ID", "design.palette[1].id");

  const badColor = validProject();
  badColor.design.palette[0].colorHex = "black";
  hasError(validateProject(badColor), "INVALID_VALUE", "design.palette[0].colorHex");
});

test("rejects unknown nested fields, including symbol keys", () => {
  const project = validProject();
  project.design.hoop.depth = 5;
  hasError(validateProject(project), "UNKNOWN_FIELD", "design.hoop.depth");

  const symbolProject = validProject();
  symbolProject[Symbol("unexpected")] = true;
  hasError(validateProject(symbolProject), "UNKNOWN_FIELD");
});

test("validates serialized current-version JSON and rejects malformed or legacy JSON", () => {
  assert.equal(validateProjectText(JSON.stringify(validProject())).ok, true);
  hasError(validateProjectText("{broken"), "INVALID_JSON", "$");
  hasError(validateProjectText(JSON.stringify(validV1Project())), "UNSUPPORTED_SCHEMA_VERSION", "schemaVersion");
});

test("enforces the byte limit before parsing", () => {
  hasError(validateProjectText("12345", { maxBytes: 4 }), "FILE_TOO_LARGE", "$");
  hasError(validateProjectText(42), "INVALID_TYPE", "$");
  assert.throws(() => validateProjectText("{}", { maxBytes: 0 }), /maxBytes/u);
});

test("constructor refuses invalid input", () => {
  assert.throws(() => createEmptyProject({ id: "", now: NOW }), /Cannot create invalid NASJ project/u);
});
