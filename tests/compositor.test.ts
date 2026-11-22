import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compositeScreenshot } from '../src/utils/compositor';
import { Stroke } from '../src/components/DrawingCanvas';

describe('Compositor Integration', () => {
  let mockContext: any;
  let mockCanvas: any;

  beforeEach(() => {
    mockContext = {
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      quadraticCurveTo: vi.fn(),
      setLineDash: vi.fn(),
      clearRect: vi.fn()
    };

    mockCanvas = {
      getContext: vi.fn(() => mockContext),
      toDataURL: vi.fn(() => 'data:image/png;base64,mock')
    };

    // Mock document globally
    (global as any).document = {
      createElement: vi.fn((tag) => {
        if (tag === 'canvas') return mockCanvas;
        return { style: {} };
      })
    };

    // Mock Image object
    (global as any).Image = class {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      set src(value: string) {
        setTimeout(() => this.onload(), 0);
      }
    };
    
    // Mock devicePixelRatio
    (global as any).window = {
      devicePixelRatio: 2,
      innerWidth: 1920,
      innerHeight: 1080
    };
  });

  it('composites screen only without annotations', async () => {
    const region = { x: 100, y: 100, width: 200, height: 150 };
    
    const result = await compositeScreenshot('mockDataUrl', region, false, []);
    
    expect(result).toBe(mockCanvas);
    expect(mockCanvas.width).toBe(400); // 200 * dpr
    expect(mockCanvas.height).toBe(300); // 150 * dpr
    expect(mockContext.drawImage).toHaveBeenCalled();
    expect(mockContext.scale).not.toHaveBeenCalled(); // No annotations
  });

  it('composites screen + annotations and translates correctly', async () => {
    const region = { x: 50, y: 50, width: 100, height: 100 };
    const strokes: Stroke[] = [
      { id: '1', type: 'pen', color: '#000', width: 2, points: [{x: 0, y: 0}, {x: 10, y: 10}] }
    ];
    
    const result = await compositeScreenshot('mockDataUrl', region, true, strokes);
    
    expect(result).toBe(mockCanvas);
    expect(mockContext.scale).toHaveBeenCalledWith(2, 2);
    expect(mockContext.translate).toHaveBeenCalledWith(-50, -50);
    expect(mockContext.fill).toHaveBeenCalled(); // pen strokes are filled outlines (perfect-freehand)
  });

  it('draws annotations on a separate layer so the pixel eraser cannot cut the screenshot (H5)', async () => {
    const region = { x: 0, y: 0, width: 100, height: 100 };
    const strokes: Stroke[] = [
      { id: 'e', type: 'eraser', color: '#000', width: 5, points: [{x: 0, y: 0}, {x: 50, y: 50}] }
    ];
    await compositeScreenshot('mockDataUrl', region, true, strokes);
    // background + annotation layer composited = 2 drawImage calls, and two canvases created
    expect(mockContext.drawImage).toHaveBeenCalledTimes(2);
    expect((global as any).document.createElement).toHaveBeenCalledTimes(2);
  });

  it('waits for inserted images so they appear in the capture (H4)', async () => {
    const region = { x: 0, y: 0, width: 100, height: 100 };
    (global as any).Image = class {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      complete = true;
      naturalWidth = 10;
      set src(_v: string) { setTimeout(() => this.onload(), 0); }
    };
    const strokes: Stroke[] = [
      { id: 'img', type: 'image', color: '#000', width: 1, imageUrl: 'data:image/png;base64,x', points: [{x: 10, y: 10}, {x: 60, y: 60}] }
    ];
    await compositeScreenshot('mockDataUrl', region, true, strokes);
    // background, the inserted image, then the annotation layer
    expect(mockContext.drawImage).toHaveBeenCalledTimes(3);
    expect(mockContext.setLineDash).not.toHaveBeenCalled(); // no "missing image" placeholder
  });
});

describe('pixel eraser never erases images', () => {
  it('draws ink and images on separate layers when an eraser is present', async () => {
    const { drawDocument } = await import('../src/components/DrawingCanvas');
    const calls: string[] = [];
    const makeCtx = (name: string): any => ({
      canvas: { width: 100, height: 100 },
      getTransform: () => ({}), setTransform: () => {}, save: () => {}, restore: () => {},
      translate: () => {}, rotate: () => {}, scale: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      quadraticCurveTo: () => {}, closePath: () => {}, rect: () => {}, ellipse: () => {}, fill: () => {}, strokeRect: () => {},
      setLineDash: () => {}, fillRect: () => {},
      stroke: () => calls.push(`${name}:stroke:${(ctxs[name] as any).globalCompositeOperation}`),
      drawImage: (src: any) => calls.push(`${name}:drawImage:${src?.tag || 'img'}`),
    });
    const ctxs: Record<string, any> = {};
    let n = 0;
    (global as any).document = { createElement: () => { const name = `layer${n++}`; const c: any = { tag: name, width: 0, height: 0 }; ctxs[name] = makeCtx(name); c.getContext = () => ctxs[name]; return c; } };
    ctxs.main = makeCtx('main');
    const img = { complete: true, naturalWidth: 10, naturalHeight: 10, tag: 'photo' };
    const strokes: any[] = [
      { id: 'img', type: 'image', color: '#000', width: 2, imageUrl: 'x', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }] },
      { id: 'hl', type: 'highlighter', color: '#ff0', width: 5, points: [{ x: 0, y: 0 }, { x: 40, y: 40 }] },
      { id: 'er', type: 'eraser', color: '#000', width: 5, points: [{ x: 0, y: 0 }, { x: 40, y: 40 }] },
    ];
    drawDocument(ctxs.main, strokes, { imageCache: { img: img as any } });
    // the eraser (destination-out) is only ever applied to ink layers, never to the main canvas holding the image
    expect(calls.filter(c => c.startsWith('main:stroke')).length).toBe(0);
    expect(calls.some(c => c === 'main:drawImage:photo')).toBe(true);
    expect(calls.some(c => /^layer\d+:stroke:destination-out$/.test(c))).toBe(true);
  });
});
