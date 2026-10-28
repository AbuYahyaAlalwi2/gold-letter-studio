# Round 03 — Geometry and initial running-stitch contract

## Scope

This round adds two UI-independent modules:

- `src/geometry.js`: millimetre coordinate contracts, design bounds, Euclidean distance, and strict polyline validation.
- `src/stitch-engine.js`: deterministic running-stitch subdivision for one continuous polyline.

The project JSON schema remains at v2. No project-file fields were added, so no schema migration is needed in this round.

## Geometry contract

- Coordinates are `{ xMm, yMm }` in millimetres.
- Design bounds are `{ widthMm, heightMm }`, each finite, greater than zero, and at most 5000 mm.
- Points must be inside the inclusive rectangle `[0, widthMm] × [0, heightMm]`.
- A polyline must have 2–10,000 points.
- Point and bounds objects reject unknown keys.
- Consecutive duplicate points are rejected rather than silently producing zero-length moves.

## Running-stitch contract

`generateRunningStitches(points, options)` returns:

- `stitches`: ordered needle positions including the start position;
- `stitchCount`: number of moves, therefore `stitches.length - 1`;
- `totalLengthMm`: length of the original polyline;
- `maxStitchLengthMm`: requested upper bound.

Each source segment is split into `ceil(segmentLength / maxStitchLengthMm)` equal moves. Authored vertices are preserved exactly. The default maximum stitch length is 4 mm and the hard output ceiling is 100,000 moves. The ceiling is checked before allocating the output array.

## Verification

Run `npm run check`. Tests cover Euclidean distance, strict bounds, invalid coordinates, path splitting, endpoint preservation, input immutability, maximum move length, and the output safety limit.

## Limits and risks

This is an initial mathematical primitive, not a complete embroidery engine. It does not generate satin columns, fills, underlay, trims, jumps, color changes, pull compensation, machine-specific commands, or DST/PES files. It does not guarantee stitch quality or machine safety. No GUI, simulation, import/export converter, or GitHub push was added. A valid geometric path is not proof of a production-ready embroidery design.
