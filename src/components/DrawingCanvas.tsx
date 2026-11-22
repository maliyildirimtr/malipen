import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import type { CropRect } from '../utils/crop';
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
  /** Image strokes: visible part of the original image (fractions 0–1); absent = whole image */
  crop?: CropRect;
}

/** Undo history depth. Older steps are dropped to bound memory use. */
export const MAX_HISTORY = 100;

let idCounter = 0;
/** Unique id even when two strokes are created in the same millisecond. */
export const newStrokeId = () => `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

/**
 * How many pixels wide a stroke really is on screen for a given brush size.
 * Used by the renderer, hit-testing and the cursor preview so they always agree.
 */
export const visualStrokeWidth = (tool: Tool | string, width: number): number => {
  if (tool === 'pen') return width * 2;            // perfect-freehand size = width * 2
  if (tool === 'highlighter') return width * 3.5;
  if (tool === 'eraser') return width * 3;
  return width;
};

export const getToolCursor = (tool: Tool) => {
  if (tool === 'select') return 'pointer';
  if (tool === 'text') return 'text';
  if (tool === 'pen') {
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' filter='drop-shadow(0px 1px 2px rgba(0,0,0,0.8))'%3E%3Cpath d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/%3E%3Cpath d='m15 5 4 4'/%3E%3C/svg%3E") 2 22, crosshair`;
  }
  if (tool === 'highlighter') {
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' filter='drop-shadow(0px 1px 2px rgba(0,0,0,0.8))'%3E%3Cpath d='m9 11-6 6v3h9l3-3'/%3E%3Cpath d='m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4'/%3E%3C/svg%3E") 3 20, crosshair`;
  }
  if (tool === 'eraser') {
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' filter='drop-shadow(0px 1px 2px rgba(0,0,0,0.8))'%3E%3Cpath d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'/%3E%3Cpath d='M22 21H7'/%3E%3Cpath d='m5 11 9 9'/%3E%3C/svg%3E") 4 20, crosshair`;
  }
  if (tool === 'laser') {
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='red' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' filter='drop-shadow(0px 0px 4px rgba(255,0,0,0.8))'%3E%3Ccircle cx='12' cy='12' r='4' fill='red'/%3E%3C/svg%3E") 12 12, crosshair`;
  }
  return 'crosshair';
};

export interface DrawingCanvasProps {
  isAnnotationMode: boolean;
  /** True for the canvas of the board currently on screen (keyboard handling). */
  isActive?: boolean;
  tool: Tool;
  color: string;
  fillColor: string;
  isFilled: boolean;
  fillOpacity?: number;
  width: number;
  laserWidth?: number;
  // Defaults for new text
  fontFamily?: string;
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  alignment?: 'left' | 'center' | 'right';
  textBackground?: boolean;
  eraserMode?: 'object' | 'pixel';
  laserFadeDuration?: number;
  laserMode?: 'individual' | 'group';
  penOpacity?: number;
  highlighterOpacity?: number;
  penStabilizer?: 'off' | 'basic' | 'soft' | 'silky' | 'fluid';
  autoShapeRecognition?: boolean;
  selectMode?: 'rectangle' | 'lasso';
  /** Theme accent used for selection outlines and handles */
  selectionColor?: string;
  onTextEditStart?: (id: string | null) => void;
  onSelectedStrokeChange?: (stroke: Stroke | null) => void;
}

