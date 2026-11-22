import { describe, it, expect } from 'vitest';
import { hitTestShape, recognizeGeometricShape, getStrokeBounds, isStrokeInRect, getCombinedBounds } from '../src/utils/geometry';
import { Stroke, Point } from '../src/components/DrawingCanvas';

const circlePoints = (cx: number, cy: number, r: number, n = 64): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });

describe('shape recognition (H3)', () => {
  it('recognises a drawn circle as a proper bounding box, not [centre, centre+r]', () => {
    const shape = recognizeGeometricShape(circlePoints(200, 150, 50));
    expect(shape).not.toBeNull();
    expect(['circle', 'ellipse']).toContain(shape!.type);
    const [p1, p2] = shape!.points;
    // Width AND height must be ~100: before the fix the height was 0 (a flat line)
    expect(Math.abs(p2.x - p1.x)).toBeGreaterThan(90);
    expect(Math.abs(p2.y - p1.y)).toBeGreaterThan(90);
    // Centred on the drawing
    expect((p1.x + p2.x) / 2).toBeCloseTo(200, 0);
    expect((p1.y + p2.y) / 2).toBeCloseTo(150, 0);
  });

  it('recognised circle can be hit on its outline', () => {
    const shape = recognizeGeometricShape(circlePoints(200, 150, 50))!;
    const stroke: Stroke = { id: 'c', type: shape.type, color: '#000', width: 2, points: shape.points };
    expect(hitTestShape(250, 150, stroke)).toBe(true); // on the outline
    expect(hitTestShape(200, 150, stroke)).toBe(false); // centre of an unfilled circle
  });
});

describe('ellipse hit testing (H8)', () => {
  const ellipse: Stroke = { id: 'e', type: 'ellipse', color: '#000', width: 2, points: [{ x: 100, y: 100 }, { x: 300, y: 200 }] };

  it('hits the drawn outline (centre is the middle of the box)', () => {
    expect(hitTestShape(300, 150, ellipse)).toBe(true); // right-most point
    expect(hitTestShape(200, 100, ellipse)).toBe(true); // top-most point
  });

  it('does not hit far outside or the empty centre', () => {
    expect(hitTestShape(100, 100, ellipse)).toBe(false); // box corner is outside the ellipse
    expect(hitTestShape(200, 150, ellipse)).toBe(false);
  });

  it('hits the inside when filled', () => {
    expect(hitTestShape(200, 150, { ...ellipse, isFilled: true })).toBe(true);
  });
});

describe('eraser marks (H17)', () => {
  const eraser: Stroke = { id: 'x', type: 'eraser', color: '#000', width: 10, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
  it('cannot be hit, selected by marquee, or object-erased', () => {
    expect(hitTestShape(50, 0, eraser)).toBe(false);
    expect(isStrokeInRect(eraser, { x: -10, y: -10, w: 200, h: 20 })).toBe(false);
  });
});

describe('text bounds for selection', () => {
  it('estimates a real box for text instead of a point', () => {
    const text: Stroke = {
      id: 't', type: 'text', color: '#000', width: 1, points: [{ x: 10, y: 10 }],
      textFormat: { text: 'Merhaba dünya', fontFamily: 'Arial', fontSize: 20, isBold: false, isItalic: false, isUnderline: false, alignment: 'left' }
    };
    const b = getStrokeBounds(text)!;
    expect(b.w).toBeGreaterThan(100);
    expect(b.h).toBeCloseTo(24, 0);
    expect(getCombinedBounds([text])!.w).toBeCloseTo(b.w);
  });
});

describe('image hit testing', () => {
  it('selects an image when clicking inside it, not only on its edge', () => {
    const img: Stroke = { id: 'i', type: 'image', color: '#000', width: 2, imageUrl: 'data:x', points: [{ x: 0, y: 0 }, { x: 200, y: 100 }] };
    expect(hitTestShape(100, 50, img)).toBe(true);
    expect(hitTestShape(300, 50, img)).toBe(false);
  });
});
