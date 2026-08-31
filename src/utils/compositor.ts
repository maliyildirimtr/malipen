import { Stroke, drawStrokesOntoContext } from '../components/DrawingCanvas';
import { Region } from '../components/CaptureOverlay';

export const compositeScreenshot = (
  frozenDataUrl: string,
  region: Region | null, // null means full screen
  includeAnnotations: boolean,
  strokes: Stroke[]
): Promise<HTMLCanvasElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        
        // If region is null, capture full screen
        const targetRegion = region || {
          x: 0,
          y: 0,
          width: window.innerWidth,
          height: window.innerHeight
        };

        const targetPhysicalWidth = targetRegion.width * dpr;
        const targetPhysicalHeight = targetRegion.height * dpr;
        
        canvas.width = targetPhysicalWidth;
        canvas.height = targetPhysicalHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2d context for compositor');
        
        // 1. Draw the native desktop image, cropped to the selected region
        // The desktop image is natively captured at physical resolution, so it matches the canvas scale natively.
        ctx.drawImage(
          img,
          targetRegion.x * dpr, targetRegion.y * dpr, targetPhysicalWidth, targetPhysicalHeight, // Source
          0, 0, targetPhysicalWidth, targetPhysicalHeight // Dest
        );

        // 2. Draw annotations if requested
        if (includeAnnotations && strokes.length > 0) {
          ctx.save();
          // Scale to physical pixels so our drawing algorithm matches the screen perfectly
          ctx.scale(dpr, dpr);
          // Offset the context so strokes draw precisely over the selected region
          ctx.translate(-targetRegion.x, -targetRegion.y);
          
          drawStrokesOntoContext(ctx, strokes, null, [], null);
          
          ctx.restore();
        }

        resolve(canvas);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load frozen image for compositor'));
    img.src = frozenDataUrl;
  });
};