export interface DrawingCanvasRef {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  getStrokes: () => Stroke[];
  addStroke: (stroke: Stroke) => void;
  deleteSelected: () => void;
  getSelectedStrokeIds: () => string[];
  updateStroke: (id: string, updates: Partial<Stroke>, commit?: boolean) => void;
  deselect: () => void;
  getBoundingBox: (id: string) => { x: number; y: number; w: number; h: number } | null;
  hasStrokes: () => boolean;
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

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** "#rrggbb" + alpha → rgba() string; other colour formats are returned unchanged. */
const withAlpha = (hex: string, alpha: number) => hexToRgba(hex, alpha);

/** Outline polygon of a pen stroke (perfect-freehand). */
const penOutline = (s: Stroke, stabilizer: string, isActive: boolean) => {
  const stabConfig = STABILIZER_CONFIGS[s.stabilizer || stabilizer || 'basic'] || STABILIZER_CONFIGS.basic;
  return getStroke(
    s.points.map(p => ({ x: p.x, y: p.y, pressure: p.pressure !== undefined ? p.pressure : 0.5 })),
    {
      size: s.width * 2,
      thinning: stabConfig.thinning,
      smoothing: stabConfig.smoothing,
      streamline: stabConfig.streamline,
      simulatePressure: false,
      last: !isActive
    }
  );
};

type PathTarget = { moveTo(x: number, y: number): void; quadraticCurveTo(a: number, b: number, c: number, d: number): void; closePath(): void };
const tracePenOutline = (target: PathTarget, outline: number[][]) => {
  target.moveTo(outline[0][0], outline[0][1]);
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    target.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  target.closePath();
};

/**
 * Committed strokes are immutable (every edit creates a new object), so the expensive
 * perfect-freehand outline can be cached per stroke object.
 */
const penPathCache = new WeakMap<Stroke, { stabilizer: string; path: Path2D }>();

export interface StrokeRenderOptions {
  activeTextEditId?: string | null;
  laserFadeDuration?: number;
  laserMode?: 'individual' | 'group';
  lastLaserActivity?: number;
  isCurrentlyDrawingLaser?: boolean;
  penOpacity?: number;
  highlighterOpacity?: number;
  penStabilizer?: 'off' | 'basic' | 'soft' | 'silky' | 'fluid';
  imageCache?: Record<string, HTMLImageElement>;
  onImageLoad?: () => void;
  now?: number;
  /** The stroke still being drawn (rendered with live, unfinished outlines) */
  activeStroke?: Stroke | null;
}

export const drawStroke = (ctx: CanvasRenderingContext2D, s: Stroke, isActive: boolean, o: StrokeRenderOptions = {}) => {
  if (s.type === 'text' && o.activeTextEditId === s.id) return;
  if (s.points.length === 0) return;
  const penStabilizer = o.penStabilizer || 'basic';
  const laserFadeDuration = o.laserFadeDuration ?? 2000;

  ctx.save();

  const bounds = s.type === 'text' ? measureTextBounds(ctx, s) : getStrokeBounds(s);
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
    ctx.lineWidth = visualStrokeWidth('highlighter', s.width);
    const alpha = s.opacity !== undefined ? s.opacity : (o.highlighterOpacity ?? 0.35);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'source-over';
  } else if (s.type === 'eraser') {
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = visualStrokeWidth('eraser', s.width);
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'destination-out';
  } else if (s.type === 'laser') {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    const now = o.now ?? Date.now();
    if (s.timestamp) {
      if (o.laserMode === 'group') {
        if (o.isCurrentlyDrawingLaser) {
          ctx.globalAlpha = 1.0;
        } else {
          const elapsed = now - (o.lastLaserActivity || s.timestamp);
          ctx.globalAlpha = Math.max(0, Math.min(1, 1 - elapsed / laserFadeDuration));
        }
      } else {
        const elapsed = now - s.timestamp;
        ctx.globalAlpha = Math.max(0, Math.min(1, 1 - elapsed / laserFadeDuration));
      }
    } else {
      ctx.globalAlpha = 1.0;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 8;
    ctx.shadowColor = s.color;
  } else {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.fillColor ? (s.fillOpacity !== undefined ? hexToRgba(s.fillColor, s.fillOpacity) : s.fillColor) : 'transparent';
    ctx.lineWidth = s.width;
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.beginPath();

  if (s.type === 'pen') {
    ctx.fillStyle = s.color;
    const alpha = s.opacity !== undefined ? s.opacity : (o.penOpacity ?? 1);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'source-over';
    const stab = s.stabilizer || penStabilizer;
    if (!isActive && typeof Path2D !== 'undefined') {
      let cached = penPathCache.get(s);
      if (!cached || cached.stabilizer !== stab) {
        const outline = penOutline(s, stab, false);
        const path = new Path2D();
        if (outline.length > 0) tracePenOutline(path, outline);
        cached = { stabilizer: stab, path };
        penPathCache.set(s, cached);
      }
      ctx.fill(cached.path);
    } else {
      const outline = penOutline(s, stab, isActive);
      if (outline.length > 0) {
        ctx.beginPath();
        tracePenOutline(ctx, outline);
        ctx.fill();
      }
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
        ctx.quadraticCurveTo(pt1.x, pt1.y, pt1.x + (pt2.x - pt1.x) / 2, pt1.y + (pt2.y - pt1.y) / 2);
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
      const tb = measureTextBounds(ctx, s);
      if (tb) {
        ctx.fillStyle = s.fillColor;
        ctx.fillRect(tb.x, tb.y, tb.w, tb.h);
      }
    }

    ctx.fillStyle = s.color;
    lines.forEach((line, idx) => {
      ctx.fillText(line, p.x, p.y + (idx * lineHeight));
    });
    if (fmt.isUnderline) {
      for (let i = 0; i < lines.length; i++) {
        const y = p.y + (i * lineHeight) + fmt.fontSize;
        const w = ctx.measureText(lines[i]).width;
        let x = p.x;
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

      let img = o.imageCache ? o.imageCache[s.id] : undefined;
      if (!img && o.imageCache && typeof Image !== 'undefined') {
        img = new Image();
        img.onload = () => { o.onImageLoad?.(); };
        img.src = s.imageUrl;
        o.imageCache[s.id] = img;
      }

      if (img && img.complete && img.naturalWidth > 0) {
        if (s.crop) {
          // Non-destructive crop: draw only the chosen part of the original image
          const nw = img.naturalWidth, nh = img.naturalHeight;
          ctx.drawImage(img, s.crop.x * nw, s.crop.y * nh, s.crop.w * nw, s.crop.h * nh, p1.x, p1.y, w, h);
        } else {
          ctx.drawImage(img, p1.x, p1.y, w, h);
        }
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
      ctx.rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      if (s.isFilled) ctx.fill();
      ctx.stroke();
    }
  } else if (s.type === 'circle' || s.type === 'ellipse') {
    if (s.points.length >= 2) {
      // points[0] / points[1] = opposite corners of the bounding box
      const p1 = s.points[0];
      const p2 = s.points[1];
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;
      ctx.ellipse(p1.x + (p2.x - p1.x) / 2, p1.y + (p2.y - p1.y) / 2, rx, ry, 0, 0, 2 * Math.PI);
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
      } else if (s.isFilled && s.points.length > 2) {
        ctx.fill();
      }
      ctx.stroke();
    }
  } else if (s.type === 'free-ellipse') {
    if (s.points.length > 0) {
      if (!isActive && s.points.length > 2) {
        const len = s.points.length;
        ctx.moveTo((s.points[0].x + s.points[len - 1].x) / 2, (s.points[0].y + s.points[len - 1].y) / 2);
        for (let i = 0; i < len; i++) {
          const next = (i + 1) % len;
          ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, (s.points[i].x + s.points[next].x) / 2, (s.points[i].y + s.points[next].y) / 2);
        }
        ctx.closePath();
        if (s.isFilled) ctx.fill();
      } else {
        ctx.moveTo(s.points[0].x, s.points[0].y);
        if (s.points.length === 1) {
          ctx.lineTo(s.points[0].x, s.points[0].y);
        } else {
          for (let i = 1; i < s.points.length - 1; i++) {
            const a = s.points[i];
            const b = s.points[i + 1];
            ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
          }
          const last = s.points[s.points.length - 1];
          ctx.lineTo(last.x, last.y);
        }
        if (isActive && s.isFilled && s.points.length > 2) ctx.fill();
      }
      ctx.stroke();
    }
  }

  ctx.restore();
};

const drawHandles = (ctx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, color: string) => {
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = color;
  const hs = 7;
  const pts: [number, number][] = [
    [bx, by], [bx + bw / 2, by], [bx + bw, by], [bx, by + bh / 2],
    [bx + bw, by + bh / 2], [bx, by + bh], [bx + bw / 2, by + bh], [bx + bw, by + bh]
  ];
  for (const [hx, hy] of pts) {
    ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }
};

/** Marquee / lasso and the selection outline with its resize handles. */
export const drawSelectionOverlay = (
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  selectedStrokeIds: string[],
  selectionBox: Rect | null,
  lassoPoints: Point[] | null,
  accent: string = '#3b82f6'
) => {
  // Selection UI follows the theme accent (canvas cannot read CSS variables)
  const soft = (alpha: number) => withAlpha(accent, alpha);
  if (selectionBox) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = soft(0.12);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
    ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
    ctx.restore();
  }

  if (lassoPoints && lassoPoints.length > 1) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = soft(0.12);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    for (let i = 1; i < lassoPoints.length; i++) ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (selectedStrokeIds.length === 0) return;
  const selected = strokes.filter(s => selectedStrokeIds.includes(s.id));

  if (selected.length === 1) {
    const s = selected[0];
    const bounds = s.type === 'text' ? measureTextBounds(ctx, s) : getStrokeBounds(s);
    if (!bounds) return;
    ctx.save();
    if (s.rotation) {
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.w + 4, bounds.h + 4);
    ctx.fillStyle = soft(0.05);
    ctx.fillRect(bounds.x - 2, bounds.y - 2, bounds.w + 4, bounds.h + 4);
    if (s.type !== 'text') drawHandles(ctx, bounds.x - 2, bounds.y - 2, bounds.w + 4, bounds.h + 4, accent);
    ctx.restore();
    return;
  }

  selected.forEach(s => {
    const b = s.type === 'text' ? measureTextBounds(ctx, s) : getStrokeBounds(s);
    if (!b) return;
    ctx.save();
    if (s.rotation) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    ctx.strokeStyle = soft(0.55);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
    ctx.restore();
  });

  const combined = getCombinedBounds(selected);
  if (combined) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(combined.x - 3, combined.y - 3, combined.w + 6, combined.h + 6);
    ctx.fillStyle = soft(0.05);
    ctx.fillRect(combined.x - 3, combined.y - 3, combined.w + 6, combined.h + 6);
    drawHandles(ctx, combined.x - 3, combined.y - 3, combined.w + 6, combined.h + 6, accent);
    ctx.restore();
  }
};

