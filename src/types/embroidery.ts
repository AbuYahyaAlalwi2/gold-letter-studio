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
  colorIndex: number;
  density: number;
  width: number;
}

export interface DSTCommand {
  type: 'stitch' | 'move' | 'trim' | 'color_change' | 'end';
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
  index: number;
  name: string;
  hex: string;
}

export const THREAD_COLORS: ThreadColor[] = [
  { index: 1, name: 'Gold', hex: '#D4AF37' },
  { index: 2, name: 'Black', hex: '#1a1a1a' },
  { index: 3, name: 'White', hex: '#FFFFFF' },
  { index: 4, name: 'Red', hex: '#DC2626' },
  { index: 5, name: 'Royal Blue', hex: '#1D4ED8' },
  { index: 6, name: 'Navy', hex: '#1E3A5F' },
  { index: 7, name: 'Forest Green', hex: '#166534' },
  { index: 8, name: 'Emerald', hex: '#059669' },
  { index: 9, name: 'Purple', hex: '#7C3AED' },
  { index: 10, name: 'Magenta', hex: '#DB2777' },
  { index: 11, name: 'Orange', hex: '#EA580C' },
  { index: 12, name: 'Amber', hex: '#D97706' },
  { index: 13, name: 'Teal', hex: '#0D9488' },
  { index: 14, name: 'Cyan', hex: '#0891B2' },
  { index: 15, name: 'Silver', hex: '#94A3B8' },
  { index: 16, name: 'Cream', hex: '#FEF3C7' },
  { index: 17, name: 'Brown', hex: '#78350F' },
  { index: 18, name: 'Maroon', hex: '#881337' },
  { index: 19, name: 'Coral', hex: '#F97316' },
  { index: 20, name: 'Sky Blue', hex: '#38BDF8' },
];

/** Look up color index from hex value */
export function getColorIndex(hex: string): number {
  const found = THREAD_COLORS.find((c) => c.hex === hex);
  return found ? found.index : 1;
}
