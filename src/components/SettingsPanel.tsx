import React, { useState, useRef, useEffect } from 'react';
import { Settings, Shortcuts, DEFAULT_SETTINGS, translations } from '../types/settings';

interface SettingsPanelProps {
  settings: Settings;
  onUpdate: (settings: Settings) => void;
  onClose: () => void;
  position?: React.CSSProperties;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, 
  onUpdate, 
  onClose,
  position
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [recordingShortcut, setRecordingShortcut] = useState<keyof Shortcuts | null>(null);
  const [showShapeShortcuts, setShowShapeShortcuts] = useState<boolean>(false);
  const [displays, setDisplays] = useState<Array<{id: number, bounds: any}>>([]);

  const t = translations[settings.language === 'English' ? 'en' : 'tr'];

  useEffect(() => {
    window.electronAPI.getDisplays().then(setDisplays);
  }, []);

  const handleSelectFolder = async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      updateSetting('screenshotFolder', folder);
    }
  };

  const handleSetStartup = (val: boolean) => {
    updateSetting('startOnWindowsStartup', val);
    window.electronAPI.setOpenAtLogin(val);
  };


  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    onUpdate({ ...settings, [key]: value });
  };

  const handleResetShortcuts = () => {
    onUpdate({
      ...settings,
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts }
    });
  };

  const recordedCombo = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (recordingShortcut) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [recordingShortcut, onClose]);

  useEffect(() => {
    if (!recordingShortcut) {
      recordedCombo.current.clear();
      return;
    }

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecordingShortcut(null);
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        onUpdate({
          ...settings,
          shortcuts: { ...settings.shortcuts, [recordingShortcut]: '' }
        });
        setRecordingShortcut(null);
        return;
      }

      if (e.metaKey) recordedCombo.current.add('Cmd');
      if (e.ctrlKey) recordedCombo.current.add('Ctrl');
      if (e.altKey) recordedCombo.current.add('Alt');
      if (e.shiftKey) recordedCombo.current.add('Shift');

      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        let keyName = e.key.toUpperCase();
        if (e.code.startsWith('Key')) keyName = e.code.replace('Key', '').toUpperCase();
        else if (e.code.startsWith('Digit')) keyName = e.code.replace('Digit', '');
        else if (e.code === 'Space' || e.key === ' ') keyName = 'SPACE';
        else if (e.key === '+') keyName = '+';
        
        recordedCombo.current.add(keyName);
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const comboArray = Array.from(recordedCombo.current);
      const nonModifiers = comboArray.filter(k => !['Cmd', 'Ctrl', 'Alt', 'Shift'].includes(k));
      
      if (nonModifiers.length > 0) {
        const modifiers = comboArray.filter(k => ['Cmd', 'Ctrl', 'Alt', 'Shift'].includes(k));
        const finalString = [...modifiers, ...nonModifiers].join(' + ');
        
        onUpdate({
          ...settings,
          shortcuts: { ...settings.shortcuts, [recordingShortcut]: finalString }
        });
        setRecordingShortcut(null);
      } else {
        // If they just pressed and released Shift without a letter, we reset the combo and let them try again
        recordedCombo.current.clear();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    window.addEventListener('keyup', handleGlobalKeyUp, { capture: true });
    
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
      window.removeEventListener('keyup', handleGlobalKeyUp, { capture: true });
    };
  }, [recordingShortcut, settings, onUpdate]);

  const handleShortcutClick = (e: React.MouseEvent, key: keyof Shortcuts) => {
    e.stopPropagation();
    setRecordingShortcut(key);
  };

  const renderCheckbox = (label: string, field: keyof Settings) => (
    <div className="epic-setting-row" onClick={() => updateSetting(field, !settings[field] as any)}>
      <div className={`epic-checkbox-wrapper ${settings[field] ? 'checked' : ''}`}>
        <input type="checkbox" checked={!!settings[field]} readOnly />
      </div>
      <span>{label}</span>
    </div>
  );

  const renderRadio = (label: string, field: keyof Settings, value: any, extra?: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="epic-setting-row" onClick={() => updateSetting(field, value)}>
        <div className={`epic-radio-wrapper ${settings[field] === value ? 'checked' : ''}`}>
          <input type="radio" checked={settings[field] === value} readOnly />
        </div>
        <span>{label}</span>
      </div>
      {extra && settings[field] === value && (
        <div style={{ paddingLeft: '30px', marginBottom: '8px' }}>{extra}</div>
      )}
    </div>
  );

  const renderShortcut = (label: string, key: keyof Shortcuts, hasToggle?: boolean, isExpanded?: boolean, onToggle?: () => void) => {
    const isActive = recordingShortcut === key;
    return (
      <div 
        className={`epic-shortcut-row ${isActive ? 'active' : ''}`}
        onClick={(e) => handleShortcutClick(e, key)}
      >
        <span className="epic-shortcut-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {label}
          {hasToggle && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', color: '#ccc', cursor: 'pointer', 
                padding: '2px 6px', display: 'flex', alignItems: 'center', borderRadius: '4px'
              }}
              title={t.showSubShortcuts}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}
        </span>
        <span className="epic-shortcut-key">
          {isActive ? t.pressKey : settings.shortcuts[key] || t.unassigned}
        </span>
      </div>
    );
  };

  if (!settings || !settings.shortcuts) {
    return <div className="epic-settings-panel" style={{ top: '50px', left: '50px', padding: '20px', background: 'white' }}>Settings Error: Invalid state</div>;
  }

  return (
    <div 
      ref={panelRef}
      className="epic-settings-panel" 
      style={position ? position : {}}
      onMouseDown={(e) => e.stopPropagation()} // Prevent closing when clicking inside
    >
      <div className="epic-settings-header" style={{ justifyContent: 'space-between' }}>
        <span>{t.settings}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>✕</button>
      </div>
      
      <div className="epic-settings-content">
        
        {/* Genel Ayarlar */}
        <div>
          <div className="epic-section-title">{t.tools}</div>
          <div style={{ marginTop: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 600, marginBottom: '8px' }}>{t.toolbarOrientation}</div>
            <div style={{ display: 'flex', gap: '16px' }}>
              {renderRadio(t.toolbarOrientationVertical, 'toolbarOrientation', 'vertical')}
              {renderRadio(t.toolbarOrientationHorizontal, 'toolbarOrientation', 'horizontal')}
            </div>
          </div>
          {renderCheckbox(t.rememberShortcutsOnClose, 'rememberShortcutsOnClose')}
          {renderCheckbox(t.toolsTrackOwnSize, 'toolsTrackOwnSize')}
          {renderCheckbox(t.mouseWheelAdjustsPenSize, 'mouseWheelAdjustsPenSize')}
          <div className="epic-setting-row" onClick={() => handleSetStartup(!settings.startOnWindowsStartup)}>
            <div className={`epic-checkbox-wrapper ${settings.startOnWindowsStartup ? 'checked' : ''}`}>
              <input type="checkbox" checked={!!settings.startOnWindowsStartup} readOnly />
            </div>
            <span>{t.startOnWindowsStartup}</span>
          </div>
          {renderCheckbox(t.checkUpdatesOnStartup, 'checkUpdatesOnStartup')}
          {renderCheckbox(t.showCursorPreview, 'showCursorPreview')}
          
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t.laserMode}
            </div>
            {renderRadio(t.laserModeIndividual, 'laserMode', 'individual')}
            {renderRadio(t.laserModeGroup, 'laserMode', 'group')}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#e4e4e7', marginTop: '12px', marginBottom: '8px' }}>
              <span>{t.laserFadeDuration}</span>
              <span>{(settings.laserFadeDuration / 1000).toFixed(1)} s</span>
            </div>
            <input 
              type="range" 
              min="500" max="5000" step="100" 
              value={settings.laserFadeDuration}
              onChange={(e) => updateSetting('laserFadeDuration', parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t.penStabilizer}
            </div>
            {renderRadio(t.stabilizerOff, 'penStabilizer', 'off')}
            {renderRadio(t.stabilizerBasic, 'penStabilizer', 'basic')}
            {renderRadio(t.stabilizerSoft, 'penStabilizer', 'soft')}
            {renderRadio(t.stabilizerSilky, 'penStabilizer', 'silky')}
            {renderRadio(t.stabilizerFluid, 'penStabilizer', 'fluid')}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#e4e4e7', marginTop: '12px', marginBottom: '8px' }}>
              <span>{t.penOpacity}</span>
              <span>{Math.round((settings.penOpacity ?? 1.0) * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.1" max="1.0" step="0.01" 
              value={settings.penOpacity ?? 1.0}
              onChange={(e) => updateSetting('penOpacity', parseFloat(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#e4e4e7', marginTop: '12px', marginBottom: '8px' }}>
              <span>{t.highlighterOpacity}</span>
              <span>{Math.round((settings.highlighterOpacity ?? 0.35) * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.05" max="1.0" step="0.01" 
              value={settings.highlighterOpacity ?? 0.35}
              onChange={(e) => updateSetting('highlighterOpacity', parseFloat(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
          
          <button className="epic-button" onClick={() => onUpdate(DEFAULT_SETTINGS)}>{t.resetToDefault}</button>
        </div>

        {/* Dil */}
        <div>
          <div className="epic-section-title">{t.language}</div>
          <select 
            className="epic-select" 
            value={settings.language} 
            onChange={(e) => updateSetting('language', e.target.value)}
          >
            <option value="Türkçe">Türkçe</option>
            <option value="English">English</option>
          </select>
        </div>

        {/* Hızlı Renkler */}
        <div>
          <div className="epic-section-title">{t.quickColors}</div>
          {[0, 1, 2, 3].map(i => {
            const color = settings.favoriteColors[i] || '#000000';
            return (
              <div key={i} className="epic-setting-row" style={{ alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={color}
                  onChange={(e) => {
                    const newFavs = [...settings.favoriteColors];
                    newFavs[i] = e.target.value;
                    updateSetting('favoriteColors', newFavs);
                  }}
                  style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', padding: 0, background: 'none' }} 
                />
                <span style={{ marginLeft: '12px' }}>{t[`quickColor${i+1}` as keyof typeof t]}</span>
              </div>
            );
          })}
        </div>

        {/* Ekran Görüntüsü */}
        <div>
          <div className="epic-section-title">{t.screenshot}</div>
          {renderRadio(t.askAlways, 'screenshotSaveMode', 'ask')}
          {renderRadio(t.saveAlwaysToFolder, 'screenshotSaveMode', 'folder', (
             <div onClick={handleSelectFolder} style={{ color: '#00a8ff', fontSize: '14px', cursor: 'pointer' }}>{settings.screenshotFolder}</div>
          ))}
          {renderCheckbox(t.captureFullDesktop, 'captureFullDesktop')}
        </div>

        {/* Beyaz Tahta */}
        <div>
          <div className="epic-section-title">{t.whiteboard}</div>
          {renderRadio(t.whiteboardAllScreens, 'whiteboardMode', 'all', undefined)}
          {renderRadio(t.whiteboardSingleScreen, 'whiteboardMode', 'single', (
            <select className="epic-select" value={settings.whiteboardScreen} onChange={(e) => updateSetting('whiteboardScreen', e.target.value)}>
              {displays.map((d, i) => (
                <option key={d.id} value={`${t.screenLabel} ${i+1}`}>{t.screenLabel} {i+1} ({d.bounds.width}x{d.bounds.height})</option>
              ))}
            </select>
          ))}
        </div>

        {/* Hayalet Modu */}
        <div>
          <div className="epic-section-title">{t.ghostMode}</div>
          <div style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '8px', lineHeight: '1.4' }}>
            {t.ghostModeDesc}
          </div>
          {renderCheckbox(t.enableGhostMode, 'ghostMode')}
          {renderCheckbox(t.disableToolNotifications, 'disableToolNotifications')}
        </div>

        {/* Kısayol Tuşları */}
        <div>
          <div className="epic-section-title">{t.shortcuts}</div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <button className="epic-button" onClick={handleResetShortcuts}>{t.resetToDefault}</button>
            <div className="epic-setting-row" style={{ marginBottom: 0 }} onClick={() => updateSetting('disableShortcuts', !settings.disableShortcuts)}>
              <div className={`epic-checkbox-wrapper ${settings.disableShortcuts ? 'checked' : ''}`}>
                <input type="checkbox" checked={settings.disableShortcuts} readOnly />
              </div>
              <span>{t.disableShortcuts}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #eee', paddingTop: '8px' }}>
            {renderShortcut(t.shortcutToggleToolbar, 'toggleToolbar')}
            {renderShortcut(t.shortcutToggleInk, 'toggleInk')}
            {renderShortcut(t.shortcutSelect, 'select')}
            {renderShortcut(t.shortcutPen, 'pen')}
            {renderShortcut(t.shortcutHighlighter, 'highlighter')}
            {renderShortcut(t.shortcutLaser, 'laser')}
            {renderShortcut(t.shortcutEraser, 'eraser')}
            {renderShortcut(t.shortcutClear, 'clear')}
            {renderShortcut(t.shortcutUndo, 'undo')}
            {renderShortcut(t.shortcutRedo, 'redo')}
            {renderShortcut(t.shortcutDelete, 'delete')}
            {renderShortcut(t.shortcutText, 'text')}
            
            {renderShortcut(t.shortcutShapes, 'shapes', true, showShapeShortcuts, () => setShowShapeShortcuts(prev => !prev))}

            {showShapeShortcuts && (
              <div style={{ borderLeft: '2px solid #555', marginLeft: '15px', paddingLeft: '5px', background: 'rgba(0,0,0,0.2)' }}>
                {renderShortcut(t.shortcutShapeLine, 'shapeLine')}
                {renderShortcut(t.shortcutShapeArrow, 'shapeArrow')}
                {renderShortcut(t.shortcutShapeDoubleArrow, 'shapeDoubleArrow')}
                {renderShortcut(t.shortcutShapeRectangle, 'shapeRectangle')}
                {renderShortcut(t.shortcutShapeSquare, 'shapeSquare')}
                {renderShortcut(t.shortcutShapeEllipse, 'shapeEllipse')}
                {renderShortcut(t.shortcutShapePolygon, 'shapePolygon')}
                {renderShortcut(t.shortcutShapeFreePolygon, 'shapeFreePolygon')}
                {renderShortcut(t.shortcutShapeFreeEllipse, 'shapeFreeEllipse')}
              </div>
            )}
            
            {renderShortcut(t.shortcutSettings, 'settings')}
            {renderShortcut(t.shortcutScreenshot, 'screenshot')}
            {renderShortcut(t.shortcutIncreaseBrush, 'increaseBrush')}
            {renderShortcut(t.shortcutDecreaseBrush, 'decreaseBrush')}
            {renderShortcut(t.shortcutChangeToLastColor, 'changeToLastColor')}
            {renderShortcut(t.quickColor1, 'quickColor1')}
            {renderShortcut(t.quickColor2, 'quickColor2')}
            {renderShortcut(t.quickColor3, 'quickColor3')}
            {renderShortcut(t.quickColor4, 'quickColor4')}
          </div>
        </div>

      </div>
    </div>
  );
};