/**
 * Draws a whole document so that the pixel eraser removes INK only, never inserted images.
 *
 * Ink is drawn into separate transparent layers, one per stretch of strokes between
 * images; the images go between the layers, keeping the original stacking order. An
 * eraser stroke is applied to every ink layer at or below it, so it still removes ink
 * drawn on top of (or beside) an image, but the image underneath stays intact.
 * Without images this is exactly the plain sequential draw (no extra canvases).
 */
export const drawDocument = (ctx: CanvasRenderingContext2D, strokes: Stroke[], o: StrokeRenderOptions = {}) => {
  const hasImage = strokes.some(s => s.type === 'image');
  const hasEraser = strokes.some(s => s.type === 'eraser');
  if (!hasImage || !hasEraser || typeof ctx.getTransform !== 'function') {
    strokes.forEach(s => drawStroke(ctx, s, s === o.activeStroke, o));
    return;
  }

  const transform = ctx.getTransform();
  const { width, height } = ctx.canvas;
  const newLayer = () => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const lctx = c.getContext('2d');
    if (lctx) lctx.setTransform(transform);
    return { c, lctx };
  };

  type Item = { kind: 'ink'; layer: ReturnType<typeof newLayer> } | { kind: 'image'; stroke: Stroke };
  const items: Item[] = [];
  let current = newLayer();
  items.push({ kind: 'ink', layer: current });
  const inkLayers = [current];

  for (const s of strokes) {
    const active = s === o.activeStroke;
    if (s.type === 'image') {
      items.push({ kind: 'image', stroke: s });
      current = newLayer();
      items.push({ kind: 'ink', layer: current });
      inkLayers.push(current);
    } else if (s.type === 'eraser') {
      // erase from all ink so far (this layer and those below), never from images
      inkLayers.forEach(l => { if (l.lctx) drawStroke(l.lctx, s, active, o); });
    } else if (current.lctx) {
      drawStroke(current.lctx, s, active, o);
    }
  }

  for (const item of items) {
    if (item.kind === 'image') {
      drawStroke(ctx, item.stroke, false, o);
    } else {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(item.layer.c, 0, 0);
      ctx.restore();
    }
  }
};

/**
 * Backwards-compatible entry point: draws strokes, the active stroke and the selection.
 * Used by the screenshot compositor and the tests.
 */
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
  const o: StrokeRenderOptions = {
    activeTextEditId, laserFadeDuration, laserMode, lastLaserActivity, isCurrentlyDrawingLaser,
    penOpacity, highlighterOpacity, penStabilizer, imageCache, onImageLoad: triggerRender
  };
  drawDocument(ctx, activeStroke ? [...strokesToDraw, activeStroke] : strokesToDraw, { ...o, activeStroke });
  drawSelectionOverlay(ctx, strokesToDraw, selectedStrokeIds, selectionBox, lassoPoints);
};

type HandleId = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

const handleAt = (x: number, y: number, b: Rect, pad: number): HandleId | null => {
  const bx = b.x - pad, by = b.y - pad, bw = b.w + pad * 2, bh = b.h + pad * 2;
  const hs = 10;
  const handles: { id: HandleId; x: number; y: number }[] = [
    { id: 'nw', x: bx, y: by }, { id: 'n', x: bx + bw / 2, y: by }, { id: 'ne', x: bx + bw, y: by },
    { id: 'w', x: bx, y: by + bh / 2 }, { id: 'e', x: bx + bw, y: by + bh / 2 },
    { id: 'sw', x: bx, y: by + bh }, { id: 's', x: bx + bw / 2, y: by + bh }, { id: 'se', x: bx + bw, y: by + bh },
  ];
  for (const h of handles) {
    if (Math.abs(x - h.x) <= hs && Math.abs(y - h.y) <= hs) return h.id;
  }
  return null;
};

