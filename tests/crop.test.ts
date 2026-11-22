import { describe, it, expect } from 'vitest';
import { applyCropToStroke, clampCrop, fitAspect, resizeCrop, isCropped, FULL_CROP, MIN_CROP } from '../src/utils/crop';
import { Stroke } from '../src/components/DrawingCanvas';
import { rotatePoint } from '../src/utils/geometry';

const image = (extra: Partial<Stroke> = {}): Stroke => ({
  id: 'img', type: 'image', color: '#000', width: 2, imageUrl: 'data:x',
  points: [{ x: 100, y: 100 }, { x: 500, y: 400 }], // 400 × 300 on screen
  ...extra,
});

describe('image crop', () => {
  it('keeps the kept part of the picture in place on screen', () => {
    // keep the right half
    const { points, crop } = applyCropToStroke(image(), { x: 0.5, y: 0, w: 0.5, h: 1 });
    expect(crop).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
    expect(points[0]).toEqual({ x: 300, y: 100 });
    expect(points[1]).toEqual({ x: 500, y: 400 });
  });

  it('re-cropping and resetting return to the original box', () => {
    const first = applyCropToStroke(image(), { x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    const reset = applyCropToStroke(image(first), FULL_CROP);
    expect(reset.crop).toBeUndefined();
    expect(reset.points[0].x).toBeCloseTo(100);
    expect(reset.points[0].y).toBeCloseTo(100);
    expect(reset.points[1].x).toBeCloseTo(500);
    expect(reset.points[1].y).toBeCloseTo(400);
  });

  it('works for rotated images (the kept area does not jump)', () => {
    const s = image({ rotation: 90 });
    const { points } = applyCropToStroke(s, { x: 0, y: 0, w: 0.5, h: 1 }); // keep the left half
    // Where the centre of the kept half was drawn before the crop…
    const before = rotatePoint(200, 250, 300, 250, 90);
    // …is the centre of the new box
    expect((points[0].x + points[1].x) / 2).toBeCloseTo(before.x);
    expect((points[0].y + points[1].y) / 2).toBeCloseTo(before.y);
  });

  it('never leaves the image or becomes too small', () => {
    expect(clampCrop({ x: -0.2, y: 0.9, w: 0.5, h: 0.5 })).toEqual({ x: 0, y: 0.5, w: 0.5, h: 0.5 });
    expect(clampCrop({ x: 0, y: 0, w: 0, h: 2 }).w).toBe(MIN_CROP);
    expect(isCropped(FULL_CROP)).toBe(false);
  });

  it('fits an aspect ratio inside the current crop', () => {
    const square = fitAspect(FULL_CROP, 1, 2); // 2:1 image → square uses half the width
    expect(square.w).toBeCloseTo(0.5);
    expect(square.h).toBeCloseTo(1);
    expect(square.x).toBeCloseTo(0.25);
  });

  it('resizes from a corner, keeping the opposite corner fixed', () => {
    const r = resizeCrop(FULL_CROP, 'se', -0.5, -0.25, null, 1);
    expect(r).toEqual({ x: 0, y: 0, w: 0.5, h: 0.75 });
  });

  it('keeps a locked ratio while resizing', () => {
    // 1:1 on a 1:1 image, drag the east edge in
    const r = resizeCrop({ x: 0, y: 0, w: 1, h: 1 }, 'e', -0.4, 0, 1, 1);
    expect(r.w).toBeCloseTo(0.6);
    expect(r.h).toBeCloseTo(0.6);
  });

  it('moves without resizing and stops at the edges', () => {
    const r = resizeCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'move', 0.6, -0.6, null, 1);
    expect(r).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });
});
