export type StitchType = 'satin' | 'tatami' | 'run' | 'zigzag';

export type ToolType =
  | 'select'
  | 'reshape'
  | 'inputA'
  | 'inputB'
  | 'complexFill'
  | 'text'
  | 'shapes'
  | 'knife';

export interface Point {
  x: number;
  y: number;
}

export interface StitchPath {
  id: string;
  points: Point[];
  stitchType: StitchType;
  color: string;
  density: number;
  width: number;
}

export interface DSTCommand {
  type: 'stitch' | 'move' | 'trim' | 'stop' | 'end';
  x: number;
  y: number;
}

export interface DesignData {
  paths: StitchPath[];
  width: number;
  height: number;
  stitchCount: number;
  colorChanges: number;
  commands: DSTCommand[];
}

export interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
  isPanning: boolean;
  lastPanPoint: Point | null;
}

export interface ThreadColor {
  name: string;
  hex: string;
}

export const THREAD_COLORS: ThreadColor[] = [
  { name: 'Gold', hex: '#D4AF37' },
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Royal Blue', hex: '#1D4ED8' },
  { name: 'Navy', hex: '#1E3A5F' },
  { name: 'Forest Green', hex: '#166534' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Purple', hex: '#7C3AED' },
  { name: 'Magenta', hex: '#DB2777' },
  { name: 'Orange', hex: '#EA580C' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Teal', hex: '#0D9488' },
  { name: 'Cyan', hex: '#0891B2' },
  { name: 'Silver', hex: '#94A3B8' },
  { name: 'Cream', hex: '#FEF3C7' },
  { name: 'Brown', hex: '#78350F' },
  { name: 'Maroon', hex: '#881337' },
  { name: 'Coral', hex: '#F97316' },
  { name: 'Sky Blue', hex: '#38BDF8' },
];
