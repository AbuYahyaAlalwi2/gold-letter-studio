# NASJ playback controller — contract v1

## Purpose

`createPlaybackController(timeline)` provides a deterministic, UI-independent cursor over a `nasj-simulation-timeline` v1 value produced by `simulateStitchSequence()`. It applies one semantic preview event at a time and exposes the resulting logical preview frame. It does not schedule time or issue machine commands.

## Cursor semantics

- The initial `eventIndex` is `-1`, meaning no event has been applied.
- `next()` applies the next event. At the last event it is a no-op.
- `previous()` undoes one applied event. Before event zero it is a no-op.
- `seek(index)` moves to an exact event index in the inclusive range `-1` to `events.length - 1`; invalid, fractional, or out-of-range values throw `RangeError`.
- `reset()` returns to `eventIndex: -1`.
- `getState()` returns a defensive snapshot. Mutating it cannot alter controller state.
- The controller snapshots the supplied timeline at construction, so later mutation of the caller's timeline does not alter playback.

## Frame fields

- `progress`: `appliedEventCount / eventCount`; event-based, not time-based.
- `stitchProgress`: `appliedStitchCount / totalStitchCount`; zero when there are no stitch events.
- `activeThread`: last applied `thread-change` event's thread, or `null` before one is applied.
- `positionMm`: last applied `start`, `stitch`, or `jump` position, or `null` before a position is established.
- `appliedStitchCount`, `appliedJumpCount`, `appliedThreadChangeCount`: counters for applied events only.
- `canStepBackward`, `canStepForward`, `isComplete`: cursor-boundary indicators.
- `currentEvent`: defensive copy of the currently selected event, or `null` before event zero.

`positionMm` is a logical preview coordinate. `activeThread` is a selected thread label, not a verified physical thread state. No needle-up/down state is represented.

## Validation and limits

- Only `nasj-simulation-timeline` version 1 in millimetres is accepted.
- Event objects and summary objects use exact-key validation; unknown fields are rejected.
- Event IDs, colors, points, lengths, event counts, summary counts, and aggregate lengths are checked before controller creation.
- The maximum event count is derived from the existing limits of 100,000 stitched moves and 256 sequence blocks.
- The controller clones the timeline once and stores compact state snapshots for reverse stepping. Memory use therefore grows with the event count.

## Compatibility

This module does not change project document schema v2, stitch-plan JSON v1, thread-sequence v1, or simulation-timeline v1. No migration is needed for prior saved project files. If the timeline event contract changes incompatibly, introduce a new timeline format version and keep v1 regression fixtures/tests; do not silently reinterpret old events.
