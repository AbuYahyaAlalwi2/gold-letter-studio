# NASJ stitch sequence — format version 1

## Purpose

This module combines existing `nasj-stitch-plan` v1 plans into a deterministic, UI-independent sequence of thread blocks and preview events. It is a simulation timeline for application use, **not** a machine command stream or a machine-ready file.

## Contract

`createStitchSequence({ designBounds, blocks })` accepts exactly two top-level input fields. The normalized output has exactly:

- `format`: `nasj-stitch-sequence`
- `formatVersion`: `1`
- `units`: `mm`
- `designBounds`: the existing strict design-bounds contract
- `blocks`: 1–256 ordered blocks

Each block contains exactly `id`, `thread`, and `stitchPlan`. Block IDs and thread IDs are unique identifiers of up to 64 ASCII letters, digits, dots, underscores, or hyphens. A thread has exactly `id`, `name`, and `hex`; the color must be `#RRGGBB`. Reusing a thread ID with different name/color metadata is rejected. Thread names are limited to 80 characters.

Every embedded plan is validated using the existing stitch-plan JSON v1 contract. All plans must declare exactly the same design bounds as the sequence. The aggregate stitched move count is limited to 100,000. Unknown fields and unsupported sequence versions are rejected; there is no implicit migration.

## Simulation events

`simulateStitchSequence(sequence)` revalidates the sequence and returns a deterministic timeline:

- `thread-change`: the selected thread changes; the first block also produces this event because the starting thread is unknown.
- `start`: the first preview position; it does not represent a physical machine movement.
- `stitch`: a stitched move between two positions from an embedded plan.
- `jump`: an unstitched travel move between the previous block's endpoint and the next block's start when those positions differ.

The summary includes block/thread-change/stitch/jump counts and stitched, jump, and total travel lengths. Adjacent blocks using the same thread ID do not trigger a redundant thread-change event. A jump is included in travel length but not stitched length.

## Safety and limits

- Inputs are normalized into defensive copies; source objects are not intentionally mutated.
- Stitch geometry and bounds are delegated to the strict existing plan validator.
- This module does not model trim commands, needle-up/down states, acceleration, hoop offsets, thread tension, color-specific machine behavior, or actual rendered playback.
- Thread changes and jumps are abstract preview events. They must not be exported to a machine without a separately specified and tested machine adapter.
- Sequence v1 is new and separate from project document schema v2 and stitch-plan format v1. Future incompatible changes require a new sequence version and frozen v1 regression fixtures/tests.
