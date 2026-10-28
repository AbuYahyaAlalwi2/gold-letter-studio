/** Safe JSON document persistence for NASJ projects (Node.js 20+). */
import { open, rename, unlink } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_MAX_PROJECT_BYTES, validateProject } from "./project.js";
import { migrateProject } from "./migrations.js";

const READ_CHUNK_BYTES = 64 * 1024;

function invalidResult(code, message) {
  return { ok: false, errors: [{ path: "$", code, message }] };
}

function assertMaxBytes(maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }
}

function assertPath(filePath) {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new TypeError("filePath must be a non-empty path string.");
  }
  return resolve(filePath);
}

function validationMessage(errors) {
  return errors.map(({ path, code }) => `${path || "$"}: ${code}`).join("; ");
}

/** Parse JSON, validate its exact known schema, and migrate supported v1 files in memory. */
export function parseProjectText(text, { maxBytes = DEFAULT_MAX_PROJECT_BYTES } = {}) {
  if (typeof text !== "string") return invalidResult("INVALID_TYPE", "Project contents must be text.");
  assertMaxBytes(maxBytes);
  const byteLength = new TextEncoder().encode(text).byteLength;
  if (byteLength > maxBytes) {
    return invalidResult("FILE_TOO_LARGE", `Project text exceeds the ${maxBytes}-byte safety limit.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalidResult("INVALID_JSON", "Project contents are not valid JSON.");
  }
  return migrateProject(parsed);
}

/**
 * Atomically save a valid schema-v2 project. The caller's object is not mutated.
 * A successful save updates lastSavedAt in the persisted copy only.
 */
export async function saveProjectFile(filePath, project, {
  now = new Date().toISOString(),
  maxBytes = DEFAULT_MAX_PROJECT_BYTES,
} = {}) {
  assertMaxBytes(maxBytes);
  const targetPath = assertPath(filePath);
  const validation = validateProject(project);
  if (!validation.ok) {
    throw new TypeError(`Cannot save invalid NASJ project: ${validationMessage(validation.errors)}`);
  }

  const savedProject = {
    ...structuredClone(project),
    metadata: { ...structuredClone(project.metadata), lastSavedAt: now },
  };
  const savedValidation = validateProject(savedProject);
  if (!savedValidation.ok) {
    throw new TypeError(`Cannot save invalid NASJ project: ${validationMessage(savedValidation.errors)}`);
  }

  const text = `${JSON.stringify(savedProject, null, 2)}\n`;
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > maxBytes) {
    throw new RangeError(`Project exceeds the ${maxBytes}-byte safety limit.`);
  }

  const tempPath = resolve(dirname(targetPath), `.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(tempPath, "wx", 0o600);
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(tempPath, targetPath);
  } catch (error) {
    if (handle) {
      try { await handle.close(); } catch { /* preserve the original failure */ }
    }
    try { await unlink(tempPath); } catch { /* temp may not have been created or may already be renamed */ }
    throw error;
  }

  return { ok: true, path: targetPath, bytes, project: savedProject };
}

async function readUtf8Bounded(filePath, maxBytes) {
  const handle = await open(filePath, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new TypeError("Project path must refer to a regular file.");
    if (stats.size > maxBytes) return { error: invalidResult("FILE_TOO_LARGE", `Project file exceeds the ${maxBytes}-byte safety limit.`) };

    const chunks = [];
    let total = 0;
    while (true) {
      const remaining = maxBytes - total;
      const chunkLength = remaining >= READ_CHUNK_BYTES ? READ_CHUNK_BYTES : remaining + 1;
      const buffer = Buffer.allocUnsafe(Math.max(1, chunkLength));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > maxBytes) {
        return { error: invalidResult("FILE_TOO_LARGE", `Project file exceeds the ${maxBytes}-byte safety limit.`) };
      }
      chunks.push(buffer.subarray(0, bytesRead));
    }

    const bytes = Buffer.concat(chunks, total);
    try {
      return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    } catch {
      return { error: invalidResult("INVALID_ENCODING", "Project file must use valid UTF-8 encoding.") };
    }
  } finally {
    await handle.close();
  }
}

/** Load and validate a project; v1 migration is in memory and never rewrites the source file. */
export async function loadProjectFile(filePath, { maxBytes = DEFAULT_MAX_PROJECT_BYTES } = {}) {
  assertMaxBytes(maxBytes);
  const targetPath = assertPath(filePath);
  const readResult = await readUtf8Bounded(targetPath, maxBytes);
  if (readResult.error) return readResult.error;
  return parseProjectText(readResult.text, { maxBytes });
}
