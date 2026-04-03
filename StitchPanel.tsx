// src/components/StitchPanel.tsx
import React from 'react';

export type StitchObject = 
  | { type: 'satin'; lines: { start: { x: number; y: number }; end: { x: number; y: number } }[]; id: string }
  | { type: 'running'; segments: { start: { x: number; y: number }; end: { x: number; y: number } }[]; id: string };

interface StitchPanelProps {
  stitches: StitchObject[];
  selectedStitchId: string | null;
  densityMm: number;
  onDensityChange: (value: number) => void;
  onSelectStitch: (id: string | null) => void;
  onDeleteStitch: () => void;
  onClearAll: () => void;
  // Optional callbacks if generation is triggered from panel
  onGenerateSatin?: () => void;
  onGenerateRunning?: () => void;
}

const StitchPanel: React.FC<StitchPanelProps> = ({
  stitches,
  selectedStitchId,
  densityMm,
  onDensityChange,
  onSelectStitch,
  onDeleteStitch,
  onClearAll,
  onGenerateSatin,
  onGenerateRunning,
}) => {
  return (
    <div style={{ width: 260, backgroundColor: '#ecf0f1', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, borderLeft: '1px solid #ccc', overflowY: 'auto', fontFamily: 'sans-serif' }}>
      <h4 style={{ margin: 0 }}>⚙️ Stitch Properties</h4>
      
      <div>
        <label style={{ fontWeight: 500 }}>Density (mm):</label>
        <input
          type="number"
          step={0.05}
          min={0.1}
          max={2}
          value={densityMm}
          onChange={(e) => onDensityChange(parseFloat(e.target.value) || 0.4)}
          style={{ width: '100%', padding: 6, marginTop: 4, borderRadius: 4, border: '1px solid #aaa' }}
        />
        <p style={{ fontSize: 12, color: '#555' }}>Stitch spacing = {densityMm}mm (0.4mm default)</p>
      </div>

      <div>
        <label style={{ fontWeight: 500 }}>Calibration:</label>
        <p style={{ fontSize: 12, margin: 0 }}>1 mm = 3.78 px</p>
        <p style={{ fontSize: 12, margin: 0 }}>Grid: 10mm major / 1mm minor</p>
      </div>

      <hr />

      <div>
        <strong>🧶 Stitch Objects ({stitches.length})</strong>
        <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
          {stitches.map(st => (
            <div
              key={st.id}
              onClick={() => onSelectStitch(st.id)}
              style={{
                background: selectedStitchId === st.id ? '#f1c40f' : '#fff',
                padding: 6,
                marginBottom: 6,
                borderRadius: 6,
                cursor: 'pointer',
                border: '1px solid #ccc',
                fontSize: 12,
              }}
            >
              {st.type === 'satin' ? '🪡 Satin' : '✖️ Running'} - {st.type === 'satin' ? `${st.lines.length} stitches` : `${st.segments.length} segments`}
            </div>
          ))}
        </div>
        {selectedStitchId && (
          <button onClick={onDeleteStitch} style={{ marginTop: 8, background: '#e74c3c', border: 'none', padding: 5, borderRadius: 4, color: 'white', width: '100%', cursor: 'pointer' }}>
            Delete Selected
          </button>
        )}
        <button onClick={onClearAll} style={{ marginTop: 8, background: '#c0392b', border: 'none', padding: 8, borderRadius: 6, color: 'white', width: '100%', fontWeight: 'bold', cursor: 'pointer' }}>
          🗑️ Clear All
        </button>
      </div>

      {(onGenerateSatin || onGenerateRunning) && (
        <>
          <hr />
          <div>
            <strong>⚡ Generate from Canvas</strong>
            {onGenerateSatin && (
              <button onClick={onGenerateSatin} style={{ marginTop: 6, background: '#2ecc71', border: 'none', padding: 6, borderRadius: 4, color: 'white', width: '100%', cursor: 'pointer' }}>
                Generate Satin
              </button>
            )}
            {onGenerateRunning && (
              <button onClick={onGenerateRunning} style={{ marginTop: 6, background: '#3498db', border: 'none', padding: 6, borderRadius: 4, color: 'white', width: '100%', cursor: 'pointer' }}>
                Generate Running
              </button>
            )}
          </div>
        </>
      )}

      <div style={{ fontSize: 11, color: '#2c3e50', marginTop: 'auto' }}>
        <strong>Instructions</strong><br />
        • <strong>Satin:</strong> Draw two boundaries (Input A/B) on canvas, then generate.<br />
        • <strong>Running:</strong> Draw a path on canvas, then generate.<br />
        • Density controls stitch spacing (0.4mm = tight).<br />
        • Pan with drag, zoom with scroll.
      </div>
    </div>
  );
};

export default StitchPanel;
export type { StitchObject };
