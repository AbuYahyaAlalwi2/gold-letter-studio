// DST (Tajima) embroidery file format exporter
// Reference: https://edutechwiki.unige.ch/en/Embroidery_format_DST

interface Point {
  x: number;
  y: number;
}

interface StitchPath {
  points: Point[];
  tool: "satin" | "running";
  color: string;
  spacing: number;
  satinWidth: number;
}

const PIXELS_PER_MM = 3.7795275591;

// DST uses 0.1mm units (1 unit = 0.1mm)
const MM_TO_DST_UNITS = 10;

function encodeStitch(dx: number, dy: number, flags: number = 0): number[] {
  // DST format uses relative coordinates
  // Each stitch is encoded as 3 bytes
  // dx and dy are in 0.1mm units, range -121 to +121
  
  dx = Math.round(dx);
  dy = Math.round(dy);
  
  // Clamp values to valid range
  dx = Math.max(-121, Math.min(121, dx));
  dy = Math.max(-121, Math.min(121, dy));
  
  let b0 = 0;
  let b1 = 0;
  let b2 = 0x03; // Regular stitch
  
  // Apply flags
  if (flags & 0x01) b2 |= 0x80; // Jump stitch
  if (flags & 0x02) b2 |= 0x40; // Color change
  if (flags & 0x04) { // End of design
    return [0x00, 0x00, 0xF3];
  }
  
  // Encode Y coordinate
  if (dy > 0) {
    if (dy > 40) { b2 |= 0x20; dy -= 81; }
    if (dy > 13) { b2 |= 0x10; dy -= 27; }
    if (dy > 4) { b2 |= 0x08; dy -= 9; }
    if (dy > 1) { b2 |= 0x04; dy -= 3; }
    if (dy > 0) { b0 |= 0x80; dy -= 1; }
  } else if (dy < 0) {
    dy = -dy;
    if (dy > 40) { b2 |= 0x20; dy -= 81; }
    if (dy > 13) { b2 |= 0x10; dy -= 27; }
    if (dy > 4) { b2 |= 0x08; dy -= 9; }
    if (dy > 1) { b2 |= 0x04; dy -= 3; }
    if (dy > 0) { b0 |= 0x40; dy -= 1; }
  }
  
  // Encode X coordinate
  if (dx > 0) {
    if (dx > 40) { b1 |= 0x04; dx -= 81; }
    if (dx > 13) { b1 |= 0x02; dx -= 27; }
    if (dx > 4) { b1 |= 0x01; dx -= 9; }
    if (dx > 1) { b0 |= 0x08; dx -= 3; }
    if (dx > 0) { b0 |= 0x01; dx -= 1; }
  } else if (dx < 0) {
    dx = -dx;
    if (dx > 40) { b1 |= 0x04; dx -= 81; }
    if (dx > 13) { b1 |= 0x02; dx -= 27; }
    if (dx > 4) { b1 |= 0x01; dx -= 9; }
    if (dx > 1) { b0 |= 0x04; dx -= 3; }
    if (dx > 0) { b0 |= 0x02; dx -= 1; }
  }
  
  return [b0, b1, b2];
}

