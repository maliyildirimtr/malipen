import { Point, Stroke, Tool } from '../components/DrawingCanvas';

export interface Rect { x: number; y: number; w: number; h: number; }

export const rotatePoint = (x: number, y: number, cx: number, cy: number, angleDegrees: number): Point => {
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cos * (x - cx) - sin * (y - cy) + cx,
    y: sin * (x - cx) + cos * (y - cy) + cy
  };
};

// Generic Hit Testing Tolerance
const HIT_TOLERANCE = 8;

export const distance = (p1: Point, p2: Point) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const distToSegment = (p: Point, v: Point, w: Point) => {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return distance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

export const isPointInPolygon = (point: Point, vs: Point[]) => {
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export const hitTestShape = (x: number, y: number, stroke: Stroke): boolean => {
  if (stroke.points.length < 2 && stroke.type !== 'pen' && stroke.type !== 'highlighter' && stroke.type !== 'eraser') return false;
  const p = { x, y };
  const p1 = stroke.points[0];
  const p2 = stroke.points[stroke.points.length - 1];

  const effectiveWidth = (stroke.type === 'highlighter' || stroke.originalType === 'highlighter') ? stroke.width * 3.5 : (stroke.width || 1);
  const tolerance = Math.max(HIT_TOLERANCE, effectiveWidth / 2 + 2);

  const isFilled = stroke.isFilled;

  switch (stroke.type) {
    case 'line':
    case 'arrow':
    case 'double-arrow': {
      return distToSegment(p, p1, p2) <= tolerance;
    }
    case 'rectangle':
    case 'square':
    case 'image': {
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);

      if (isFilled) {
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
      } else {
        // Check proximity to edges
        const dTop = distToSegment(p, { x: minX, y: minY }, { x: maxX, y: minY });
        const dBottom = distToSegment(p, { x: minX, y: maxY }, { x: maxX, y: maxY });
        const dLeft = distToSegment(p, { x: minX, y: minY }, { x: minX, y: maxY });
        const dRight = distToSegment(p, { x: maxX, y: minY }, { x: maxX, y: maxY });
        return Math.min(dTop, dBottom, dLeft, dRight) <= tolerance;
      }
    }
    case 'circle': {
      const radius = distance(p1, p2);
      const dist = distance(p, p1);
      if (isFilled) return dist <= radius;
      return Math.abs(dist - radius) <= tolerance;
    }
    case 'ellipse': {
      const radiusX = Math.abs(p2.x - p1.x);
      const radiusY = Math.abs(p2.y - p1.y);
      if (radiusX === 0 || radiusY === 0) return false;
      // Normalized equation of ellipse
      const dx = (p.x - p1.x) / radiusX;
      const dy = (p.y - p1.y) / radiusY;
      const value = dx * dx + dy * dy;
      if (isFilled) return value <= 1;

      return Math.abs(value - 1) <= (tolerance / Math.max(radiusX, radiusY));
    }
    case 'polygon':
    case 'free-polygon': {
      if (stroke.points.length < 3) return false;
      if (isFilled) {
        return isPointInPolygon(p, stroke.points);
      } else {
        for (let i = 0; i < stroke.points.length; i++) {
          const v = stroke.points[i];
          const w = stroke.points[(i + 1) % stroke.points.length];
          if (distToSegment(p, v, w) <= tolerance) return true;
        }
        return false;
      }
    }
    case 'pen':
    case 'highlighter':
    case 'eraser':
    case 'free-ellipse': {
      for (let i = 0; i < stroke.points.length - 1; i++) {
        if (distToSegment(p, stroke.points[i], stroke.points[i + 1]) <= tolerance) return true;
      }
      return false;
    }
    default:
      return false;
  }
};

export const getStrokeBounds = (stroke: Stroke) => {
  if (stroke.points.length === 0) return null;
  let minX = stroke.points[0].x;
  let maxX = stroke.points[0].x;
  let minY = stroke.points[0].y;
  let maxY = stroke.points[0].y;

  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  // Add some padding to perfectly encapsulate thick strokes
  const pad = (stroke.width || 1) / 2 + 2;
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2
  };
};

export const isStrokeInRect = (stroke: Stroke, rect: Rect): boolean => {
  const minX = Math.min(rect.x, rect.x + rect.w);
  const maxX = Math.max(rect.x, rect.x + rect.w);
  const minY = Math.min(rect.y, rect.y + rect.h);
  const maxY = Math.max(rect.y, rect.y + rect.h);

  // Check if any point is in rect
  for (const p of stroke.points) {
    if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
      return true;
    }
  }

  // Check if stroke bounds intersect rect
  const b = getStrokeBounds(stroke);
  if (!b) return false;
  const strokeMinX = b.x;
  const strokeMaxX = b.x + b.w;
  const strokeMinY = b.y;
  const strokeMaxY = b.y + b.h;

  const overlap = !(strokeMaxX < minX || strokeMinX > maxX || strokeMaxY < minY || strokeMinY > maxY);
  return overlap;
};

