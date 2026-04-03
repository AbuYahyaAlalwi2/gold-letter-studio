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


def _scale(value_mm: float) -> float:
    """Scale a millimetre value to DST units (0.1 mm)."""
    return value_mm * MM_TO_DST


def generate_dst_pattern(objects: List[StitchObject]) -> pyembroidery.EmbPattern:
    """
    Build a pyembroidery EmbPattern from a list of StitchObjects.

    For each object:
      1. Register the thread colour.
      2. JUMP to the first stitch position (move without stitching).
      3. STITCH through all remaining points.
      4. TRIM at the end to cut the thread.
      5. COLOR_CHANGE (STOP) to signal a thread swap to the next colour.

    Between separate objects a JUMP bridges the gap so the machine
    repositions without leaving thread on the fabric.
    """
    pattern = pyembroidery.EmbPattern()

    for obj_idx, obj in enumerate(objects):
        if not obj.points:
            continue

        # Register thread colour
        r, g, b = _hex_to_rgb(obj.color)
        thread = pyembroidery.EmbThread()
        thread.color = (r << 16) | (g << 8) | b
        thread.name = obj.color
        pattern.add_thread(thread)

        first = obj.points[0]

        # JUMP to the first point (move without stitching)
        pattern.add_command(pyembroidery.JUMP, _scale(first.x), _scale(first.y))

        # STITCH through all subsequent points
        for pt in obj.points[1:]:
            pattern.add_command(pyembroidery.STITCH, _scale(pt.x), _scale(pt.y))

        # TRIM at the end of the object — cuts the thread
        last = obj.points[-1]
        pattern.add_command(pyembroidery.TRIM, _scale(last.x), _scale(last.y))

        # COLOR_CHANGE (STOP) at end of each colour block
        # (skip for the very last object — END will follow)
        if obj_idx < len(objects) - 1:
            pattern.add_command(
                pyembroidery.COLOR_CHANGE, _scale(last.x), _scale(last.y)
            )

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
            result.append(StitchObject(color=color, points=pts))

    return result
