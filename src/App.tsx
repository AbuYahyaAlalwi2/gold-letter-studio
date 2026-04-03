import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import Toolbox from './components/Toolbox';
import EmbroideryCanvas from './components/EmbroideryCanvas';
import InspectorPanel from './components/InspectorPanel';
import ColorPalette from './components/ColorPalette';
import StatusBar from './components/StatusBar';
import { StitchPath, ToolType, StitchType, CanvasState } from './types/embroidery';
import { calculateStitchCount, exportDesignData, downloadDesignJSON } from './utils/dst-export';

function App() {
  // Design state
  const [paths, setPaths] = useState<StitchPath[]>([]);
  const [undoStack, setUndoStack] = useState<StitchPath[][]>([]);
  const [redoStack, setRedoStack] = useState<StitchPath[][]>([]);

  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>('inputA');
  const [stitchType, setStitchType] = useState<StitchType>('run');
  const [activeColor, setActiveColor] = useState('#D4AF37');
  const [density, setDensity] = useState(1.0);
  const [stitchWidth, setStitchWidth] = useState(3.0);

  // Canvas state
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    panX: 60,
    panY: 40,
    isPanning: false,
    lastPanPoint: null,
  });

  // Mouse position (in mm)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Stitch count
  const stitchCount = calculateStitchCount(paths);

  // Add a new path
  const handleAddPath = useCallback(
    (path: StitchPath) => {
      setUndoStack((prev) => [...prev, paths]);
      setRedoStack([]);
      setPaths((prev) => [...prev, path]);
    },
    [paths]
  );

  // Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevPaths = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, paths]);
    setPaths(prevPaths);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack, paths]);

  // Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextPaths = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, paths]);
    setPaths(nextPaths);
    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack, paths]);

  // New design
  const handleNew = useCallback(() => {
    if (paths.length > 0) {
      setUndoStack((prev) => [...prev, paths]);
      setRedoStack([]);
    }
    setPaths([]);
  }, [paths]);

  // Export
  const handleExport = useCallback(() => {
    const design = exportDesignData(paths, 200, 150);
    downloadDesignJSON(design, 'gold-letter-design.json');
  }, [paths]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setCanvasState((prev) => ({
      ...prev,
      zoom: Math.min(10, prev.zoom * 1.25),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCanvasState((prev) => ({
      ...prev,
      zoom: Math.max(0.1, prev.zoom * 0.8),
    }));
  }, []);

  const handleZoomFit = useCallback(() => {
    setCanvasState((prev) => ({
      ...prev,
      zoom: 1,
      panX: 60,
      panY: 40,
    }));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
          case 's':
            e.preventDefault();
            handleExport();
            break;
          case 'n':
            e.preventDefault();
            handleNew();
            break;
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'a':
          setActiveTool('inputA');
          break;
        case 'b':
          setActiveTool('inputB');
          break;
        case 'f':
          setActiveTool('complexFill');
          break;
        case 't':
          setActiveTool('text');
          break;
        case 's':
          setActiveTool('shapes');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleExport, handleNew]);

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a] text-gray-200 overflow-hidden">
      <Header onExport={handleExport} onNew={handleNew} />
      <Toolbar
        onNew={handleNew}
        onExport={handleExport}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        zoom={canvasState.zoom}
      />
      <div className="flex flex-1 overflow-hidden">
        <Toolbox activeTool={activeTool} onToolChange={setActiveTool} />
        <EmbroideryCanvas
          paths={paths}
          activeTool={activeTool}
          activeColor={activeColor}
          stitchType={stitchType}
          density={density}
          stitchWidth={stitchWidth}
          onAddPath={handleAddPath}
          onMouseMove={(x, y) => setMousePos({ x, y })}
          canvasState={canvasState}
          onCanvasStateChange={setCanvasState}
        />
        <InspectorPanel
          stitchType={stitchType}
          onStitchTypeChange={setStitchType}
          density={density}
          onDensityChange={setDensity}
          stitchWidth={stitchWidth}
          onStitchWidthChange={setStitchWidth}
          selectedPathCount={0}
          totalPaths={paths.length}
        />
      </div>
      <ColorPalette activeColor={activeColor} onColorChange={setActiveColor} />
      <StatusBar
        mouseX={mousePos.x}
        mouseY={mousePos.y}
        stitchCount={stitchCount}
        activeTool={activeTool}
        stitchType={stitchType}
        pathCount={paths.length}
        zoom={canvasState.zoom}
      />
    </div>
  );
}

export default App;