export const isStrokeInPolygon = (stroke: Stroke, polygon: Point[]): boolean => {
  if (polygon.length < 3) return false;

  // Check if any stroke point is in polygon
  for (const p of stroke.points) {
    if (isPointInPolygon(p, polygon)) {
      return true;
    }
  }

  // Check if center of bounds is in polygon
  const b = getStrokeBounds(stroke);
  if (b) {
    const center = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    if (isPointInPolygon(center, polygon)) return true;
  }

  return false;
};

export const getCombinedBounds = (strokes: Stroke[]): Rect | null => {
  if (strokes.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (const stroke of strokes) {
    const b = getStrokeBounds(stroke);
    if (b) {
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x + b.w);
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y + b.h);
    }
  }

  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const calculateContextualPanelPosition = (
  objectBounds: Rect,
  panelSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
  placement: 'top' | 'side' = 'top'
): { x: number; y: number } => {
  const PADDING = 12;

  if (placement === 'top') {
    // Horizontally center or align with left of object
    let x = objectBounds.x + (objectBounds.w / 2) - (panelSize.width / 2);
    // Clamp x to viewport
    if (x < PADDING) x = PADDING;
    if (x + panelSize.width > viewportSize.width - PADDING) {
      x = viewportSize.width - panelSize.width - PADDING;
    }

    // Try to place ABOVE the object
    let y = objectBounds.y - panelSize.height - PADDING;
    // If not enough space above, place BELOW the object
    if (y < PADDING) {
      y = objectBounds.y + objectBounds.h + PADDING;
    }
    // If still off-screen at bottom, clamp to viewport
    if (y + panelSize.height > viewportSize.height - PADDING) {
      y = viewportSize.height - panelSize.height - PADDING;
    }
    if (y < PADDING) y = PADDING;

    return { x, y };
  } else {
    // Side placement
    let x = objectBounds.x + objectBounds.w + PADDING;
    if (x + panelSize.width > viewportSize.width) {
      x = objectBounds.x - panelSize.width - PADDING;
    }
    if (x < PADDING) x = PADDING;
    if (x + panelSize.width > viewportSize.width - PADDING) {
      x = viewportSize.width - panelSize.width - PADDING;
    }
    let y = objectBounds.y;
    if (y + panelSize.height > viewportSize.height - PADDING) {
      y = viewportSize.height - panelSize.height - PADDING;
    }
    if (y < PADDING) y = PADDING;
    return { x, y };
  }
};

/**
 * Maps actual size (1-100) to non-linear slider position (0-100).
 * - 1 to 10: 0% - 50% of the slider (wide range / fine precision)
 * - 10 to 40: 50% - 80% of the slider (medium range)
 * - 40 to 100: 80% - 100% of the slider (coarse range)
 */
export const brushSizeToSlider = (size: number): number => {
  const s = Math.max(1, Math.min(100, size || 1));
  if (s <= 10) {
    return ((s - 1) / 9) * 50;
  } else if (s <= 40) {
    return 50 + ((s - 10) / 30) * 30;
  } else {
    return 80 + ((s - 40) / 60) * 20;
  }
};

/**
 * Maps non-linear slider position (0-100) back to actual integer size (1-100).
 */
export const sliderToBrushSize = (sliderVal: number): number => {
  const v = Math.max(0, Math.min(100, isNaN(sliderVal) ? 0 : sliderVal));
  if (v <= 50) {
    return Math.round(1 + (v / 50) * 9);
  } else if (v <= 80) {
    return Math.round(10 + ((v - 50) / 30) * 30);
  } else {
    return Math.round(40 + ((v - 80) / 20) * 60);
  }
};

/**
 * Ramer-Douglas-Peucker line/polygon simplification algorithm
 */
