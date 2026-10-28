/** Explicit, pure schema migrations. No input object is mutated. */
import {
  LEGACY_PROJECT_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  validateProject,
  validateProjectV1,
} from "./project.js";

export const MIGRATION_V1_TO_V2 = "001-to-002";

/**
 * Validate a project and migrate supported legacy versions in memory.
 * Version 1 had no lastSavedAt field, so the documented fallback is updatedAt.
 * The caller decides whether/when to persist the migrated document.
 */
export function migrateProject(input) {
  if (input && typeof input === "object" && input.schemaVersion === LEGACY_PROJECT_SCHEMA_VERSION) {
    const legacy = validateProjectV1(input);
    if (!legacy.ok) return legacy;

    const migrated = {
      ...structuredClone(input),
      schemaVersion: PROJECT_SCHEMA_VERSION,
      metadata: {
        ...structuredClone(input.metadata),
        lastSavedAt: input.metadata.updatedAt,
      },
    };
    const current = validateProject(migrated);
    if (!current.ok) return current;
    return {
      ok: true,
      project: migrated,
      migratedFrom: LEGACY_PROJECT_SCHEMA_VERSION,
      migrationId: MIGRATION_V1_TO_V2,
    };
  }

  const current = validateProject(input);
  if (!current.ok) return current;
  return { ok: true, project: input, migratedFrom: null, migrationId: null };
}
