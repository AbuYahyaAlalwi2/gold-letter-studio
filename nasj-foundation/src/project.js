/**
 * NASJ project data contract.
 * Schema version 2 adds an explicit lastSavedAt timestamp. This module has no
 * filesystem, UI, rendering, or embroidery-engine dependencies.
 */

export const PROJECT_FORMAT = "nasj-embroidery-project";
export const PROJECT_SCHEMA_VERSION = 2;
export const LEGACY_PROJECT_SCHEMA_VERSION = 1;
export const DEFAULT_MAX_PROJECT_BYTES = 1024 * 1024;

const MAX_DIMENSION_MM = 5000;
const MAX_PALETTE_ITEMS = 256;
const ID_MAX_LENGTH = 128;
const NAME_MAX_LENGTH = 120;
const COLOR_NAME_MAX_LENGTH = 80;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addError(errors, path, code, message) {
  errors.push({ path, code, message });
}

function checkKeys(value, expectedKeys, path, errors) {
  if (!isPlainObject(value)) {
    addError(errors, path, "INVALID_TYPE", "Expected an object.");
    return false;
  }

  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      addError(errors, path ? `${path}.${key}` : key, "MISSING_FIELD", "Required field is missing.");
    }
  }

  const allowed = new Set(expectedKeys);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) {
      const displayKey = typeof key === "string" ? key : String(key);
      addError(errors, path ? `${path}.${displayKey}` : displayKey, "UNKNOWN_FIELD", "Unknown fields are not allowed in this schema version.");
    }
  }
  return true;
}

function checkText(value, path, errors, { maxLength, allowEmpty = false } = {}) {
  if (typeof value !== "string") {
    addError(errors, path, "INVALID_TYPE", "Expected a string.");
    return false;
  }
  if ((!allowEmpty && value.trim().length === 0) || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) {
    addError(errors, path, "INVALID_VALUE", `Expected a printable string${allowEmpty ? "" : " that is not empty"} of at most ${maxLength} characters.`);
    return false;
  }
  return true;
}

function checkDimension(value, path, errors) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addError(errors, path, "INVALID_TYPE", "Expected a finite number in millimetres.");
    return false;
  }
  if (value <= 0 || value > MAX_DIMENSION_MM) {
    addError(errors, path, "INVALID_VALUE", `Dimension must be greater than 0 and no more than ${MAX_DIMENSION_MM} mm.`);
    return false;
  }
  return true;
}

function checkTimestamp(value, path, errors) {
  if (typeof value !== "string") {
    addError(errors, path, "INVALID_TYPE", "Expected a UTC ISO-8601 timestamp.");
    return false;
  }
  try {
    if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
      throw new Error("not canonical ISO timestamp");
    }
    return true;
  } catch {
    addError(errors, path, "INVALID_VALUE", "Timestamp must be canonical UTC ISO-8601, for example 2026-01-02T03:04:05.000Z.");
    return false;
  }
}

