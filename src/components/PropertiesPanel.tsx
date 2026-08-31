import React, { useEffect } from 'react';
import { Stroke, TextFormat } from './DrawingCanvas';
import { brushSizeToSlider, sliderToBrushSize } from '../utils/geometry';
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline } from 'lucide-react';

export const fontSizeToSlider = (size: number): number => {
  const s = Math.max(10, Math.min(140, size || 24));
  if (s <= 36) {
    // 10px - 36px mapped across 0% to 50% of the slider -> ultra smooth & precise for common text sizes
    return ((s - 10) / (36 - 10)) * 50;
  } else if (s <= 72) {
    // 36px - 72px mapped across 50% to 80%
    return 50 + ((s - 36) / (72 - 36)) * 30;
  } else {
    // 72px - 140px mapped across 80% to 100%
    return 80 + ((s - 72) / (140 - 72)) * 20;
  }
};

export const sliderToFontSize = (val: number): number => {
  if (val <= 50) {
    return Math.round(10 + (val / 50) * (36 - 10));
  } else if (val <= 80) {
    return Math.round(36 + ((val - 50) / 30) * (72 - 36));
  } else {
    return Math.round(72 + ((val - 80) / 20) * (140 - 72));
  }
};

interface PropertiesPanelProps {
  stroke: Stroke;
  onChange: (updates: Partial<Stroke>, commit: boolean) => void;
  onClose: () => void;
  position?: { x: number; y: number };
  language?: string;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ stroke, onChange, onClose, position, language = 'Türkçe' }) => {
  const isEn = language === 'English';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [onClose]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  const update = (updates: Partial<Stroke>, commit: boolean = true) => {
    onChange(updates, commit);
  };

  const updateText = (updates: Partial<TextFormat>, commit: boolean = true) => {
    if (!stroke.textFormat) return;
    onChange({ textFormat: { ...stroke.textFormat, ...updates } }, commit);
  };

  return (
    <div 
      className="properties-panel" 
      style={position ? { position: 'absolute', left: position.x, top: position.y, transform: 'none', right: 'auto' } : {}}
      onPointerDown={handlePointerDown} 
      onPointerUp={handlePointerUp}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="properties-header">
        <span>{stroke.type === 'text' ? (isEn ? 'Text Settings' : 'Metin Ayarları') : (isEn ? 'Shape Settings' : 'Şekil Ayarları')}</span>
        <button onClick={onClose} className="close-btn">×</button>
      </div>
      
      <div className="properties-content">
        {stroke.type === 'text' && stroke.textFormat ? (
          <>
            <div className="prop-row">
              <label>{isEn ? 'Font Family' : 'Yazı Tipi'}</label>
              <select value={stroke.textFormat.fontFamily} onChange={(e) => updateText({ fontFamily: e.target.value })}>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
                <option value="Segoe UI">Segoe UI</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
              </select>
            </div>
            
            <div className="prop-column">
              <div className="prop-header-row">
                <label>{isEn ? 'Size' : 'Boyut'}</label>
                <span className="prop-value-badge">{stroke.textFormat.fontSize}px</span>
              </div>
              <input 
                type="range" 
                className="prop-slider"
                min="0" 
                max="100" 
                step="0.5"
                value={fontSizeToSlider(stroke.textFormat.fontSize)}
                onChange={(e) => updateText({ fontSize: sliderToFontSize(parseFloat(e.target.value)) }, false)}
                onMouseUp={(e) => updateText({ fontSize: sliderToFontSize(parseFloat((e.target as HTMLInputElement).value)) }, true)}
              />
            </div>

            <div className="prop-row format-buttons">
              <button 
                className={stroke.textFormat.isBold ? 'active' : ''} 
                onClick={() => updateText({ isBold: !stroke.textFormat!.isBold })}
                title={isEn ? 'Bold' : 'Kalın (Bold)'}
              >
                <Bold size={16} />
              </button>
              <button 
                className={stroke.textFormat.isItalic ? 'active' : ''} 
                onClick={() => updateText({ isItalic: !stroke.textFormat!.isItalic })}
                title={isEn ? 'Italic' : 'İtalik (Italic)'}
              >
                <Italic size={16} />
              </button>
              <button 
                className={stroke.textFormat.isUnderline ? 'active' : ''} 
                onClick={() => updateText({ isUnderline: !stroke.textFormat!.isUnderline })}
                title={isEn ? 'Underline' : 'Altı Çizili (Underline)'}
              >
                <Underline size={16} />
              </button>
            </div>

            <div className="prop-row format-buttons">
              <button 
                className={stroke.textFormat.alignment === 'left' ? 'active' : ''} 
                onClick={() => updateText({ alignment: 'left' })}
                title={isEn ? 'Align Left' : 'Sola Hizala'}
              >
                <AlignLeft size={16} />
              </button>
              <button 
                className={stroke.textFormat.alignment === 'center' ? 'active' : ''} 
                onClick={() => updateText({ alignment: 'center' })}
                title={isEn ? 'Center' : 'Ortala'}
              >
                <AlignCenter size={16} />
              </button>
              <button 
                className={stroke.textFormat.alignment === 'right' ? 'active' : ''} 
                onClick={() => updateText({ alignment: 'right' })}
                title={isEn ? 'Align Right' : 'Sağa Hizala'}
              >
                <AlignRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
             <div className="prop-column">
                <div className="prop-header-row">
                  <label>{isEn ? 'Line Width' : 'Çizgi Kalınlığı'}</label>
                  <span className="prop-value-badge">{stroke.width}px</span>
                </div>
                <input type="range" min="0" max="100" step="0.2"
                  className="prop-slider"
                  value={brushSizeToSlider(stroke.width)}
                  onChange={(e) => update({ width: sliderToBrushSize(parseFloat(e.target.value)) }, false)}
                  onMouseUp={(e) => update({ width: sliderToBrushSize(parseFloat((e.target as HTMLInputElement).value)) }, true)}
                />
             </div>
             {['rectangle', 'square', 'circle', 'ellipse', 'polygon', 'free-polygon', 'free-ellipse'].includes(stroke.type) && (
               <div className="prop-row">
                 <label>
                   <input type="checkbox" checked={!!stroke.isFilled} onChange={(e) => update({ isFilled: e.target.checked })} /> {isEn ? 'Fill Active' : 'Dolgu Aktif'}
                 </label>
               </div>
             )}
          </>
        )}

        <div className="prop-row">
          <label>{stroke.type === 'text' ? (isEn ? 'Text Color' : 'Metin Rengi') : (isEn ? 'Stroke Color' : 'Çizgi Rengi')}</label>
          <input type="color" value={stroke.color} 
            onChange={(e) => update({ color: e.target.value }, false)}
            onBlur={(e) => update({ color: e.target.value }, true)}
          />
        </div>

        {((stroke.type === 'text' && stroke.isFilled) || (stroke.type !== 'text' && stroke.isFilled)) && (
          <>
            <div className="prop-row">
              <label>{stroke.type === 'text' ? (isEn ? 'Background Color' : 'Arka Plan Rengi') : (isEn ? 'Fill Color' : 'Dolgu Rengi')}</label>
              <input type="color" value={stroke.fillColor || '#ffffff'} 
                onChange={(e) => update({ fillColor: e.target.value }, false)}
                onBlur={(e) => update({ fillColor: e.target.value }, true)}
              />
            </div>
            {stroke.type !== 'text' && (
              <div className="prop-column">
                <div className="prop-header-row">
                  <label>{isEn ? 'Opacity' : 'Şeffaflık'}</label>
                  <span className="prop-value-badge">{Math.round((stroke.fillOpacity ?? 1) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.01" value={stroke.fillOpacity ?? 1}
                  className="prop-slider"
                  onChange={(e) => update({ fillOpacity: parseFloat(e.target.value) }, false)}
                  onMouseUp={(e) => update({ fillOpacity: parseFloat((e.target as HTMLInputElement).value) }, true)}
                />
              </div>
            )}
          </>
        )}

        {stroke.type !== 'text' && (
          <div className="prop-column">
            <div className="prop-header-row">
              <label>{isEn ? 'Rotation' : 'Döndürme'}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="prop-value-badge">{(stroke.rotation ?? 0) > 0 ? `+${stroke.rotation}°` : `${stroke.rotation ?? 0}°`}</span>
                {(stroke.rotation ?? 0) !== 0 && (
                  <button
                    type="button"
                    className="prop-reset-btn"
                    onClick={() => update({ rotation: 0 }, true)}
                    title={isEn ? 'Reset (0°)' : '0° (Sıfırla)'}
                  >
                    {isEn ? 'Reset' : 'Sıfırla'}
                  </button>
                )}
              </div>
            </div>
            <input 
              type="range" 
              className="prop-slider"
              min="-180" 
              max="180" 
              step="1" 
              value={stroke.rotation ?? 0}
              onChange={(e) => update({ rotation: parseInt(e.target.value, 10) }, false)}
              onMouseUp={(e) => update({ rotation: parseInt((e.target as HTMLInputElement).value, 10) }, true)}
            />
            <div className="prop-ticks-row">
              <span>-180°</span>
              <span style={{ fontWeight: (stroke.rotation ?? 0) === 0 ? '700' : 'normal', color: (stroke.rotation ?? 0) === 0 ? '#60a5fa' : '#71717a' }}>0°</span>
              <span>+180°</span>
            </div>
          </div>
        )}
        
        {stroke.type === 'text' && (
          <div className="prop-row">
            <label>
              <input type="checkbox" checked={!!stroke.isFilled} onChange={(e) => update({ isFilled: e.target.checked })} /> {isEn ? 'Background Active' : 'Arka Plan Aktif'}
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
