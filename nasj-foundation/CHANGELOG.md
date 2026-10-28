# Changelog

## 0.6.0 — Foundation Round 06

- Added strict validation for the existing logical simulation timeline v1 before playback.
- Added a deterministic UI-independent playback cursor with next, previous, seek, reset, event progress, stitch progress, active thread, and logical preview position.
- Added defensive input/output snapshots and boundary/error regression tests.
- Kept project schema v2, stitch-plan JSON v1, thread-sequence v1, and simulation-timeline v1 unchanged; no migration was required.
- No visual playback UI, real-time scheduler, physical needle state, machine command stream, machine-format support, or GitHub upload was added.

## 0.5.0 — Foundation Round 05

- Added a strict, UI-independent `nasj-stitch-sequence` v1 model for ordered stitch-plan blocks and thread metadata.
- Added deterministic preview timeline events for thread changes, stitched moves, and unstitched jumps.
- Added aggregate safety limits and consistency checks for thread IDs, colors, bounds, and embedded plans.
- Added sequence and simulation regression tests and documented the event contract.
- Kept project document schema at v2 and stitch-plan format at v1; no prior-format migration was required.
- No visual playback UI, trim/needle-state simulation, machine command stream, machine-format support, or GitHub upload was added.

## 0.4.0 — Foundation Round 04

- Added strict `nasj-stitch-plan` JSON interchange format version 1.
- Added validated creation from the existing running-stitch engine result.
- Added bounded JSON export/import with exact-key, unit, bounds, move-count, path-length, and maximum-stitch-length checks.
- Added compatibility and malformed-input tests.
- Kept project document schema at v2; no project migration was required.
- No DST/PES or other machine-format support, UI, simulation, or GitHub upload was added.

## 0.3.0 — Foundation Round 03

- Added strict millimetre geometry contracts and polyline validation.
- Added deterministic running-stitch subdivision with a hard generated-move limit.
- Added geometry and stitch-engine tests.
- Kept project schema at v2; no document migration was required.
- No UI, simulation, machine-format import/export, or GitHub upload was added.

## 0.2.0 — Foundation Round 02

- Added schema v2 field `metadata.lastSavedAt`.
- Added documented migration `001-to-002` from the previous schema.
- Added bounded UTF-8 JSON parsing and file loading.
- Added atomic file save using a temporary file in the target directory.
- Added regression tests for legacy migration, persistence, malformed files, size limits, and safe failure behavior.
- No UI, stitch engine, import/export format converter, or GitHub upload was added.
