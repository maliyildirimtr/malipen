import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Shortcuts, translations } from '../types/settings';

interface HelpPanelProps {
  onClose: () => void;
  language?: string;
  shortcuts: Shortcuts;
}

const SHORTCUT_ROWS: { key: keyof Shortcuts; label: keyof typeof translations.tr }[] = [
  { key: 'toggleToolbar', label: 'shortcutToggleToolbar' },
  { key: 'toggleInk', label: 'shortcutToggleInk' },
  { key: 'pen', label: 'shortcutPen' },
  { key: 'highlighter', label: 'shortcutHighlighter' },
  { key: 'laser', label: 'shortcutLaser' },
  { key: 'eraser', label: 'shortcutEraser' },
  { key: 'select', label: 'shortcutSelect' },
  { key: 'text', label: 'shortcutText' },
  { key: 'undo', label: 'shortcutUndo' },
  { key: 'redo', label: 'shortcutRedo' },
  { key: 'clear', label: 'shortcutClear' },
  { key: 'screenshot', label: 'shortcutScreenshot' },
  { key: 'settings', label: 'shortcutSettings' },
];

export const HelpPanel: React.FC<HelpPanelProps> = ({ onClose, language = 'Türkçe', shortcuts }) => {
  const isEn = language === 'English';
  const t = translations[isEn ? 'en' : 'tr'];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const tips = isEn ? [
    'Click the lock button (or the toolbar shortcut) to switch between drawing and using your desktop.',
    'Draw a shape with the pen and hold still for a moment: it snaps to a clean line, circle, rectangle or triangle.',
    'Hold Shift while drawing a line or rectangle to snap angles or make it square.',
    'Use the Selection tool to move, resize and rotate items; double-click text to edit it.',
    'Whiteboard and blackboard each keep their own drawing; the screen layer stays untouched.',
    'Closing the toolbar keeps MaliPen running in the menu bar / system tray.',
  ] : [
    'Kilit düğmesi (veya araç çubuğu kısayolu) çizim ile masaüstünü kullanma arasında geçiş yapar.',
    'Kalemle bir şekil çizip bir an bekleyin: düzgün çizgi, daire, dikdörtgen veya üçgene dönüşür.',
    'Çizgi veya dikdörtgen çizerken Shift tuşu açıyı sabitler ya da kare yapar.',
    'Seçim aracıyla öğeleri taşıyın, boyutlandırın ve döndürün; metni düzenlemek için çift tıklayın.',
    'Beyaz ve siyah tahtanın her biri kendi çizimini tutar; ekran katmanı etkilenmez.',
    'Araç çubuğunu kapatınca MaliPen menü çubuğunda / sistem tepsisinde çalışmaya devam eder.',
  ];

  return (
    <div className="privacy-overlay" onClick={onClose}>
      <div className="privacy-container" onClick={(e) => e.stopPropagation()}>
        <header className="privacy-header">
          <div>
            <h1 className="privacy-title">{isEn ? 'Help' : 'Yardım'}</h1>
          </div>
          <button className="privacy-close-btn tool-btn" onClick={onClose} aria-label={isEn ? 'Close' : 'Kapat'}>
            <X size={24} />
          </button>
        </header>
        <div className="privacy-content">
          <section>
            <h2>{isEn ? 'Getting started' : 'Başlarken'}</h2>
            <ul>{tips.map((tip, i) => <li key={i}>{tip}</li>)}</ul>
          </section>
          <section>
            <h2>{t.shortcuts}</h2>
            <p style={{ fontSize: 13 }}>{t.globalShortcutsNote}</p>
            <ul>
              {SHORTCUT_ROWS.map(row => (
                <li key={row.key}><strong>{t[row.label]}</strong>: {shortcuts[row.key] || t.unassigned}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
