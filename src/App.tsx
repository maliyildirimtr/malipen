import { useState, useEffect, useRef } from 'react'
import { DrawingCanvas, Tool, Stroke } from './components/DrawingCanvas'
import { useDraggable } from './hooks/useDraggable'
import { CaptureOverlay, Region } from './components/CaptureOverlay'
import { PropertiesPanel } from './components/PropertiesPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { Settings, DEFAULT_SETTINGS } from './types/settings'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { matchesShortcut, activeKeys, getNormalizedKey } from './utils/shortcuts'
import { compositeScreenshot } from './utils/compositor'
import { calculateContextualPanelPosition, brushSizeToSlider, sliderToBrushSize } from './utils/geometry'
import { Pen, Highlighter, Eraser, MousePointer2, Undo, Redo, Trash2, Shapes, Minus, ArrowRight, ArrowLeftRight, Square, Circle, Triangle, CheckSquare, Square as SquareOutline, Type, Camera, Fullscreen, Scissors, Settings as SettingsIcon, Presentation, Monitor, Github, Instagram, Globe, Lock, Unlock, RectangleHorizontal, Hexagon, Spline, BoxSelect, LassoSelect, Image as ImageIcon, LayoutGrid } from 'lucide-react'

const DEFAULT_FAVORITE_COLORS = ['#ff0000', '#000000', '#00aa00', '#0066ff'];

type BgPattern = { type: 'none' | 'lines' | 'grid' | 'dots'; spacing: number; opacity: number };