function validateProjectAtVersion(input, expectedVersion) {
  const errors = [];
  if (!checkKeys(input, ["format", "schemaVersion", "metadata", "design"], "", errors)) {
    return { ok: false, errors };
  }

  if (input.format !== PROJECT_FORMAT) {
    addError(errors, "format", "INVALID_VALUE", `Expected format "${PROJECT_FORMAT}".`);
  }

  if (!Number.isInteger(input.schemaVersion)) {
    addError(errors, "schemaVersion", "INVALID_TYPE", "Expected an integer schema version.");
  } else if (input.schemaVersion !== expectedVersion) {
    addError(errors, "schemaVersion", "UNSUPPORTED_SCHEMA_VERSION", `Schema version ${input.schemaVersion} is not accepted by this validator; expected version ${expectedVersion}.`);
  }

  const metadataKeys = expectedVersion === LEGACY_PROJECT_SCHEMA_VERSION
    ? ["id", "name", "createdAt", "updatedAt"]
    : ["id", "name", "createdAt", "updatedAt", "lastSavedAt"];
  const metadataOk = checkKeys(input.metadata, metadataKeys, "metadata", errors);
  if (metadataOk) {
    checkText(input.metadata.id, "metadata.id", errors, { maxLength: ID_MAX_LENGTH });
    checkText(input.metadata.name, "metadata.name", errors, { maxLength: NAME_MAX_LENGTH });
    const createdAtOk = checkTimestamp(input.metadata.createdAt, "metadata.createdAt", errors);
    const updatedAtOk = checkTimestamp(input.metadata.updatedAt, "metadata.updatedAt", errors);
    if (expectedVersion === PROJECT_SCHEMA_VERSION) {
      checkTimestamp(input.metadata.lastSavedAt, "metadata.lastSavedAt", errors);
    }
    if (createdAtOk && updatedAtOk && Date.parse(input.metadata.updatedAt) < Date.parse(input.metadata.createdAt)) {
      addError(errors, "metadata.updatedAt", "INVALID_VALUE", "updatedAt must not be earlier than createdAt.");
    }
  }

  const designOk = checkKeys(input.design, ["widthMm", "heightMm", "hoop", "palette"], "design", errors);
  if (designOk) {
    checkDimension(input.design.widthMm, "design.widthMm", errors);
    checkDimension(input.design.heightMm, "design.heightMm", errors);

    const hoopOk = checkKeys(input.design.hoop, ["widthMm", "heightMm"], "design.hoop", errors);
    if (hoopOk) {
      checkDimension(input.design.hoop.widthMm, "design.hoop.widthMm", errors);
      checkDimension(input.design.hoop.heightMm, "design.hoop.heightMm", errors);
    }

    if (!Array.isArray(input.design.palette)) {
      addError(errors, "design.palette", "INVALID_TYPE", "Expected an array of thread palette entries.");
    } else if (input.design.palette.length > MAX_PALETTE_ITEMS) {
      addError(errors, "design.palette", "INVALID_VALUE", `Palette cannot contain more than ${MAX_PALETTE_ITEMS} entries.`);
    } else {
      const seenIds = new Set();
      input.design.palette.forEach((thread, index) => {
        const path = `design.palette[${index}]`;
        if (!checkKeys(thread, ["id", "name", "colorHex"], path, errors)) return;

        const idOk = checkText(thread.id, `${path}.id`, errors, { maxLength: ID_MAX_LENGTH });
        checkText(thread.name, `${path}.name`, errors, { maxLength: COLOR_NAME_MAX_LENGTH });
        if (typeof thread.colorHex !== "string" || !/^#[0-9a-fA-F]{6}$/u.test(thread.colorHex)) {
          addError(errors, `${path}.colorHex`, "INVALID_VALUE", "Color must be a six-digit hexadecimal value such as #1A2B3C.");
        }
        if (idOk) {
          if (seenIds.has(thread.id)) {
            addError(errors, `${path}.id`, "DUPLICATE_ID", "Thread palette IDs must be unique within a project.");
          }
          seenIds.add(thread.id);
        }
      });
    }
  }

  return errors.length === 0 ? { ok: true, value: input } : { ok: false, errors };
}

/** Validate a current schema-version-2 in-memory project without mutating it. */
export function validateProject(input) {
  return validateProjectAtVersion(input, PROJECT_SCHEMA_VERSION);
}

/** Validate the exact schema-version-1 shape for migration purposes only. */
export function validateProjectV1(input) {
  return validateProjectAtVersion(input, LEGACY_PROJECT_SCHEMA_VERSION);
}

/** Validate serialized current-version JSON without attempting migration. */
export function validateProjectText(text, { maxBytes = DEFAULT_MAX_PROJECT_BYTES } = {}) {
  if (typeof text !== "string") {
    return { ok: false, errors: [{ path: "$", code: "INVALID_TYPE", message: "Project contents must be text." }] };
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }

  const byteLength = new TextEncoder().encode(text).byteLength;
  if (byteLength > maxBytes) {
    return {
      ok: false,
      errors: [{ path: "$", code: "FILE_TOO_LARGE", message: `Project text exceeds the ${maxBytes}-byte safety limit.` }],
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ path: "$", code: "INVALID_JSON", message: "Project contents are not valid JSON." }] };
  }
  return validateProject(parsed);
}

/** Build a minimal valid version-2 project. */
export function createEmptyProject({
  id,
  name = "Untitled design",
  now = new Date().toISOString(),
  widthMm = 100,
  heightMm = 100,
  hoopWidthMm = 100,
  hoopHeightMm = 100,
} = {}) {
  const project = {
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    metadata: { id, name, createdAt: now, updatedAt: now, lastSavedAt: now },
    design: {
      widthMm,
      heightMm,
      hoop: { widthMm: hoopWidthMm, heightMm: hoopHeightMm },
      palette: [],
    },
  };
  const result = validateProject(project);
  if (!result.ok) {
    const details = result.errors.map(({ path, code }) => `${path}: ${code}`).join("; ");
    throw new TypeError(`Cannot create invalid NASJ project: ${details}`);
  }
  return project;
}
