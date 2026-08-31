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
    expect(mockContext.stroke).toHaveBeenCalled(); // Drawing the pen stroke
  });
});
