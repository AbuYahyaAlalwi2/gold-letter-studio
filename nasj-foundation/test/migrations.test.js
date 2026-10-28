import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { migrateProject, MIGRATION_V1_TO_V2 } from "../src/migrations.js";
import { PROJECT_SCHEMA_VERSION } from "../src/project.js";

const fixturePath = fileURLToPath(new URL("./fixtures/project-v1.json", import.meta.url));

test("migrates the frozen version-1 fixture to version 2", async () => {
  const originalText = await readFile(fixturePath, "utf8");
  const legacy = JSON.parse(originalText);
  const before = structuredClone(legacy);
  const result = migrateProject(legacy);

  assert.equal(result.ok, true);
  assert.equal(result.migratedFrom, 1);
  assert.equal(result.migrationId, MIGRATION_V1_TO_V2);
  assert.equal(result.project.schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.equal(result.project.metadata.lastSavedAt, "2026-10-23T12:30:00.000Z");
  assert.deepEqual(legacy, before, "migration must not mutate the source object");
  assert.equal(JSON.parse(originalText).schemaVersion, 1, "fixture remains an immutable v1 regression case");
});

test("does not migrate malformed legacy documents", () => {
  const result = migrateProject({
    format: "nasj-embroidery-project",
    schemaVersion: 1,
    metadata: { id: "x" },
    design: {},
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("rejects future schema versions instead of guessing a migration", () => {
  const result = migrateProject({ format: "nasj-embroidery-project", schemaVersion: 99 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "UNSUPPORTED_SCHEMA_VERSION"));
});

test("current version is validated but not marked as migrated", async () => {
  const legacy = JSON.parse(await readFile(fixturePath, "utf8"));
  const migrated = migrateProject(legacy);
  const current = migrateProject(migrated.project);
  assert.equal(current.ok, true);
  assert.equal(current.migratedFrom, null);
  assert.equal(current.migrationId, null);
});
