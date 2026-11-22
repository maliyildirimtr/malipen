import type { Point, Stroke } from '../components/DrawingCanvas';
import { rotatePoint } from './geometry';

/**
 * Non-destructive crop of an image stroke, as fractions (0–1) of the ORIGINAL image.
 * The image data is never changed, so a crop can always be adjusted or reset.
 */
export interface CropRect { x: number; y: number; w: number; h: number }

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/** Smallest crop allowed, as a fraction of the image side. */
export const MIN_CROP = 0.02;

export const getCrop = (stroke: Pick<Stroke, 'crop'>): CropRect => stroke.crop ?? FULL_CROP;

export const isCropped = (crop: CropRect | undefined) =>
  !!crop && (crop.x > 1e-4 || crop.y > 1e-4 || crop.w < 1 - 1e-4 || crop.h < 1 - 1e-4);

/** Keeps a crop inside the image and at least MIN_CROP large. */
export const clampCrop = (c: CropRect): CropRect => {
  const w = Math.min(1, Math.max(MIN_CROP, c.w));
  const h = Math.min(1, Math.max(MIN_CROP, c.h));
  const x = Math.min(1 - w, Math.max(0, c.x));
  const y = Math.min(1 - h, Math.max(0, c.y));
  return { x, y, w, h };
};

/**
 * The largest crop with the given pixel aspect ratio (width / height) that fits inside
 * `around`, centred on it. `imageAspect` is the original image's width / height, needed
 * because crop fractions are relative to each side.
 */
export const fitAspect = (around: CropRect, aspect: number, imageAspect: number): CropRect => {
  // Work in pixels of a unit-height image: width = imageAspect
  const pw = around.w * imageAspect;
  const ph = around.h;
  let w = pw, h = ph;
  if (pw / ph > aspect) w = ph * aspect; else h = pw / aspect;
  const cx = around.x + around.w / 2;
  const cy = around.y + around.h / 2;
  const fw = w / imageAspect, fh = h;
  return clampCrop({ x: cx - fw / 2, y: cy - fh / 2, w: fw, h: fh });
};

/**
 * Applies a new crop to an image stroke and moves/resizes its box so the part of the
 * picture that stays visible does not move on screen (also for rotated images).
 * Returns the new `points` and `crop` to merge into the stroke.
 */
export const applyCropToStroke = (stroke: Stroke, next: CropRect): { points: Point[]; crop: CropRect | undefined } => {
  const crop = clampCrop(next);
  const prev = getCrop(stroke);
  const [a, b] = stroke.points;
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);

  // Screen pixels per unit of crop fraction, from the current box
  const sx = w / prev.w;
  const sy = h / prev.h;

  // New box in the image's own (unrotated) frame
  const nx = x0 + (crop.x - prev.x) * sx;
  const ny = y0 + (crop.y - prev.y) * sy;
  const nw = crop.w * sx;
  const nh = crop.h * sy;

  let cx = nx + nw / 2, cy = ny + nh / 2;
  if (stroke.rotation) {
    // The image is drawn rotated about its box centre; keep the kept area in place
    const c = rotatePoint(cx, cy, x0 + w / 2, y0 + h / 2, stroke.rotation);
    cx = c.x; cy = c.y;
  }
  return {
    points: [{ x: cx - nw / 2, y: cy - nh / 2 }, { x: cx + nw / 2, y: cy + nh / 2 }],
    crop: isCropped(crop) ? crop : undefined,
  };
};

export type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * Drag maths for the crop editor. `dx`/`dy` are the pointer movement as fractions of
 * the image size. With `aspect` (pixel width / height) the crop keeps that shape;
 * `imageAspect` (image width / height) converts between the two.
 * The edge or corner opposite to the dragged one stays fixed.
 */
export const resizeCrop = (
  start: CropRect, handle: CropHandle, dx: number, dy: number,
  aspect: number | null, imageAspect: number
): CropRect => {
  if (handle === 'move') {
    return clampCrop({ ...start, x: start.x + dx, y: start.y + dy });
  }
  let left = start.x, top = start.y, right = start.x + start.w, bottom = start.y + start.h;
  if (handle.includes('w')) left = Math.min(right - MIN_CROP, Math.max(0, left + dx));
  if (handle.includes('e')) right = Math.max(left + MIN_CROP, Math.min(1, right + dx));
  if (handle.includes('n')) top = Math.min(bottom - MIN_CROP, Math.max(0, top + dy));
  if (handle.includes('s')) bottom = Math.max(top + MIN_CROP, Math.min(1, bottom + dy));

  if (!aspect) return clampCrop({ x: left, y: top, w: right - left, h: bottom - top });

  // Keep the shape: width drives height for side/corner handles, height drives width for n/s
  const ratio = aspect / imageAspect; // w_fraction / h_fraction for the requested shape
  let w = right - left, h = bottom - top;
  if (handle === 'n' || handle === 's') w = h * ratio; else h = w / ratio;

  // Shrink to fit inside the image while keeping the fixed edge/corner
  const maxW = handle.includes('w') ? right : handle.includes('e') ? 1 - left : Math.min(start.x + start.w / 2, 1 - (start.x + start.w / 2)) * 2;
  const maxH = handle.includes('n') ? bottom : handle.includes('s') ? 1 - top : Math.min(start.y + start.h / 2, 1 - (start.y + start.h / 2)) * 2;
  const scale = Math.min(1, maxW / w, maxH / h);
  w *= scale; h *= scale;

  const x = handle.includes('w') ? right - w : handle.includes('e') ? left : start.x + start.w / 2 - w / 2;
  const y = handle.includes('n') ? bottom - h : handle.includes('s') ? top : start.y + start.h / 2 - h / 2;
  return clampCrop({ x, y, w, h });
};