function createHeader(name: string, stitchCount: number, colorCount: number): Uint8Array {
  const header = new Uint8Array(512);
  
  // Fill with spaces
  header.fill(0x20);
  
  // Label (first 20 characters)
  const label = `LA:${name.substring(0, 16).padEnd(16, ' ')}`;
  for (let i = 0; i < label.length && i < 20; i++) {
    header[i] = label.charCodeAt(i);
  }
  header[19] = 0x0D; // CR
  
  // Stitch count
  const stStr = `ST:${String(stitchCount).padStart(7, '0')}`;
  for (let i = 0; i < stStr.length; i++) {
    header[20 + i] = stStr.charCodeAt(i);
  }
  header[30] = 0x0D;
  
  // Color count
  const coStr = `CO:${String(colorCount).padStart(3, '0')}`;
  for (let i = 0; i < coStr.length; i++) {
    header[31 + i] = coStr.charCodeAt(i);
  }
  header[37] = 0x0D;
  
  // Extent boundaries (+X, -X, +Y, -Y) - simplified
  const extents = [
    `+X:${String(100).padStart(5, '0')}`,
    `-X:${String(0).padStart(5, '0')}`,
    `+Y:${String(100).padStart(5, '0')}`,
    `-Y:${String(0).padStart(5, '0')}`,
  ];
  
  let pos = 38;
  for (const ext of extents) {
    for (let i = 0; i < ext.length; i++) {
      header[pos + i] = ext.charCodeAt(i);
    }
    pos += ext.length;
    header[pos] = 0x0D;
    pos++;
  }
  
  // AX/AY (needle offset)
  const ax = `AX:${"+".padEnd(6, '0')}`;
  const ay = `AY:${"+".padEnd(6, '0')}`;
  
  for (let i = 0; i < ax.length; i++) {
    header[pos + i] = ax.charCodeAt(i);
  }
  pos += ax.length;
  header[pos] = 0x0D;
  pos++;
  
  for (let i = 0; i < ay.length; i++) {
    header[pos + i] = ay.charCodeAt(i);
  }
  pos += ay.length;
  header[pos] = 0x0D;
  pos++;
  
  // MX/MY
  const mx = `MX:${"+".padEnd(6, '0')}`;
  const my = `MY:${"+".padEnd(6, '0')}`;
  
  for (let i = 0; i < mx.length; i++) {
    header[pos + i] = mx.charCodeAt(i);
  }
  pos += mx.length;
  header[pos] = 0x0D;
  pos++;
  
  for (let i = 0; i < my.length; i++) {
    header[pos + i] = my.charCodeAt(i);
  }
  pos += my.length;
  header[pos] = 0x0D;
  
  // Fill rest with 0x20 (spaces) up to 512 bytes
  // Already done above
  
  return header;
}

export function exportToDST(paths: StitchPath[], fileName: string = "design"): Blob {
  const stitchData: number[] = [];
  let lastX = 0;
  let lastY = 0;
  let stitchCount = 0;
  const colors = new Set<string>();
  
  for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
    const path = paths[pathIndex];
    colors.add(path.color);
    
    // Generate stitches for this path
    for (let i = 0; i < path.points.length; i++) {
      const point = path.points[i];
      
      // Convert pixels to 0.1mm DST units
      const x = Math.round((point.x / PIXELS_PER_MM) * MM_TO_DST_UNITS);
      const y = Math.round((point.y / PIXELS_PER_MM) * MM_TO_DST_UNITS);
      
      const dx = x - lastX;
      const dy = y - lastY;
      
      // If first point of a new path (not first path), add jump stitch
      if (i === 0 && pathIndex > 0) {
        const jumpBytes = encodeStitch(dx, -dy, 0x01);
        stitchData.push(...jumpBytes);
      } else if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        // Break long movements into multiple stitches
        const maxMove = 121;
        let remainingDx = dx;
        let remainingDy = dy;
        
        while (Math.abs(remainingDx) > maxMove || Math.abs(remainingDy) > maxMove) {
          const moveDx = Math.max(-maxMove, Math.min(maxMove, remainingDx));
          const moveDy = Math.max(-maxMove, Math.min(maxMove, remainingDy));
          
          const bytes = encodeStitch(moveDx, -moveDy, 0);
          stitchData.push(...bytes);
          stitchCount++;
          
          remainingDx -= moveDx;
          remainingDy -= moveDy;
        }
        
        if (remainingDx !== 0 || remainingDy !== 0) {
          const bytes = encodeStitch(remainingDx, -remainingDy, 0);
          stitchData.push(...bytes);
          stitchCount++;
        }
      }
      
      lastX = x;
      lastY = y;
    }
  }
  
  // Add end-of-design marker
  stitchData.push(...encodeStitch(0, 0, 0x04));
  
  // Create header
  const header = createHeader(fileName, stitchCount, colors.size);
  
  // Combine header and stitch data
  const fullData = new Uint8Array(header.length + stitchData.length);
  fullData.set(header, 0);
  fullData.set(new Uint8Array(stitchData), header.length);
  
  return new Blob([fullData], { type: "application/octet-stream" });
}

export function downloadDST(paths: StitchPath[], fileName: string = "design") {
  const blob = exportToDST(paths, fileName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.dst`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
