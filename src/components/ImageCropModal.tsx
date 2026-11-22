import React, { useEffect, useRef, useState } from 'react';
import { CropRect, CropHandle, FULL_CROP, clampCrop, fitAspect, resizeCrop } from '../utils/crop';

interface ImageCropModalProps {
  imageUrl: string;
  initialCrop?: CropRect;
  language?: string;
  onApply: (crop: CropRect) => void;
  onCancel: () => void;
}

type AspectId = 'free' | 'original' | '1:1' | '4:3' | '16:9' | '3:4';

const HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/**
 * Crop editor for an inserted image. Works on the original image and returns the
 * crop as fractions, so cropping never loses picture data and can be redone.
 */
export const ImageCropModal: React.FC<ImageCropModalProps> = ({ imageUrl, initialCrop, language = 'Türkçe', onApply, onCancel }) => {
  const isEn = language === 'English';
  const [crop, setCrop] = useState<CropRect>(initialCrop ?? FULL_CROP);
  const [aspectId, setAspectId] = useState<AspectId>('free');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: CropHandle; startX: number; startY: number; startCrop: CropRect } | null>(null);
  const cropRef = useRef(crop);
  cropRef.current = crop;

  const imageAspect = natural ? natural.w / natural.h : 1;
  const aspectValue = (id: AspectId): number | null => {
    switch (id) {
      case 'original': return imageAspect;
      case '1:1': return 1;
      case '4:3': return 4 / 3;
      case '16:9': return 16 / 9;
      case '3:4': return 3 / 4;
      default: return null;
    }
  };

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onCancel(); }
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); onApply(cropRef.current); }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onApply, onCancel]);

  const chooseAspect = (id: AspectId) => {
    setAspectId(id);
    const a = aspectValue(id);
    if (a) setCrop(prev => fitAspect(prev, a, imageAspect));
  };

  const onPointerDown = (handle: CropHandle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startCrop: cropRef.current };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const rect = stage.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    setCrop(resizeCrop(drag.startCrop, drag.handle, dx, dy, aspectValue(aspectId), imageAspect));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* not captured */ }
  };

  // Fit the original image into the window without distorting it
  const stageSize: React.CSSProperties = (() => {
    const maxW = Math.min(window.innerWidth * 0.8, 900);
    const maxH = window.innerHeight * 0.62;
    if (!natural) return { width: maxW * 0.6, height: maxH * 0.6 };
    const scale = Math.min(maxW / natural.w, maxH / natural.h, 1.5);
    return { width: Math.round(natural.w * scale), height: Math.round(natural.h * scale) };
  })();

  const pct = (v: number) => `${v * 100}%`;
  const aspects: { id: AspectId; label: string }[] = [
    { id: 'free', label: isEn ? 'Free' : 'Serbest' },
    { id: 'original', label: isEn ? 'Original' : 'Orijinal' },
    { id: '1:1', label: '1:1' },
    { id: '4:3', label: '4:3' },
    { id: '16:9', label: '16:9' },
    { id: '3:4', label: '3:4' },
  ];

  return (
    <div className="crop-modal-overlay" onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="crop-modal" role="dialog" aria-modal="true" aria-label={isEn ? 'Crop image' : 'Görseli kırp'}>
        <div className="crop-modal-header">
          <h2>{isEn ? 'Crop image' : 'Görseli Kırp'}</h2>
          {natural && (
            <span className="crop-size">
              {Math.round(crop.w * natural.w)} × {Math.round(crop.h * natural.h)} px
            </span>
          )}
        </div>

        <div className="crop-aspects" role="radiogroup" aria-label={isEn ? 'Aspect ratio' : 'En-boy oranı'}>
          {aspects.map(a => (
            <button key={a.id} type="button" role="radio" aria-checked={aspectId === a.id}
              className={`crop-aspect-btn ${aspectId === a.id ? 'active' : ''}`} onClick={() => chooseAspect(a.id)}>
              {a.label}
            </button>
          ))}
        </div>

        <div className="crop-stage-wrap">
          <div
            ref={stageRef}
            className="crop-stage"
            style={stageSize}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <img src={imageUrl} alt="" draggable={false} className="crop-image" />
            <div
              className="crop-box"
              style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
              onPointerDown={onPointerDown('move')}
            >
              <div className="crop-grid" />
              {HANDLES.map(h => (
                <div key={h} className={`crop-handle crop-handle-${h}`} onPointerDown={onPointerDown(h)} />
              ))}
            </div>
          </div>
        </div>

        <div className="crop-actions">
          <button className="btn-secondary" onClick={() => { setAspectId('free'); setCrop(clampCrop(FULL_CROP)); }}>
            {isEn ? 'Reset' : 'Sıfırla'}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn-secondary" onClick={onCancel}>{isEn ? 'Cancel' : 'İptal'}</button>
          <button className="btn-primary" onClick={() => onApply(crop)}>{isEn ? 'Apply' : 'Uygula'}</button>
        </div>
      </div>
    </div>
  );
};