/** Scale factors + fixed anchor for dragging a resize handle by (dx, dy) in local space. */
const resizeTransform = (handle: HandleId, bounds: Rect, dx: number, dy: number) => {
  let scaleX = 1, scaleY = 1, anchorX = bounds.x, anchorY = bounds.y;
  if (handle.includes('e')) { scaleX = (bounds.w + dx) / bounds.w; anchorX = bounds.x; }
  if (handle.includes('w')) { scaleX = (bounds.w - dx) / bounds.w; anchorX = bounds.x + bounds.w; }
  if (handle.includes('s')) { scaleY = (bounds.h + dy) / bounds.h; anchorY = bounds.y; }
  if (handle.includes('n')) { scaleY = (bounds.h - dy) / bounds.h; anchorY = bounds.y + bounds.h; }
  if (!isFinite(scaleX) || bounds.w === 0) scaleX = 1;
  if (!isFinite(scaleY) || bounds.h === 0) scaleY = 1;
  return { scaleX, scaleY, anchorX, anchorY };
};

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  isAnnotationMode,
  isActive = true,
  tool,
  color,
  fillColor,
  isFilled,
  fillOpacity,
  width,
  laserWidth,
  fontFamily = 'Arial',
  fontSize = 24,
  isBold = false,
  isItalic = false,
  isUnderline = false,
  alignment = 'left',
  textBackground = false,
  eraserMode = 'object',
  laserFadeDuration = 2000,
  laserMode = 'individual',
  penOpacity = 1.0,
  highlighterOpacity = 0.35,
  penStabilizer = 'basic',
  autoShapeRecognition = true,
  selectMode = 'rectangle',
  selectionColor = '#3b82f6',
  onTextEditStart,
  onSelectedStrokeChange
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Document state. Refs are the source of truth for event handlers and rendering;
  //    React state only drives re-renders of the parent-facing bits.
  const [strokes, setStrokesState] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const historyRef = useRef<Stroke[][]>([[]]);
  const historyIndexRef = useRef<number>(0);
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Laser trails are transient: they live outside the document and the undo history.
  const lasersRef = useRef<Stroke[]>([]);
  const lastLaserActivityRef = useRef<number>(0);
  const laserLoopRef = useRef<number | null>(null);

  const [selectedStrokeIds, setSelectedStrokeIdsState] = useState<string[]>([]);
  const selectedIdsRef = useRef<string[]>([]);

  const [activeTextEdit, setActiveTextEditState] = useState<{ id: string, stroke: Stroke, text: string } | null>(null);
  const activeTextEditRef = useRef<{ id: string, stroke: Stroke, text: string } | null>(null);

  // Pointer interaction
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingPolygonRef = useRef(false);
  const drawFrameRef = useRef<number | null>(null);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldSnappedRef = useRef<boolean>(false);
  const holdAnchorPointRef = useRef<Point | null>(null);
  const recognizedInitialPointsRef = useRef<Point[] | null>(null);

  const selectionBoxRef = useRef<Rect | null>(null);
  const lassoPointsRef = useRef<Point[] | null>(null);
  const isDraggingSelectionRef = useRef<boolean>(false);
  const draggingStrokesOriginalRef = useRef<{ id: string, points: Point[] }[]>([]);
  const dragStartPointRef = useRef<Point | null>(null);
  const originalBoundsRef = useRef<Rect | null>(null);
  const resizeHandleRef = useRef<HandleId | null>(null);
  const resizeRotationRef = useRef<{ rotation: number; center: { x: number; y: number } } | null>(null);
  const dragMovedRef = useRef(false);

  // Cache of the committed strokes, so a frame only redraws what is changing
  const cacheRef = useRef<{ canvas: HTMLCanvasElement | null; strokes: Stroke[] | null; w: number; h: number; dpr: number; textEditId: string | null; imagesVersion: number }>(
    { canvas: null, strokes: null, w: 0, h: 0, dpr: 0, textEditId: null, imagesVersion: 0 }
  );
  const imagesVersionRef = useRef(0);

  const propsRef = useRef({ tool, color, fillColor, isFilled, fillOpacity, width, laserWidth, isAnnotationMode, isActive, fontFamily, fontSize, isBold, isItalic, isUnderline, alignment, textBackground, eraserMode, laserFadeDuration, laserMode, penOpacity, highlighterOpacity, penStabilizer, autoShapeRecognition, selectMode, selectionColor });
  propsRef.current = { tool, color, fillColor, isFilled, fillOpacity, width, laserWidth, isAnnotationMode, isActive, fontFamily, fontSize, isBold, isItalic, isUnderline, alignment, textBackground, eraserMode, laserFadeDuration, laserMode, penOpacity, highlighterOpacity, penStabilizer, autoShapeRecognition, selectMode, selectionColor };

  // ── Rendering ──────────────────────────────────────────────────────────────
  const renderNow = useCallback(() => {
    drawFrameRef.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const p = propsRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const pw = Math.round(rect.width * dpr);
    const ph = Math.round(rect.height * dpr);
    if (pw === 0 || ph === 0) return; // hidden board: nothing to draw
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }

    const textEditId = activeTextEditRef.current?.id || null;
    const opts: StrokeRenderOptions = {
      activeTextEditId: textEditId,
      laserFadeDuration: p.laserFadeDuration,
      laserMode: p.laserMode,
      lastLaserActivity: lastLaserActivityRef.current,
      isCurrentlyDrawingLaser: isDrawingRef.current && currentStrokeRef.current?.type === 'laser',
      penOpacity: p.penOpacity,
      highlighterOpacity: p.highlighterOpacity,
      penStabilizer: p.penStabilizer,
      imageCache: imageCacheRef.current,
      onImageLoad: () => { imagesVersionRef.current++; scheduleRender(); },
    };

    // 1. Committed strokes (re-rendered only when they change)
    const cache = cacheRef.current;
    if (!cache.canvas) cache.canvas = document.createElement('canvas');
    const stale = cache.strokes !== strokesRef.current || cache.w !== pw || cache.h !== ph || cache.dpr !== dpr ||
      cache.textEditId !== textEditId || cache.imagesVersion !== imagesVersionRef.current;
    if (stale) {
      const cc = cache.canvas;
      cc.width = pw;
      cc.height = ph;
      const cctx = cc.getContext('2d');
      if (cctx) {
        cctx.setTransform(1, 0, 0, 1, 0, 0);
        cctx.clearRect(0, 0, pw, ph);
        cctx.scale(dpr, dpr);
        drawDocument(cctx, strokesRef.current, opts);
      }
      Object.assign(cache, { strokes: strokesRef.current, w: pw, h: ph, dpr, textEditId, imagesVersion: imagesVersionRef.current });
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    const active = currentStrokeRef.current;
    const erasingAroundImages = active?.type === 'eraser' && strokesRef.current.some(s => s.type === 'image');
    if (erasingAroundImages) {
      // Live pixel-eraser preview must spare images too: redraw the document with it
      ctx.scale(dpr, dpr);
      drawDocument(ctx, [...strokesRef.current, active], { ...opts, activeStroke: active });
    } else {
      ctx.drawImage(cache.canvas, 0, 0);
      ctx.scale(dpr, dpr);
    }

    // 2. The stroke being drawn (a pixel eraser cuts into the cached ink here)
    if (active && !erasingAroundImages) drawStroke(ctx, active, true, opts);
    // 3. Fading laser trails
    lasersRef.current.forEach(s => drawStroke(ctx, s, false, opts));
    // 4. Selection UI
    drawSelectionOverlay(ctx, strokesRef.current, selectedIdsRef.current, selectionBoxRef.current, lassoPointsRef.current, p.selectionColor);
    ctx.restore();
  }, []);

  const scheduleRender = useCallback(() => {
    if (drawFrameRef.current !== null) return;
    drawFrameRef.current = requestAnimationFrame(renderNow);
  }, [renderNow]);

  // ── State helpers (keep refs and React state in sync) ──────────────────────
  const setStrokes = useCallback((next: Stroke[]) => {
    strokesRef.current = next;
    setStrokesState(next);
    scheduleRender();
  }, [scheduleRender]);

  const setSelectedStrokeIds = useCallback((ids: string[]) => {
    selectedIdsRef.current = ids;
    setSelectedStrokeIdsState(ids);
    scheduleRender();
  }, [scheduleRender]);

  const setActiveTextEdit = useCallback((value: { id: string, stroke: Stroke, text: string } | null) => {
    activeTextEditRef.current = value;
    setActiveTextEditState(value);
    scheduleRender();
  }, [scheduleRender]);

  const commitHistory = useCallback((newStrokes: Stroke[]) => {
    let newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(newStrokes);
    if (newHistory.length > MAX_HISTORY + 1) newHistory = newHistory.slice(newHistory.length - (MAX_HISTORY + 1));
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setStrokes(newStrokes);
  }, [setStrokes]);

  // Expose selection to parent
  useEffect(() => {
    if (!onSelectedStrokeChange) return;
    if (selectedStrokeIds.length === 1) {
      let stroke = strokes.find(s => s.id === selectedStrokeIds[0]);
      if (!stroke && activeTextEdit && activeTextEdit.id === selectedStrokeIds[0]) stroke = activeTextEdit.stroke;
      onSelectedStrokeChange(stroke || null);
    } else {
      onSelectedStrokeChange(null); // none, or a multi-selection (no single properties panel)
    }
  }, [selectedStrokeIds, strokes, activeTextEdit, onSelectedStrokeChange]);

  // Re-render when display-related props change
  useEffect(() => { scheduleRender(); }, [penOpacity, highlighterOpacity, penStabilizer, isActive, selectionColor, scheduleRender]);

  useEffect(() => {
    const handleResize = () => scheduleRender();
    window.addEventListener('resize', handleResize);
    scheduleRender();
    return () => window.removeEventListener('resize', handleResize);
  }, [scheduleRender]);

  // ── Laser fade loop: runs only while there is something to fade ────────────
  const ensureLaserLoop = useCallback(() => {
    if (laserLoopRef.current !== null) return;
    const tick = () => {
      const now = Date.now();
      const p = propsRef.current;
      const drawingLaser = isDrawingRef.current && currentStrokeRef.current?.type === 'laser';
      if (p.laserMode === 'group') {
        if (drawingLaser) lastLaserActivityRef.current = now;
        else if (now - lastLaserActivityRef.current >= p.laserFadeDuration) lasersRef.current = [];
      } else {
        lasersRef.current = lasersRef.current.filter(s => now - (s.timestamp || now) < p.laserFadeDuration);
      }
      renderNow();
      if (lasersRef.current.length > 0 || drawingLaser) {
        laserLoopRef.current = requestAnimationFrame(tick);
      } else {
        laserLoopRef.current = null;
      }
    };
    laserLoopRef.current = requestAnimationFrame(tick);
  }, [renderNow]);

  useEffect(() => () => {
    // Reset the handles too: React (StrictMode / fast refresh) can unmount and re-mount
    // the same component, and a stale non-null handle would block every future frame.
    if (laserLoopRef.current !== null) cancelAnimationFrame(laserLoopRef.current);
    laserLoopRef.current = null;
    if (drawFrameRef.current !== null) cancelAnimationFrame(drawFrameRef.current);
    drawFrameRef.current = null;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }, []);

  // ── Hit testing ────────────────────────────────────────────────────────────
  const hitTest = (ctx: CanvasRenderingContext2D, x: number, y: number, list: Stroke[]) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const stroke = list[i];
      const bounds = stroke.type === 'text' ? measureTextBounds(ctx, stroke) : getStrokeBounds(stroke);
      let testX = x, testY = y;
      if (stroke.rotation && bounds) {
        const r = rotatePoint(x, y, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, -stroke.rotation);
        testX = r.x; testY = r.y;
      }
      if (stroke.type === 'text') {
        if (bounds && testX >= bounds.x && testX <= bounds.x + bounds.w && testY >= bounds.y && testY <= bounds.y + bounds.h) return stroke.id;
      } else if (hitTestShape(testX, testY, stroke)) {
        return stroke.id;
      }
    }
    return null;
  };

  /** Resize handle under the pointer for the current selection (single or group). */
  const hitTestHandles = (x: number, y: number): HandleId | null => {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return null;
    const selected = strokesRef.current.filter(s => ids.includes(s.id));
    if (selected.length === 1) {
      const stroke = selected[0];
      if (stroke.type === 'text') return null;
      const bounds = getStrokeBounds(stroke);
      if (!bounds) return null;
      let tx = x, ty = y;
      if (stroke.rotation) {
        const r = rotatePoint(x, y, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, -stroke.rotation);
        tx = r.x; ty = r.y;
      }
      return handleAt(tx, ty, bounds, 2);
    }
    const combined = getCombinedBounds(selected);
    return combined ? handleAt(x, y, combined, 3) : null;
  };

  // ── Text editing ───────────────────────────────────────────────────────────
  const finishTextEdit = useCallback(() => {
    const edit = activeTextEditRef.current;
    if (!edit) return;
    const current = strokesRef.current;
    if (edit.text.trim()) {
      const updated: Stroke = { ...edit.stroke, textFormat: { ...edit.stroke.textFormat!, text: edit.text } };
      const idx = current.findIndex(s => s.id === edit.id);
      if (idx >= 0) {
        const next = [...current];
        next[idx] = updated;
        commitHistory(next);
      } else {
        commitHistory([...current, updated]);
      }
      setSelectedStrokeIds([updated.id]);
    } else {
      // Emptied text is removed
      if (current.some(s => s.id === edit.id)) commitHistory(current.filter(s => s.id !== edit.id));
      setSelectedStrokeIds([]);
    }
    setActiveTextEdit(null);
  }, [commitHistory, setSelectedStrokeIds, setActiveTextEdit]);

  // ── Polygons ───────────────────────────────────────────────────────────────
  const commitPolygon = useCallback(() => {
    if (isDrawingPolygonRef.current && currentStrokeRef.current) {
      isDrawingPolygonRef.current = false;
      const stroke = currentStrokeRef.current;
      if (stroke.points.length > 2) stroke.points.pop(); // drop the rubber-band point
      currentStrokeRef.current = null;
      if (stroke.points.length >= 3) commitHistory([...strokesRef.current, { ...stroke, points: [...stroke.points] }]);
      scheduleRender();
    }
  }, [commitHistory, scheduleRender]);

  const cancelPolygon = useCallback(() => {
    if (isDrawingPolygonRef.current) {
      isDrawingPolygonRef.current = false;
      currentStrokeRef.current = null;
      scheduleRender();
    }
  }, [scheduleRender]);

  // ── Imperative API for the parent ──────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    undo: () => {
      if (isDrawingPolygonRef.current) return cancelPolygon();
      if (activeTextEditRef.current) return; // typing has its own undo
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        setStrokes(historyRef.current[historyIndexRef.current]);
        setSelectedStrokeIds([]);
      }
    },
    redo: () => {
      if (isDrawingPolygonRef.current) cancelPolygon();
      if (activeTextEditRef.current) return;
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current++;
        setStrokes(historyRef.current[historyIndexRef.current]);
        setSelectedStrokeIds([]);
      }
    },
    clear: () => {
      if (isDrawingPolygonRef.current) cancelPolygon();
      if (activeTextEditRef.current) setActiveTextEdit(null);
      if (strokesRef.current.length > 0) commitHistory([]);
      setSelectedStrokeIds([]);
    },
    getStrokes: () => strokesRef.current,
    hasStrokes: () => strokesRef.current.length > 0,
    addStroke: (stroke: Stroke) => {
      if (stroke.type === 'image' && stroke.imageUrl) {
        const img = new Image();
        img.onload = () => { imagesVersionRef.current++; scheduleRender(); };
        img.src = stroke.imageUrl;
        imageCacheRef.current[stroke.id] = img;
      }
      // Always append to the latest document (an image may finish loading later)
      commitHistory([...strokesRef.current, stroke]);
    },
    deleteSelected: () => {
      const toDelete = selectedIdsRef.current;
      if (toDelete.length > 0) {
        commitHistory(strokesRef.current.filter(s => !toDelete.includes(s.id)));
        setSelectedStrokeIds([]);
      }
    },
    getSelectedStrokeIds: () => selectedIdsRef.current,
    updateStroke: (id: string, updates: Partial<Stroke>, commit: boolean = true) => {
      const edit = activeTextEditRef.current;
      if (edit && edit.id === id) {
        const merged: Stroke = {
          ...edit.stroke,
          ...updates,
          textFormat: updates.textFormat ? { ...edit.stroke.textFormat!, ...updates.textFormat } : edit.stroke.textFormat
        };
        setActiveTextEdit({ ...edit, stroke: merged });
        onSelectedStrokeChange?.(merged);
      }

      const current = strokesRef.current;
      const idx = current.findIndex(s => s.id === id);
      if (idx !== -1) {
        const next = [...current];
        next[idx] = {
          ...next[idx],
          ...updates,
          textFormat: updates.textFormat ? { ...next[idx].textFormat!, ...updates.textFormat } : next[idx].textFormat
        };
        if (commit) commitHistory(next);
        else setStrokes(next);
      }
    },
    deselect: () => setSelectedStrokeIds([]),
    getBoundingBox: (id: string) => {
      let s = strokesRef.current.find(st => st.id === id);
      if (!s && activeTextEditRef.current && activeTextEditRef.current.id === id) s = activeTextEditRef.current.stroke;
      if (!s) return null;
      let bounds: Rect | null = null;
      if (s.type === 'text') {
        const ctx = document.createElement('canvas').getContext('2d');
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
        const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
        return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      }
      return bounds;
    }
  }), [cancelPolygon, commitHistory, setStrokes, setSelectedStrokeIds, setActiveTextEdit, scheduleRender, onSelectedStrokeChange]);

  // Escape / Enter for polygons and selection. Deleting is handled once, by the App
  // (configurable "delete" shortcut), so a key press never deletes twice.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!propsRef.current.isActive) return;
      if (activeTextEditRef.current) return; // the textarea handles its own keys
      if (e.key === 'Escape') {
        cancelPolygon();
        if (selectedIdsRef.current.length) setSelectedStrokeIds([]);
      }
      if (e.key === 'Enter') commitPolygon();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commitPolygon, cancelPolygon, setSelectedStrokeIds]);

  // Leaving annotation mode finishes whatever was in progress
  useEffect(() => {
    if (!isAnnotationMode) {
      if (isDrawingPolygonRef.current) commitPolygon();
      if (activeTextEditRef.current) finishTextEdit();
    }
  }, [isAnnotationMode, commitPolygon, finishTextEdit]);

  const applyConstraints = (start: Point, end: Point, t: Tool, shiftKey: boolean): Point => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const toSquare = () => {
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      return { x: start.x + (dx >= 0 ? 1 : -1) * size, y: start.y + (dy >= 0 ? 1 : -1) * size };
    };
    if (t === 'square' || t === 'circle') return toSquare();
    if (!shiftKey) return end;
    if (t === 'rectangle' || t === 'ellipse') return toSquare();
    if (t === 'line' || t === 'arrow' || t === 'double-arrow') {
      const snapped = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.hypot(dx, dy);
      return { x: start.x + Math.cos(snapped) * dist, y: start.y + Math.sin(snapped) * dist };
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
      scheduleRender();
    }
  }, [scheduleRender]);

  const armHoldTimer = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(triggerHoldSnap, 420);
  };

  const toPoint = (e: { clientX: number; clientY: number; pointerType?: string; pressure?: number }): Point => ({
    x: e.clientX,
    y: e.clientY,
    pressure: e.pointerType === 'pen' ? e.pressure : 0.5
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const props = propsRef.current;
    if (!props.isAnnotationMode) return;

    // Clicking anywhere finishes an active text edit
    if (activeTextEditRef.current) {
      finishTextEdit();
      return;
    }

    const point = toPoint(e);
    const target = e.currentTarget;
    const current = strokesRef.current;

    if (props.tool === 'select') {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      dragMovedRef.current = false;

      // 1. Resize handles of the current selection (single or group)
      const handleId = hitTestHandles(point.x, point.y);
      if (handleId) {
        const ids = selectedIdsRef.current;
        const selected = current.filter(s => ids.includes(s.id));
        resizeHandleRef.current = handleId;
        isDrawingRef.current = true;
        isDraggingSelectionRef.current = false;
        target.setPointerCapture(e.pointerId);
        dragStartPointRef.current = point;
        draggingStrokesOriginalRef.current = selected.map(s => ({ id: s.id, points: s.points.map(p => ({ ...p })) }));
        if (selected.length === 1) {
          const b = getStrokeBounds(selected[0]);
          originalBoundsRef.current = b;
          resizeRotationRef.current = selected[0].rotation && b
            ? { rotation: selected[0].rotation, center: { x: b.x + b.w / 2, y: b.y + b.h / 2 } }
            : null;
        } else {
          originalBoundsRef.current = getCombinedBounds(selected);
          resizeRotationRef.current = null;
        }
        return;
      }
      resizeHandleRef.current = null;

      // 2. Inside the current selection -> move all selected strokes
      if (selectedIdsRef.current.length > 0) {
        const selected = current.filter(s => selectedIdsRef.current.includes(s.id));
        const combined = getCombinedBounds(selected);
        if (combined && point.x >= combined.x && point.x <= combined.x + combined.w && point.y >= combined.y && point.y <= combined.y + combined.h) {
          isDrawingRef.current = true;
          isDraggingSelectionRef.current = true;
          dragStartPointRef.current = point;
          draggingStrokesOriginalRef.current = selected.map(s => ({ id: s.id, points: s.points.map(p => ({ ...p })) }));
          target.setPointerCapture(e.pointerId);
          return;
        }
      }

      // 3. Directly on a stroke
      const hitId = hitTest(ctx, point.x, point.y, current);
      if (hitId) {
        setSelectedStrokeIds([hitId]);
        const hitStroke = current.find(s => s.id === hitId);
        if (hitStroke) {
          isDrawingRef.current = true;
          isDraggingSelectionRef.current = true;
          dragStartPointRef.current = point;
          draggingStrokesOriginalRef.current = [{ id: hitStroke.id, points: hitStroke.points.map(p => ({ ...p })) }];
          target.setPointerCapture(e.pointerId);
        }
        return;
      }

      // 4. Empty area -> marquee or lasso
      setSelectedStrokeIds([]);
      isDrawingRef.current = true;
      isDraggingSelectionRef.current = false;
      dragStartPointRef.current = point;
      if (props.selectMode === 'lasso') {
        lassoPointsRef.current = [point];
        selectionBoxRef.current = null;
      } else {
        selectionBoxRef.current = { x: point.x, y: point.y, w: 0, h: 0 };
        lassoPointsRef.current = null;
      }
      target.setPointerCapture(e.pointerId);
      scheduleRender();
      return;
    }

    if (props.tool === 'eraser' && props.eraserMode !== 'pixel') {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        // Images are never erased (only selection + Delete removes them). Hitting an
        // image also protects the ink hidden underneath it.
        const hitId = hitTest(ctx, point.x, point.y, current);
        const hit = hitId ? current.find(s => s.id === hitId) : undefined;
        if (hit && hit.type !== 'image') commitHistory(current.filter(s => s.id !== hitId));
        isDrawingRef.current = true;
        target.setPointerCapture(e.pointerId);
      }
      return;
    }

    if (selectedIdsRef.current.length) setSelectedStrokeIds([]);

    if (props.tool === 'text') {
      const newId = newStrokeId();
      const newStroke: Stroke = {
        id: newId,
        type: 'text',
        color: props.color,
        fillColor: props.fillColor,
        isFilled: props.textBackground, // text has its own background default (not the shape fill)
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
      setSelectedStrokeIds([newId]);
      onTextEditStart?.(newId);
      return;
    }

    if (props.tool === 'polygon' || props.tool === 'free-polygon' || props.tool === 'free-ellipse') {
      if (!isDrawingPolygonRef.current) {
        isDrawingPolygonRef.current = true;
        currentStrokeRef.current = {
          id: newStrokeId(),
          color: props.color,
          fillColor: props.fillColor,
          fillOpacity: props.isFilled ? props.fillOpacity : undefined,
          isFilled: props.isFilled,
          width: props.width,
          type: props.tool,
          points: [point, { ...point }],
          ...(props.tool === 'polygon' && e.shiftKey ? { isEquilateral: true } : {})
        };
      } else if (currentStrokeRef.current) {
        const stroke = currentStrokeRef.current;
        if (props.tool === 'polygon' && stroke.isEquilateral) {
          commitPolygon();
          return;
        }
        const start = stroke.points[0];
        // Close free polygon / ellipse when clicking near the start
        if ((props.tool === 'free-polygon' || props.tool === 'free-ellipse') && Math.hypot(start.x - point.x, start.y - point.y) < 20 && stroke.points.length > 3) {
          commitPolygon();
          return;
        }
        stroke.points[stroke.points.length - 1] = point;
        stroke.points.push({ ...point });
        // Triangle closes after its third corner
        if (props.tool === 'polygon' && stroke.points.length === 4) {
          commitPolygon();
          return;
        }
      }
      scheduleRender();
      return;
    }

    isDrawingRef.current = true;
    isHoldSnappedRef.current = false;
    recognizedInitialPointsRef.current = null;
    holdAnchorPointRef.current = point;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if ((props.tool === 'pen' || props.tool === 'highlighter') && props.autoShapeRecognition !== false) armHoldTimer();

    target.setPointerCapture(e.pointerId);

    currentStrokeRef.current = {
      id: newStrokeId(),
      color: props.color,
      fillColor: props.fillColor,
      fillOpacity: props.isFilled ? props.fillOpacity : undefined,
      isFilled: props.isFilled,
      width: props.tool === 'laser' ? (props.laserWidth ?? props.width) : props.width,
      type: props.tool,
      points: [point, { ...point }],
      ...(props.tool === 'pen' ? { opacity: props.penOpacity ?? 1.0, stabilizer: props.penStabilizer || 'basic' } : {}),
      ...(props.tool === 'highlighter' ? { opacity: props.highlighterOpacity ?? 0.35 } : {})
    };

    if (props.tool === 'laser') {
      lastLaserActivityRef.current = Date.now();
      ensureLaserLoop();
    }
    scheduleRender();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const props = propsRef.current;
    if (!props.isAnnotationMode) return;
    const point = toPoint(e);
    const current = strokesRef.current;

    if (props.tool === 'select' && isDrawingRef.current) {
      const start = dragStartPointRef.current;
      // A. Resize (single stroke or group)
      if (resizeHandleRef.current && start && originalBoundsRef.current) {
        dragMovedRef.current = true;
        const bounds = originalBoundsRef.current;
        let dx = point.x - start.x;
        let dy = point.y - start.y;
        const rot = resizeRotationRef.current;
        if (rot) {
          // Work in the shape's own (unrotated) frame
          const pLocal = rotatePoint(point.x, point.y, rot.center.x, rot.center.y, -rot.rotation);
          const sLocal = rotatePoint(start.x, start.y, rot.center.x, rot.center.y, -rot.rotation);
          dx = pLocal.x - sLocal.x;
          dy = pLocal.y - sLocal.y;
        }
        const { scaleX, scaleY, anchorX, anchorY } = resizeTransform(resizeHandleRef.current, bounds, dx, dy);
        const origMap = new Map(draggingStrokesOriginalRef.current.map(o => [o.id, o.points]));

        // A rotated shape is drawn rotated about its bounds centre. Scaling moves that
        // centre, so shift the result to keep the dragged-from corner fixed on screen.
        let offX = 0, offY = 0;
        if (rot) {
          const nb = {
            x: anchorX + (bounds.x - anchorX) * scaleX,
            y: anchorY + (bounds.y - anchorY) * scaleY,
            w: bounds.w * scaleX,
            h: bounds.h * scaleY
          };
          const minX = Math.min(nb.x, nb.x + nb.w), minY = Math.min(nb.y, nb.y + nb.h);
          const newCenter = { x: minX + Math.abs(nb.w) / 2, y: minY + Math.abs(nb.h) / 2 };
          const before = rotatePoint(anchorX, anchorY, rot.center.x, rot.center.y, rot.rotation);
          const after = rotatePoint(anchorX, anchorY, newCenter.x, newCenter.y, rot.rotation);
          offX = before.x - after.x;
          offY = before.y - after.y;
        }

        const next = current.map(s => {
          const orig = origMap.get(s.id);
          if (!orig) return s;
          return {
            ...s,
            points: orig.map(p => ({
              x: anchorX + (p.x - anchorX) * scaleX + offX,
              y: anchorY + (p.y - anchorY) * scaleY + offY,
              pressure: p.pressure
            }))
          };
        });
        setStrokes(next);
        return;
      }

      // B. Move selected strokes
      if (isDraggingSelectionRef.current && start && draggingStrokesOriginalRef.current.length > 0) {
        const dx = point.x - start.x;
        const dy = point.y - start.y;
        if (Math.abs(dx) + Math.abs(dy) > 0) dragMovedRef.current = true;
        const origMap = new Map(draggingStrokesOriginalRef.current.map(o => [o.id, o.points]));
        setStrokes(current.map(s => {
          const orig = origMap.get(s.id);
          return orig ? { ...s, points: orig.map(p => ({ x: p.x + dx, y: p.y + dy, pressure: p.pressure })) } : s;
        }));
        return;
      }

      // C. Marquee
      if (selectionBoxRef.current && start) {
        selectionBoxRef.current = {
          x: Math.min(start.x, point.x), y: Math.min(start.y, point.y),
          w: Math.abs(point.x - start.x), h: Math.abs(point.y - start.y)
        };
        scheduleRender();
        return;
      }

      // D. Lasso
      if (lassoPointsRef.current) {
        lassoPointsRef.current.push(point);
        scheduleRender();
      }
      return;
    }

    if (props.tool === 'eraser' && isDrawingRef.current && props.eraserMode !== 'pixel') {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        // Images are never erased (only selection + Delete removes them). Hitting an
        // image also protects the ink hidden underneath it.
        const hitId = hitTest(ctx, point.x, point.y, current);
        const hit = hitId ? current.find(s => s.id === hitId) : undefined;
        if (hit && hit.type !== 'image') commitHistory(current.filter(s => s.id !== hitId));
      }
      return;
    }

    if (isDrawingPolygonRef.current && currentStrokeRef.current) {
      const stroke = currentStrokeRef.current;
      if (stroke.type === 'polygon' && stroke.isEquilateral) {
        stroke.points[1] = point;
        const p0 = stroke.points[0];
        const angle = Math.atan2(point.y - p0.y, point.x - p0.x);
        const dist = Math.hypot(point.x - p0.x, point.y - p0.y);
        const p2 = { x: p0.x + dist * Math.cos(angle - Math.PI / 3), y: p0.y + dist * Math.sin(angle - Math.PI / 3) };
        stroke.points[2] = p2;
        stroke.points[3] = { ...p2 };
      } else {
        stroke.points[stroke.points.length - 1] = point;
      }
      scheduleRender();
      return;
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const stroke = currentStrokeRef.current;
    const strokeType = stroke.type as string;

    if (isHoldSnappedRef.current) {
      // Keep scaling the recognised shape while the pointer stays down
      if (strokeType === 'line' || strokeType === 'arrow') {
        stroke.points[1] = point;
      } else if (strokeType === 'rectangle' || strokeType === 'square' || strokeType === 'circle' || strokeType === 'ellipse') {
        stroke.points[1] = (strokeType === 'square' || strokeType === 'circle')
          ? applyConstraints(stroke.points[0], point, stroke.type, false)
          : point;
      } else if (strokeType === 'polygon' && recognizedInitialPointsRef.current) {
        const initPts = recognizedInitialPointsRef.current;
        const xs = initPts.map(p => p.x), ys = initPts.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const origDist = Math.hypot(maxX - cx, maxY - cy) || 1;
        const scale = Math.max(0.2, Math.hypot(point.x - cx, point.y - cy) / origDist);
        stroke.points = initPts.map(p => ({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale }));
      }
      scheduleRender();
      return;
    }

    const isFreehand = stroke.type === 'pen' || stroke.type === 'highlighter' || stroke.type === 'laser' ||
      (stroke.type === 'eraser' && props.eraserMode === 'pixel');
    if (isFreehand) {
      // Coalesced events give every sample the pen produced since the last frame,
      // so fast strokes stay smooth instead of turning into straight segments.
      const native = e.nativeEvent as PointerEvent;
      const samples = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
      if (samples.length > 0) {
        for (const ev of samples) stroke.points.push(toPoint(ev));
      } else {
        stroke.points.push(point);
      }

      if (stroke.type === 'laser') {
        lastLaserActivityRef.current = Date.now();
      } else if ((stroke.type === 'pen' || stroke.type === 'highlighter') && props.autoShapeRecognition !== false && holdAnchorPointRef.current) {
        // Re-arm the draw-and-hold timer whenever the pointer actually moves
        if (Math.hypot(point.x - holdAnchorPointRef.current.x, point.y - holdAnchorPointRef.current.y) > 10) {
          holdAnchorPointRef.current = point;
          armHoldTimer();
        }
      }
    } else {
      stroke.points[1] = applyConstraints(stroke.points[0], point, stroke.type, e.shiftKey);
    }
    scheduleRender();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    isHoldSnappedRef.current = false;
    recognizedInitialPointsRef.current = null;
    const target = e.currentTarget;
    const release = () => { try { target.releasePointerCapture(e.pointerId); } catch { /* not captured */ } };

    if (propsRef.current.tool === 'select' && isDrawingRef.current) {
      isDrawingRef.current = false;
      release();

      if (resizeHandleRef.current || isDraggingSelectionRef.current) {
        resizeHandleRef.current = null;
        resizeRotationRef.current = null;
        isDraggingSelectionRef.current = false;
        draggingStrokesOriginalRef.current = [];
        // Only a real move/resize creates an undo step (a plain click does not)
        if (dragMovedRef.current) commitHistory(strokesRef.current);
        dragMovedRef.current = false;
        return;
      }

      if (selectionBoxRef.current) {
        const box = selectionBoxRef.current;
        selectionBoxRef.current = null;
        setSelectedStrokeIds(box.w > 4 || box.h > 4 ? strokesRef.current.filter(s => isStrokeInRect(s, box)).map(s => s.id) : []);
        return;
      }

      if (lassoPointsRef.current) {
        const pts = lassoPointsRef.current;
        lassoPointsRef.current = null;
        setSelectedStrokeIds(pts.length > 4 ? strokesRef.current.filter(s => isStrokeInPolygon(s, pts)).map(s => s.id) : []);
      }
      return;
    }

    if (isDrawingPolygonRef.current) return;
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    release();
    if (!currentStrokeRef.current) return; // object eraser drag

    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (finished.type === 'laser') {
      const now = Date.now();
      lasersRef.current = [...lasersRef.current, { ...finished, timestamp: now }];
      lastLaserActivityRef.current = now;
      ensureLaserLoop();
      scheduleRender();
    } else {
      commitHistory([...strokesRef.current, finished]);
    }
  };

  const handleDoubleClick = () => {
    const ids = selectedIdsRef.current;
    if (propsRef.current.tool === 'select' && ids.length === 1) {
      const stroke = strokesRef.current.find(s => s.id === ids[0]);
      if (stroke && stroke.type === 'text') setActiveTextEdit({ id: stroke.id, stroke, text: stroke.textFormat!.text });
      return;
    }
    if (isDrawingPolygonRef.current) commitPolygon();
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="annotation-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: isAnnotationMode ? 'auto' : 'none',
          zIndex: 10, touchAction: 'none',
          cursor: getToolCursor(tool)
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
              finishTextEdit();
            }
            // Enter naturally creates a newline
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
            border: '1px dashed var(--mp-accent)',
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
            const t = e.target as HTMLTextAreaElement;
            t.style.height = 'auto';
            t.style.height = `${Math.max(activeTextEdit.stroke.textFormat!.fontSize * 1.3, t.scrollHeight)}px`;
            t.style.width = 'auto';
            t.style.width = `${Math.max(120, t.scrollWidth)}px`;
          }}
        />
      )}
    </>
  );
});
