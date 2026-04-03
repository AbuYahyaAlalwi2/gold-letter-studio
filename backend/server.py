"""
FastAPI backend for Gold Letter Studio — DST file generation endpoint.

POST /api/generate-dst
  Accepts the design's stitch data (paths with pre-computed stitch points)
  and returns a binary .DST file for download.
"""

from __future__ import annotations

from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from dst_generator import (
    StitchObject,
    StitchPoint,
    generate_dst_bytes,
)

app = FastAPI(title="Gold Letter Studio — DST Backend")

# Allow CORS from the Vite dev server and any origin for flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / response models ───────────────────────────────────────────────

class PointPayload(BaseModel):
    x: float
    y: float


class StitchObjectPayload(BaseModel):
    color: str
    colorIndex: int = 1
    points: List[PointPayload]


class GenerateDSTRequest(BaseModel):
    """
    The frontend sends an array of stitch objects, each with a colour and
    an array of (x, y) stitch coordinates in millimetres.
    """
    objects: List[StitchObjectPayload]
    filename: str = "gold-letter-design.dst"


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/api/generate-dst")
async def generate_dst(req: GenerateDSTRequest) -> Response:
    """
    Convert stitch objects to a .DST binary file and return it for download.

    The coordinates are expected in millimetres. The generator will:
      1. Scale them to 0.1 mm DST units.
      2. Add JUMP commands between separate objects.
      3. Add TRIM + STOP (color change) at the end of each colour block.
      4. Return the .DST binary with appropriate headers for download.
    """
    objects = [
        StitchObject(
            color=obj.color,
            color_index=obj.colorIndex,
            points=[StitchPoint(x=p.x, y=p.y) for p in obj.points],
        )
        for obj in req.objects
    ]

    dst_bytes = generate_dst_bytes(objects)

    return Response(
        content=dst_bytes,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{req.filename}"',
        },
    )


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "service": "gold-letter-studio-dst-backend"}
