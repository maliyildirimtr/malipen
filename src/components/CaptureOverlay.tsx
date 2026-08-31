import React, { useState, useEffect } from 'react';

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CaptureOverlayProps {
  frozenImage: string;
  onCapture: (region: Region) => void;
  onCancel: () => void;
}

export const CaptureOverlay: React.FC<CaptureOverlayProps> = ({ onCapture, onCancel }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // console.log("CAPTURE_OVERLAY_MOUNTED");
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    const point = { x: e.clientX, y: e.clientY };
    setStartPoint(point);
    setCurrentPoint(point);
    if (e.target && (e.target as any).setPointerCapture) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setCurrentPoint({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !startPoint || !currentPoint) return;
    setIsDragging(false);
    if (e.target && (e.target as any).releasePointerCapture) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }

    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    if (width > 5 && height > 5) {
      onCapture({ x, y, width, height });
    } else {
      // If it's a tiny click, assume cancel
      onCancel();
    }
  };

  const getSelectionStyle = () => {
    if (!startPoint || !currentPoint) return { display: 'none' };
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);
    return {
      left: x,
      top: y,
      width,
      height
    };
  };

  const selection = getSelectionStyle();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999, // Super high z-index above everything
        cursor: 'crosshair',
        backgroundColor: 'rgba(255, 255, 255, 0.01)', // Force macOS to treat as non-transparent for hit testing
        touchAction: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Dark Mask */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          pointerEvents: 'none' // allow events to pass to parent
        }}
      />
      
      {/* Cutout / Selected Region */}
      {isDragging && startPoint && currentPoint && (
        <div
          style={{
            position: 'absolute',
            ...selection,
            border: '2px solid #3b82f6',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'none', // ensures the cutout shows the background image cleanly
            clipPath: 'none',
          }}
        >
           {/* We can use CSS trick: since the parent has the frozen background, we can just let this div be transparent but use box-shadow to darken the REST of the screen. 
               Wait, the parent div already has rgba(0,0,0,0.4). That covers everything. 
               We need a true "cutout".
               The standard way to do a cutout is border borders, or box-shadow: 0 0 0 9999px rgba(0,0,0,0.4).
               Let's fix the dark mask.
           */}
           <div style={{
              position: 'absolute',
              bottom: '-30px',
              right: '0',
              background: 'rgba(20, 20, 20, 0.9)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'sans-serif'
           }}>
              {selection.width} × {selection.height}
           </div>
        </div>
      )}
    </div>
  );
};
