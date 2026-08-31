import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import { hitTestShape, getStrokeBounds, rotatePoint, recognizeGeometricShape, isStrokeInRect, isStrokeInPolygon, getCombinedBounds, Rect } from '../utils/geometry';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export type Tool = 'select' | 'pen' | 'highlighter' | 'laser' | 'eraser' | 'text' | 'line' | 'arrow' | 'double-arrow' | 'rectangle' | 'square' | 'circle' | 'ellipse' | 'polygon' | 'free-polygon' | 'free-ellipse' | 'image';

export interface TextFormat {
  text: string;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  alignment: 'left' | 'center' | 'right';
}

export interface Stroke {
  id: string;
  color: string;
  width: number;
  points: Point[];
  type: Tool;
  originalType?: Tool;
  isFilled?: boolean;
  fillColor?: string;
  fillOpacity?: number;
  rotation?: number;
  textFormat?: TextFormat;
  timestamp?: number;
  isEquilateral?: boolean;
  opacity?: number;
  stabilizer?: 'off' | 'basic' | 'soft' | 'silky' | 'fluid';
  imageUrl?: string;
}

export interface DrawingCanvasProps {
  isAnnotationMode: boolean;
  tool: Tool;
  color: string;
  fillColor: string;
  isFilled: boolean;
  fillOpacity?: number;
  width: number;
  // Text specific formatting passed from App
  fontFamily?: string;
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  alignment?: 'left' | 'center' | 'right';
  eraserMode?: 'object' | 'pixel';
  laserFadeDuration?: number;
  laserMode?: 'individual' | 'group';
  penOpacity?: number;
  highlighterOpacity?: number;
  penStabilizer?: 'off' | 'basic' | 'soft' | 'silky' | 'fluid';
  autoShapeRecognition?: boolean;
  selectMode?: 'rectangle' | 'lasso';
  onTextEditStart?: (id: string | null) => void;
  onSelectedStrokeChange?: (stroke: Stroke | null) => void;
}

export interface DrawingCanvasRef {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  getStrokes: () => Stroke[];
  deleteSelected: () => void;
  getSelectedStrokeIds: () => string[];
  updateStroke: (id: string, updates: Partial<Stroke>, commit?: boolean) => void;
  deselect: () => void;
  getBoundingBox: (id: string) => { x: number; y: number; w: number; h: number } | null;
}
export const measureTextBounds = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  if (stroke.type !== 'text' || !stroke.textFormat) return null;
  const fmt = stroke.textFormat;
  ctx.save();
  ctx.font = `${fmt.isBold ? 'bold' : ''} ${fmt.isItalic ? 'italic' : ''} ${fmt.fontSize}px ${fmt.fontFamily}`;
  const lines = (fmt.text || ' ').split('\n');
  const lineHeight = fmt.fontSize * 1.2;
  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line || ' ').width);
  }
  ctx.restore();

  const p = stroke.points[0];
  const padding = stroke.isFilled ? 8 : 0;
  let x = p.x;
  if (fmt.alignment === 'center') x -= maxWidth / 2;
  else if (fmt.alignment === 'right') x -= maxWidth;

  return {
    x: x - padding,
    y: p.y - padding,
    w: maxWidth + padding * 2,
    h: (lines.length * lineHeight) + padding * 2
  };
};

export const drawArrowhead = (ctx: CanvasRenderingContext2D, from: Point, to: Point, width: number) => {
  const headlen = Math.max(10, width * 3);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
};

export const STABILIZER_CONFIGS: Record<string, { smoothing: number; streamline: number; thinning: number }> = {
  off: { smoothing: 0.0, streamline: 0.0, thinning: 0.5 },
  basic: { smoothing: 0.25, streamline: 0.25, thinning: 0.55 },
  soft: { smoothing: 0.5, streamline: 0.5, thinning: 0.6 },
  silky: { smoothing: 0.75, streamline: 0.75, thinning: 0.6 },
  fluid: { smoothing: 0.9, streamline: 0.9, thinning: 0.65 }
};