function BoardPatternOverlay({ pattern, boardMode }: { pattern: BgPattern; boardMode: 'whiteboard' | 'blackboard' }) {
  if (pattern.type === 'none') return null;
  const lineColor = boardMode === 'whiteboard' ? `rgba(0,0,0,${pattern.opacity})` : `rgba(255,255,255,${pattern.opacity})`;
  const s = Math.round(pattern.spacing * (96 / 25.4)); // Convert mm to px for rendering
  // Include boardMode in ID to prevent collision when both SVGs are in DOM simultaneously
  const patternId = `bp-${boardMode}-${pattern.type}-${s}`;
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id={patternId} x="0" y="0" width={s} height={s} patternUnits="userSpaceOnUse">
          <rect width={s} height={s} fill="none" />
          {pattern.type === 'lines' && <line x1="0" y1={s} x2={s} y2={s} stroke={lineColor} strokeWidth="1" />}
          {pattern.type === 'grid' && (
            <>
              <line x1={s} y1="0" x2={s} y2={s} stroke={lineColor} strokeWidth="1" />
              <line x1="0" y1={s} x2={s} y2={s} stroke={lineColor} strokeWidth="1" />
            </>
          )}
          {pattern.type === 'dots' && <circle cx={s / 2} cy={s / 2} r="1.5" fill={lineColor} />}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

export function App() {
  const [isAnnotationMode, setIsAnnotationMode] = useState(false)
  const [previousAnnotationMode, setPreviousAnnotationMode] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMouseOverToolbar, setIsMouseOverToolbar] = useState(false)
  const [currentTool, setCurrentTool] = useState<Tool>('pen')
  const [selectMode, setSelectMode] = useState<'rectangle' | 'lasso'>('rectangle')
  const [showSelectMenu, setShowSelectMenu] = useState(false)
  const [penColor, setPenColor] = useState<string>(() => {
    try {
      const local = localStorage.getItem('malipen_settings');
      if (local) {
        const parsed = JSON.parse(local);
        return parsed.penColor || '#000000';
      }
    } catch (e) {}
    return '#000000';
  });
  const [highlighterColor, setHighlighterColor] = useState<string>(() => {
    try {
      const local = localStorage.getItem('malipen_settings');
      if (local) {
        const parsed = JSON.parse(local);
        return parsed.highlighterColor || '#ffff00';
      }
    } catch (e) {}
    return '#ffff00';
  });

  const currentColor = currentTool === 'highlighter' ? highlighterColor : penColor;

  const [fillColor, setFillColor] = useState('#ffffff')
  const [fillOpacity, setFillOpacity] = useState(1.0)
  const [isFilled, setIsFilled] = useState(false)
  
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const local = localStorage.getItem('malipen_settings');
      if (local) {
        const parsed = JSON.parse(local);
        const favs = Array.isArray(parsed.favoriteColors) && parsed.favoriteColors.length > 0 
          ? parsed.favoriteColors 
          : DEFAULT_FAVORITE_COLORS;
        return { ...DEFAULT_SETTINGS, ...parsed, favoriteColors: favs, penSize: parsed.penSize || 5 };
      }
    } catch (e) {}
    return {
      ...DEFAULT_SETTINGS,
      favoriteColors: DEFAULT_FAVORITE_COLORS,
      penSize: 5
    };
  })
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [settingsPanelPos, setSettingsPanelPos] = useState<React.CSSProperties | null>(null)
  
  const currentWidth = currentTool === 'pen' ? settings.penSize 
    : currentTool === 'highlighter' ? settings.highlighterSize 
    : currentTool === 'eraser' ? settings.eraserSize 
    : settings.penSize

  const favoriteColorsList = Array.isArray(settings.favoriteColors) && settings.favoriteColors.length > 0
    ? settings.favoriteColors
    : DEFAULT_FAVORITE_COLORS;

  const cursorPreviewRef = useRef<HTMLDivElement>(null)

  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const [showDrawMenu, setShowDrawMenu] = useState(false)
  const [showLaserMenu, setShowLaserMenu] = useState(false)

  const [selectedStroke, setSelectedStroke] = useState<Stroke | null>(null)
  const [contextualPanelPos, setContextualPanelPos] = useState<{x: number, y: number} | null>(null)
  
  const [showColorPopover, setShowColorPopover] = useState(false)
  const [showBrushSizePopover, setShowBrushSizePopover] = useState(false)
  
  const [eraserMode, setEraserMode] = useState<'object' | 'pixel'>('object')
  const [showEraserMenu, setShowEraserMenu] = useState(false)

  // Text formatting state (Defaults for new text)
  const [fontFamily] = useState('Arial')
  const [fontSize] = useState(24)
  const [isBold] = useState(false)
  const [isItalic] = useState(false)
  const [isUnderline] = useState(false)
  const [alignment] = useState<'left'|'center'|'right'>('left')
  
  // Capture states
  const [showCaptureMenu, setShowCaptureMenu] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [frozenImage, setFrozenImage] = useState<string | null>(null)
  const [captureRegion, setCaptureRegion] = useState<Region | null>(null)
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [previewIncludeAnnotations, setPreviewIncludeAnnotations] = useState(true)
  
  const toolbarRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleImageBtnClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.electronAPI && window.electronAPI.selectImage) {
      const dataUrl = await window.electronAPI.selectImage();
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 500;
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          
          if (w > maxWidth) {
            const ratio = maxWidth / w;
            w = maxWidth;
            h = h * ratio;
          }

          const cx = window.innerWidth / 2;
          const cy = window.innerHeight / 2;

          const newStroke = {
            id: Date.now().toString(),
            type: 'image' as any,
            points: [
              { x: cx - w / 2, y: cy - h / 2 },
              { x: cx + w / 2, y: cy + h / 2 }
            ],
            color: '#000000',
            width: 2,
            imageUrl: dataUrl,
            isFilled: false,
            rotation: 0
          };

          if (activeCanvasRef.current && activeCanvasRef.current.addStroke) {
            activeCanvasRef.current.addStroke(newStroke);
            setShowCaptureMenu(false);
          }
        };
        img.src = dataUrl;
      }
    } else {
      // Fallback for non-electron environment
      if (imageInputRef.current) {
        imageInputRef.current.click();
      }
    }
  };

  const [boardMode, setBoardMode] = useState<'screen' | 'whiteboard' | 'blackboard'>('screen')
  const [showBoardMenu, setShowBoardMenu] = useState(false)
  const [bgPattern, setBgPattern] = useState<{ type: 'none' | 'lines' | 'grid' | 'dots'; spacing: number; opacity: number }>({ type: 'none', spacing: 10, opacity: 0.15 })
  const [showBgPatternMenu, setShowBgPatternMenu] = useState(false)
  
  const [showSettingsPopover, setShowSettingsPopover] = useState(false)
  const [showAboutPopover, setShowAboutPopover] = useState(false)
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
  
  const [updateAvailable, setUpdateAvailable] = useState<any>(null)
  const [updateDownloaded, setUpdateDownloaded] = useState<any>(null)
  const [showUpdateToast, setShowUpdateToast] = useState(false)

  const isEn = settings.language === 'English';

  const screenCanvasRef = useRef<any>(null)
  const whiteboardCanvasRef = useRef<any>(null)
  const blackboardCanvasRef = useRef<any>(null)

  const activeCanvasRef = boardMode === 'whiteboard' ? whiteboardCanvasRef 
    : boardMode === 'blackboard' ? blackboardCanvasRef 
    : screenCanvasRef;
  const { position, setPosition, handleMouseDown, isDragging } = useDraggable(toolbarRef)

  const isToolbarOnRight = position.x > window.innerWidth / 2;
  const isToolbarOnBottom = position.y > window.innerHeight / 2;
  const popoverClass = `${isToolbarOnRight ? 'popover-left' : ''} ${isToolbarOnBottom ? 'popover-bottom' : ''}`.trim();

  const isShapeTool = ['line', 'arrow', 'double-arrow', 'rectangle', 'square', 'circle', 'ellipse', 'polygon', 'free-polygon', 'free-ellipse'].includes(currentTool);

  const saveSettingsHelper = async (newSettings: Settings) => {
    try {
      localStorage.setItem('malipen_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
    if ((window as any).electronAPI?.saveSettings) {
      try {
        await (window as any).electronAPI.saveSettings(newSettings);
      } catch (e) {
        console.error('Failed to save settings via Electron', e);
      }
    }
  };

  const lastColorRef = useRef<string | null>(null);

  const setCurrentColor = (color: string) => {
    if (currentColor !== color) {
      lastColorRef.current = currentColor;
    }
    if (currentTool === 'highlighter') {
      setHighlighterColor(color);
      const newSettings = { ...settings, highlighterColor: color };
      setSettings(newSettings);
      saveSettingsHelper(newSettings);
    } else {
      setPenColor(color);
      const newSettings = { ...settings, penColor: color };
      setSettings(newSettings);
      saveSettingsHelper(newSettings);
    }
  };

  const updateBrushSize = (size: number) => {
    const validSize = Math.min(100, Math.max(1, size));
    setSettings(prev => {
      const newSettings = { ...prev };
      
      if (prev.toolsTrackOwnSize) {
        if (currentTool === 'pen' || isShapeTool) newSettings.penSize = validSize;
        else if (currentTool === 'highlighter') newSettings.highlighterSize = validSize;
        else if (currentTool === 'eraser') newSettings.eraserSize = validSize;
        else newSettings.penSize = validSize;
      } else {
        newSettings.penSize = validSize;
        newSettings.highlighterSize = validSize;
        newSettings.eraserSize = validSize;
      }
      
      saveSettingsHelper(newSettings);
      return newSettings;
    });
  };

  const handleSetBoardMode = (mode: 'screen' | 'whiteboard' | 'blackboard') => {
    setBoardMode(mode);
    setShowBoardMenu(false);
    if (mode === 'blackboard' && currentColor === '#000000') {
       setCurrentColor('#ffffff');
    }
  };
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // If clicking inside the Settings panel, keep it open; otherwise close it
      if (!target.closest('.epic-settings-panel')) {
        setShowSettingsMenu(false);
      }

      // Check if clicking inside any specific popover or its trigger button
      const inSelect = !!target.closest('.select-popover, .select-menu-container') || !!target.closest('.tool-btn[title*="Seçim"], .tool-btn[title*="Selection"]');
      const inDraw = !!target.closest('.draw-tools-popover, .draw-popover') || !!target.closest('.tool-btn[title*="Draw Tools"]');
      const inShape = !!target.closest('.shapes-popover') || !!target.closest('.tool-btn[title*="Shapes"]');
      const inEraser = !!target.closest('.eraser-popover, .eraser-menu') || !!target.closest('.tool-btn[title*="Eraser"]');
      const inLaser = !!target.closest('.laser-popover, .laser-menu') || !!target.closest('.tool-btn[title*="Laser"]');
      const inCapture = !!target.closest('.capture-menu-popover') || !!target.closest('.tool-btn[title*="Screenshot"]') || !!target.closest('.tool-btn[title*="Ekran Görüntüsü"]');
      const inBoard = !!target.closest('.board-mode-popover') || !!target.closest('.tool-btn[title*="Board Mode"]') || !!target.closest('.tool-btn[title*="Tahta Modu"]');
      const inBgPattern = !!target.closest('.bg-pattern-popover') || !!target.closest('.tool-btn[title*="Background"]') || !!target.closest('.tool-btn[title*="Arkaplan"]');
      const inColor = !!target.closest('.color-popover:not(.brush-size-popover)') || !!target.closest('.tool-btn[title="Color"]');
      const inBrushSize = !!target.closest('.brush-size-popover') || !!target.closest('.tool-btn[title="Brush Size"]');
      const inSettings = !!target.closest('.settings-popover, .about-popover') || !!target.closest('.tool-btn[title*="Settings"]');

      if (!inSelect) setShowSelectMenu(false);
      if (!inDraw) setShowDrawMenu(false);
      if (!inShape) setShowShapeMenu(false);
      if (!inEraser) setShowEraserMenu(false);
      if (!inLaser) setShowLaserMenu(false);
      if (!inCapture) setShowCaptureMenu(false);
      if (!inBoard) setShowBoardMenu(false);
      if (!inBgPattern) setShowBgPatternMenu(false);
      if (!inColor) setShowColorPopover(false);
      if (!inBrushSize) setShowBrushSizePopover(false);
      if (!inSettings) {
        setShowSettingsPopover(false);
        setShowAboutPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  useEffect(() => {
    if (window.electronAPI && window.electronAPI.updateInteractionState) {
      const isAnyMenuOpen = showSelectMenu || showSettingsMenu || showSettingsPopover || showAboutPopover || showShapeMenu || showDrawMenu || showColorPopover || showBrushSizePopover || showEraserMenu || showBoardMenu || showLaserMenu || showPrivacyPolicy;
      const shouldIgnore = (!isAnnotationMode || isMinimized) && !isCapturing && !previewCanvas && !isAnyMenuOpen && !isDragging && !isMouseOverToolbar;


      const intervalId = setInterval(() => {
        const rects: {x: number, y: number, width: number, height: number}[] = [];
        
        // Target all interactive UI elements
        const selectors = [
          '.toolbar',
          '.epic-settings-panel',
          '.properties-panel',
          '.settings-popover', 
          '.about-popover', 
          '.shape-popover', 
          '.draw-popover', 
          '.draw-tools-popover',
          '.color-popover', 
          '.brush-size-container', 
          '.brush-size-popover',
          '.board-mode-menu', 
          '.board-mode-popover',
          '.privacy-overlay', 
          '.privacy-container',
          '.eraser-menu', 
          '.laser-menu', 
          '.preview-container', 
          '.preview-modal',
          '.board-controls'
        ];

        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            const r = el.getBoundingClientRect();
            // Ensure element is actually visible and rendered
            if (r.width > 0 && r.height > 0) {
              rects.push({x: r.left, y: r.top, width: r.width, height: r.height});
            }
          });
        });

        window.electronAPI.updateInteractionState({
          shouldIgnoreBase: shouldIgnore,
          clickableRects: rects
        });
      }, 100);

      return () => clearInterval(intervalId);
    }
  }, [isAnnotationMode, isMinimized, isCapturing, previewCanvas, showSettingsMenu, showSettingsPopover, showAboutPopover, showShapeMenu, showDrawMenu, showColorPopover, showBrushSizePopover, showEraserMenu, showBoardMenu, showLaserMenu, showPrivacyPolicy, isDragging, isMouseOverToolbar]);

  useEffect(() => {
    const loadInitSettings = async () => {
      let loadedSettings: Partial<Settings> | null = null;
      try {
        if ((window as any).electronAPI?.loadSettings) {
          const electronSettings = await (window as any).electronAPI.loadSettings();
          if (electronSettings && typeof electronSettings === 'object' && Object.keys(electronSettings).length > 0) {
            loadedSettings = electronSettings;
          }
        }
      } catch (e) { 
        console.error('Failed to load settings from electron', e);
      }

      if (!loadedSettings) {
        try {
          const local = localStorage.getItem('malipen_settings');
          if (local) {
            loadedSettings = JSON.parse(local);
          }
        } catch (e) {
          console.error('Failed to load settings from localStorage', e);
        }
      }

      if (loadedSettings) {
        const merged: Settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
        if (typeof merged.penSize !== 'number' || isNaN(merged.penSize) || merged.penSize <= 0) {
          merged.penSize = 5;
        }
        if (typeof merged.highlighterSize !== 'number' || isNaN(merged.highlighterSize) || merged.highlighterSize <= 0) {
          merged.highlighterSize = 20;
        }
        if (typeof merged.eraserSize !== 'number' || isNaN(merged.eraserSize) || merged.eraserSize <= 0) {
          merged.eraserSize = 30;
        }
        if (!Array.isArray(merged.favoriteColors) || merged.favoriteColors.length === 0) {
          merged.favoriteColors = DEFAULT_FAVORITE_COLORS;
        }
        if (!merged.rememberShortcutsOnClose) {
          merged.shortcuts = { ...DEFAULT_SETTINGS.shortcuts };
        }
        setSettings(merged);
        saveSettingsHelper(merged);
      } else {
        const initial: Settings = {
          ...DEFAULT_SETTINGS,
          favoriteColors: DEFAULT_FAVORITE_COLORS,
          penSize: 5
        };
        setSettings(initial);
        saveSettingsHelper(initial);
      }
    }
    loadInitSettings()
  }, [])
  
  // Calculate contextual position whenever selectedStroke changes (only on initial selection)
  useEffect(() => {
    if (selectedStroke && activeCanvasRef.current) {
      const bounds = activeCanvasRef.current.getBoundingBox(selectedStroke.id);
      if (bounds) {
        const isText = selectedStroke.type === 'text';
        const panelSize = isText ? { width: 260, height: 300 } : { width: 260, height: 340 };
        const pos = calculateContextualPanelPosition(
          bounds, 
          panelSize, 
          { width: window.innerWidth, height: window.innerHeight },
          'top'
        );
        setContextualPanelPos(pos);
      }
    } else {
      setContextualPanelPos(null);
    }
  }, [selectedStroke?.id, isAnnotationMode]); // only re-run if selection ID or mode changes so it stays in place during edits

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if (showPrivacyPolicy) return;
       if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

       const s = settings.shortcuts;
       
       // Sadece Ayarlar (Settings) ve Araç Çubuğu kısayollarına her zaman izin ver, 
       // Diğerlerini disableShortcuts ise engelle!
       if (matchesShortcut(e, s.settings)) {
         setShowSettingsMenu(prev => !prev);
         return;
       }
       if (matchesShortcut(e, s.toggleToolbar)) {
         if (!settings.ghostMode) {
            // Hayalet modu kapalıysa mürekkebi de gizle
            setIsAnnotationMode(prev => !prev);
            setIsMinimized(prev => !prev);
         } else {
            // Hayalet modu açıksa sadece toolbar küçülür
            setIsMinimized(prev => !prev);
         }
         return;
       }
       
       if (settings.disableShortcuts) return;

       if (matchesShortcut(e, s.pen)) setTool('pen')
       else if (matchesShortcut(e, s.highlighter)) setTool('highlighter')
       else if (matchesShortcut(e, s.eraser)) setTool('eraser')
       else if (matchesShortcut(e, s.select)) setTool('select')
       else if (matchesShortcut(e, s.text)) setTool('text')
       else if (matchesShortcut(e, s.shapes)) setShowShapeMenu(prev => !prev)
       else if (matchesShortcut(e, s.shapeLine)) setTool('line')
       else if (matchesShortcut(e, s.shapeArrow)) setTool('arrow')
       else if (matchesShortcut(e, s.shapeDoubleArrow)) setTool('double-arrow')
       else if (matchesShortcut(e, s.shapeRectangle)) setTool('rectangle')
       else if (matchesShortcut(e, s.shapeSquare)) setTool('square')
       else if (matchesShortcut(e, s.shapeEllipse)) setTool('ellipse')
       else if (matchesShortcut(e, s.shapePolygon)) setTool('polygon')
       else if (matchesShortcut(e, s.shapeFreePolygon)) setTool('free-polygon')
       else if (matchesShortcut(e, s.shapeFreeEllipse)) setTool('free-ellipse')
       else if (matchesShortcut(e, s.undo)) activeCanvasRef.current?.undo()
       else if (matchesShortcut(e, s.redo)) activeCanvasRef.current?.redo()
       else if (matchesShortcut(e, s.clear)) activeCanvasRef.current?.clear()
       else if (matchesShortcut(e, s.delete)) activeCanvasRef.current?.deleteSelected()
       else if (matchesShortcut(e, s.increaseBrush)) {
          updateBrushSize(Math.min(100, currentWidth + 2))
       }
       else if (matchesShortcut(e, s.decreaseBrush)) {
          updateBrushSize(Math.max(1, currentWidth - 2))
       }
       else if (matchesShortcut(e, s.changeToLastColor)) {
          if (lastColorRef.current) {
            setCurrentColor(lastColorRef.current);
          }
       }
       else if (matchesShortcut(e, s.screenshot)) {
          handleCaptureStart(settings.captureFullDesktop ? 'full' : 'region');
       }
       else if (matchesShortcut(e, s.quickColor1) && settings.favoriteColors[0]) {
          setCurrentColor(settings.favoriteColors[0]);
       }
       else if (matchesShortcut(e, s.quickColor2) && settings.favoriteColors[1]) {
          setCurrentColor(settings.favoriteColors[1]);
       }
       else if (matchesShortcut(e, s.quickColor3) && settings.favoriteColors[2]) {
          setCurrentColor(settings.favoriteColors[2]);
       }
       else if (matchesShortcut(e, s.quickColor4) && settings.favoriteColors[3]) {
          setCurrentColor(settings.favoriteColors[3]);
       }
       else if (matchesShortcut(e, s.toggleInk)) {
          // Toggle Ink: Hide board completely but keep toolbar
          setPreviousAnnotationMode(isAnnotationMode);
          setIsAnnotationMode(prev => !prev);
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings, currentWidth, showPrivacyPolicy, isAnnotationMode]);

  // Global key tracking for chord/multi-key shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      activeKeys.add(getNormalizedKey(e));
      if (e.key === 'Escape') {
        const isAnyMenuOrPanelOpen = 
          showSettingsMenu || 
          showSettingsPopover || 
          showAboutPopover || 
          showShapeMenu || 
          showDrawMenu || 
          showColorPopover || 
          showBrushSizePopover || 
          showEraserMenu || 
          showBoardMenu || 
          showLaserMenu || 
          showCaptureMenu || 
          showPrivacyPolicy || 
          !!selectedStroke || 
          isCapturing || 
          !!previewCanvas;

        if (isAnyMenuOrPanelOpen) {
          e.preventDefault();
          e.stopPropagation();
          setShowSettingsMenu(false);
          setShowSettingsPopover(false);
          setShowAboutPopover(false);
          setShowShapeMenu(false);
          setShowDrawMenu(false);
          setShowColorPopover(false);
          setShowBrushSizePopover(false);
          setShowEraserMenu(false);
          setShowBoardMenu(false);
          setShowLaserMenu(false);
          setShowCaptureMenu(false);
          setShowPrivacyPolicy(false);
          if (selectedStroke) {
            setSelectedStroke(null);
            activeCanvasRef.current?.deselect();
          }
          if (isCapturing) {
            setIsCapturing(false);
            setFrozenImage(null);
          }
          if (previewCanvas) {
            setPreviewCanvas(null);
            setPreviewImageUrl(null);
          }
          return;
        }

        if (isAnnotationMode) {
          setIsAnnotationMode(false);
        }
      }
    };
    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      activeKeys.delete(getNormalizedKey(e));
    };
    const handleGlobalBlur = () => {
      activeKeys.clear();
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    window.addEventListener('keyup', handleGlobalKeyUp, { capture: true });
    window.addEventListener('blur', handleGlobalBlur);
    
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
      window.removeEventListener('keyup', handleGlobalKeyUp, { capture: true });
      window.removeEventListener('blur', handleGlobalBlur);
    };
  }, [
    isAnnotationMode, showPrivacyPolicy, showSettingsMenu, showSettingsPopover, showAboutPopover,
    showShapeMenu, showDrawMenu, showColorPopover, showBrushSizePopover, showEraserMenu,
    showBoardMenu, showLaserMenu, showCaptureMenu, selectedStroke, isCapturing, previewCanvas
  ]);

  // Adjust brush size with mouse wheel
  useEffect(() => {
    let timeoutId: any;
    const handleWheel = (e: WheelEvent) => {
      if (!settings.mouseWheelAdjustsPenSize) return;

      // Don't change brush size if scrolling over a menu or toolbar
      const target = e.target as HTMLElement;
      if (target.closest('.toolbar') || target.closest('.shape-popover') || target.closest('.settings-panel')) {
         return;
      }
      
      if (!isAnnotationMode || currentTool === 'select') return;
      
      const delta = e.deltaY > 0 ? -1 : 1; 
      const newSize = Math.min(100, Math.max(1, currentWidth + delta));
      updateBrushSize(newSize);
    };

    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      clearTimeout(timeoutId);
    };
  }, [isAnnotationMode, currentWidth, currentTool, isShapeTool, settings.mouseWheelAdjustsPenSize]);

  useEffect(() => {
    const updateCursor = (e: MouseEvent) => {
      if (cursorPreviewRef.current && settings.showCursorPreview && isAnnotationMode && !isCapturing && !previewCanvas) {
        // Use requestAnimationFrame for smooth performance
        requestAnimationFrame(() => {
          if (!cursorPreviewRef.current) return;
          cursorPreviewRef.current.style.transform = `translate(${e.clientX - currentWidth / 2}px, ${e.clientY - currentWidth / 2}px)`;
        });
      }
    };
    window.addEventListener('mousemove', updateCursor);
    return () => window.removeEventListener('mousemove', updateCursor);
  }, [settings.showCursorPreview, isAnnotationMode, isCapturing, previewCanvas, currentWidth]);

  const handleCaptureStart = async (mode: 'full' | 'region') => {
    if (isCapturing || previewCanvas) return; // Prevent concurrent captures
    setIsCapturing(true);
    setShowCaptureMenu(false);
    
    try {
      let dataUrl = '';
      if (boardMode === 'whiteboard' || boardMode === 'blackboard') {
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = boardMode === 'whiteboard' ? '#ffffff' : '#1e1e1e';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        dataUrl = canvas.toDataURL('image/png');
      } else {
        // The main process hides the window automatically before capturing
        dataUrl = await (window as any).electronAPI.captureScreen();
      }

      if (!dataUrl) throw new Error("Failed to capture screen");
      
      setFrozenImage(dataUrl);
      
      // CRITICAL MAC OS FIX: mainWindow.hide() and show() can reset the native window hit-testing state!
      // We must explicitly re-assert that we want to capture mouse events after the window is shown again.
      if ((window as any).electronAPI) {
        console.log("RE-ASSERTING setIgnoreMouseEvents(false) after window.show()");
        (window as any).electronAPI.setIgnoreMouseEvents(false, { forward: true });
      }

      if (mode === 'full') {
         await handleCaptureFinish(dataUrl, null);
      }
    } catch (err) {
      console.error('CAPTURE_ERROR', err);
      setIsCapturing(false);
      setFrozenImage(null);
    }
  };

  const handleCaptureFinish = async (backgroundSrc: string, region: Region | null) => {
    try {
      setCaptureRegion(region);
      const strokes = activeCanvasRef.current?.getStrokes() || [];
      const startCompose = performance.now();
      const composed = await compositeScreenshot(backgroundSrc, region, previewIncludeAnnotations, strokes);
      console.log(`[PERF] COMPOSITION: ${performance.now() - startCompose}ms`);
      setPreviewCanvas(composed);
      
      const blob = await new Promise<Blob | null>(res => composed.toBlob(res, 'image/png'));
      if (blob) setPreviewImageUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Composition failed:', err);
    } finally {
      setIsCapturing(false); // hide overlay
    }
  };

  useEffect(() => {
    if (previewCanvas && frozenImage) {
      // Regenerate preview if toggle changes
      const generate = async () => {
         const strokes = activeCanvasRef.current?.getStrokes() || [];
         const composed = await compositeScreenshot(frozenImage, captureRegion, previewIncludeAnnotations, strokes);
         setPreviewCanvas(composed);
         
         const blob = await new Promise<Blob | null>(res => composed.toBlob(res, 'image/png'));
         if (blob) {
           setPreviewImageUrl(prev => {
             if (prev) URL.revokeObjectURL(prev);
             return URL.createObjectURL(blob);
           });
         }
      };
      generate();
    }
  }, [previewIncludeAnnotations]);

  const handleSavePreview = async (format: 'png' | 'jpeg') => {
     if (previewCanvas && saveStatus !== 'saving') {
        setSaveStatus('saving');
        try {
          const t0 = performance.now();
          console.log('[PERF] SAVE_START');
          
          const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
          const blob = await new Promise<Blob | null>(res => previewCanvas.toBlob(res, mimeType, format === 'jpeg' ? 0.9 : undefined));
          if (!blob) throw new Error("Failed to generate blob");
          
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const t1 = performance.now();
          console.log(`[PERF] DATA_PREPARATION: ${t1 - t0}ms`);
          
          const savePath = settings.screenshotSaveMode === 'folder' ? settings.screenshotFolder : undefined;
          const savedPath = await (window as any).electronAPI.saveImage(uint8Array, format, savePath);
          const t2 = performance.now();
          
          console.log(`[PERF] IPC_SEND + MAIN_PROCESS + RETURN: ${t2 - t1}ms`);
          console.log(`[PERF] SAVE_COMPLETE Total: ${t2 - t0}ms`);
          
          if (savedPath) {
            setSaveStatus('saved');
            setTimeout(() => {
              handleCancelPreview();
            }, 600);
          } else {
            setSaveStatus('idle');
          }
        } catch (e) {
          console.error("Save failed", e);
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }
     }
  };

  const handleCopyPreview = async () => {
     if (previewCanvas && saveStatus !== 'saving') {
        try {
          const blob = await new Promise<Blob | null>(res => previewCanvas.toBlob(res, 'image/png'));
          if (!blob) return;
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          await (window as any).electronAPI.copyToClipboard(uint8Array);
          
          setSaveStatus('saved');
          setTimeout(() => handleCancelPreview(), 600);
        } catch (e) {
          console.error("Copy failed", e);
        }
     }
  };

  const handleCancelPreview = () => {
     if (previewImageUrl) {
       URL.revokeObjectURL(previewImageUrl);
     }
     setPreviewCanvas(null);
     setPreviewImageUrl(null);
     setFrozenImage(null);
     setCaptureRegion(null);
     setSaveStatus('idle');
  };

  useEffect(() => {
    if ((window as any).electronAPI && (window as any).electronAPI.onShortcut) {
      (window as any).electronAPI.onShortcut((action: string) => {
        if (action === 'toggle-mode') {
          setIsAnnotationMode(prev => !prev)
        } else if (action === 'tool-pen') {
          setIsAnnotationMode(true); setCurrentTool('pen')
        } else if (action === 'tool-highlighter') {
          setIsAnnotationMode(true); setCurrentTool('highlighter')
        } else if (action === 'tool-eraser') {
          setIsAnnotationMode(true); setCurrentTool('eraser')
        } else if (action === 'clear-all') {
          activeCanvasRef.current?.clear()
        } else if (action === 'undo') {
          activeCanvasRef.current?.undo()
        } else if (action === 'capture-region') {
          handleCaptureStart('region')
        } else if (action === 'capture-full') {
          handleCaptureStart('full')
        }
      })
    }
  }, [])

  useEffect(() => {
    if ((window as any).electronAPI) {
      if ((window as any).electronAPI.onUpdateAvailable) {
        (window as any).electronAPI.onUpdateAvailable((info: any) => {
          setUpdateAvailable(info);
          setShowUpdateToast(true);
        });
      }
      if ((window as any).electronAPI.onUpdateDownloaded) {
        (window as any).electronAPI.onUpdateDownloaded((info: any) => {
          setUpdateDownloaded(info);
          setShowUpdateToast(true);
        });
      }
    }
  }, []);

  const setTool = (tool: Tool) => {
    setIsAnnotationMode(true);
    setCurrentTool(tool);
    setShowSelectMenu(false);
    setShowShapeMenu(false);
    setShowCaptureMenu(false);
    setShowSettingsPopover(false);
    setShowAboutPopover(false);
    setShowColorPopover(false);
    setShowBrushSizePopover(false);
    setShowEraserMenu(false);
    setShowDrawMenu(false);
    setShowLaserMenu(false);
    setShowBoardMenu(false);
  };

  return (
    <div className={`app-container ${isAnnotationMode ? 'annotation-mode' : 'cursor-mode'}`}>
      {showUpdateToast && (
        <div className="update-toast-container">
          <div className="update-toast">
            <div className="update-toast-header">
              {updateDownloaded 
                ? (isEn ? "Update Ready!" : "Güncelleme Hazır!") 
                : (isEn ? "Update Available" : "Güncelleme Mevcut")}
            </div>
            <div className="update-toast-body">
              {updateDownloaded 
                ? (isEn ? "A new version of MaliPen has been downloaded and is ready to install." : "MaliPen'in yeni sürümü indirildi ve kuruluma hazır.") 
                : (isEn ? `Downloading the latest version ${updateAvailable?.version ? `(${updateAvailable.version}) ` : ''}in the background...` : `En son sürüm ${updateAvailable?.version ? `(${updateAvailable.version}) ` : ''}arka planda indiriliyor...`)}
            </div>
            <div className="update-toast-actions">
              <button className="update-toast-btn" onClick={() => setShowUpdateToast(false)}>
                {isEn ? "Dismiss" : "Kapat"}
              </button>
              {updateDownloaded && (
                <button 
                  className="update-toast-btn primary" 
                  onClick={() => {
                    if ((window as any).electronAPI?.installUpdate) {
                      (window as any).electronAPI.installUpdate();
                    }
                  }}
                >
                  {isEn ? "Install & Restart" : "Kur ve Yeniden Başlat"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div 
        ref={toolbarRef}
        className={`toolbar ${settings.toolbarOrientation === 'horizontal' ? 'horizontal' : ''} ${isDragging ? 'dragging' : ''} ${isMinimized ? 'minimized' : ''}`}
        style={{ left: position.x, top: position.y }}
        onPointerEnter={() => setIsMouseOverToolbar(true)}
        onPointerLeave={() => setIsMouseOverToolbar(false)}
      >
        <div className="toolbar-drag-handle" onMouseDown={handleMouseDown}>
          <div className="drag-indicator" />
          <div className="drag-indicator" />
        </div>
        
        {/* Minimize Button */}
        <button 
          className="tool-btn toolbar-toggle-btn"
          onClick={() => {
            const newMinimized = !isMinimized;
            setIsMinimized(newMinimized);
            if (newMinimized) {
              setPreviousAnnotationMode(isAnnotationMode);
              setIsAnnotationMode(false);
            } else {
              setIsAnnotationMode(previousAnnotationMode);
            }
          }}
          title={isMinimized ? (isEn ? `Unlock Drawing [${settings.shortcuts.toggleToolbar}]` : `Çizimi Aç [${settings.shortcuts.toggleToolbar}]`) : (isEn ? `Lock Drawing (Screen Mode) [${settings.shortcuts.toggleToolbar}]` : `Çizimi Kilitle (Ekran Modu) [${settings.shortcuts.toggleToolbar}]`)}
        >
          {isMinimized ? <Lock size={20} color="#ff007f" /> : <Unlock size={20} color="#ff007f" />}
        </button>

        {!isMinimized && (
          <div className="toolbar-content">
            <button 
            className={`tool-btn ${!isAnnotationMode ? 'active pointer-mode' : ''}`}
            onClick={() => setIsAnnotationMode(false)}
            title={isEn ? 'Cursor Mode' : 'İmleç Modu'}
          >
            <MousePointer2 size={20} />
          </button>
          
          {/* Selection Tool Menu */}
          <div className="shape-menu-container select-menu-container">
            <button 
              className={`tool-btn ${isAnnotationMode && currentTool === 'select' ? 'active pointer-mode' : ''}`}
              onClick={() => {
                if (currentTool === 'select') {
                  setShowSelectMenu(prev => !prev);
                } else {
                  setTool('select');
                  setShowSelectMenu(false);
                }
              }}
              onDoubleClick={() => setShowSelectMenu(true)}
              title={`${isEn ? 'Selection Tool' : 'Seçim Aracı'} (${selectMode === 'rectangle' ? (isEn ? 'Rectangle' : 'Kutu Seçim') : (isEn ? 'Lasso' : 'Serbest Seçim')}) [${settings.shortcuts.select}]`}
            >
              {selectMode === 'lasso' ? <LassoSelect size={20} /> : <BoxSelect size={20} />}
            </button>

            {showSelectMenu && (
              <div 
                className={`shape-popover select-popover ${popoverClass}`} 
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="draw-popover-header">
                  <span>{isEn ? 'Selection Type' : 'Seçim Türü'}</span>
                </div>
                <div className="draw-popover-grid">
                  <button 
                    className={`draw-popover-item ${selectMode === 'rectangle' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectMode('rectangle');
                      setTool('select');
                      setShowSelectMenu(false);
                    }}
                  >
                    <BoxSelect size={18} />
                    <span>{isEn ? 'Rectangle Select' : 'Kutu Seçim'}</span>
                  </button>
                  <button 
                    className={`draw-popover-item ${selectMode === 'lasso' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectMode('lasso');
                      setTool('select');
                      setShowSelectMenu(false);
                    }}
                  >
                    <LassoSelect size={18} />
                    <span>{isEn ? 'Lasso Select' : 'Serbest Seçim'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="toolbar-divider" />

            {/* Draw Menu */}
            <div className="shape-menu-container">
              <button 
                className={`tool-btn ${['pen', 'highlighter', 'text'].includes(currentTool) ? 'active' : ''}`} 
                onClick={() => {
                  if (['pen', 'highlighter', 'text'].includes(currentTool)) {
                    setShowDrawMenu(!showDrawMenu);
                  } else {
                    setTool('pen');
                  }
                }}
                onDoubleClick={() => {
                  if (!['pen', 'highlighter', 'text'].includes(currentTool)) setTool('pen');
                  setShowDrawMenu(true);
                }}
                title={`${isEn ? 'Draw Tools' : 'Çizim Araçları'} [${settings.shortcuts.pen}] (${isEn ? 'Double click for settings' : 'Ayarlar için çift tıklayın'})`}
              >
                {currentTool === 'highlighter' ? <Highlighter size={20} /> 
                 : currentTool === 'text' ? <Type size={20} /> 
                 : <Pen size={20} />}
              </button>
              {showDrawMenu && (
                <div className={`shape-popover draw-tools-popover draw-popover ${popoverClass}`}>
                  <div className="shape-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '4px' }}>
                    <button className={`tool-btn ${currentTool === 'pen' ? 'active' : ''}`} onClick={() => { setIsAnnotationMode(true); setCurrentTool('pen'); }} title={`${isEn ? 'Pen' : 'Kalem'} [${settings.shortcuts.pen}]`}><Pen size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'highlighter' ? 'active' : ''}`} onClick={() => { setIsAnnotationMode(true); setCurrentTool('highlighter'); }} title={`${isEn ? 'Highlighter' : 'Vurgulayıcı'} [${settings.shortcuts.highlighter}]`}><Highlighter size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'text' ? 'active' : ''}`} onClick={() => { setIsAnnotationMode(true); setCurrentTool('text'); }} title={`${isEn ? 'Text' : 'Metin'} [${settings.shortcuts.text}]`}><Type size={18} /></button>
                  </div>

                  {currentTool === 'pen' && (
                    <>
                      <div className="draw-tools-section">
                        <div className="draw-tools-section-title">
                          <span>{isEn ? 'Stabilizer' : 'Sabitleyici (Yumuşatma)'}</span>
                        </div>
                        <div className="stabilizer-grid">
                          {[
                            { id: 'off', label: isEn ? 'Off' : 'Kapalı' },
                            { id: 'basic', label: isEn ? 'Basic' : 'Temel' },
                            { id: 'soft', label: isEn ? 'Soft' : 'Yumuşak' },
                            { id: 'silky', label: isEn ? 'Silky' : 'İpeksi' },
                            { id: 'fluid', label: isEn ? 'Fluid' : 'Akıcı' },
                          ].map(item => (
                            <button
                              key={item.id}
                              className={`stabilizer-btn ${(settings.penStabilizer || 'basic') === item.id ? 'active' : ''}`}
                              onClick={() => {
                                const newSettings = { ...settings, penStabilizer: item.id as any };
                                setSettings(newSettings);
                                saveSettingsHelper(newSettings);
                              }}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="draw-tools-section">
                        <div className="draw-tools-section-title">
                          <span>{isEn ? 'Opacity' : 'Kalem Opaklığı'}</span>
                          <span>{Math.round((settings.penOpacity ?? 1.0) * 100)}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.01"
                          value={settings.penOpacity ?? 1.0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            const newSettings = { ...settings, penOpacity: val };
                            setSettings(newSettings);
                            saveSettingsHelper(newSettings);
                          }}
                          className="brush-size-slider"
                        />
                      </div>
                    </>
                  )}

                  {currentTool === 'highlighter' && (
                    <div className="draw-tools-section">
                      <div className="draw-tools-section-title">
                        <span>{isEn ? 'Highlighter Opacity' : 'Vurgulayıcı Opaklığı'}</span>
                        <span>{Math.round((settings.highlighterOpacity ?? 0.35) * 100)}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0.05"
                        max="1.0"
                        step="0.01"
                        value={settings.highlighterOpacity ?? 0.35}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const newSettings = { ...settings, highlighterOpacity: val };
                          setSettings(newSettings);
                          saveSettingsHelper(newSettings);
                        }}
                        className="brush-size-slider"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="shape-menu-container">
            <button 
              className={`tool-btn ${currentTool === 'eraser' ? 'active' : ''}`} 
              onClick={() => {
                if (currentTool === 'eraser') {
                   setShowEraserMenu(!showEraserMenu);
                } else {
                   setTool('eraser');
                }
              }}
              onDoubleClick={() => {
                setTool('eraser');
                setShowEraserMenu(true);
              }}
              title={`${isEn ? 'Eraser' : 'Silgi'} [${settings.shortcuts.eraser}] (${isEn ? 'Double click for mode' : 'Mod için çift tıklayın'})`}
            >
              <Eraser size={20} />
            </button>
            {showEraserMenu && (
              <div className={`shape-popover eraser-popover eraser-menu ${popoverClass}`} style={{ padding: '8px', width: '130px' }}>
                <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '8px', textAlign: 'center' }}>{isEn ? 'Eraser Mode' : 'Silgi Modu'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                   <button 
                     className={`tool-btn ${eraserMode === 'object' ? 'active' : ''}`} 
                     style={{ padding: '6px', fontSize: '12px', width: '100%', justifyContent: 'flex-start' }}
                     onClick={() => { setEraserMode('object'); setShowEraserMenu(false); }}
                   >
                     {isEn ? 'Object Eraser' : 'Nesne Silgisi'}
                   </button>
                   <button 
                     className={`tool-btn ${eraserMode === 'pixel' ? 'active' : ''}`} 
                     style={{ padding: '6px', fontSize: '12px', width: '100%', justifyContent: 'flex-start' }}
                     onClick={() => { setEraserMode('pixel'); setShowEraserMenu(false); }}
                   >
                     {isEn ? 'Pixel Eraser' : 'Piksel Silgisi'}
                   </button>
                </div>
              </div>
            )}
          </div>

          <div className="shape-menu-container">
            <button className={`tool-btn ${isShapeTool ? 'active' : ''}`} onClick={() => setShowShapeMenu(!showShapeMenu)} title={`${isEn ? 'Shapes' : 'Şekiller'} [${settings.shortcuts.shapes}]`}>
              <Shapes size={20} />
            </button>
            {showShapeMenu && (
              <div className={`shape-popover shapes-popover ${popoverClass}`}>
                <div className="shape-grid">
                  <button className={`tool-btn ${currentTool === 'line' ? 'active' : ''}`} onClick={() => setTool('line')} title={isEn ? 'Line' : 'Çizgi'}><Minus size={18} /></button>
                  <button className={`tool-btn ${currentTool === 'arrow' ? 'active' : ''}`} onClick={() => setTool('arrow')} title={isEn ? 'Arrow' : 'Ok'}><ArrowRight size={18} /></button>
                  <button className={`tool-btn ${currentTool === 'double-arrow' ? 'active' : ''}`} onClick={() => setTool('double-arrow')} title={isEn ? 'Double Arrow' : 'Çift Ok'}><ArrowLeftRight size={18} /></button>
                  <button className={`tool-btn ${currentTool === 'rectangle' ? 'active' : ''}`} onClick={() => setTool('rectangle')} title={isEn ? 'Rectangle' : 'Dikdörtgen'}><RectangleHorizontal size={18} /></button>
                  <button className={`tool-btn ${currentTool === 'square' ? 'active' : ''}`} onClick={() => setTool('square')} title={isEn ? 'Square' : 'Kare'}><Square size={18} /></button>
                  <button className={`tool-btn ${currentTool === 'ellipse' ? 'active' : ''}`} onClick={() => setTool('ellipse')} title={isEn ? 'Ellipse' : 'Elips'}><Circle size={18} /></button>
                  <button className={`tool-btn ${currentTool === 'polygon' ? 'active' : ''}`} onClick={() => setTool('polygon')} title={isEn ? 'Triangle' : 'Üçgen'}><Triangle size={18} /></button>
                  <button className={`tool-btn ${currentTool === 'free-polygon' ? 'active' : ''}`} onClick={() => setTool('free-polygon')} title={isEn ? 'Free Polygon' : 'Serbest Çokgen'}><Hexagon size={18} /></button>
                  <button className={`tool-btn ${currentTool === 'free-ellipse' ? 'active' : ''}`} onClick={() => setTool('free-ellipse')} title={isEn ? 'Free Ellipse' : 'Serbest Elips'}><Spline size={18} /></button>
                </div>
                <div className="fill-controls">
                  <div className="fill-header-row">
                    <label className="fill-toggle" title={isEn ? 'Toggle Fill' : 'Dolguyu Aç/Kapat'}>
                      <input type="checkbox" checked={isFilled} onChange={(e) => setIsFilled(e.target.checked)} />
                      {isFilled ? <CheckSquare size={16} /> : <SquareOutline size={16} />}
                      <span>{isEn ? 'Fill' : 'Dolgu'}</span>
                    </label>
                    {isFilled && (
                      <div className="fill-color-picker-wrapper">
                        <input 
                          type="color" 
                          value={fillColor} 
                          onChange={(e) => setFillColor(e.target.value)} 
                          className="color-picker fill-picker"
                          title={isEn ? 'Fill Color' : 'Dolgu Rengi'}
                        />
                      </div>
                    )}
                  </div>
                  {isFilled && (
                    <div className="fill-opacity-container">
                      <div className="fill-opacity-header">
                        <span>{isEn ? 'Opacity' : 'Şeffaflık'}</span>
                        <span>{Math.round(fillOpacity * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="1" step="0.01" 
                        value={fillOpacity} 
                        onChange={(e) => setFillOpacity(parseFloat(e.target.value))} 
                        className="brush-size-slider"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="shape-menu-container">
            <button 
              className={`tool-btn ${currentTool === 'laser' ? 'active' : ''}`} 
              onClick={() => {
                if (currentTool === 'laser') {
                  setShowLaserMenu(!showLaserMenu);
                } else {
                  setTool('laser');
                }
              }} 
              onDoubleClick={() => {
                setTool('laser');
                setShowLaserMenu(true);
              }}
              title={`${isEn ? 'Laser Pointer' : 'Lazer İşaretçi'} [${settings.shortcuts.laser}] (${isEn ? 'Double click for mode' : 'Mod için çift tıklayın'})`}
            >
              <div style={{width: 14, height: 14, borderRadius: '50%', background: '#ff007f', boxShadow: '0 0 6px #ff007f'}} />
            </button>
            {showLaserMenu && (
              <div className={`shape-popover laser-popover laser-menu ${popoverClass}`} style={{ padding: '10px', width: '150px' }}>
                <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '8px', textAlign: 'center', fontWeight: 600 }}>
                  {isEn ? 'Laser Mode' : 'Lazer Modu'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                  <button 
                    className={`tool-btn ${(settings.laserMode || 'individual') === 'individual' ? 'active' : ''}`}
                    style={{ padding: '6px 8px', fontSize: '11px', width: '100%', justifyContent: 'flex-start', height: 'auto' }}
                    onClick={() => {
                      const newSettings = { ...settings, laserMode: 'individual' as const };
                      setSettings(newSettings);
                      saveSettingsHelper(newSettings);
                    }}
                  >
                    {isEn ? 'Individual Fade' : 'Kaybolan (Bireysel)'}
                  </button>
                  <button 
                    className={`tool-btn ${settings.laserMode === 'group' ? 'active' : ''}`}
                    style={{ padding: '6px 8px', fontSize: '11px', width: '100%', justifyContent: 'flex-start', height: 'auto' }}
                    onClick={() => {
                      const newSettings = { ...settings, laserMode: 'group' as const };
                      setSettings(newSettings);
                      saveSettingsHelper(newSettings);
                    }}
                  >
                    {isEn ? 'Group / Idle Fade' : 'Bekleyen (Grup)'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                  {isEn ? 'Duration' : 'Lazer Süresi'}: {(settings.laserFadeDuration / 1000).toFixed(1)}s
                </div>
                <input 
                  type="range" 
                  min="500" max="5000" step="100" 
                  value={settings.laserFadeDuration}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    const newSettings = { ...settings, laserFadeDuration: val };
                    setSettings(newSettings);
                    saveSettingsHelper(newSettings);
                  }}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
            )}
          </div>
          
          <div className="shape-menu-container">
            <button className="tool-btn" onClick={() => setShowCaptureMenu(!showCaptureMenu)} title={`${isEn ? 'Screenshot' : 'Ekran Görüntüsü'} [${settings.shortcuts.screenshot}]`}>
              <Camera size={20} />
            </button>
            {showCaptureMenu && (
              <div className={`shape-popover capture-menu-popover ${popoverClass}`}>
                <div className="shape-grid">
                  <button className="tool-btn" onClick={() => handleCaptureStart('region')} title={isEn ? 'Region' : 'Bölge Seç'}><Scissors size={18} /></button>
                  <button className="tool-btn" onClick={() => handleCaptureStart('full')} title={isEn ? 'Full Screen' : 'Tam Ekran'}><Fullscreen size={18} /></button>
                  <button className="tool-btn" onClick={handleImageBtnClick} title={isEn ? 'Insert Image' : 'Görsel Ekle'}><ImageIcon size={18} /></button>
                </div>
              </div>
            )}
          </div>

          <div className="shape-menu-container">
            <button className={`tool-btn ${showBoardMenu ? 'active' : ''}`} onClick={() => setShowBoardMenu(!showBoardMenu)} title={isEn ? 'Board Mode' : 'Tahta Modu'}>
              <Presentation size={20} />
            </button>
            {showBoardMenu && (
              <div className={`shape-popover board-mode-popover ${popoverClass}`} style={{ width: '150px' }}>
                <button className={`board-mode-btn ${boardMode === 'screen' ? 'active' : ''}`} onClick={() => handleSetBoardMode('screen')}>
                  <Monitor size={16} /> {isEn ? 'Screen' : 'Ekran'}
                </button>
                <button className={`board-mode-btn ${boardMode === 'whiteboard' ? 'active' : ''}`} onClick={() => handleSetBoardMode('whiteboard')}>
                  <SquareOutline size={16} /> {isEn ? 'Whiteboard' : 'Beyaz Tahta'}
                </button>
                <button className={`board-mode-btn ${boardMode === 'blackboard' ? 'active' : ''}`} onClick={() => handleSetBoardMode('blackboard')}>
                  <Square size={16} /> {isEn ? 'Blackboard' : 'Siyah Tahta'}
                </button>
              </div>
            )}
          </div>

          {/* Background pattern — only visible in whiteboard/blackboard */}
          {boardMode !== 'screen' && (
            <div className="shape-menu-container">
              <button
                className={`tool-btn ${showBgPatternMenu ? 'active' : ''}`}
                onClick={() => setShowBgPatternMenu(p => !p)}
                title={isEn ? 'Background Pattern' : 'Arkaplan Deseni'}
              >
                <LayoutGrid size={20} />
              </button>
              {showBgPatternMenu && (
                <div className={`shape-popover bg-pattern-popover ${popoverClass}`} style={{ width: '200px', padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '8px', textAlign: 'center' }}>
                    {isEn ? 'Background Pattern' : 'Arkaplan Deseni'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                    {(['none', 'lines', 'grid', 'dots'] as const).map(pt => (
                      <button
                        key={pt}
                        className={`board-mode-btn ${bgPattern.type === pt ? 'active' : ''}`}
                        style={{ fontSize: '11px', justifyContent: 'center' }}
                        onClick={() => setBgPattern(p => ({ ...p, type: pt }))}
                      >
                        {pt === 'none' ? (isEn ? 'None' : 'Yok') :
                         pt === 'lines' ? (isEn ? 'Lines' : 'Çizgili') :
                         pt === 'grid' ? (isEn ? 'Grid' : 'Kareli') :
                         (isEn ? 'Dots' : 'Noktalı')}
                      </button>
                    ))}
                  </div>
                  {bgPattern.type !== 'none' && (
                    <>
                      <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '4px' }}>
                        {isEn ? 'Spacing' : 'Aralık'}: {bgPattern.spacing}mm
                      </div>
                      <input
                        type="range" min={3} max={30} step={0.5}
                        value={bgPattern.spacing}
                        onChange={e => setBgPattern(p => ({ ...p, spacing: Number(e.target.value) }))}
                        style={{ width: '100%', marginBottom: '10px' }}
                      />
                      <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '4px' }}>
                        {isEn ? 'Opacity' : 'Opaklık'}: {Math.round(bgPattern.opacity * 100)}%
                      </div>
                      <input
                        type="range" min={5} max={60} step={1}
                        value={Math.round(bgPattern.opacity * 100)}
                        onChange={e => setBgPattern(p => ({ ...p, opacity: Number(e.target.value) / 100 }))}
                        style={{ width: '100%' }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="toolbar-divider" />

          <button className="tool-btn" title={`${isEn ? 'Undo' : 'Geri Al'} [${settings.shortcuts.undo}]`} onClick={() => activeCanvasRef.current?.undo()}><Undo size={20} /></button>
          <button className="tool-btn" title={`${isEn ? 'Redo' : 'İleri Al'} [${settings.shortcuts.redo}]`} onClick={() => activeCanvasRef.current?.redo()}><Redo size={20} /></button>
          <button className="tool-btn danger" title={currentTool === 'select' ? (isEn ? 'Delete Selected / Clear All' : 'Seçilileri Sil / Temizle') : `${isEn ? 'Clear All' : 'Tümünü Temizle'} [${settings.shortcuts.clear}]`} onClick={() => {
            if (currentTool === 'select' && activeCanvasRef.current?.getSelectedStrokeIds().length) {
              activeCanvasRef.current.deleteSelected();
            } else {
              activeCanvasRef.current?.clear();
            }
          }}><Trash2 size={20} /></button>

          <div className="toolbar-divider" />

          <div className="shape-menu-container">
            <button className="tool-btn" title={isEn ? 'Color' : 'Renk'} onClick={() => setShowColorPopover(!showColorPopover)}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: currentColor, border: '1px solid rgba(255,255,255,0.2)' }} />
            </button>
            {showColorPopover && (
              <div className={`color-popover ${popoverClass}`}>
                <div className="color-popover-header">
                  <span>{isEn ? 'Color Picker' : 'Renk Seçici'}</span>
                  <button className="close-btn" onClick={() => setShowColorPopover(false)}>×</button>
                </div>
                <div className="current-color-row">
                  <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} className="color-picker stroke-picker" />
                  <span style={{ fontSize: 13, color: 'white' }}>{currentColor.toUpperCase()}</span>
                </div>
                
                <div className="color-popover-header" style={{ marginTop: 8 }}>
                  <span>{isEn ? 'Favorite Colors' : 'Favori Renkler'}</span>
                  <span style={{ fontSize: '11px', color: '#71717a' }}>{favoriteColorsList.length}/12</span>
                </div>
                <div className="favorites-grid">
                  {favoriteColorsList.map((col, i) => (
                    <div 
                      key={`${col}-${i}`} 
                      className="favorite-swatch-wrapper"
                      title={isEn ? `${col} (Click to select, click × to remove)` : `${col} (Seçmek için tıkla, kaldırmak için × bas)`}
                    >
                      <div 
                        className={`favorite-swatch ${currentColor.toLowerCase() === col.toLowerCase() ? 'active' : ''}`} 
                        style={{ backgroundColor: col }}
                        onClick={() => setCurrentColor(col)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          const newFavs = favoriteColorsList.filter((_, idx) => idx !== i);
                          const newSettings = { ...settings, favoriteColors: newFavs };
                          setSettings(newSettings);
                          saveSettingsHelper(newSettings);
                        }}
                      />
                      <button
                        className="favorite-remove-btn"
                        title={isEn ? 'Remove from favorites' : 'Favorilerden kaldır'}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newFavs = favoriteColorsList.filter((_, idx) => idx !== i);
                          const newSettings = { ...settings, favoriteColors: newFavs };
                          setSettings(newSettings);
                          saveSettingsHelper(newSettings);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {favoriteColorsList.length < 12 && (
                  <div 
                    className="add-favorite-btn" 
                    onClick={() => {
                      if (!favoriteColorsList.includes(currentColor)) {
                        const newFavs = [...favoriteColorsList, currentColor];
                        const newSettings = { ...settings, favoriteColors: newFavs };
                        setSettings(newSettings);
                        saveSettingsHelper(newSettings);
                      }
                    }}
                  >
                    {isEn ? '+ Add Current Color' : '+ Mevcut Rengi Ekle'}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="toolbar-divider" />
          
          <div className="shape-menu-container">
             <button className="tool-btn" title={isEn ? 'Brush Size' : 'Fırça Boyutu'} onClick={() => setShowBrushSizePopover(!showBrushSizePopover)}>
               <div style={{ width: Math.min(24, Math.max(4, currentWidth)), height: Math.min(24, Math.max(4, currentWidth)), borderRadius: '50%', backgroundColor: 'white' }} />
             </button>
             {showBrushSizePopover && (
               <div className={`color-popover brush-size-popover ${popoverClass}`} style={{ width: '200px' }}>
                 <div className="brush-size-header">
                   <span>{isEn ? 'Size' : 'Boyut'}</span>
                   <span>{currentWidth}px</span>
                 </div>
                  <input 
                    type="range" 
                    className="brush-size-slider" 
                    min="0" max="100" step="0.2"
                    value={brushSizeToSlider(currentWidth)}
                    onChange={(e) => updateBrushSize(sliderToBrushSize(parseFloat(e.target.value)))} 
                  />
               </div>
             )}
          </div>

          <div className="toolbar-divider" />

          <div className="shape-menu-container">
            <button className={`tool-btn ${showSettingsPopover || showAboutPopover ? 'active' : ''}`} title={`${isEn ? 'Settings' : 'Ayarlar'} [${settings.shortcuts.settings}]`} onClick={() => setShowSettingsPopover(!showSettingsPopover)}>
              <SettingsIcon size={20} />
            </button>
            {showSettingsPopover && !showAboutPopover && (
              <div className={`shape-popover settings-popover ${popoverClass}`} style={{ width: '180px', top: 'auto', bottom: '-8px' }}>
                <div style={{ padding: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontWeight: 'bold', paddingLeft: '8px' }}>{isEn ? 'MaliPen Menu' : 'MaliPen Menü'}</div>
                <button className="board-mode-btn" onClick={() => { setShowSettingsPopover(false); setShowAboutPopover(true); }}>{isEn ? 'About' : 'Hakkında'}</button>
                <button className="board-mode-btn" onClick={() => setShowSettingsPopover(false)}>{isEn ? 'Help' : 'Yardım'}</button>
                <button className="board-mode-btn" onClick={() => { 
                  const offsetW = toolbarRef.current?.offsetWidth || 0;
                  const offsetH = toolbarRef.current?.offsetHeight || 0;
                  const isLeft = position.x < window.innerWidth / 2;
                  const isTop = position.y < window.innerHeight / 2;
                  let newPos: React.CSSProperties = {};
                  const padding = 12;

                  if (settings.toolbarOrientation === 'horizontal') {
                    if (isLeft) newPos.left = position.x;
                    else newPos.right = window.innerWidth - (position.x + offsetW);
                    
                    if (isTop) newPos.top = position.y + offsetH + padding;
                    else newPos.bottom = window.innerHeight - position.y + padding;
                  } else {
                    if (isTop) newPos.top = position.y;
                    else newPos.bottom = window.innerHeight - (position.y + offsetH);
                    
                    if (isLeft) newPos.left = position.x + offsetW + padding;
                    else newPos.right = window.innerWidth - position.x + padding;
                  }
                  
                  setSettingsPanelPos(newPos);
                  setShowSettingsPopover(false); 
                  setShowSettingsMenu(true); 
                }}>{isEn ? 'Settings' : 'Ayarlar'}</button>
                <div style={{ margin: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }} />
                <button className="board-mode-btn" onClick={() => window.close()}>{isEn ? 'Close toolbar' : 'Araç çubuğunu kapat'}</button>
              </div>
            )}
            
            {showAboutPopover && (
              <div className={`shape-popover about-popover ${popoverClass}`} style={{ width: '250px', padding: '0', overflow: 'hidden', top: 'auto', bottom: '-8px' }}>
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#e4e4e7', position: 'relative' }}>
                   <button 
                     onClick={() => setShowAboutPopover(false)} 
                     style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '18px' }}>×</button>
                   <h2 style={{ fontSize: '42px', fontWeight: 'bold', margin: '0 0 0 0', fontFamily: 'cursive', letterSpacing: '-1px', color: '#ffffff' }}>MaliPen</h2>
                   <div style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '24px', fontWeight: '300' }}>professional</div>
                   <div style={{ fontSize: '13px', fontWeight: '600' }}>©2026 Mali Yıldırım</div>
                   <div style={{ fontSize: '12px', color: '#a1a1aa' }}>{isEn ? 'Version 1.0.0' : 'Versiyon 1.0.0'}</div>
                   <div 
                     style={{ marginTop: '24px', fontSize: '11px', color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}
                     onClick={() => setShowPrivacyPolicy(true)}
                   >
                     {isEn ? 'View Privacy Policy' : 'Gizlilik Politikasını Görüntüle'}
                   </div>
                </div>
                <div style={{ display: 'flex', height: '48px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                   <div style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#e4e4e7', cursor: 'pointer' }} onClick={() => window.open('https://maliyildirimtr.com')}>
                     <Globe size={20} />
                   </div>
                   <div style={{ flex: 1, backgroundColor: 'rgba(225, 48, 108, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#f25b90', cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.05)' }} onClick={() => window.open('https://www.instagram.com/mali_academy')}>
                     <Instagram size={20} />
                   </div>
                   <div style={{ flex: 1, backgroundColor: 'rgba(51, 51, 51, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ffffff', cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.05)' }} onClick={() => window.open('https://github.com/maliyildirimtr/')}>
                     <Github size={20} />
                   </div>
                   <div style={{ flex: 1, backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.05)' }} onClick={() => window.open('https://academy.maliyildirimtr.com/')}>
                     <img src="/mali_academy.png" alt="Mali Academy" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
      
      {/* SCREEN CANVAS */}
      <div 
        className="canvas-wrapper" 
        style={{ 
          display: boardMode === 'screen' ? 'block' : 'none', 
          zIndex: 10,
          visibility: isMinimized ? 'hidden' : 'visible'
        }}
      >
        <DrawingCanvas 
          ref={screenCanvasRef}
          isAnnotationMode={isAnnotationMode && !isCapturing && !previewCanvas && !isMinimized} 
          tool={currentTool} 
          color={currentColor} 
          fillColor={fillColor}
          isFilled={isFilled}
          fillOpacity={fillOpacity}
          width={currentWidth} 
          fontFamily={fontFamily}
          fontSize={fontSize}
          isBold={isBold}
          isItalic={isItalic}
          isUnderline={isUnderline}
          alignment={alignment}
          eraserMode={eraserMode}
          onSelectedStrokeChange={setSelectedStroke}
          laserFadeDuration={settings.laserFadeDuration}
          laserMode={settings.laserMode || 'individual'}
          penOpacity={settings.penOpacity ?? 1.0}
          highlighterOpacity={settings.highlighterOpacity ?? 0.35}
          penStabilizer={settings.penStabilizer || 'basic'}
          autoShapeRecognition={settings.autoShapeRecognition !== false}
          selectMode={selectMode}
        />
      </div>

      {/* WHITEBOARD CANVAS */}
      <div 
        className="canvas-wrapper" 
        style={{ 
          display: boardMode === 'whiteboard' ? 'block' : 'none', 
          backgroundColor: '#ffffff', 
          zIndex: 20,
          visibility: isMinimized ? 'hidden' : 'visible',
          position: 'relative'
        }}
      >
        <BoardPatternOverlay pattern={bgPattern} boardMode="whiteboard" />
        <DrawingCanvas 
          ref={whiteboardCanvasRef}
          isAnnotationMode={!isCapturing && !previewCanvas && !isMinimized} 
          tool={currentTool} 
          color={currentColor} 
          fillColor={fillColor}
          isFilled={isFilled}
          fillOpacity={fillOpacity}
          width={currentWidth} 
          fontFamily={fontFamily}
          fontSize={fontSize}
          isBold={isBold}
          isItalic={isItalic}
          isUnderline={isUnderline}
          alignment={alignment}
          eraserMode={eraserMode}
          onSelectedStrokeChange={setSelectedStroke}
          laserFadeDuration={settings.laserFadeDuration}
          laserMode={settings.laserMode || 'individual'}
          penOpacity={settings.penOpacity ?? 1.0}
          highlighterOpacity={settings.highlighterOpacity ?? 0.35}
          penStabilizer={settings.penStabilizer || 'basic'}
          autoShapeRecognition={settings.autoShapeRecognition !== false}
          selectMode={selectMode}
        />
      </div>

      {/* BLACKBOARD CANVAS */}
      <div 
        className="canvas-wrapper" 
        style={{ 
          display: boardMode === 'blackboard' ? 'block' : 'none', 
          backgroundColor: '#1e1e1e', 
          zIndex: 20,
          visibility: isMinimized ? 'hidden' : 'visible',
          position: 'relative'
        }}
      >
        <BoardPatternOverlay pattern={bgPattern} boardMode="blackboard" />
        <DrawingCanvas 
          ref={blackboardCanvasRef}
          isAnnotationMode={!isCapturing && !previewCanvas && !isMinimized} 
          tool={currentTool} 
          color={currentColor} 
          fillColor={fillColor}
          isFilled={isFilled}
          fillOpacity={fillOpacity}
          width={currentWidth} 
          fontFamily={fontFamily}
          fontSize={fontSize}
          isBold={isBold}
          isItalic={isItalic}
          isUnderline={isUnderline}
          alignment={alignment}
          eraserMode={eraserMode}
          onSelectedStrokeChange={setSelectedStroke}
          laserFadeDuration={settings.laserFadeDuration}
          laserMode={settings.laserMode || 'individual'}
          penOpacity={settings.penOpacity ?? 1.0}
          highlighterOpacity={settings.highlighterOpacity ?? 0.35}
          penStabilizer={settings.penStabilizer || 'basic'}
          autoShapeRecognition={settings.autoShapeRecognition !== false}
          selectMode={selectMode}
        />
      </div>

      {selectedStroke && contextualPanelPos && !isMinimized && (
        <PropertiesPanel 
           stroke={selectedStroke}
           position={contextualPanelPos}
           language={settings.language}
           onChange={(updates, commit) => {
              activeCanvasRef.current?.updateStroke(selectedStroke.id, updates, commit);
           }}
           onClose={() => {
              setSelectedStroke(null);
              activeCanvasRef.current?.deselect();
           }}
        />
      )}

      {showSettingsMenu && (
        <SettingsPanel 
          settings={settings}
          position={settingsPanelPos || { top: 50, left: 50 }}
          onUpdate={async (newSettings) => {
            if (settings.toolbarOrientation !== newSettings.toolbarOrientation) {
              if (newSettings.toolbarOrientation === 'horizontal') {
                setPosition({
                  x: Math.max(0, (window.innerWidth - (toolbarRef.current?.offsetWidth || 400)) / 2),
                  y: 20
                });
              } else {
                setPosition({
                  x: Math.max(0, window.innerWidth - 120),
                  y: Math.max(20, (window.innerHeight - (toolbarRef.current?.offsetHeight || 600)) / 2)
                });
              }
            }
            setSettings(newSettings);
            saveSettingsHelper(newSettings);
          }}
          onClose={() => setShowSettingsMenu(false)}
        />
      )}

      {isCapturing && frozenImage && boardMode === 'screen' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1, backgroundImage: `url(${frozenImage})`, backgroundSize: '100% 100%', pointerEvents: 'none' }} />
      )}

      {isCapturing && frozenImage && (
        <CaptureOverlay 
          frozenImage={frozenImage}
          onCapture={(region) => handleCaptureFinish(frozenImage, region)}
          onCancel={() => {
            setIsCapturing(false);
            setFrozenImage(null);
          }}
        />
      )}

      {previewCanvas && (
        <div className="preview-modal-overlay">
           <div className="preview-modal">
              <h2>{isEn ? 'Screenshot Preview' : 'Ekran Görüntüsü Önizleme'}</h2>
              {previewImageUrl && <img src={previewImageUrl} alt="Capture Preview" className="preview-img" />}
              
              <div className="preview-controls">
                 <label className="fill-toggle">
                    <input type="checkbox" checked={previewIncludeAnnotations} onChange={(e) => setPreviewIncludeAnnotations(e.target.checked)} />
                    {previewIncludeAnnotations ? <CheckSquare size={16} /> : <SquareOutline size={16} />}
                    <span>{isEn ? 'Include Annotations' : 'Çizimleri Dahil Et'}</span>
                 </label>
              </div>

              <div className="preview-actions">
                 <button className="btn-secondary" onClick={handleCancelPreview}>{isEn ? 'Cancel' : 'İptal'}</button>
                 <button className="btn-secondary" onClick={handleCopyPreview}>{isEn ? 'Copy' : 'Kopyala'}</button>
                 <button className="btn-primary" onClick={() => handleSavePreview('png')} disabled={saveStatus === 'saving' || saveStatus === 'saved'}>
                   {saveStatus === 'saving' ? (isEn ? 'Saving...' : 'Kaydediliyor...') : saveStatus === 'saved' ? (isEn ? 'Saved' : 'Kaydedildi') : (isEn ? 'Save PNG' : 'PNG Kaydet')}
                 </button>
                 <button className="btn-primary" onClick={() => handleSavePreview('jpeg')} disabled={saveStatus === 'saving' || saveStatus === 'saved'}>
                   {saveStatus === 'saving' ? (isEn ? 'Saving...' : 'Kaydediliyor...') : saveStatus === 'saved' ? (isEn ? 'Saved' : 'Kaydedildi') : (isEn ? 'Save JPEG' : 'JPEG Kaydet')}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Brush Size Preview Cursor */}
      {settings.showCursorPreview && isAnnotationMode && !['select', 'text'].includes(currentTool) && !isCapturing && !previewCanvas && !isMinimized && (
        <div 
          ref={cursorPreviewRef}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: `${currentWidth}px`,
            height: `${currentWidth}px`,
            borderRadius: '50%',
            border: '1px solid rgba(0, 0, 0, 0.5)',
            backgroundColor: currentTool === 'eraser' ? 'rgba(255,255,255,0.8)' : currentColor,
            opacity: 0.5,
            pointerEvents: 'none',
            zIndex: 99999, // Under toolbar but above canvas
            willChange: 'transform'
          }}
        />
      )}

      {showPrivacyPolicy && (
        <PrivacyPolicy onClose={() => setShowPrivacyPolicy(false)} language={settings.language} />
      )}
    </div>
  )
}

export default App
