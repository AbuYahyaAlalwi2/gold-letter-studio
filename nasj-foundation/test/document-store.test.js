import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectFile, parseProjectText, saveProjectFile } from "../src/document-store.js";
import { createEmptyProject, PROJECT_SCHEMA_VERSION } from "../src/project.js";

const NOW = "2026-10-23T12:00:00.000Z";
const legacyFixturePath = fileURLToPath(new URL("./fixtures/project-v1.json", import.meta.url));

async function withTempDir(run) {
  const directory = await mkdtemp(join(tmpdir(), "nasj-document-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("saves atomically and reloads a valid current document", async () => {
  await withTempDir(async (directory) => {
    const filePath = join(directory, "sample.nasj.json");
    const project = createEmptyProject({ id: "save-test", name: "Save test", now: NOW });
    const result = await saveProjectFile(filePath, project, { now: "2026-10-24T10:00:00.000Z" });

    assert.equal(result.ok, true);
    assert.equal(result.project.metadata.lastSavedAt, "2026-10-24T10:00:00.000Z");
    assert.equal(project.metadata.lastSavedAt, NOW, "save must not mutate the caller's project");
    assert.equal(result.project.schemaVersion, PROJECT_SCHEMA_VERSION);

    const loaded = await loadProjectFile(filePath);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.migratedFrom, null);
    assert.deepEqual(loaded.project, result.project);
    assert.deepEqual(await readdir(directory), ["sample.nasj.json"], "temporary file must not remain after save");
  });
});

test("loads v1 by migrating in memory and leaves the source file unchanged", async () => {
  await withTempDir(async (directory) => {
    const filePath = join(directory, "legacy.nasj.json");
    const original = await readFile(legacyFixturePath, "utf8");
    await writeFile(filePath, original, "utf8");

    const loaded = await loadProjectFile(filePath);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.migratedFrom, 1);
    assert.equal(loaded.project.schemaVersion, 2);
    assert.equal(loaded.project.metadata.lastSavedAt, loaded.project.metadata.updatedAt);
    assert.equal(await readFile(filePath, "utf8"), original, "loading must not silently rewrite legacy data");
  });
});

test("parses v1 and v2 text but rejects malformed JSON and unsupported versions", async () => {
  const v1Text = await readFile(legacyFixturePath, "utf8");
  assert.equal(parseProjectText(v1Text).migratedFrom, 1);
  assert.equal(parseProjectText("{bad json").errors[0].code, "INVALID_JSON");
  assert.equal(parseProjectText(JSON.stringify({ schemaVersion: 50 })).ok, false);
  assert.equal(parseProjectText("too large", { maxBytes: 4 }).errors[0].code, "FILE_TOO_LARGE");
});

test("rejects oversized and invalid UTF-8 files before JSON parsing", async () => {
  await withTempDir(async (directory) => {
    const oversized = join(directory, "large.json");
    await writeFile(oversized, Buffer.alloc(20, 0x61));
    assert.equal((await loadProjectFile(oversized, { maxBytes: 10 })).errors[0].code, "FILE_TOO_LARGE");

    const invalidUtf8 = join(directory, "invalid-utf8.json");
    await writeFile(invalidUtf8, Buffer.from([0x7b, 0xff, 0x7d]));
    assert.equal((await loadProjectFile(invalidUtf8)).errors[0].code, "INVALID_ENCODING");
  });
});

test("does not overwrite an existing file when validation or size checks fail", async () => {
  await withTempDir(async (directory) => {
    const filePath = join(directory, "protected.json");
    await writeFile(filePath, "keep this", "utf8");
    const project = createEmptyProject({ id: "safe", now: NOW });

    await assert.rejects(saveProjectFile(filePath, { ...project, extra: true }, { now: NOW }), /Cannot save invalid/u);
    await assert.rejects(saveProjectFile(filePath, project, { now: NOW, maxBytes: 10 }), /safety limit/u);
    assert.equal(await readFile(filePath, "utf8"), "keep this");
    assert.deepEqual(await readdir(directory), ["protected.json"]);
  });
});

test("requires an existing regular file path for loading", async () => {
  await withTempDir(async (directory) => {
    await assert.rejects(loadProjectFile(join(directory, "missing.json")), { code: "ENOENT" });
    await assert.rejects(loadProjectFile(directory), /regular file/u);
  });
});
