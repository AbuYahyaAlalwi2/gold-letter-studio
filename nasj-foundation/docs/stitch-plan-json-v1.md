# NASJ stitch-plan JSON — format version 1

## Purpose

This is a bounded, application-level interchange representation for needle positions produced by the current NASJ running-stitch engine. It is not a machine embroidery format and does not claim compatibility with DST, PES, EXP, JEF, or any vendor-specific format.

## Required object shape

The JSON root must contain exactly these fields; unknown or missing fields are rejected:

| Field | Type | Contract |
|---|---|---|
| `format` | string | Must equal `nasj-stitch-plan` |
| `formatVersion` | integer | Must equal `1`; no automatic version migration |
| `units` | string | Must equal `mm` |
| `designBounds` | object | Exactly `widthMm` and `heightMm`; both finite and positive, each no greater than 5000 mm |
| `stitches` | array | From 2 to 100001 positions, each with exactly finite numeric `xMm` and `yMm` fields |
| `stitchCount` | integer | From 1 to 100000 and equal to `stitches.length - 1` |
| `totalLengthMm` | number | Finite, positive, and consistent with the sum of segment lengths within numeric tolerance |
| `maxStitchLengthMm` | number | Finite and positive; no segment may exceed it beyond numeric tolerance |

Every position must lie within `designBounds`. Consecutive duplicate positions are rejected. The default import/export text limit is 8 MiB and can be lowered by the caller. Import parses JSON as data only; it never evaluates code or silently upgrades a format version.

## API

- `createStitchPlan({ designBounds, stitchResult })` validates engine output and returns a normalized plan.
- `exportStitchPlanText(plan, { maxBytes })` validates and serializes a plan to JSON text.
- `importStitchPlanText(text, { maxBytes })` returns `{ ok: true, value }` or `{ ok: false, errors }`.

## Compatibility and safety

Version 1 is a new format, not a revision of the project document schema. Future incompatible changes must use a new `formatVersion`, document a migration strategy, and add fixtures and tests for this version before accepting older plans. Until then, unknown versions are rejected.

## Known limitations

The format contains only a single ordered list of needle positions. It has no thread-color sequence, jump/trim commands, machine settings, stitch types, object semantics, hoop origin convention beyond the stated coordinate bounds, or vendor-specific metadata. Do not send this JSON directly to an embroidery machine.
