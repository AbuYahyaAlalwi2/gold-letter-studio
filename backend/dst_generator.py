"""
DST File Generator using pyembroidery.

Converts an array of stitch coordinates (x, y, color) into a binary .DST
embroidery file.

Key operations:
  - Scales coordinates to the 0.1 mm unit required by the DST format.
  - Adds JUMP commands between separate objects (non-contiguous stitch groups).
  - Adds TRIM and STOP (color change) commands at the end of each color block.
  - Generates a downloadable .DST file as bytes.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import List, Optional

import pyembroidery


# ── Data structures ──────────────────────────────────────────────────────────

@dataclass
class StitchPoint:
    """A single stitch coordinate in *millimetres*."""
    x: float
    y: float


@dataclass
class StitchObject:
    """A contiguous group of stitches sharing one thread colour."""
    color: str  # hex colour, e.g. "#D4AF37"
    color_index: int = 1  # 1-based thread palette index
    points: List[StitchPoint] = field(default_factory=list)


# ── Colour helpers ───────────────────────────────────────────────────────────

def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert '#RRGGBB' to (r, g, b) ints."""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


# ── Core conversion ─────────────────────────────────────────────────────────

MM_TO_DST = 10.0  # 1 mm = 10 DST units (0.1 mm each)

# Minimum distance (mm) between consecutive objects to trigger a TRIM command
TRIM_DISTANCE_MM = 5.0


def _scale(value_mm: float) -> float:
    """Scale a millimetre value to DST units (0.1 mm)."""
    return value_mm * MM_TO_DST


def _dist_mm(a: StitchPoint, b: StitchPoint) -> float:
    """Euclidean distance between two stitch points in mm."""
    dx = b.x - a.x
    dy = b.y - a.y
    return (dx * dx + dy * dy) ** 0.5


def generate_dst_pattern(objects: List[StitchObject]) -> pyembroidery.EmbPattern:
    """
    Build a pyembroidery EmbPattern from a list of StitchObjects.

    Thread palette logic:
      - Each object carries a `color_index` (1-based palette position).
      - A COLOR_CHANGE (Stop) command is inserted only when the color_index
        differs between consecutive objects (i.e. an actual thread swap).

    Trim logic:
      - A TRIM command is inserted between objects whose endpoints are
        more than 5 mm apart.  Objects closer than 5 mm get a simple
        JUMP without trimming.

    For each object:
      1. Register the thread colour.
      2. (Conditionally) TRIM the previous thread if gap > 5 mm.
      3. (Conditionally) COLOR_CHANGE if the thread colour changed.
      4. JUMP to the first stitch position.
      5. STITCH through all remaining points.
    """
    pattern = pyembroidery.EmbPattern()

    # Collect unique thread colours in palette-index order for the pattern header
    seen_indices: set[int] = set()
    for obj in objects:
        if obj.color_index not in seen_indices:
            seen_indices.add(obj.color_index)
            r, g, b = _hex_to_rgb(obj.color)
            thread = pyembroidery.EmbThread()
            thread.color = (r << 16) | (g << 8) | b
            thread.name = obj.color
            pattern.add_thread(thread)

    prev_last: StitchPoint | None = None
    prev_color_index: int | None = None

    for obj in objects:
        if not obj.points:
            continue

        first = obj.points[0]

        # Between objects: decide on TRIM and/or COLOR_CHANGE
        if prev_last is not None:
            gap = _dist_mm(prev_last, first)

            # TRIM if the gap exceeds 5 mm
            if gap > TRIM_DISTANCE_MM:
                pattern.add_command(
                    pyembroidery.TRIM, _scale(prev_last.x), _scale(prev_last.y)
                )

            # COLOR_CHANGE only when the thread actually changes
            if prev_color_index is not None and prev_color_index != obj.color_index:
                pattern.add_command(
                    pyembroidery.COLOR_CHANGE,
                    _scale(prev_last.x),
                    _scale(prev_last.y),
                )

        # JUMP to the first point (move without stitching)
        pattern.add_command(pyembroidery.JUMP, _scale(first.x), _scale(first.y))

        # STITCH through all subsequent points
        for pt in obj.points[1:]:
            pattern.add_command(pyembroidery.STITCH, _scale(pt.x), _scale(pt.y))

        prev_last = obj.points[-1]
        prev_color_index = obj.color_index

    # End-of-design marker
    pattern.add_command(pyembroidery.END)

    return pattern


def generate_dst_bytes(objects: List[StitchObject]) -> bytes:
    """
    Generate a .DST file as raw bytes ready for download.

    This is the main entry-point called by the API endpoint.
    """
    pattern = generate_dst_pattern(objects)

    # Write to an in-memory buffer
    buf = io.BytesIO()
    pyembroidery.write_dst(pattern, buf)
    buf.seek(0)
    return buf.read()


def save_dst_file(objects: List[StitchObject], filepath: str) -> str:
    """Save a .DST file to disk and return the path."""
    data = generate_dst_bytes(objects)
    with open(filepath, "wb") as f:
        f.write(data)
    return filepath


# ── Convenience: build StitchObjects from the frontend JSON format ───────────

def objects_from_frontend_data(
    paths: List[dict],
    stitch_points_by_path: Optional[List[List[dict]]] = None,
) -> List[StitchObject]:
    """
    Convert the frontend design data into StitchObjects.

    If `stitch_points_by_path` is provided (pre-computed by the converter),
    use those coordinates directly.  Otherwise fall back to the raw
    user-placed path points.
    """
    result: List[StitchObject] = []

    for i, path_data in enumerate(paths):
        color = path_data.get("color", "#000000")
        color_index = path_data.get("colorIndex", path_data.get("color_index", 1))

        if stitch_points_by_path and i < len(stitch_points_by_path):
            pts = [
                StitchPoint(x=p["x"], y=p["y"])
                for p in stitch_points_by_path[i]
            ]
        else:
            pts = [
                StitchPoint(x=p["x"], y=p["y"])
                for p in path_data.get("points", [])
            ]

        if pts:
            result.append(StitchObject(color=color, color_index=color_index, points=pts))

    return result