export const drawStrokesOntoContext = (
  ctx: CanvasRenderingContext2D,
  strokesToDraw: Stroke[],
  activeStroke: Stroke | null = null,
  selectedStrokeIds: string[] = [],
  activeTextEditId: string | null = null,
  laserFadeDuration: number = 2000,
  laserMode: 'individual' | 'group' = 'individual',
  lastLaserActivity: number = 0,
  isCurrentlyDrawingLaser: boolean = false,
  penOpacity: number = 1.0,
  highlighterOpacity: number = 0.35,
  penStabilizer: 'off' | 'basic' | 'soft' | 'silky' | 'fluid' = 'basic',
  selectionBox: Rect | null = null,
  lassoPoints: Point[] | null = null,
  imageCache?: Record<string, HTMLImageElement>,
  triggerRender?: () => void
) => {
  const drawStrokeFn = (s: Stroke, isActive: boolean) => {
    if (s.type === 'text' && activeTextEditId === s.id) return;
    if (s.points.length === 0) return;

    ctx.save();

    let bounds: { x: number, y: number, w: number, h: number } | null = null;
    if (s.type === 'text') bounds = measureTextBounds(ctx, s);
    else bounds = getStrokeBounds(s);

    if (s.rotation && bounds) {
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const isHighlighter = s.type === 'highlighter' || s.originalType === 'highlighter';

    if (isHighlighter) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * 3.5;
      const alpha = s.opacity !== undefined ? s.opacity : highlighterOpacity;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.globalCompositeOperation = 'source-over';
    } else if (s.type === 'eraser') {
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = s.width * 3;
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'destination-out';
    } else if (s.type === 'laser') {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = 'transparent';
      ctx.lineWidth = s.width;
      
      if (s.timestamp) {
        if (laserMode === 'group') {
          if (isCurrentlyDrawingLaser) {
            ctx.globalAlpha = 1.0;
          } else {
            const elapsed = Date.now() - (lastLaserActivity || s.timestamp);
            const remaining = 1 - (elapsed / laserFadeDuration);
            ctx.globalAlpha = Math.max(0, Math.min(1, remaining));
          }
        } else {
          const elapsed = Date.now() - s.timestamp;
          const remaining = 1 - (elapsed / laserFadeDuration);
          ctx.globalAlpha = Math.max(0, remaining);
        }
      } else {
        ctx.globalAlpha = 1.0;
      }
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 8;
      ctx.shadowColor = s.color;
    } else {
      ctx.strokeStyle = s.color;
      const hexToRgba = (hex: string, alpha: number) => {
        if (!hex.startsWith('#') || hex.length !== 7) return hex;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      ctx.fillStyle = s.fillColor ? (s.fillOpacity !== undefined ? hexToRgba(s.fillColor, s.fillOpacity) : s.fillColor) : 'transparent';
      ctx.lineWidth = s.width;
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.beginPath();

    if (s.type === 'pen') {
        const stabKey = s.stabilizer || penStabilizer || 'basic';
        const stabConfig = STABILIZER_CONFIGS[stabKey] || STABILIZER_CONFIGS.basic;

        const strokePoints = getStroke(
          s.points.map(p => ({ x: p.x, y: p.y, pressure: p.pressure !== undefined ? p.pressure : 0.5 })),
          {
            size: s.width * 2, // Base size scales with pen width setting
            thinning: stabConfig.thinning,     // Thinning based on stabilizer
            smoothing: stabConfig.smoothing,   // Smoothing based on stabilizer
            streamline: stabConfig.streamline, // Streamline based on stabilizer
            simulatePressure: false,           // We always use real or our constant 0.5 pressure
            last: !isActive
          }
        );
        
        if (strokePoints.length > 0) {
          ctx.beginPath();
          ctx.moveTo(strokePoints[0][0], strokePoints[0][1]);
          for (let i = 0; i < strokePoints.length; i++) {
            const [x0, y0] = strokePoints[i];
            const [x1, y1] = strokePoints[(i + 1) % strokePoints.length];
            ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
          }
          ctx.closePath();
          // perfect-freehand creates an SVG-like polygon, so we FILL it instead of stroke
          ctx.fillStyle = s.color;
          const alpha = s.opacity !== undefined ? s.opacity : penOpacity;
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.globalCompositeOperation = 'source-over';
          ctx.fill();
        }
    } else if (s.type === 'highlighter' || s.type === 'eraser' || s.type === 'laser') {
      if (s.points.length === 1) {
        ctx.moveTo(s.points[0].x, s.points[0].y);
        ctx.lineTo(s.points[0].x + 0.1, s.points[0].y + 0.1);
      } else {
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length - 1; i++) {
          const pt1 = s.points[i];
          const pt2 = s.points[i + 1];
          const mid = { x: pt1.x + (pt2.x - pt1.x) / 2, y: pt1.y + (pt2.y - pt1.y) / 2 };
          ctx.quadraticCurveTo(pt1.x, pt1.y, mid.x, mid.y);
        }
        const last = s.points[s.points.length - 1];
        ctx.lineTo(last.x, last.y);
      }
      ctx.stroke();
    } else if (s.type === 'text' && s.textFormat) {
       const fmt = s.textFormat;
       ctx.font = `${fmt.isBold ? 'bold' : ''} ${fmt.isItalic ? 'italic' : ''} ${fmt.fontSize}px ${fmt.fontFamily}`;
       ctx.textBaseline = 'top';
       ctx.textAlign = fmt.alignment;
       
       const lines = fmt.text.split('\n');
       const lineHeight = fmt.fontSize * 1.2;
       const p = s.points[0];

       if (s.isFilled && s.fillColor) {
          const bounds = measureTextBounds(ctx, s);
          if (bounds) {
            ctx.fillStyle = s.fillColor;
            ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
          }
       }

       ctx.fillStyle = s.color;
       lines.forEach((line, idx) => {
          ctx.fillText(line, p.x, p.y + (idx * lineHeight));
       });
       if (fmt.isUnderline) {
         for (let i = 0; i < lines.length; i++) {
            const y = s.points[0].y + (i * lineHeight) + fmt.fontSize;
            const w = ctx.measureText(lines[i]).width;
            let x = s.points[0].x;
            if (fmt.alignment === 'center') x -= w / 2;
            else if (fmt.alignment === 'right') x -= w;
            ctx.beginPath();
            ctx.moveTo(x, y + 2);
            ctx.lineTo(x + w, y + 2);
            ctx.lineWidth = Math.max(1, fmt.fontSize / 15);
            ctx.stroke();
         }
       }
    } else if (s.type === 'line' || s.type === 'arrow' || s.type === 'double-arrow') {
       if (s.points.length >= 2) {
         const p1 = s.points[0];
         const p2 = s.points[1];
         ctx.moveTo(p1.x, p1.y);
         ctx.lineTo(p2.x, p2.y);
         ctx.stroke();
         if (s.type === 'arrow' || s.type === 'double-arrow') drawArrowhead(ctx, p1, p2, s.width);
         if (s.type === 'double-arrow') drawArrowhead(ctx, p2, p1, s.width);
       }
    } else if (s.type === 'image' && s.imageUrl) {
       if (s.points.length >= 2) {
          const p1 = s.points[0];
          const p2 = s.points[1];
          const w = p2.x - p1.x;
          const h = p2.y - p1.y;
          
          let img = imageCache ? imageCache[s.id] : undefined;
          if (!img && imageCache) {
            img = new Image();
            img.src = s.imageUrl;
            img.onload = () => {
              if (triggerRender) triggerRender();
            };
            imageCache[s.id] = img;
          }
          
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, p1.x, p1.y, w, h);
          } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(p1.x, p1.y, w, h);
            ctx.setLineDash([]);
          }
       }
    } else if (s.type === 'rectangle' || s.type === 'square') {
       if (s.points.length >= 2) {
          const p1 = s.points[0];
          const p2 = s.points[1];
          const w = p2.x - p1.x;
          const h = p2.y - p1.y;
          ctx.rect(p1.x, p1.y, w, h);
          if (s.isFilled) ctx.fill();
          ctx.stroke();
       }
    } else if (s.type === 'circle' || s.type === 'ellipse') {
       if (s.points.length >= 2) {
          const p1 = s.points[0];
          const p2 = s.points[1];
          const rx = Math.abs(p2.x - p1.x) / 2;
          const ry = Math.abs(p2.y - p1.y) / 2;
          const cx = p1.x + (p2.x - p1.x) / 2;
          const cy = p1.y + (p2.y - p1.y) / 2;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          if (s.isFilled) ctx.fill();
          ctx.stroke();
       }
    } else if (s.type === 'polygon' || s.type === 'free-polygon') {
       if (s.points.length > 0) {
         ctx.moveTo(s.points[0].x, s.points[0].y);
         for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
         if (!isActive) {
           ctx.closePath();
           if (s.isFilled) ctx.fill();
         } else if (isActive && s.isFilled && s.points.length > 2) {
           ctx.fill();
         }
         ctx.stroke();
       }
    } else if (s.type === 'free-ellipse') {
       if (s.points.length > 0) {
         if (!isActive && s.points.length > 2) {
            const len = s.points.length;
            ctx.moveTo((s.points[0].x + s.points[len-1].x)/2, (s.points[0].y + s.points[len-1].y)/2);
            for (let i = 0; i < len; i++) {
                const next = (i + 1) % len;
                const midX = (s.points[i].x + s.points[next].x) / 2;
                const midY = (s.points[i].y + s.points[next].y) / 2;
                ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, midX, midY);
            }
            ctx.closePath();
            if (s.isFilled) ctx.fill();
         } else {
            ctx.moveTo(s.points[0].x, s.points[0].y);
            if (s.points.length === 1) {
                ctx.lineTo(s.points[0].x, s.points[0].y);
            } else {
                for (let i = 1; i < s.points.length - 1; i++) {
                    const p0 = s.points[i];
                    const p1 = s.points[i + 1];
                    const mid = { x: (p0.x + p1.x)/2, y: (p0.y + p1.y)/2 };
                    ctx.quadraticCurveTo(p0.x, p0.y, mid.x, mid.y);
                }
                const last = s.points[s.points.length - 1];
                ctx.lineTo(last.x, last.y);
            }
            if (isActive && s.isFilled && s.points.length > 2) {
                ctx.fill();
            }
         }
         ctx.stroke();
       }
    }
    
    ctx.restore();
  };

  strokesToDraw.forEach(s => drawStrokeFn(s, false));
  if (activeStroke) drawStrokeFn(activeStroke, true);

  // 1. Draw Marquee Selection Box (Dashed Blue Rectangle)
  if (selectionBox) {
    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
    ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
    ctx.restore();
  }

  // 2. Draw Lasso Selection Path (Dashed Blue Loop)
  if (lassoPoints && lassoPoints.length > 1) {
    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    for (let i = 1; i < lassoPoints.length; i++) {
      ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 3. Draw Selected Strokes Outline & Handles
  if (selectedStrokeIds && selectedStrokeIds.length > 0) {
    const selectedStrokes = strokesToDraw.filter(s => selectedStrokeIds.includes(s.id));
    if (selectedStrokes.length === 1) {
      const s = selectedStrokes[0];
      const bounds = s.type === 'text' ? measureTextBounds(ctx, s) : getStrokeBounds(s);
      if (bounds) {
        ctx.save();
        if (s.rotation) {
           const cx = bounds.x + bounds.w / 2;
           const cy = bounds.y + bounds.h / 2;
           ctx.translate(cx, cy);
           ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.w + 4, bounds.h + 4);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
    ctx.fillRect(bounds.x - 2, bounds.y - 2, bounds.w + 4, bounds.h + 4);

    if (s.type !== 'text') {
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      const hs = 7;
      const drawHandle = (hx: number, hy: number) => {
        ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      };
      const bx = bounds.x - 2, by = bounds.y - 2, bw = bounds.w + 4, bh = bounds.h + 4;
      drawHandle(bx, by);
      drawHandle(bx + bw / 2, by);
      drawHandle(bx + bw, by);
      drawHandle(bx, by + bh / 2);
      drawHandle(bx + bw, by + bh / 2);
      drawHandle(bx, by + bh);
      drawHandle(bx + bw / 2, by + bh);
      drawHandle(bx + bw, by + bh);
    }
    ctx.restore();
  }
} else if (selectedStrokes.length > 1) {
  // Outline each selected stroke
  selectedStrokes.forEach(s => {
    const b = s.type === 'text' ? measureTextBounds(ctx, s) : getStrokeBounds(s);
    if (b) {
      ctx.save();
      if (s.rotation) {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate((s.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }
      ctx.strokeStyle = '#93c5fa';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
      ctx.restore();
    }
  });

  // Draw combined bounding box with handles
  const combined = getCombinedBounds(selectedStrokes);
  if (combined) {
    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(combined.x - 3, combined.y - 3, combined.w + 6, combined.h + 6);
    ctx.fillStyle = 'rgba(37, 99, 235, 0.05)';
    ctx.fillRect(combined.x - 3, combined.y - 3, combined.w + 6, combined.h + 6);

    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    const hs = 7;
    const drawHandle = (hx: number, hy: number) => {
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    };
    const bx = combined.x - 3, by = combined.y - 3, bw = combined.w + 6, bh = combined.h + 6;
    drawHandle(bx, by);
    drawHandle(bx + bw / 2, by);
    drawHandle(bx + bw, by);
    drawHandle(bx, by + bh / 2);
    drawHandle(bx + bw, by + bh / 2);
    drawHandle(bx, by + bh);
    drawHandle(bx + bw / 2, by + bh);
    drawHandle(bx + bw, by + bh);
    ctx.restore();
  }
}
  }
};

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  isAnnotationMode,
  tool,
  color,
  fillColor,
  isFilled,
  width,
  fontFamily = 'Arial',
  fontSize = 24,
  isBold = false,
  isItalic = false,
  isUnderline = false,
  alignment = 'left',
  eraserMode = 'object',
  laserFadeDuration = 2000,
  laserMode = 'individual',
  penOpacity = 1.0,
  highlighterOpacity = 0.35,
  penStabilizer = 'basic',
  autoShapeRecognition = true,
  selectMode = 'rectangle',
  onTextEditStart,
  onSelectedStrokeChange
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastLaserActivityRef = useRef<number>(0);

  // Draw-and-Hold Shape Recognition Refs
  const holdTimerRef = useRef<any>(null);
  const isHoldSnappedRef = useRef<boolean>(false);
  const holdAnchorPointRef = useRef<Point | null>(null);
  const recognizedInitialPointsRef = useRef<Point[] | null>(null);

  // Selection & Marquee/Lasso Refs
  const selectionBoxRef = useRef<Rect | null>(null);
  const lassoPointsRef = useRef<Point[] | null>(null);
  const isDraggingSelectionRef = useRef<boolean>(false);
  const draggingStrokesOriginalRef = useRef<{ id: string, points: Point[] }[]>([]);

  // History Snapshot State
  const historyRef = useRef<Stroke[][]>([[]]);
  const historyIndexRef = useRef<number>(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const drawFrameRef = useRef<number | null>(null);

  const isDrawingPolygonRef = useRef(false);

  // Selection & Text Editing State
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const selectedStrokeId = selectedStrokeIds.length === 1 ? selectedStrokeIds[0] : null;
  const setSelectedStrokeId = useCallback((id: string | null) => {
    setSelectedStrokeIds(id ? [id] : []);
  }, []);

  const [activeTextEdit, setActiveTextEdit] = useState<{ id: string, stroke: Stroke, text: string } | null>(null);

  // Expose selection to parent
  useEffect(() => {
    if (onSelectedStrokeChange) {
      if (selectedStrokeIds.length === 0) {
        onSelectedStrokeChange(null);
      } else if (selectedStrokeIds.length === 1) {
        let stroke = strokes.find(s => s.id === selectedStrokeIds[0]);
        if (!stroke && activeTextEdit && activeTextEdit.id === selectedStrokeIds[0]) {
          stroke = activeTextEdit.stroke;
        }
        onSelectedStrokeChange(stroke || null);
      } else {
        // Multi-selection: create a synthetic group stroke or pass null to properties panel
        onSelectedStrokeChange(null);
      }
    }
  }, [selectedStrokeIds, strokes, activeTextEdit, onSelectedStrokeChange]);

  const dragStartPointRef = useRef<Point | null>(null);
  const draggingStrokeOriginalPointsRef = useRef<Point[] | null>(null);
  const originalBoundsRef = useRef<{ x: number, y: number, w: number, h: number } | null>(null);
  const resizeHandleRef = useRef<string | null>(null);

  const propsRef = useRef({ tool, color, fillColor, isFilled, width, isAnnotationMode, fontFamily, fontSize, isBold, isItalic, isUnderline, alignment, eraserMode, laserFadeDuration, laserMode, penOpacity, highlighterOpacity, penStabilizer, autoShapeRecognition, selectMode });

  useEffect(() => {
    propsRef.current = { tool, color, fillColor, isFilled, width, isAnnotationMode, fontFamily, fontSize, isBold, isItalic, isUnderline, alignment, eraserMode, laserFadeDuration, laserMode, penOpacity, highlighterOpacity, penStabilizer, autoShapeRecognition, selectMode };
  }, [tool, color, fillColor, isFilled, width, isAnnotationMode, fontFamily, fontSize, isBold, isItalic, isUnderline, alignment, eraserMode, laserFadeDuration, laserMode, penOpacity, highlighterOpacity, penStabilizer, autoShapeRecognition, selectMode]);

  const commitHistory = useCallback((newStrokes: Stroke[]) => {
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push([...newStrokes]);
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setStrokes(newStrokes);
  }, []);



  const hitTestHandles = (x: number, y: number, historyStrokes: Stroke[], selectedId: string | null) => {
    if (!selectedId) return null;
    const stroke = historyStrokes.find(s => s.id === selectedId);
    if (!stroke || stroke.type === 'text') return null;
    const bounds = getStrokeBounds(stroke);
    if (!bounds) return null;

    let testX = x;
    let testY = y;
    if (stroke.rotation) {
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      const rotated = rotatePoint(x, y, cx, cy, -stroke.rotation);
      testX = rotated.x;
      testY = rotated.y;
    }

    const bx = bounds.x - 2, by = bounds.y - 2, bw = bounds.w + 4, bh = bounds.h + 4;
    const hs = 10;

    const handles = [
      { id: 'nw', x: bx, y: by },
      { id: 'n', x: bx + bw / 2, y: by },
      { id: 'ne', x: bx + bw, y: by },
      { id: 'w', x: bx, y: by + bh / 2 },
      { id: 'e', x: bx + bw, y: by + bh / 2 },
      { id: 'sw', x: bx, y: by + bh },
      { id: 's', x: bx + bw / 2, y: by + bh },
      { id: 'se', x: bx + bw, y: by + bh },
    ];

    for (const handle of handles) {
      if (Math.abs(testX - handle.x) <= hs && Math.abs(testY - handle.y) <= hs) {
        return handle.id;
      }
    }
    return null;
  };

  const hitTest = (ctx: CanvasRenderingContext2D, x: number, y: number, historyStrokes: Stroke[]) => {
    for (let i = historyStrokes.length - 1; i >= 0; i--) {
      const stroke = historyStrokes[i];
      let testX = x;
      let testY = y;

      let bounds = null;
      if (stroke.type === 'text') bounds = measureTextBounds(ctx, stroke);
      else bounds = getStrokeBounds(stroke);

      if (stroke.rotation && bounds) {
        const cx = bounds.x + bounds.w / 2;
        const cy = bounds.y + bounds.h / 2;
        const rotated = rotatePoint(x, y, cx, cy, -stroke.rotation);
        testX = rotated.x;
        testY = rotated.y;
      }

      if (stroke.type === 'text') {
        if (bounds && testX >= bounds.x && testX <= bounds.x + bounds.w && testY >= bounds.y && testY <= bounds.y + bounds.h) {
          return stroke.id;
        }
      } else {
        if (hitTestShape(testX, testY, stroke)) {
          return stroke.id;
        }
      }
    }
    return null;
  };

  const renderCanvas = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, activeStroke: Stroke | null, historyStrokes: Stroke[]) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const isDrawingLaser = isDrawingRef.current && currentStrokeRef.current?.type === 'laser';

    drawStrokesOntoContext(
      ctx,
      historyStrokes,
      activeStroke,
      selectedStrokeIds,
      activeTextEdit?.id || null,
      propsRef.current.laserFadeDuration,
      propsRef.current.laserMode || 'individual',
      lastLaserActivityRef.current,
      isDrawingLaser,
      propsRef.current.penOpacity,
      propsRef.current.highlighterOpacity,
      propsRef.current.penStabilizer,
      selectionBoxRef.current,
      lassoPointsRef.current,
      imageCacheRef.current,
      triggerRender
    );

    ctx.restore();
  }, [activeTextEdit, selectedStrokeIds]);

  const triggerRender = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (drawFrameRef.current) cancelAnimationFrame(drawFrameRef.current);
    drawFrameRef.current = requestAnimationFrame(() => {
      renderCanvas(ctx, canvas, currentStrokeRef.current, strokes);
    });
  }, [strokes, renderCanvas]);

  // Laser fade out loop
  useEffect(() => {
    const interval = setInterval(() => {
      setStrokes(prev => {
        const now = Date.now();
        let needsRender = false;
        const mode = propsRef.current.laserMode || 'individual';
        const isDrawingLaser = isDrawingRef.current && currentStrokeRef.current?.type === 'laser';

        if (mode === 'group') {
          if (isDrawingLaser) {
            lastLaserActivityRef.current = now;
            needsRender = true;
            return prev;
          }

          const hasLaser = prev.some(s => s.type === 'laser');
          if (hasLaser) {
            needsRender = true;
            const elapsed = now - (lastLaserActivityRef.current || now);
            if (elapsed >= laserFadeDuration) {
              const next = prev.filter(s => s.type !== 'laser');
              triggerRender();
              return next;
            }
          }
          if (needsRender) {
            triggerRender();
          }
          return prev;
        } else {
          const next = prev.filter(s => {
            if (s.type === 'laser' && s.timestamp) {
              needsRender = true;
              return now - s.timestamp < laserFadeDuration;
            }
            return true;
          });

          if (needsRender || next.length !== prev.length) {
            triggerRender();
          }

          if (next.length !== prev.length) {
            return next;
          }
          return prev;
        }
      });
    }, 16);
    return () => clearInterval(interval);
  }, [laserFadeDuration, triggerRender]);

  const commitPolygon = useCallback(() => {
    if (isDrawingPolygonRef.current && currentStrokeRef.current) {
      isDrawingPolygonRef.current = false;
      const stroke = currentStrokeRef.current;
      if (stroke.points.length > 2) stroke.points.pop();
      if (stroke.points.length >= 3) {
        commitHistory([...strokes, stroke]);
      }
      currentStrokeRef.current = null;
      triggerRender();
    }
  }, [triggerRender, strokes, commitHistory]);

  const cancelPolygon = useCallback(() => {
    if (isDrawingPolygonRef.current) {
      isDrawingPolygonRef.current = false;
      currentStrokeRef.current = null;
      triggerRender();
    }
  }, [triggerRender]);

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (isDrawingPolygonRef.current) return cancelPolygon();
      if (activeTextEdit) return; // Prevent undo while typing
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        setStrokes(historyRef.current[historyIndexRef.current]);
        setSelectedStrokeId(null);
      }
    },
    redo: () => {
      if (isDrawingPolygonRef.current) cancelPolygon();
      if (activeTextEdit) return;
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current++;
        setStrokes(historyRef.current[historyIndexRef.current]);
        setSelectedStrokeId(null);
      }
    },
    clear: () => {
      if (isDrawingPolygonRef.current) cancelPolygon();
      commitHistory([]);
      setSelectedStrokeIds([]);
    },
    getStrokes: () => strokes,
    addStroke: (stroke: Stroke) => {
      // If this is an image stroke, pre-load it into the cache so it renders immediately
      if (stroke.type === 'image' && stroke.imageUrl) {
        const img = new Image();
        img.src = stroke.imageUrl;
        imageCacheRef.current[stroke.id] = img;
        if (img.complete && img.naturalWidth > 0) {
          // Already loaded (e.g. data URL that was already decoded)
          commitHistory([...strokes, stroke]);
          triggerRender();
        } else {
          img.onload = () => {
            commitHistory([...strokes, stroke]);
            triggerRender();
          };
          img.onerror = () => {
            // Still add it even if image fails
            commitHistory([...strokes, stroke]);
          };
        }
        return;
      }
      commitHistory([...strokes, stroke]);
    },
    deleteSelected: () => {
      const toDelete = selectedStrokeIds.length > 0 ? selectedStrokeIds : (selectedStrokeId ? [selectedStrokeId] : []);
      if (toDelete.length > 0) {
        commitHistory(strokes.filter(s => !toDelete.includes(s.id)));
        setSelectedStrokeIds([]);
        if (onSelectedStrokeChange) onSelectedStrokeChange(null);
      }
    },
    getSelectedStrokeIds: () => selectedStrokeIds,
    updateStroke: (id: string, updates: Partial<Stroke>, commit: boolean = true) => {
      // 1. If activeTextEdit is currently editing this stroke, update its live state
      if (activeTextEdit && activeTextEdit.id === id) {
        const mergedStroke: Stroke = {
          ...activeTextEdit.stroke,
          ...updates,
          textFormat: updates.textFormat
            ? { ...activeTextEdit.stroke.textFormat!, ...updates.textFormat }
            : activeTextEdit.stroke.textFormat
        };
        setActiveTextEdit({
          ...activeTextEdit,
          stroke: mergedStroke
        });
        if (onSelectedStrokeChange) onSelectedStrokeChange(mergedStroke);
      }

      // 2. Also update in committed strokes list
      const idx = strokes.findIndex(s => s.id === id);
      if (idx !== -1) {
        const newStrokes = [...strokes];
        newStrokes[idx] = {
          ...newStrokes[idx],
          ...updates,
          textFormat: updates.textFormat
            ? { ...newStrokes[idx].textFormat!, ...updates.textFormat }
            : newStrokes[idx].textFormat
        };
        if (commit) commitHistory(newStrokes);
        else {
          setStrokes(newStrokes);
        }
        if (id === selectedStrokeId && onSelectedStrokeChange) {
          onSelectedStrokeChange(newStrokes[idx]);
        }
      }
    },
    deselect: () => {
      setSelectedStrokeIds([]);
    },
    getBoundingBox: (id: string) => {
      let s = strokes.find(st => st.id === id);
      if (!s && activeTextEdit && activeTextEdit.id === id) {
        s = activeTextEdit.stroke;
      }
      if (!s) return null;
      let bounds: Rect | null = null;
      if (s.type === 'text') {
        // We need a context to measure text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          bounds = measureTextBounds(ctx, s);
          if (bounds) {
            bounds.w = Math.max(bounds.w, 140);
            bounds.h = Math.max(bounds.h, (s.textFormat?.fontSize || 24) * 1.5);
          }
        }
      } else {
        bounds = getStrokeBounds(s);
      }
      if (!bounds) return null;
      if (s.rotation) {
        const cx = bounds.x + bounds.w / 2;
        const cy = bounds.y + bounds.h / 2;
        const corners = [
          rotatePoint(bounds.x, bounds.y, cx, cy, s.rotation),
          rotatePoint(bounds.x + bounds.w, bounds.y, cx, cy, s.rotation),
          rotatePoint(bounds.x + bounds.w, bounds.y + bounds.h, cx, cy, s.rotation),
          rotatePoint(bounds.x, bounds.y + bounds.h, cx, cy, s.rotation)
        ];
        const minX = Math.min(...corners.map(p => p.x));
        const maxX = Math.max(...corners.map(p => p.x));
        const minY = Math.min(...corners.map(p => p.y));
        const maxY = Math.max(...corners.map(p => p.y));
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
      return bounds;
    }
  }));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If we are actively editing text, don't hijack keys except escape
      if (activeTextEdit) {
        if (e.key === 'Escape') {
          setActiveTextEdit(null);
          triggerRender();
        }
        return;
      }
      if (e.key === 'Escape') {
        cancelPolygon();
        setSelectedStrokeIds([]);
      }
      if (e.key === 'Enter') commitPolygon();
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStrokeIds.length > 0) {
        commitHistory(strokes.filter(s => !selectedStrokeIds.includes(s.id)));
        setSelectedStrokeIds([]);
        if (onSelectedStrokeChange) onSelectedStrokeChange(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commitPolygon, cancelPolygon, activeTextEdit, selectedStrokeIds, commitHistory, triggerRender, strokes, onSelectedStrokeChange]);

  useEffect(() => {
    triggerRender();
    const handleResize = () => triggerRender();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [triggerRender]);

  const applyConstraints = (start: Point, end: Point, tool: Tool, shiftKey: boolean): Point => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (tool === 'square') {
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      // Fallback direction based on movement if perfectly 0
      const signX = dx >= 0 ? 1 : -1;
      const signY = dy >= 0 ? 1 : -1;
      return { x: start.x + signX * size, y: start.y + signY * size };
    }

    if (!shiftKey) return end;
    if (tool === 'rectangle' || tool === 'circle' || tool === 'ellipse') {
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      const signX = dx >= 0 ? 1 : -1;
      const signY = dy >= 0 ? 1 : -1;
      return { x: start.x + signX * size, y: start.y + signY * size };
    } else if (tool === 'line' || tool === 'arrow' || tool === 'double-arrow') {
      const angle = Math.atan2(dy, dx);
      const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.sqrt(dx * dx + dy * dy);
      return { x: start.x + Math.cos(snappedAngle) * dist, y: start.y + Math.sin(snappedAngle) * dist };
    }
    return end;
  };

  const triggerHoldSnap = useCallback(() => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const stroke = currentStrokeRef.current;
    if (stroke.type !== 'pen' && stroke.type !== 'highlighter') return;
    if (stroke.points.length < 5) return;

    const recognized = recognizeGeometricShape(stroke.points);
    if (recognized) {
      isHoldSnappedRef.current = true;
      recognizedInitialPointsRef.current = recognized.points.map(p => ({ ...p }));
      currentStrokeRef.current = {
        ...stroke,
        type: recognized.type,
        originalType: stroke.type,
        points: recognized.points,
        isEquilateral: recognized.isEquilateral
      };
      triggerRender();
    }
  }, [triggerRender]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const props = propsRef.current;
    if (!props.isAnnotationMode) return;

    // Finalize any active text edit on click outside
    if (activeTextEdit) {
      if (activeTextEdit.text.trim()) {
        const updatedStroke = { ...activeTextEdit.stroke, textFormat: { ...activeTextEdit.stroke.textFormat!, text: activeTextEdit.text } };
        const idx = strokes.findIndex(s => s.id === activeTextEdit.id);
        if (idx >= 0) {
          const newStrokes = [...strokes];
          newStrokes[idx] = updatedStroke;
          commitHistory(newStrokes);
        } else {
          commitHistory([...strokes, updatedStroke]);
        }
        setSelectedStrokeId(updatedStroke.id);
        if (onSelectedStrokeChange) onSelectedStrokeChange(updatedStroke);
      } else {
        const filtered = strokes.filter(s => s.id !== activeTextEdit.id);
        if (filtered.length !== strokes.length) {
          commitHistory(filtered);
        }
        setSelectedStrokeId(null);
        if (onSelectedStrokeChange) onSelectedStrokeChange(null);
      }
      setActiveTextEdit(null);
      return;
    }

    const point: Point = {
      x: e.clientX,
      y: e.clientY,
      pressure: e.pointerType === 'pen' ? e.pressure : 0.5
    };

    if (props.tool === 'select') {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        // 1. If a single stroke is selected, check its resize handles
        if (selectedStrokeIds.length === 1) {
          const handleId = hitTestHandles(point.x, point.y, strokes, selectedStrokeIds[0]);
          if (handleId) {
            resizeHandleRef.current = handleId;
            isDrawingRef.current = true;
            isDraggingSelectionRef.current = false;
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            dragStartPointRef.current = point;
            const hitStroke = strokes.find(s => s.id === selectedStrokeIds[0]);
            if (hitStroke) {
              draggingStrokeOriginalPointsRef.current = hitStroke.points.map(p => ({ ...p }));
              originalBoundsRef.current = getStrokeBounds(hitStroke);
            }
            return;
          }
        }

        resizeHandleRef.current = null;

        // 2. Check if clicking inside the combined bounding box of currently selected items
        if (selectedStrokeIds.length > 0) {
          const selectedStrokes = strokes.filter(s => selectedStrokeIds.includes(s.id));
          const combined = getCombinedBounds(selectedStrokes);
          if (combined && point.x >= combined.x && point.x <= combined.x + combined.w && point.y >= combined.y && point.y <= combined.y + combined.h) {
            // User clicked inside selection -> Start moving all selected strokes!
            isDrawingRef.current = true;
            isDraggingSelectionRef.current = true;
            dragStartPointRef.current = point;
            draggingStrokesOriginalRef.current = selectedStrokes.map(s => ({ id: s.id, points: s.points.map(p => ({ ...p })) }));
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            return;
          }
        }

        // 3. Check if directly clicked on a stroke
        const hitId = hitTest(ctx, point.x, point.y, strokes);
        if (hitId) {
          setSelectedStrokeIds([hitId]);
          const hitStroke = strokes.find(s => s.id === hitId);
          if (hitStroke) {
            isDrawingRef.current = true;
            isDraggingSelectionRef.current = true;
            dragStartPointRef.current = point;
            draggingStrokesOriginalRef.current = [{ id: hitStroke.id, points: hitStroke.points.map(p => ({ ...p })) }];
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          }
          triggerRender();
          return;
        }

        // 4. Clicked on empty area -> Clear selection and start Marquee Box or Lasso drag!
        setSelectedStrokeIds([]);
        isDrawingRef.current = true;
        isDraggingSelectionRef.current = false;
        dragStartPointRef.current = point;

        if (propsRef.current.selectMode === 'lasso') {
          lassoPointsRef.current = [point];
          selectionBoxRef.current = null;
        } else {
          selectionBoxRef.current = { x: point.x, y: point.y, w: 0, h: 0 };
          lassoPointsRef.current = null;
        }
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        triggerRender();
      }
      return;
    }

    if (props.tool === 'eraser') {
      if (props.eraserMode !== 'pixel') {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          const hitId = hitTest(ctx, point.x, point.y, strokes);
          if (hitId) {
            commitHistory(strokes.filter(s => s.id !== hitId));
          }
          isDrawingRef.current = true;
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }
        return;
      }
    }

    // Clear selection if clicking elsewhere
    setSelectedStrokeId(null);

    if (props.tool === 'text') {
      const newId = Date.now().toString();
      const newStroke: Stroke = {
        id: newId,
        type: 'text',
        color: props.color,
        fillColor: props.fillColor,
        isFilled: props.isFilled,
        width: 1,
        points: [point],
        textFormat: {
          text: '',
          fontFamily: props.fontFamily,
          fontSize: props.fontSize,
          isBold: props.isBold,
          isItalic: props.isItalic,
          isUnderline: props.isUnderline,
          alignment: props.alignment
        }
      };
      setActiveTextEdit({ id: newId, stroke: newStroke, text: '' });
      setSelectedStrokeId(newId);
      if (onSelectedStrokeChange) onSelectedStrokeChange(newStroke);
      if (onTextEditStart) onTextEditStart(newId);
      return;
    }

    if (props.tool === 'polygon' || props.tool === 'free-polygon' || props.tool === 'free-ellipse') {
      if (!isDrawingPolygonRef.current) {
        isDrawingPolygonRef.current = true;
        currentStrokeRef.current = {
          id: Date.now().toString(),
          color: props.color,
          fillColor: props.fillColor,
          isFilled: props.isFilled,
          width: props.width,
          type: props.tool,
          points: [point, { ...point }],
          ...(props.tool === 'polygon' && e.shiftKey ? { isEquilateral: true } : {})
        };
      } else if (currentStrokeRef.current) {
        if (props.tool === 'polygon' && currentStrokeRef.current.isEquilateral) {
          commitPolygon();
          return;
        }

        const startPoint = currentStrokeRef.current.points[0];
        const distToStart = Math.hypot(startPoint.x - point.x, startPoint.y - point.y);

        // Auto-close free polygon/ellipse if clicked near the start
        if ((props.tool === 'free-polygon' || props.tool === 'free-ellipse') && distToStart < 20 && currentStrokeRef.current.points.length > 3) {
          commitPolygon();
          return;
        }

        currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1] = point;
        currentStrokeRef.current.points.push({ ...point });

        // Auto-close triangle after 3 points placed
        if (props.tool === 'polygon' && currentStrokeRef.current.points.length === 4) {
          commitPolygon();
          return;
        }
      }
      triggerRender();
      return;
    }

    isDrawingRef.current = true;
    isHoldSnappedRef.current = false;
    recognizedInitialPointsRef.current = null;
    holdAnchorPointRef.current = point;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if ((props.tool === 'pen' || props.tool === 'highlighter') && props.autoShapeRecognition !== false) {
      holdTimerRef.current = setTimeout(() => {
        triggerHoldSnap();
      }, 420);
    }

    if (props.tool === 'laser') {
      lastLaserActivityRef.current = Date.now();
    }
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);

    currentStrokeRef.current = {
      id: Date.now().toString(),
      color: props.color,
      fillColor: props.fillColor,
      isFilled: props.isFilled,
      width: props.width,
      type: props.tool,
      points: [point, { ...point }],
      ...(props.tool === 'pen' ? {
        opacity: props.penOpacity !== undefined ? props.penOpacity : 1.0,
        stabilizer: props.penStabilizer || 'basic'
      } : {}),
      ...(props.tool === 'highlighter' ? {
        opacity: props.highlighterOpacity !== undefined ? props.highlighterOpacity : 0.35
      } : {})
    };

    triggerRender();
  }, [triggerRender, activeTextEdit, commitHistory, onTextEditStart, strokes, triggerHoldSnap]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!propsRef.current.isAnnotationMode) return;
    const point: Point = {
      x: e.clientX,
      y: e.clientY,
      pressure: e.pointerType === 'pen' ? e.pressure : 0.5
    };

    if (propsRef.current.tool === 'select' && isDrawingRef.current) {
      // A. If resizing a single stroke
      if (resizeHandleRef.current && selectedStrokeIds.length === 1 && dragStartPointRef.current && draggingStrokeOriginalPointsRef.current) {
        const dx = point.x - dragStartPointRef.current.x;
        const dy = point.y - dragStartPointRef.current.y;
        const newStrokes = [...strokes];
        const idx = newStrokes.findIndex(s => s.id === selectedStrokeIds[0]);
        if (idx >= 0) {
          const bounds = originalBoundsRef.current;
          if (bounds) {
            let localDx = dx;
            let localDy = dy;
            const originalStroke = strokes[idx];
            if (originalStroke.rotation) {
              const cx = bounds.x + bounds.w / 2;
              const cy = bounds.y + bounds.h / 2;
              const pLocal = rotatePoint(point.x, point.y, cx, cy, -originalStroke.rotation);
              const startLocal = rotatePoint(dragStartPointRef.current.x, dragStartPointRef.current.y, cx, cy, -originalStroke.rotation);
              localDx = pLocal.x - startLocal.x;
              localDy = pLocal.y - startLocal.y;
            }

            let scaleX = 1;
            let scaleY = 1;
            let anchorX = 0;
            let anchorY = 0;

            const h = resizeHandleRef.current;
            if (h.includes('e')) { scaleX = (bounds.w + localDx) / bounds.w; anchorX = bounds.x; }
            if (h.includes('w')) { scaleX = (bounds.w - localDx) / bounds.w; anchorX = bounds.x + bounds.w; }
            if (h.includes('s')) { scaleY = (bounds.h + localDy) / bounds.h; anchorY = bounds.y; }
            if (h.includes('n')) { scaleY = (bounds.h - localDy) / bounds.h; anchorY = bounds.y + bounds.h; }

            // Preclude division by zero or extreme scaling if bounds were 0
            if (bounds.w === 0) { scaleX = 1; anchorX = bounds.x; }
            if (bounds.h === 0) { scaleY = 1; anchorY = bounds.y; }

            newStrokes[idx] = {
              ...newStrokes[idx],
              points: draggingStrokeOriginalPointsRef.current.map(p => ({
                x: anchorX + (p.x - anchorX) * scaleX,
                y: anchorY + (p.y - anchorY) * scaleY
              }))
            };
            setStrokes(newStrokes);
            triggerRender();
          }
        }
        return;
      }

      // B. If dragging/moving selected strokes
      if (isDraggingSelectionRef.current && dragStartPointRef.current && draggingStrokesOriginalRef.current.length > 0) {
        const dx = point.x - dragStartPointRef.current.x;
        const dy = point.y - dragStartPointRef.current.y;
        const origMap = new Map(draggingStrokesOriginalRef.current.map(o => [o.id, o.points]));
        const newStrokes = strokes.map(s => {
          const origPts = origMap.get(s.id);
          if (origPts) {
            return {
              ...s,
              points: origPts.map(p => ({ x: p.x + dx, y: p.y + dy, pressure: p.pressure }))
            };
          }
          return s;
        });
        setStrokes(newStrokes);
        triggerRender();
        return;
      }

      // C. If drawing selection rectangle marquee
      if (selectionBoxRef.current && dragStartPointRef.current) {
        const minX = Math.min(dragStartPointRef.current.x, point.x);
        const maxX = Math.max(dragStartPointRef.current.x, point.x);
        const minY = Math.min(dragStartPointRef.current.y, point.y);
        const maxY = Math.max(dragStartPointRef.current.y, point.y);
        selectionBoxRef.current = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        triggerRender();
        return;
      }

      // D. If drawing lasso path
      if (lassoPointsRef.current) {
        lassoPointsRef.current.push(point);
        triggerRender();
        return;
      }
      return;
    }

    if (propsRef.current.tool === 'eraser' && isDrawingRef.current) {
      if (propsRef.current.eraserMode !== 'pixel') {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          const hitId = hitTest(ctx, point.x, point.y, strokes);
          if (hitId) {
            commitHistory(strokes.filter(s => s.id !== hitId));
          }
        }
        return;
      }
    }

    if (isDrawingPolygonRef.current && currentStrokeRef.current) {
      const stroke = currentStrokeRef.current;

      if (stroke.type === 'polygon' && stroke.isEquilateral) {
        stroke.points[1] = point;
        const p0 = stroke.points[0];
        const p1 = stroke.points[1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const angle = Math.atan2(dy, dx);
        const dist = Math.hypot(dx, dy);

        const p2 = {
          x: p0.x + dist * Math.cos(angle - Math.PI / 3),
          y: p0.y + dist * Math.sin(angle - Math.PI / 3)
        };

        if (stroke.points.length === 2) stroke.points.push(p2);
        else stroke.points[2] = p2;

        if (stroke.points.length === 3) stroke.points.push({ ...p2 });
        else stroke.points[3] = { ...p2 };
      } else {
        stroke.points[stroke.points.length - 1] = point;
      }

      triggerRender();
      return;
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    const stroke = currentStrokeRef.current;
    const strokeType = stroke.type as string;

    if (isHoldSnappedRef.current) {
      // Dynamic interactive scaling while user continues holding after snap
      if (strokeType === 'line' || strokeType === 'arrow') {
        stroke.points[1] = point;
      } else if (strokeType === 'rectangle' || strokeType === 'square' || strokeType === 'circle' || strokeType === 'ellipse') {
        const p0 = stroke.points[0];
        if (strokeType === 'square' || strokeType === 'circle') {
          const side = Math.max(Math.abs(point.x - p0.x), Math.abs(point.y - p0.y));
          const signX = point.x >= p0.x ? 1 : -1;
          const signY = point.y >= p0.y ? 1 : -1;
          stroke.points[1] = { x: p0.x + side * signX, y: p0.y + side * signY };
        } else {
          stroke.points[1] = point;
        }
      } else if (strokeType === 'polygon' && recognizedInitialPointsRef.current) {
        const initPts = recognizedInitialPointsRef.current;
        let minX = initPts[0].x, maxX = initPts[0].x, minY = initPts[0].y, maxY = initPts[0].y;
        initPts.forEach(p => {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const origDist = Math.hypot(maxX - cx, maxY - cy) || 1;
        const currentDist = Math.hypot(point.x - cx, point.y - cy);
        const scale = Math.max(0.2, currentDist / origDist);
        stroke.points = initPts.map(p => ({
          x: cx + (p.x - cx) * scale,
          y: cy + (p.y - cy) * scale
        }));
      }
      triggerRender();
      return;
    }

    if (stroke.type === 'pen' || stroke.type === 'highlighter') {
      stroke.points.push(point);

      // Check if user has paused/held pointer to trigger shape recognition
      if (propsRef.current.autoShapeRecognition !== false && holdAnchorPointRef.current) {
        const d = Math.hypot(point.x - holdAnchorPointRef.current.x, point.y - holdAnchorPointRef.current.y);
        if (d > 10) {
          holdAnchorPointRef.current = point;
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          holdTimerRef.current = setTimeout(() => {
            triggerHoldSnap();
          }, 420);
        }
      }
    } else if (stroke.type === 'laser' || (stroke.type === 'eraser' && propsRef.current.eraserMode === 'pixel')) {
      if (stroke.type === 'laser') {
        lastLaserActivityRef.current = Date.now();
      }
      stroke.points.push(point);
    } else {
      stroke.points[1] = applyConstraints(stroke.points[0], point, stroke.type, e.shiftKey);
    }

    triggerRender();
  }, [triggerRender, selectedStrokeId, strokes, commitHistory, triggerHoldSnap]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    isHoldSnappedRef.current = false;
    recognizedInitialPointsRef.current = null;

    if (propsRef.current.tool === 'select' && isDrawingRef.current) {
      isDrawingRef.current = false;
      try {
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      } catch (err) { }

      if (resizeHandleRef.current) {
        resizeHandleRef.current = null;
        commitHistory(strokes);
        triggerRender();
        return;
      }

      if (isDraggingSelectionRef.current) {
        isDraggingSelectionRef.current = false;
        draggingStrokesOriginalRef.current = [];
        commitHistory(strokes);
        triggerRender();
        return;
      }

      // If selection rectangle completed
      if (selectionBoxRef.current) {
        const box = selectionBoxRef.current;
        selectionBoxRef.current = null;
        if (box.w > 4 || box.h > 4) {
          const matched = strokes.filter(s => isStrokeInRect(s, box)).map(s => s.id);
          setSelectedStrokeIds(matched);
        } else {
          setSelectedStrokeIds([]);
        }
        triggerRender();
        return;
      }

      // If lasso selection completed
      if (lassoPointsRef.current) {
        const pts = lassoPointsRef.current;
        lassoPointsRef.current = null;
        if (pts.length > 4) {
          const matched = strokes.filter(s => isStrokeInPolygon(s, pts)).map(s => s.id);
          setSelectedStrokeIds(matched);
        } else {
          setSelectedStrokeIds([]);
        }
        triggerRender();
        return;
      }
      return;
    }

    if (isDrawingPolygonRef.current) return;
    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    isDrawingRef.current = false;
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch (err) { }

    const finishedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (finishedStroke.type === 'laser') {
      finishedStroke.timestamp = Date.now();
      lastLaserActivityRef.current = Date.now();
      setStrokes(prev => [...prev, finishedStroke]);
      triggerRender();
    } else {
      commitHistory([...strokes, finishedStroke]);
    }
  }, [commitHistory, selectedStrokeId, strokes, triggerRender]);

  const handleDoubleClick = useCallback(() => {
    if (propsRef.current.tool === 'select' && selectedStrokeId) {
      const stroke = strokes.find(s => s.id === selectedStrokeId);
      if (stroke && stroke.type === 'text') {
        setActiveTextEdit({ id: stroke.id, stroke, text: stroke.textFormat!.text });
      }
      return;
    }
    if (isDrawingPolygonRef.current) {
      commitPolygon();
    }
  }, [commitPolygon, selectedStrokeId, strokes, activeTextEdit]);

  return (
    <>
      <canvas
        ref={canvasRef}
        id="annotation-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: isAnnotationMode ? 'auto' : 'none',
          zIndex: 10, touchAction: 'none',
          cursor: tool === 'select' ? 'pointer' : (tool === 'text' ? 'text' : 'crosshair')
        }}
      />
      {activeTextEdit && activeTextEdit.stroke.textFormat && (
        <textarea
          autoFocus
          value={activeTextEdit.text}
          onChange={(e) => setActiveTextEdit({ ...activeTextEdit, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              if (activeTextEdit.text.trim()) {
                const updatedStroke = { ...activeTextEdit.stroke, textFormat: { ...activeTextEdit.stroke.textFormat!, text: activeTextEdit.text } };
                const idx = strokes.findIndex(s => s.id === activeTextEdit.id);
                if (idx >= 0) {
                  const newStrokes = [...strokes];
                  newStrokes[idx] = updatedStroke;
                  commitHistory(newStrokes);
                } else {
                  commitHistory([...strokes, updatedStroke]);
                }
                setSelectedStrokeId(updatedStroke.id);
                if (onSelectedStrokeChange) onSelectedStrokeChange(updatedStroke);
              } else {
                setSelectedStrokeId(null);
                if (onSelectedStrokeChange) onSelectedStrokeChange(null);
              }
              setActiveTextEdit(null);
            }
            // Enter key naturally creates newline '\n'
          }}
          style={{
            position: 'absolute',
            zIndex: 100,
            left: activeTextEdit.stroke.points[0].x,
            top: activeTextEdit.stroke.points[0].y,
            fontFamily: activeTextEdit.stroke.textFormat.fontFamily,
            fontSize: `${activeTextEdit.stroke.textFormat.fontSize}px`,
            lineHeight: '1.2',
            fontWeight: activeTextEdit.stroke.textFormat.isBold ? 'bold' : 'normal',
            fontStyle: activeTextEdit.stroke.textFormat.isItalic ? 'italic' : 'normal',
            textDecoration: activeTextEdit.stroke.textFormat.isUnderline ? 'underline' : 'none',
            color: activeTextEdit.stroke.color,
            background: activeTextEdit.stroke.isFilled ? (activeTextEdit.stroke.fillColor || '#ffffff') : 'transparent',
            padding: activeTextEdit.stroke.isFilled ? '8px' : '0px',
            border: '1px dashed #3b82f6',
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            whiteSpace: 'pre',
            minWidth: '120px',
            minHeight: `${activeTextEdit.stroke.textFormat.fontSize * 1.5}px`,
            transform: `translate(${activeTextEdit.stroke.textFormat.alignment === 'center' ? '-50%' : activeTextEdit.stroke.textFormat.alignment === 'right' ? '-100%' : '0'}, 0)`,
            textAlign: activeTextEdit.stroke.textFormat.alignment,
            boxSizing: 'content-box'
          }}
          onInput={(e) => {
            // Auto-resize
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.max(activeTextEdit.stroke.textFormat!.fontSize * 1.3, target.scrollHeight)}px`;
            target.style.width = 'auto';
            target.style.width = `${Math.max(120, target.scrollWidth)}px`;
          }}
        />
      )}
    </>
  );
});