export const ramerDouglasPeucker = (points: Point[], epsilon: number): Point[] => {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = distToSegment(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }
  if (dmax > epsilon) {
    const recResults1 = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const recResults2 = ramerDouglasPeucker(points.slice(index), epsilon);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
};

export interface RecognizedShape {
  type: Tool;
  points: Point[];
  isEquilateral?: boolean;
  confidence: number;
}

/**
 * Recognizes geometric shape from a freehand stroke of points (Draw-and-Hold).
 */
export const recognizeGeometricShape = (points: Point[]): RecognizedShape | null => {
  if (points.length < 5) return null;

  // 1. Calculate path length & bounding box
  let totalLength = 0;
  let minX = points[0].x, maxX = points[0].x;
  let minY = points[0].y, maxY = points[0].y;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) {
      totalLength += distance(points[i - 1], p);
    }
  }

  const p0 = points[0];
  const pEnd = points[points.length - 1];
  const directDist = distance(p0, pEnd);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const diagonal = Math.sqrt(width * width + height * height);

  if (diagonal < 15 || totalLength < 20) return null;

  const isClosed = directDist < Math.max(35, diagonal * 0.25);
  const cx = minX + width / 2;
  const cy = minY + height / 2;

  // Case 1: Straight Line
  if (!isClosed) {
    const straightness = directDist / totalLength;
    if (straightness > 0.85) {
      return {
        type: 'line',
        points: [{ x: p0.x, y: p0.y }, { x: pEnd.x, y: pEnd.y }],
        confidence: straightness
      };
    }

    // Case 1b: Arrow (Line with an arrowhead)
    const shaftLen = Math.floor(points.length * 0.75);
    if (shaftLen > 3) {
      const shaftStart = points[0];
      const shaftEnd = points[shaftLen];
      const shaftDirect = distance(shaftStart, shaftEnd);
      let shaftTotal = 0;
      for (let i = 1; i <= shaftLen; i++) shaftTotal += distance(points[i - 1], points[i]);
      if (shaftDirect / shaftTotal > 0.82) {
        const headStart = points[shaftLen];
        const headTip = points[points.length - 1];
        if (distance(headStart, headTip) > 8 && distance(headStart, headTip) < diagonal * 0.5) {
          return {
            type: 'arrow',
            points: [{ x: shaftStart.x, y: shaftStart.y }, { x: shaftEnd.x, y: shaftEnd.y }],
            confidence: 0.85
          };
        }
      }
    }
  }

  // Case 2: Closed Shapes (Circle, Ellipse, Triangle, Rectangle, Square, Polygon)
  if (isClosed) {
    const rx = width / 2;
    const ry = height / 2;

    // 2a: Test Circle / Ellipse Fit
    let ellipseErrorSum = 0;
    for (let i = 0; i < points.length; i++) {
      const dx = (points[i].x - cx) / rx;
      const dy = (points[i].y - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      ellipseErrorSum += Math.abs(d - 1.0);
    }
    const avgEllipseError = ellipseErrorSum / points.length;

    // 2b: Test Polygon Vertices via Ramer-Douglas-Peucker
    const closedPoints = [...points, points[0]];
    const epsilon = Math.max(6, diagonal * 0.055);
    const simplified = ramerDouglasPeucker(closedPoints, epsilon);
    const uniqueVertices = simplified.slice(0, simplified.length - 1);
    const numVertices = uniqueVertices.length;

    // Triangle
    if (numVertices === 3) {
      const [v0, v1, v2] = uniqueVertices;
      const d01 = distance(v0, v1);
      const d12 = distance(v1, v2);
      const d20 = distance(v2, v0);
      const maxSide = Math.max(d01, d12, d20);
      const minSide = Math.min(d01, d12, d20);
      const isEquilateral = (maxSide - minSide) / maxSide < 0.25;

      return {
        type: 'polygon',
        points: [v0, v1, v2],
        isEquilateral,
        confidence: 0.9
      };
    }

    // Quadrilateral -> Rectangle or Square
    if (numVertices === 4) {
      const isSquare = Math.abs(width - height) / Math.max(width, height) < 0.2;
      if (isSquare) {
        const side = (width + height) / 2;
        return {
          type: 'square',
          points: [{ x: cx - side / 2, y: cy - side / 2 }, { x: cx + side / 2, y: cy + side / 2 }],
          confidence: 0.9
        };
      } else {
        return {
          type: 'rectangle',
          points: [{ x: minX, y: minY }, { x: maxX, y: maxY }],
          confidence: 0.9
        };
      }
    }

    // Circle or Ellipse
    if (avgEllipseError < 0.22) {
      const isCircle = Math.abs(rx - ry) / Math.max(rx, ry) < 0.2;
      if (isCircle) {
        const r = (rx + ry) / 2;
        return {
          type: 'circle',
          points: [{ x: cx, y: cy }, { x: cx + r, y: cy }],
          confidence: 1 - avgEllipseError
        };
      } else {
        return {
          type: 'ellipse',
          points: [{ x: minX, y: minY }, { x: maxX, y: maxY }],
          confidence: 1 - avgEllipseError
        };
      }
    }

    // General N-gon Polygon (Pentagon, Hexagon, etc.)
    if (numVertices >= 5 && numVertices <= 8 && avgEllipseError >= 0.15) {
      return {
        type: 'polygon',
        points: uniqueVertices,
        confidence: 0.85
      };
    }

    // Fallback to Circle/Ellipse if smooth closed curve
    if (avgEllipseError < 0.35) {
      const isCircle = Math.abs(rx - ry) / Math.max(rx, ry) < 0.22;
      if (isCircle) {
        const r = (rx + ry) / 2;
        return {
          type: 'circle',
          points: [{ x: cx, y: cy }, { x: cx + r, y: cy }],
          confidence: 0.8
        };
      } else {
        return {
          type: 'ellipse',
          points: [{ x: minX, y: minY }, { x: maxX, y: maxY }],
          confidence: 0.8
        };
      }
    }
  }

  return null;
};
