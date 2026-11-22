import { Stroke, drawStrokesOntoContext } from '../components/DrawingCanvas';
import { Region } from '../components/CaptureOverlay';

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Failed to load image for compositor'));
  img.src = src;
});

/** Decodes every inserted image up front so they are drawn into the capture. */
const preloadStrokeImages = async (strokes: Stroke[]): Promise<Record<string, HTMLImageElement>> => {
  const cache: Record<string, HTMLImageElement> = {};
  await Promise.all(strokes
    .filter(s => s.type === 'image' && s.imageUrl)
    .map(async s => {
      try { cache[s.id] = await loadImage(s.imageUrl as string); } catch { /* drawn as placeholder */ }
    }));
  return cache;
};

export interface CompositeOptions {
  penOpacity?: number;
  highlighterOpacity?: number;
  penStabilizer?: 'off' | 'basic' | 'soft' | 'silky' | 'fluid';
}

export const compositeScreenshot = async (
  frozenDataUrl: string,
  region: Region | null, // null means full screen
  includeAnnotations: boolean,
  strokes: Stroke[],
  options: CompositeOptions = {}
): Promise<HTMLCanvasElement> => {
  const background = await loadImage(frozenDataUrl);
  const imageCache = includeAnnotations ? await preloadStrokeImages(strokes) : {};

  const dpr = window.devicePixelRatio || 1;
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const targetRegion = region || { x: 0, y: 0, width: viewW, height: viewH };

  // The captured image covers exactly the overlay window, but its pixel density can
  // differ slightly from devicePixelRatio; derive the source scale from the image itself.
  const srcScaleX = background.naturalWidth ? background.naturalWidth / viewW : dpr;
  const srcScaleY = background.naturalHeight ? background.naturalHeight / viewH : dpr;

  const outW = Math.round(targetRegion.width * dpr);
  const outH = Math.round(targetRegion.height * dpr);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for compositor');

  // 1. The desktop / board background, cropped to the region
  ctx.drawImage(
    background,
    targetRegion.x * srcScaleX, targetRegion.y * srcScaleY, targetRegion.width * srcScaleX, targetRegion.height * srcScaleY,
    0, 0, outW, outH
  );

  // 2. Annotations on their OWN layer, then laid over the background. Drawing them
  //    straight onto the background would let the pixel eraser ('destination-out')
  //    punch holes into the screenshot itself.
  if (includeAnnotations && strokes.length > 0) {
    const layer = document.createElement('canvas');
    layer.width = outW;
    layer.height = outH;
    const lctx = layer.getContext('2d');
    if (!lctx) throw new Error('Failed to get 2d context for annotation layer');
    lctx.save();
    lctx.scale(dpr, dpr);
    lctx.translate(-targetRegion.x, -targetRegion.y);
    drawStrokesOntoContext(
      lctx, strokes, null, [], null, 2000, 'individual', 0, false,
      options.penOpacity ?? 1, options.highlighterOpacity ?? 0.35, options.penStabilizer ?? 'basic',
      null, null, imageCache
    );
    lctx.restore();
    ctx.drawImage(layer, 0, 0);
  }

  return canvas;
};
