import { useState, useEffect, useRef, useCallback } from 'react'
import { DrawingCanvas, DrawingCanvasRef, Tool, Stroke, newStrokeId, visualStrokeWidth } from './components/DrawingCanvas'
import { useDraggable } from './hooks/useDraggable'
import { CaptureOverlay, Region } from './components/CaptureOverlay'
import { PropertiesPanel } from './components/PropertiesPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { ConfirmModal } from './components/ConfirmModal'
import { HelpPanel } from './components/HelpPanel'
import { ImageCropModal } from './components/ImageCropModal'
import { applyCropToStroke, CropRect } from './utils/crop'
import { Settings, Shortcuts } from './types/settings'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { matchesShortcut, activeKeys, getNormalizedKey } from './utils/shortcuts'
import { compositeScreenshot } from './utils/compositor'
import { migrateSettings, DEFAULT_FAVORITE_COLORS } from './utils/settingsMigration'
import { BgPattern, BoardMode, BOARD_BACKGROUND, paintBoard, patternLineColor, patternSpacingPx } from './utils/boardPattern'
import { useTheme } from './theme'
// Inlined as a data URL by build.assetsInlineLimit in vite.config (CSS masks from file:// fail CORS)
import malipenMarkUrl from './assets/malipen_mark.png'
import { calculateContextualPanelPosition, brushSizeToSlider, sliderToBrushSize } from './utils/geometry'
import { Pen, Highlighter, Eraser, MousePointer2, Undo, Redo, Trash2, Shapes, Minus, ArrowRight, ArrowLeftRight, Square, Circle, Triangle, CheckSquare, Square as SquareOutline, Type, Camera, Fullscreen, Scissors, Settings as SettingsIcon, Presentation, Monitor, Github, Instagram, Globe, Lock, Unlock, RectangleHorizontal, Hexagon, Spline, BoxSelect, LassoSelect, Image as ImageIcon, LayoutGrid, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'

const FONT_FAMILIES = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Segoe UI', 'Comic Sans MS'];
const SHAPE_TOOLS: Tool[] = ['line', 'arrow', 'double-arrow', 'rectangle', 'square', 'circle', 'ellipse', 'polygon', 'free-polygon', 'free-ellipse'];

type MenuKey = 'select' | 'draw' | 'shapes' | 'eraser' | 'laser' | 'capture' | 'board' | 'bgPattern' | 'color' | 'brush' | 'settings';
type ShortcutAction = keyof Shortcuts | 'capture-region' | 'capture-full' | 'open-settings';

/** Shortcut actions in the order they are matched locally. */
const SHORTCUT_ORDER: (keyof Shortcuts)[] = [
  'settings', 'toggleToolbar', 'toggleInk',
  'pen', 'highlighter', 'laser', 'eraser', 'select', 'text', 'shapes',
  'shapeLine', 'shapeArrow', 'shapeDoubleArrow', 'shapeRectangle', 'shapeSquare', 'shapeEllipse', 'shapePolygon', 'shapeFreePolygon', 'shapeFreeEllipse',
  'undo', 'redo', 'clear', 'delete', 'increaseBrush', 'decreaseBrush', 'changeToLastColor', 'screenshot',
  'quickColor1', 'quickColor2', 'quickColor3', 'quickColor4',
];
/** These keep working when "disable shortcuts" is on, so the user can always get back. */
const ALWAYS_ON: (keyof Shortcuts)[] = ['settings', 'toggleToolbar'];

const SHAPE_SHORTCUT_TOOL: Partial<Record<keyof Shortcuts, Tool>> = {
  shapeLine: 'line', shapeArrow: 'arrow', shapeDoubleArrow: 'double-arrow', shapeRectangle: 'rectangle',
  shapeSquare: 'square', shapeEllipse: 'ellipse', shapePolygon: 'polygon', shapeFreePolygon: 'free-polygon', shapeFreeEllipse: 'free-ellipse',
};

const TOOL_LABELS: Record<string, [string, string]> = {
  pen: ['Kalem', 'Pen'], highlighter: ['Vurgulayıcı', 'Highlighter'], laser: ['Lazer', 'Laser'], eraser: ['Silgi', 'Eraser'],
  select: ['Seçim', 'Selection'], text: ['Metin', 'Text'], line: ['Çizgi', 'Line'], arrow: ['Ok', 'Arrow'], 'double-arrow': ['Çift Ok', 'Double Arrow'],
  rectangle: ['Dikdörtgen', 'Rectangle'], square: ['Kare', 'Square'], ellipse: ['Elips', 'Ellipse'], circle: ['Daire', 'Circle'],
  polygon: ['Üçgen', 'Triangle'], 'free-polygon': ['Serbest Çokgen', 'Free Polygon'], 'free-ellipse': ['Serbest Elips', 'Free Ellipse'],
};

/** UI regions that must receive clicks while the rest of the window passes them through. */
const INTERACTIVE_SELECTORS = [
  '.toolbar', '.epic-settings-panel', '.properties-panel', '.shape-popover', '.color-popover',
  '.brush-size-popover', '.privacy-overlay', '.preview-modal-overlay', '.update-toast',
  '.confirm-modal-overlay', '.save-toast', '.crop-modal-overlay',
].join(',');

function BoardPatternOverlay({ pattern, boardMode }: { pattern: BgPattern; boardMode: 'whiteboard' | 'blackboard' }) {
  if (pattern.type === 'none') return null;
  const lineColor = patternLineColor(pattern, boardMode);
  const s = patternSpacingPx(pattern);
  // Include boardMode in the id: both SVGs are in the DOM at the same time
  const patternId = `bp-${boardMode}-${pattern.type}-${s}`;
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
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

const readLocalSettings = (): Settings => {
  try {
    const local = localStorage.getItem('malipen_settings');
    if (local) return migrateSettings(JSON.parse(local));
  } catch { /* storage unavailable or corrupt */ }
  return migrateSettings(null);
};

export function App() {
  const api = window.electronAPI;

  const [settings, setSettings] = useState<Settings>(readLocalSettings)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const theme = useTheme({ themeMode: settings.themeMode, themeAccent: settings.themeAccent })

  const [isAnnotationMode, setIsAnnotationMode] = useState(false)
  const previousAnnotationModeRef = useRef(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [inkHidden, setInkHidden] = useState(false)
  const [isMouseOverToolbar, setIsMouseOverToolbar] = useState(false)
  const [currentTool, setCurrentTool] = useState<Tool>('pen')
  const [selectMode, setSelectMode] = useState<'rectangle' | 'lasso'>('rectangle')
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [settingsPanelPos, setSettingsPanelPos] = useState<React.CSSProperties | null>(null)
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null)
  const [toolToast, setToolToast] = useState<string | null>(null)
  const [saveToast, setSaveToast] = useState<{ text: string; path?: string } | null>(null)
  const [failedShortcuts, setFailedShortcuts] = useState<string[]>([])
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false)

  const penColor = settings.penColor || '#000000';
  const highlighterColor = settings.highlighterColor || '#ffff00';
  const currentColor = currentTool === 'highlighter' ? highlighterColor : penColor;

  const [fillColor, setFillColor] = useState('#ffffff')
  const [fillOpacity, setFillOpacity] = useState(1.0)
  const [isFilled, setIsFilled] = useState(false)

  const isShapeTool = SHAPE_TOOLS.includes(currentTool);
  const currentWidth = currentTool === 'highlighter' ? settings.highlighterSize
    : currentTool === 'eraser' ? settings.eraserSize
    : currentTool === 'laser' ? settings.laserSize
    : settings.penSize;

  const favoriteColorsList = Array.isArray(settings.favoriteColors) && settings.favoriteColors.length > 0
    ? settings.favoriteColors
    : DEFAULT_FAVORITE_COLORS;

  const cursorPreviewRef = useRef<HTMLDivElement>(null)

  const [selectedStroke, setSelectedStroke] = useState<Stroke | null>(null)
  /** Image stroke whose crop editor is open */
  const [cropTargetId, setCropTargetId] = useState<string | null>(null)
  const [contextualPanelPos, setContextualPanelPos] = useState<{ x: number, y: number } | null>(null)
  const [eraserMode, setEraserMode] = useState<'object' | 'pixel'>('object')

  // Capture state
  const [isCapturing, setIsCapturing] = useState(false)
  const [frozenImage, setFrozenImage] = useState<string | null>(null)
  const [captureRegion, setCaptureRegion] = useState<Region | null>(null)
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [previewIncludeAnnotations, setPreviewIncludeAnnotations] = useState(true)

  const toolbarRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [boardMode, setBoardMode] = useState<BoardMode>('screen')
  const [bgPattern, setBgPattern] = useState<BgPattern>({ type: 'none', spacing: 10, opacity: 0.15 })
  /** Pen colour remembered per board, so white ink never ends up on the whiteboard. */
  const boardColorsRef = useRef<Partial<Record<BoardMode, string>>>({})

  const [updateAvailable, setUpdateAvailable] = useState<{ version?: string } | null>(null)
  const [updateDownloaded, setUpdateDownloaded] = useState<{ version?: string } | null>(null)
  const [showUpdateToast, setShowUpdateToast] = useState(false)

  const isEn = settings.language === 'English';
  const L = (tr: string, en: string) => (isEn ? en : tr);

  const screenCanvasRef = useRef<DrawingCanvasRef>(null)
  const whiteboardCanvasRef = useRef<DrawingCanvasRef>(null)
  const blackboardCanvasRef = useRef<DrawingCanvasRef>(null)
  const activeCanvasRef = boardMode === 'whiteboard' ? whiteboardCanvasRef
    : boardMode === 'blackboard' ? blackboardCanvasRef
    : screenCanvasRef;

  const { position, setPosition, handleMouseDown, isDragging } = useDraggable(toolbarRef)

  const isToolbarOnRight = position.x > window.innerWidth / 2;
  const isToolbarOnBottom = position.y > window.innerHeight / 2;
  const popoverClass = `${isToolbarOnRight ? 'popover-left' : ''} ${isToolbarOnBottom ? 'popover-bottom' : ''}`.trim();

  /** Ink is hidden when the toolbar is minimised (unless ghost mode) or toggled off. */
  const inkVisible = !inkHidden && !(isMinimized && !settings.ghostMode);
  const canDraw = isAnnotationMode && inkVisible && !isCapturing && !previewCanvas;

  // ── Settings persistence ───────────────────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<Settings | null>(null);

  const flushSettings = useCallback(() => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (pending && api?.saveSettings) api.saveSettings(pending).catch(e => console.error('Failed to save settings via Electron', e));
  }, [api]);

  /** localStorage immediately; settings.json debounced (sliders fire many times a second). */
  const persistSettings = useCallback((next: Settings) => {
    try { localStorage.setItem('malipen_settings', JSON.stringify(next)); } catch { /* storage full or unavailable */ }
    pendingSaveRef.current = next;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSettings, 300);
  }, [flushSettings]);

  useEffect(() => {
    window.addEventListener('beforeunload', flushSettings);
    return () => window.removeEventListener('beforeunload', flushSettings);
  }, [flushSettings]);

  const updateSettings = useCallback((patch: Partial<Settings> | ((prev: Settings) => Settings)) => {
    setSettings(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: Partial<Settings> | null = null;
      let desktop: string | undefined;
      try {
        if (api) {
          const fromFile = await api.loadSettings();
          if (fromFile && Object.keys(fromFile).length > 0) stored = fromFile as Partial<Settings>;
          desktop = (await api.getDefaultPaths()).desktop;
        }
      } catch (e) {
        console.error('Failed to load settings from electron', e);
      }
      if (!stored) {
        try {
          const local = localStorage.getItem('malipen_settings');
          if (local) stored = JSON.parse(local);
        } catch { /* ignore */ }
      }
      if (cancelled) return;
      const merged = migrateSettings(stored, desktop);
      setSettings(merged);
      persistSettings(merged);
    })();
    return () => { cancelled = true; };
  }, [api, persistSettings]);

  // ── Colours & sizes ────────────────────────────────────────────────────────
  const lastColorRef = useRef<string | null>(null);

  const setCurrentColor = (color: string) => {
    if (currentColor !== color) lastColorRef.current = currentColor;
    updateSettings(currentTool === 'highlighter' ? { highlighterColor: color } : { penColor: color });
  };

  const updateBrushSize = (size: number) => {
    const validSize = Math.min(100, Math.max(1, Math.round(size)));
    updateSettings(prev => {
      const next = { ...prev };
      if (currentTool === 'laser') next.laserSize = validSize; // the laser always has its own size
      else if (prev.toolsTrackOwnSize) {
        if (currentTool === 'highlighter') next.highlighterSize = validSize;
        else if (currentTool === 'eraser') next.eraserSize = validSize;
        else next.penSize = validSize;
      } else {
        next.penSize = validSize;
        next.highlighterSize = validSize;
        next.eraserSize = validSize;
      }
      return next;
    });
  };

  // ── Notifications ──────────────────────────────────────────────────────────
  const toolToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifyTool = (tool: Tool) => {
    if (settingsRef.current.disableToolNotifications) return;
    const label = TOOL_LABELS[tool];
    if (!label) return;
    setToolToast(isEn ? label[1] : label[0]);
    if (toolToastTimer.current) clearTimeout(toolToastTimer.current);
    toolToastTimer.current = setTimeout(() => setToolToast(null), 1200);
  };

  // ── Tools, menus, modes ────────────────────────────────────────────────────
  const closeMenus = () => { setOpenMenu(null); setAboutOpen(false); };
  const toggleMenu = (key: MenuKey) => setOpenMenu(prev => (prev === key ? null : key));

  const setTool = (tool: Tool) => {
    setIsAnnotationMode(true);
    setInkHidden(false);
    setCurrentTool(tool);
    closeMenus();
  };

  /** One code path for the lock button and the toolbar shortcut (fixes state drift). */
  const toggleMinimized = () => {
    const next = !isMinimized;
    setIsMinimized(next);
    if (settingsRef.current.ghostMode) return; // ghost mode: only the toolbar hides
    if (next) {
      previousAnnotationModeRef.current = isAnnotationMode;
      setIsAnnotationMode(false);
    } else {
      setIsAnnotationMode(previousAnnotationModeRef.current);
    }
  };

  const handleSetBoardMode = (mode: BoardMode) => {
    if (mode !== boardMode) {
      boardColorsRef.current[boardMode] = penColor;
      let nextColor = boardColorsRef.current[mode];
      if (!nextColor) {
        const c = penColor.toLowerCase();
        if (mode === 'blackboard' && (c === '#000000' || c === '#000')) nextColor = '#ffffff';
        else if (mode !== 'blackboard' && (c === '#ffffff' || c === '#fff')) nextColor = '#000000';
      }
      if (nextColor && nextColor !== penColor) updateSettings({ penColor: nextColor });
      setSelectedStroke(null);
    }
    setBoardMode(mode);
    if (mode !== 'screen') { setIsAnnotationMode(true); setInkHidden(false); }
    setOpenMenu(null);
  };

  const askConfirm = (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
    setConfirmState({ title, message, confirmLabel, onConfirm });
  };

  const requestClear = () => {
    const canvas = activeCanvasRef.current;
    if (!canvas || !canvas.hasStrokes()) return;
    if (settingsRef.current.confirmBeforeClearing) {
      askConfirm(L('Tümünü temizle', 'Clear all'), L('Bu tahtadaki tüm çizimler silinecek. Geri Al ile geri getirebilirsiniz.', 'All drawings on this board will be removed. You can bring them back with Undo.'), L('Temizle', 'Clear'), () => canvas.clear());
    } else {
      canvas.clear();
    }
  };

  const requestDeleteSelected = () => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const count = canvas.getSelectedStrokeIds().length;
    if (count === 0) return;
    if (count > 1 && settingsRef.current.confirmBeforeDeleting) {
      askConfirm(L('Seçilenleri sil', 'Delete selection'), L(`${count} öğe silinecek.`, `${count} items will be deleted.`), L('Sil', 'Delete'), () => canvas.deleteSelected());
    } else {
      canvas.deleteSelected();
    }
  };

  const openSettingsPanel = () => {
    const offsetW = toolbarRef.current?.offsetWidth || 0;
    const offsetH = toolbarRef.current?.offsetHeight || 0;
    const isLeft = position.x < window.innerWidth / 2;
    const isTop = position.y < window.innerHeight / 2;
    const newPos: React.CSSProperties = {};
    const padding = 12;
    if (settingsRef.current.toolbarOrientation === 'horizontal') {
      if (isLeft) newPos.left = position.x; else newPos.right = window.innerWidth - (position.x + offsetW);
      if (isTop) newPos.top = position.y + offsetH + padding; else newPos.bottom = window.innerHeight - position.y + padding;
    } else {
      if (isTop) newPos.top = position.y; else newPos.bottom = window.innerHeight - (position.y + offsetH);
      if (isLeft) newPos.left = position.x + offsetW + padding; else newPos.right = window.innerWidth - position.x + padding;
    }
    setSettingsPanelPos(newPos);
    closeMenus();
    setShowSettingsMenu(true);
  };

  const hideToolbarWindow = () => {
    closeMenus();
    if (api?.hideWindow) api.hideWindow();
    else window.close();
  };

  const quitApp = () => {
    flushSettings();
    if (api?.quitApp) api.quitApp();
    else window.close();
  };

  // Close menus when clicking outside of them. Menus are identified by data-menu,
  // not by translated button titles.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.epic-settings-panel')) setShowSettingsMenu(false);
      const inside = target.closest('[data-menu]')?.getAttribute('data-menu') as MenuKey | null;
      setOpenMenu(prev => (prev && prev !== inside ? null : prev));
      if (inside !== 'settings') setAboutOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Click-through regions: sent when the UI actually changes, not on a timer ─
  const anyOverlayOpen = !!openMenu || aboutOpen || showSettingsMenu || showPrivacyPolicy || showHelp || !!confirmState || !!cropTargetId;
  const shouldIgnore = !canDraw && !isCapturing && !previewCanvas && !anyOverlayOpen && !isDragging && !isMouseOverToolbar;
  const shouldIgnoreRef = useRef(shouldIgnore);
  shouldIgnoreRef.current = shouldIgnore;

  const sendFrameRef = useRef<number | null>(null);
  const sendInteractionState = useCallback(() => {
    if (!api?.updateInteractionState || sendFrameRef.current !== null) return;
    sendFrameRef.current = requestAnimationFrame(() => {
      sendFrameRef.current = null;
      const rects: { x: number, y: number, width: number, height: number }[] = [];
      document.querySelectorAll(INTERACTIVE_SELECTORS).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      });
      api.updateInteractionState({ shouldIgnoreBase: shouldIgnoreRef.current, clickableRects: rects });
    });
  }, [api]);

  useEffect(() => { sendInteractionState(); }, [shouldIgnore, position, settings.toolbarOrientation, sendInteractionState]);

  useEffect(() => {
    if (!api) return;
    // The brush preview moves on every mouse move; its style changes don't affect click regions
    const observer = new MutationObserver(mutations => {
      if (mutations.every(m => m.target === cursorPreviewRef.current)) return;
      sendInteractionState();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', sendInteractionState);
    return () => { observer.disconnect(); window.removeEventListener('resize', sendInteractionState); };
  }, [api, sendInteractionState]);

  // Contextual properties panel position (only on selection change, so it stays put during edits)
  useEffect(() => {
    if (selectedStroke && activeCanvasRef.current) {
      const bounds = activeCanvasRef.current.getBoundingBox(selectedStroke.id);
      if (bounds) {
        const panelSize = selectedStroke.type === 'text' ? { width: 260, height: 300 } : { width: 260, height: 340 };
        setContextualPanelPos(calculateContextualPanelPosition(bounds, panelSize, { width: window.innerWidth, height: window.innerHeight }, 'top'));
      }
    } else {
      setContextualPanelPos(null);
    }
  }, [selectedStroke?.id, isAnnotationMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Screenshot ─────────────────────────────────────────────────────────────
  const getCompositeOptions = () => ({
    penOpacity: settingsRef.current.penOpacity,
    highlighterOpacity: settingsRef.current.highlighterOpacity,
    penStabilizer: settingsRef.current.penStabilizer,
  });

  const showPreview = async (background: string, region: Region | null, include: boolean) => {
    const strokes = activeCanvasRef.current?.getStrokes() || [];
    const composed = await compositeScreenshot(background, region, include, strokes, getCompositeOptions());
    setPreviewCanvas(composed);
    const blob = await new Promise<Blob | null>(res => composed.toBlob(res, 'image/png'));
    if (blob) {
      setPreviewImageUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    }
  };

  const handleCaptureFinish = async (backgroundSrc: string, region: Region | null) => {
    try {
      setCaptureRegion(region);
      await showPreview(backgroundSrc, region, previewIncludeAnnotations);
    } catch (err) {
      console.error('Composition failed:', err);
      setFrozenImage(null);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCaptureStart = async (mode: 'full' | 'region') => {
    if (isCapturing || previewCanvas) return; // no concurrent captures
    setIsCapturing(true);
    closeMenus();
    try {
      let dataUrl: string | null = null;
      if (boardMode === 'whiteboard' || boardMode === 'blackboard') {
        // The board is drawn by us: paint its background and pattern instead of capturing the desktop
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
          paintBoard(ctx, boardMode, bgPattern, window.innerWidth, window.innerHeight);
        }
        dataUrl = canvas.toDataURL('image/png');
      } else if (api) {
        dataUrl = await api.captureScreen(); // main hides the overlay while capturing
      }
      if (!dataUrl) throw new Error('Failed to capture screen');
      setFrozenImage(dataUrl);
      if (mode === 'full') await handleCaptureFinish(dataUrl, null);
    } catch (err) {
      console.error('CAPTURE_ERROR', err);
      setIsCapturing(false);
      setFrozenImage(null);
    }
  };

  useEffect(() => {
    if (previewCanvas && frozenImage) {
      showPreview(frozenImage, captureRegion, previewIncludeAnnotations).catch(err => console.error('Preview update failed', err));
    }
  }, [previewIncludeAnnotations]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancelPreview = () => {
    if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
    setPreviewCanvas(null);
    setPreviewImageUrl(null);
    setFrozenImage(null);
    setCaptureRegion(null);
    setSaveStatus('idle');
  };

  const saveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSaveToast = (text: string, path?: string) => {
    setSaveToast({ text, path });
    if (saveToastTimer.current) clearTimeout(saveToastTimer.current);
    saveToastTimer.current = setTimeout(() => setSaveToast(null), 5000);
  };

  const handleSavePreview = async (format: 'png' | 'jpeg') => {
    if (!previewCanvas || saveStatus === 'saving') return;
    setSaveStatus('saving');
    try {
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      let source = previewCanvas;
      if (format === 'jpeg') {
        // JPEG has no alpha: flatten on white so transparent areas don't turn black
        source = document.createElement('canvas');
        source.width = previewCanvas.width;
        source.height = previewCanvas.height;
        const ctx = source.getContext('2d');
        if (ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, source.width, source.height); ctx.drawImage(previewCanvas, 0, 0); }
      }
      const blob = await new Promise<Blob | null>(res => source.toBlob(res, mimeType, format === 'jpeg' ? 0.92 : undefined));
      if (!blob) throw new Error('Failed to generate blob');
      const bytes = new Uint8Array(await blob.arrayBuffer());

      let savedPath: string | null = null;
      if (api) {
        savedPath = await api.saveImage(bytes, format);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `MaliPen.${format === 'jpeg' ? 'jpg' : 'png'}`;
        a.click();
        savedPath = a.download;
      }

      if (savedPath) {
        setSaveStatus('saved');
        showSaveToast(L('Kaydedildi', 'Saved'), api ? savedPath : undefined);
        setTimeout(handleCancelPreview, 600);
      } else {
        setSaveStatus('idle');
      }
    } catch (e) {
      console.error('Save failed', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleCopyPreview = async () => {
    if (!previewCanvas || saveStatus === 'saving') return;
    try {
      const blob = await new Promise<Blob | null>(res => previewCanvas.toBlob(res, 'image/png'));
      if (!blob) return;
      if (api) await api.copyToClipboard(new Uint8Array(await blob.arrayBuffer()));
      else await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setSaveStatus('saved');
      showSaveToast(L('Panoya kopyalandı', 'Copied to clipboard'));
      setTimeout(handleCancelPreview, 600);
    } catch (e) {
      console.error('Copy failed', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  // ── Insert image ───────────────────────────────────────────────────────────
  const insertImage = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 500;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxWidth) { h = h * (maxWidth / w); w = maxWidth; }
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      activeCanvasRef.current?.addStroke({
        id: newStrokeId(),
        type: 'image',
        points: [{ x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy + h / 2 }],
        color: '#000000',
        width: 2,
        imageUrl: dataUrl,
        isFilled: false,
        rotation: 0
      });
      setIsAnnotationMode(true);
      setCurrentTool('select');
      closeMenus();
    };
    img.src = dataUrl;
  };

  const handleImageBtnClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (api?.selectImage) {
      const dataUrl = await api.selectImage();
      if (dataUrl) insertImage(dataUrl);
    } else {
      imageInputRef.current?.click(); // plain browser fallback
    }
  };

  // ── Shortcut actions (shared by local keys, global shortcuts and the tray) ──
  const runAction = (action: ShortcutAction) => {
    const s = settingsRef.current;
    const canvas = activeCanvasRef.current;
    const shapeTool = SHAPE_SHORTCUT_TOOL[action as keyof Shortcuts];
    if (shapeTool) { setTool(shapeTool); notifyTool(shapeTool); return; }

    switch (action) {
      case 'settings':
      case 'open-settings':
        if (isMinimized) toggleMinimized();
        if (showSettingsMenu && action === 'settings') setShowSettingsMenu(false);
        else openSettingsPanel();
        return;
      case 'toggleToolbar': toggleMinimized(); return;
      case 'toggleInk': {
        const hide = !inkHidden;
        setInkHidden(hide);
        if (hide) setIsAnnotationMode(false);
        return;
      }
      case 'pen': case 'highlighter': case 'laser': case 'eraser': case 'select': case 'text':
        setTool(action); notifyTool(action); return;
      case 'shapes':
        setIsAnnotationMode(true);
        if (isMinimized) toggleMinimized();
        toggleMenu('shapes');
        return;
      case 'undo': canvas?.undo(); return;
      case 'redo': canvas?.redo(); return;
      case 'clear': requestClear(); return;
      case 'delete': requestDeleteSelected(); return;
      case 'increaseBrush': updateBrushSize(currentWidth + 2); return;
      case 'decreaseBrush': updateBrushSize(currentWidth - 2); return;
      case 'changeToLastColor': if (lastColorRef.current) setCurrentColor(lastColorRef.current); return;
      case 'screenshot': handleCaptureStart(s.captureFullDesktop ? 'full' : 'region'); return;
      case 'capture-region': handleCaptureStart('region'); return;
      case 'capture-full': handleCaptureStart('full'); return;
      case 'quickColor1': case 'quickColor2': case 'quickColor3': case 'quickColor4': {
        const idx = Number(action.slice(-1)) - 1;
        if (s.favoriteColors[idx]) setCurrentColor(s.favoriteColors[idx]);
        return;
      }
    }
  };
  const runActionRef = useRef(runAction);
  runActionRef.current = runAction;

  // Register system-wide shortcuts in the main process
  const registeredGlobalRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!api?.registerShortcuts) return;
    const map: Record<string, string> = {};
    // While a new combination is being recorded, nothing may be grabbed system-wide
    if (!isRecordingShortcut) for (const key of SHORTCUT_ORDER) {
      if (settings.disableShortcuts && !ALWAYS_ON.includes(key)) continue;
      const value = settings.shortcuts[key];
      if (value) map[key] = value;
    }
    let cancelled = false;
    api.registerShortcuts(map).then(result => {
      if (cancelled) return;
      registeredGlobalRef.current = new Set(result.registered);
      if (!isRecordingShortcut) setFailedShortcuts(result.failed);
    }).catch(err => console.error('Failed to register shortcuts', err));
    return () => { cancelled = true; };
  }, [api, settings.shortcuts, settings.disableShortcuts, isRecordingShortcut]);

  useEffect(() => {
    if (!api?.onShortcut) return;
    return api.onShortcut(action => runActionRef.current(action as ShortcutAction));
  }, [api]);

  // Local shortcuts (single keys, chords, and anything the OS refused to register)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showPrivacyPolicy || showHelp || confirmState || cropTargetId) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const s = settingsRef.current;
      for (const key of SHORTCUT_ORDER) {
        if (s.disableShortcuts && !ALWAYS_ON.includes(key)) continue;
        if (registeredGlobalRef.current.has(key)) continue; // handled by the global shortcut
        if (matchesShortcut(e, s.shortcuts[key])) {
          e.preventDefault();
          runActionRef.current(key);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrivacyPolicy, showHelp, confirmState, cropTargetId]);

  // Escape closes the top-most thing; key tracking for chord shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      activeKeys.add(getNormalizedKey(e));
      if (e.key !== 'Escape' || isRecordingShortcut || cropTargetId) return; // the crop editor handles its own Escape
      const somethingOpen = anyOverlayOpen || !!selectedStroke || isCapturing || !!previewCanvas;
      if (somethingOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeMenus();
        setShowSettingsMenu(false);
        setShowPrivacyPolicy(false);
        setShowHelp(false);
        if (selectedStroke) { setSelectedStroke(null); activeCanvasRef.current?.deselect(); }
        if (isCapturing) { setIsCapturing(false); setFrozenImage(null); }
        if (previewCanvas) handleCancelPreview();
        return;
      }
      if (isAnnotationMode) setIsAnnotationMode(false);
    };
    const handleGlobalKeyUp = (e: KeyboardEvent) => { activeKeys.delete(getNormalizedKey(e)); };
    const handleGlobalBlur = () => { activeKeys.clear(); };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    window.addEventListener('keyup', handleGlobalKeyUp, { capture: true });
    window.addEventListener('blur', handleGlobalBlur);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
      window.removeEventListener('keyup', handleGlobalKeyUp, { capture: true });
      window.removeEventListener('blur', handleGlobalBlur);
    };
  });

  // Mouse wheel adjusts the brush size
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!settings.mouseWheelAdjustsPenSize) return;
      const target = e.target as HTMLElement;
      if (target.closest('.toolbar, .shape-popover, .epic-settings-panel, .properties-panel, .color-popover')) return;
      if (!canDraw || currentTool === 'select' || currentTool === 'text') return;
      updateBrushSize(currentWidth + (e.deltaY > 0 ? -1 : 1));
    };
    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  });

  // Brush-size cursor preview follows the pointer
  const previewSize = visualStrokeWidth(currentTool, currentWidth);
  useEffect(() => {
    let frame: number | null = null;
    const updateCursor = (e: MouseEvent) => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (cursorPreviewRef.current) {
          cursorPreviewRef.current.style.transform = `translate(${e.clientX - previewSize / 2}px, ${e.clientY - previewSize / 2}px)`;
        }
      });
    };
    window.addEventListener('mousemove', updateCursor);
    return () => { window.removeEventListener('mousemove', updateCursor); if (frame !== null) cancelAnimationFrame(frame); };
  }, [previewSize]);

  // Auto-update notifications
  useEffect(() => {
    if (!api) return;
    const offAvailable = api.onUpdateAvailable?.(info => { setUpdateAvailable(info); setShowUpdateToast(true); });
    const offDownloaded = api.onUpdateDownloaded?.(info => { setUpdateDownloaded(info); setShowUpdateToast(true); });
    return () => { offAvailable?.(); offDownloaded?.(); };
  }, [api]);

  const canvasProps = {
    tool: currentTool,
    color: currentColor,
    fillColor,
    isFilled,
    fillOpacity,
    width: currentWidth,
    laserWidth: settings.laserSize,
    fontFamily: settings.textFontFamily,
    fontSize: settings.textFontSize,
    isBold: settings.textBold,
    isItalic: settings.textItalic,
    isUnderline: settings.textUnderline,
    alignment: settings.textAlignment,
    textBackground: settings.textBackground,
    eraserMode,
    onSelectedStrokeChange: setSelectedStroke,
    laserFadeDuration: settings.laserFadeDuration,
    laserMode: settings.laserMode || 'individual',
    penOpacity: settings.penOpacity ?? 1.0,
    highlighterOpacity: settings.highlighterOpacity ?? 0.35,
    penStabilizer: settings.penStabilizer || 'basic',
    autoShapeRecognition: settings.autoShapeRecognition !== false,
    selectMode,
    selectionColor: theme.accent,
  } as const;

  const shortcutHint = (key: keyof Shortcuts) => (settings.shortcuts[key] ? ` [${settings.shortcuts[key]}]` : '');

  return (
    <div className={`app-container ${isAnnotationMode ? 'annotation-mode' : 'cursor-mode'}`}>
      {showUpdateToast && (
        <div className="update-toast-container">
          <div className="update-toast">
            <div className="update-toast-header">
              {updateDownloaded ? L('Güncelleme Hazır!', 'Update Ready!') : L('Güncelleme Mevcut', 'Update Available')}
            </div>
            <div className="update-toast-body">
              {updateDownloaded
                ? L("MaliPen'in yeni sürümü indirildi ve kuruluma hazır.", 'A new version of MaliPen has been downloaded and is ready to install.')
                : L(`En son sürüm ${updateAvailable?.version ? `(${updateAvailable.version}) ` : ''}arka planda indiriliyor...`, `Downloading the latest version ${updateAvailable?.version ? `(${updateAvailable.version}) ` : ''}in the background...`)}
            </div>
            <div className="update-toast-actions">
              <button className="update-toast-btn" onClick={() => setShowUpdateToast(false)}>{L('Kapat', 'Dismiss')}</button>
              {updateDownloaded && (
                <button className="update-toast-btn primary" onClick={() => { flushSettings(); api?.installUpdate(); }}>
                  {L('Kur ve Yeniden Başlat', 'Install & Restart')}
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

        <button
          className="tool-btn toolbar-toggle-btn"
          onClick={toggleMinimized}
          title={isMinimized ? `${L('Çizimi Aç', 'Unlock Drawing')}${shortcutHint('toggleToolbar')}` : `${L('Çizimi Kilitle (Ekran Modu)', 'Lock Drawing (Screen Mode)')}${shortcutHint('toggleToolbar')}`}
          aria-label={isMinimized ? L('Çizimi Aç', 'Unlock Drawing') : L('Çizimi Kilitle', 'Lock Drawing')}
        >
          {isMinimized ? <Lock size={20} color="var(--mp-brand)" /> : <Unlock size={20} color="var(--mp-brand)" />}
        </button>

        {!isMinimized && (
          <div className="toolbar-content">
            <button
              className={`tool-btn ${!isAnnotationMode ? 'active pointer-mode' : ''}`}
              onClick={() => { setIsAnnotationMode(false); closeMenus(); }}
              title={L('İmleç Modu', 'Cursor Mode')}
              aria-label={L('İmleç Modu', 'Cursor Mode')}
            >
              <MousePointer2 size={20} />
            </button>

            {/* Selection */}
            <div className="shape-menu-container select-menu-container" data-menu="select">
              <button
                className={`tool-btn ${isAnnotationMode && currentTool === 'select' ? 'active pointer-mode' : ''}`}
                onClick={() => { if (currentTool === 'select' && isAnnotationMode) toggleMenu('select'); else setTool('select'); }}
                onDoubleClick={() => setOpenMenu('select')}
                title={`${L('Seçim Aracı', 'Selection Tool')} (${selectMode === 'rectangle' ? L('Kutu Seçim', 'Rectangle') : L('Serbest Seçim', 'Lasso')})${shortcutHint('select')}`}
                aria-label={L('Seçim Aracı', 'Selection Tool')}
              >
                {selectMode === 'lasso' ? <LassoSelect size={20} /> : <BoxSelect size={20} />}
              </button>
              {openMenu === 'select' && (
                <div className={`shape-popover select-popover ${popoverClass}`}>
                  <div className="draw-popover-header"><span>{L('Seçim Türü', 'Selection Type')}</span></div>
                  <div className="draw-popover-grid">
                    <button className={`draw-popover-item ${selectMode === 'rectangle' ? 'active' : ''}`} onClick={() => { setSelectMode('rectangle'); setTool('select'); }}>
                      <BoxSelect size={18} /><span>{L('Kutu Seçim', 'Rectangle Select')}</span>
                    </button>
                    <button className={`draw-popover-item ${selectMode === 'lasso' ? 'active' : ''}`} onClick={() => { setSelectMode('lasso'); setTool('select'); }}>
                      <LassoSelect size={18} /><span>{L('Serbest Seçim', 'Lasso Select')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="toolbar-divider" />

            {/* Draw tools */}
            <div className="shape-menu-container" data-menu="draw">
              <button
                className={`tool-btn ${['pen', 'highlighter', 'text'].includes(currentTool) && isAnnotationMode ? 'active' : ''}`}
                onClick={() => { if (['pen', 'highlighter', 'text'].includes(currentTool) && isAnnotationMode) toggleMenu('draw'); else setTool('pen'); }}
                onDoubleClick={() => { if (!['pen', 'highlighter', 'text'].includes(currentTool)) setTool('pen'); setOpenMenu('draw'); }}
                title={`${L('Çizim Araçları', 'Draw Tools')}${shortcutHint('pen')} (${L('Ayarlar için çift tıklayın', 'Double click for settings')})`}
                aria-label={L('Çizim Araçları', 'Draw Tools')}
              >
                {currentTool === 'highlighter' ? <Highlighter size={20} /> : currentTool === 'text' ? <Type size={20} /> : <Pen size={20} />}
              </button>
              {openMenu === 'draw' && (
                <div className={`shape-popover draw-tools-popover draw-popover ${popoverClass}`}>
                  <div className="shape-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '4px' }}>
                    <button className={`tool-btn ${currentTool === 'pen' ? 'active' : ''}`} onClick={() => { setIsAnnotationMode(true); setCurrentTool('pen'); }} title={`${L('Kalem', 'Pen')}${shortcutHint('pen')}`}><Pen size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'highlighter' ? 'active' : ''}`} onClick={() => { setIsAnnotationMode(true); setCurrentTool('highlighter'); }} title={`${L('Vurgulayıcı', 'Highlighter')}${shortcutHint('highlighter')}`}><Highlighter size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'text' ? 'active' : ''}`} onClick={() => { setIsAnnotationMode(true); setCurrentTool('text'); }} title={`${L('Metin', 'Text')}${shortcutHint('text')}`}><Type size={18} /></button>
                  </div>

                  {currentTool === 'pen' && (
                    <>
                      <div className="draw-tools-section">
                        <div className="draw-tools-section-title"><span>{L('Sabitleyici (Yumuşatma)', 'Stabilizer')}</span></div>
                        <div className="stabilizer-grid">
                          {([
                            { id: 'off', label: L('Kapalı', 'Off') },
                            { id: 'basic', label: L('Temel', 'Basic') },
                            { id: 'soft', label: L('Yumuşak', 'Soft') },
                            { id: 'silky', label: L('İpeksi', 'Silky') },
                            { id: 'fluid', label: L('Akıcı', 'Fluid') },
                          ] as const).map(item => (
                            <button key={item.id} className={`stabilizer-btn ${(settings.penStabilizer || 'basic') === item.id ? 'active' : ''}`} onClick={() => updateSettings({ penStabilizer: item.id })}>
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="draw-tools-section">
                        <div className="draw-tools-section-title">
                          <span>{L('Kalem Opaklığı', 'Opacity')}</span>
                          <span>{Math.round((settings.penOpacity ?? 1.0) * 100)}%</span>
                        </div>
                        <input type="range" min="0.1" max="1.0" step="0.01" value={settings.penOpacity ?? 1.0}
                          onChange={(e) => updateSettings({ penOpacity: parseFloat(e.target.value) })} className="brush-size-slider" />
                      </div>
                    </>
                  )}

                  {currentTool === 'highlighter' && (
                    <div className="draw-tools-section">
                      <div className="draw-tools-section-title">
                        <span>{L('Vurgulayıcı Opaklığı', 'Highlighter Opacity')}</span>
                        <span>{Math.round((settings.highlighterOpacity ?? 0.35) * 100)}%</span>
                      </div>
                      <input type="range" min="0.05" max="1.0" step="0.01" value={settings.highlighterOpacity ?? 0.35}
                        onChange={(e) => updateSettings({ highlighterOpacity: parseFloat(e.target.value) })} className="brush-size-slider" />
                    </div>
                  )}

                  {currentTool === 'text' && (
                    <div className="draw-tools-section">
                      <div className="draw-tools-section-title"><span>{L('Yeni metin', 'New text')}</span><span>{settings.textFontSize}px</span></div>
                      <select className="epic-select" value={settings.textFontFamily} onChange={(e) => updateSettings({ textFontFamily: e.target.value })} style={{ width: '100%', marginBottom: 6 }}>
                        {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <input type="range" min="10" max="140" step="1" value={settings.textFontSize}
                        onChange={(e) => updateSettings({ textFontSize: parseInt(e.target.value, 10) })} className="brush-size-slider" />
                      <div className="format-buttons" style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        <button className={`tool-btn ${settings.textBold ? 'active' : ''}`} onClick={() => updateSettings({ textBold: !settings.textBold })} title={L('Kalın', 'Bold')}><Bold size={14} /></button>
                        <button className={`tool-btn ${settings.textItalic ? 'active' : ''}`} onClick={() => updateSettings({ textItalic: !settings.textItalic })} title={L('İtalik', 'Italic')}><Italic size={14} /></button>
                        <button className={`tool-btn ${settings.textUnderline ? 'active' : ''}`} onClick={() => updateSettings({ textUnderline: !settings.textUnderline })} title={L('Altı çizili', 'Underline')}><Underline size={14} /></button>
                        <button className={`tool-btn ${settings.textAlignment === 'left' ? 'active' : ''}`} onClick={() => updateSettings({ textAlignment: 'left' })} title={L('Sola hizala', 'Align left')}><AlignLeft size={14} /></button>
                        <button className={`tool-btn ${settings.textAlignment === 'center' ? 'active' : ''}`} onClick={() => updateSettings({ textAlignment: 'center' })} title={L('Ortala', 'Center')}><AlignCenter size={14} /></button>
                        <button className={`tool-btn ${settings.textAlignment === 'right' ? 'active' : ''}`} onClick={() => updateSettings({ textAlignment: 'right' })} title={L('Sağa hizala', 'Align right')}><AlignRight size={14} /></button>
                      </div>
                      <label className="fill-toggle" style={{ marginTop: 6 }}>
                        <input type="checkbox" checked={settings.textBackground} onChange={(e) => updateSettings({ textBackground: e.target.checked })} />
                        {settings.textBackground ? <CheckSquare size={16} /> : <SquareOutline size={16} />}
                        <span>{L('Arka plan', 'Background')}</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Eraser */}
            <div className="shape-menu-container" data-menu="eraser">
              <button
                className={`tool-btn ${currentTool === 'eraser' && isAnnotationMode ? 'active' : ''}`}
                onClick={() => { if (currentTool === 'eraser' && isAnnotationMode) toggleMenu('eraser'); else setTool('eraser'); }}
                onDoubleClick={() => { setTool('eraser'); setOpenMenu('eraser'); }}
                title={`${L('Silgi', 'Eraser')}${shortcutHint('eraser')} (${L('Mod için çift tıklayın', 'Double click for mode')})`}
                aria-label={L('Silgi', 'Eraser')}
              >
                <Eraser size={20} />
              </button>
              {openMenu === 'eraser' && (
                <div className={`shape-popover eraser-popover eraser-menu ${popoverClass}`} style={{ padding: '8px', width: '130px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--mp-text-muted)', marginBottom: '8px', textAlign: 'center' }}>{L('Silgi Modu', 'Eraser Mode')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button className={`tool-btn ${eraserMode === 'object' ? 'active' : ''}`} style={{ padding: '6px', fontSize: '12px', width: '100%', justifyContent: 'flex-start' }} onClick={() => { setEraserMode('object'); setOpenMenu(null); }}>
                      {L('Nesne Silgisi', 'Object Eraser')}
                    </button>
                    <button className={`tool-btn ${eraserMode === 'pixel' ? 'active' : ''}`} style={{ padding: '6px', fontSize: '12px', width: '100%', justifyContent: 'flex-start' }} onClick={() => { setEraserMode('pixel'); setOpenMenu(null); }}>
                      {L('Piksel Silgisi', 'Pixel Eraser')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Shapes */}
            <div className="shape-menu-container" data-menu="shapes">
              <button className={`tool-btn ${isShapeTool && isAnnotationMode ? 'active' : ''}`} onClick={() => toggleMenu('shapes')} title={`${L('Şekiller', 'Shapes')}${shortcutHint('shapes')}`} aria-label={L('Şekiller', 'Shapes')}>
                <Shapes size={20} />
              </button>
              {openMenu === 'shapes' && (
                <div className={`shape-popover shapes-popover ${popoverClass}`}>
                  <div className="shape-grid">
                    <button className={`tool-btn ${currentTool === 'line' ? 'active' : ''}`} onClick={() => setTool('line')} title={L('Çizgi', 'Line')}><Minus size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'arrow' ? 'active' : ''}`} onClick={() => setTool('arrow')} title={L('Ok', 'Arrow')}><ArrowRight size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'double-arrow' ? 'active' : ''}`} onClick={() => setTool('double-arrow')} title={L('Çift Ok', 'Double Arrow')}><ArrowLeftRight size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'rectangle' ? 'active' : ''}`} onClick={() => setTool('rectangle')} title={L('Dikdörtgen', 'Rectangle')}><RectangleHorizontal size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'square' ? 'active' : ''}`} onClick={() => setTool('square')} title={L('Kare', 'Square')}><Square size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'ellipse' ? 'active' : ''}`} onClick={() => setTool('ellipse')} title={L('Elips', 'Ellipse')}><Circle size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'polygon' ? 'active' : ''}`} onClick={() => setTool('polygon')} title={L('Üçgen', 'Triangle')}><Triangle size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'free-polygon' ? 'active' : ''}`} onClick={() => setTool('free-polygon')} title={L('Serbest Çokgen', 'Free Polygon')}><Hexagon size={18} /></button>
                    <button className={`tool-btn ${currentTool === 'free-ellipse' ? 'active' : ''}`} onClick={() => setTool('free-ellipse')} title={L('Serbest Elips', 'Free Ellipse')}><Spline size={18} /></button>
                  </div>
                  <div className="fill-controls">
                    <div className="fill-header-row">
                      <label className="fill-toggle" title={L('Dolguyu Aç/Kapat', 'Toggle Fill')}>
                        <input type="checkbox" checked={isFilled} onChange={(e) => setIsFilled(e.target.checked)} />
                        {isFilled ? <CheckSquare size={16} /> : <SquareOutline size={16} />}
                        <span>{L('Dolgu', 'Fill')}</span>
                      </label>
                      {isFilled && (
                        <div className="fill-color-picker-wrapper">
                          <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="color-picker fill-picker" title={L('Dolgu Rengi', 'Fill Color')} />
                        </div>
                      )}
                    </div>
                    {isFilled && (
                      <div className="fill-opacity-container">
                        <div className="fill-opacity-header">
                          <span>{L('Şeffaflık', 'Opacity')}</span>
                          <span>{Math.round(fillOpacity * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={fillOpacity} onChange={(e) => setFillOpacity(parseFloat(e.target.value))} className="brush-size-slider" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Laser */}
            <div className="shape-menu-container" data-menu="laser">
              <button
                className={`tool-btn ${currentTool === 'laser' && isAnnotationMode ? 'active' : ''}`}
                onClick={() => { if (currentTool === 'laser' && isAnnotationMode) toggleMenu('laser'); else setTool('laser'); }}
                onDoubleClick={() => { setTool('laser'); setOpenMenu('laser'); }}
                title={`${L('Lazer İşaretçi', 'Laser Pointer')}${shortcutHint('laser')} (${L('Mod için çift tıklayın', 'Double click for mode')})`}
                aria-label={L('Lazer İşaretçi', 'Laser Pointer')}
              >
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--mp-brand)', boxShadow: '0 0 6px var(--mp-brand)' }} />
              </button>
              {openMenu === 'laser' && (
                <div className={`shape-popover laser-popover laser-menu ${popoverClass}`} style={{ padding: '10px', width: '150px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--mp-text-muted)', marginBottom: '8px', textAlign: 'center', fontWeight: 600 }}>{L('Lazer Modu', 'Laser Mode')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                    <button className={`tool-btn ${(settings.laserMode || 'individual') === 'individual' ? 'active' : ''}`} style={{ padding: '6px 8px', fontSize: '11px', width: '100%', justifyContent: 'flex-start', height: 'auto' }} onClick={() => updateSettings({ laserMode: 'individual' })}>
                      {L('Kaybolan (Bireysel)', 'Individual Fade')}
                    </button>
                    <button className={`tool-btn ${settings.laserMode === 'group' ? 'active' : ''}`} style={{ padding: '6px 8px', fontSize: '11px', width: '100%', justifyContent: 'flex-start', height: 'auto' }} onClick={() => updateSettings({ laserMode: 'group' })}>
                      {L('Bekleyen (Grup)', 'Group / Idle Fade')}
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--mp-text-muted)', marginBottom: '6px', textAlign: 'center', borderTop: '1px solid rgba(var(--mp-fg-rgb), 0.1)', paddingTop: '8px' }}>
                    {L('Lazer Süresi', 'Duration')}: {(settings.laserFadeDuration / 1000).toFixed(1)}s
                  </div>
                  <input type="range" min="500" max="5000" step="100" value={settings.laserFadeDuration} onChange={(e) => updateSettings({ laserFadeDuration: parseInt(e.target.value, 10) })} style={{ width: '100%', cursor: 'pointer' }} />
                </div>
              )}
            </div>

            {/* Capture */}
            <div className="shape-menu-container" data-menu="capture">
              <button className="tool-btn" onClick={() => toggleMenu('capture')} title={`${L('Ekran Görüntüsü', 'Screenshot')}${shortcutHint('screenshot')}`} aria-label={L('Ekran Görüntüsü', 'Screenshot')}>
                <Camera size={20} />
              </button>
              {openMenu === 'capture' && (
                <div className={`shape-popover capture-menu-popover ${popoverClass}`}>
                  <div className="shape-grid">
                    <button className="tool-btn" onClick={() => handleCaptureStart('region')} title={L('Bölge Seç', 'Region')}><Scissors size={18} /></button>
                    <button className="tool-btn" onClick={() => handleCaptureStart('full')} title={L('Tam Ekran', 'Full Screen')}><Fullscreen size={18} /></button>
                    <button className="tool-btn" onClick={handleImageBtnClick} title={L('Görsel Ekle', 'Insert Image')}><ImageIcon size={18} /></button>
                  </div>
                </div>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => { if (typeof reader.result === 'string') insertImage(reader.result); };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Board mode */}
            <div className="shape-menu-container" data-menu="board">
              <button className={`tool-btn ${openMenu === 'board' ? 'active' : ''}`} onClick={() => toggleMenu('board')} title={L('Tahta Modu', 'Board Mode')} aria-label={L('Tahta Modu', 'Board Mode')}>
                <Presentation size={20} />
              </button>
              {openMenu === 'board' && (
                <div className={`shape-popover board-mode-popover ${popoverClass}`} style={{ width: '150px' }}>
                  <button className={`board-mode-btn ${boardMode === 'screen' ? 'active' : ''}`} onClick={() => handleSetBoardMode('screen')}><Monitor size={16} /> {L('Ekran', 'Screen')}</button>
                  <button className={`board-mode-btn ${boardMode === 'whiteboard' ? 'active' : ''}`} onClick={() => handleSetBoardMode('whiteboard')}><SquareOutline size={16} /> {L('Beyaz Tahta', 'Whiteboard')}</button>
                  <button className={`board-mode-btn ${boardMode === 'blackboard' ? 'active' : ''}`} onClick={() => handleSetBoardMode('blackboard')}><Square size={16} /> {L('Siyah Tahta', 'Blackboard')}</button>
                </div>
              )}
            </div>

            {/* Background pattern (boards only) */}
            {boardMode !== 'screen' && (
              <div className="shape-menu-container" data-menu="bgPattern">
                <button className={`tool-btn ${openMenu === 'bgPattern' ? 'active' : ''}`} onClick={() => toggleMenu('bgPattern')} title={L('Arkaplan Deseni', 'Background Pattern')} aria-label={L('Arkaplan Deseni', 'Background Pattern')}>
                  <LayoutGrid size={20} />
                </button>
                {openMenu === 'bgPattern' && (
                  <div className={`shape-popover bg-pattern-popover ${popoverClass}`} style={{ width: '200px', padding: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--mp-text-muted)', marginBottom: '8px', textAlign: 'center' }}>{L('Arkaplan Deseni', 'Background Pattern')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                      {(['none', 'lines', 'grid', 'dots'] as const).map(pt => (
                        <button key={pt} className={`board-mode-btn ${bgPattern.type === pt ? 'active' : ''}`} style={{ fontSize: '11px', justifyContent: 'center' }} onClick={() => setBgPattern(p => ({ ...p, type: pt }))}>
                          {pt === 'none' ? L('Yok', 'None') : pt === 'lines' ? L('Çizgili', 'Lines') : pt === 'grid' ? L('Kareli', 'Grid') : L('Noktalı', 'Dots')}
                        </button>
                      ))}
                    </div>
                    {bgPattern.type !== 'none' && (
                      <>
                        <div style={{ fontSize: '11px', color: 'var(--mp-text-muted)', marginBottom: '4px' }}>{L('Aralık', 'Spacing')}: {bgPattern.spacing}mm</div>
                        <input type="range" min={3} max={30} step={0.5} value={bgPattern.spacing} onChange={e => setBgPattern(p => ({ ...p, spacing: Number(e.target.value) }))} style={{ width: '100%', marginBottom: '10px' }} />
                        <div style={{ fontSize: '11px', color: 'var(--mp-text-muted)', marginBottom: '4px' }}>{L('Opaklık', 'Opacity')}: {Math.round(bgPattern.opacity * 100)}%</div>
                        <input type="range" min={5} max={60} step={1} value={Math.round(bgPattern.opacity * 100)} onChange={e => setBgPattern(p => ({ ...p, opacity: Number(e.target.value) / 100 }))} style={{ width: '100%' }} />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="toolbar-divider" />

            <button className="tool-btn" title={`${L('Geri Al', 'Undo')}${shortcutHint('undo')}`} aria-label={L('Geri Al', 'Undo')} onClick={() => activeCanvasRef.current?.undo()}><Undo size={20} /></button>
            <button className="tool-btn" title={`${L('İleri Al', 'Redo')}${shortcutHint('redo')}`} aria-label={L('İleri Al', 'Redo')} onClick={() => activeCanvasRef.current?.redo()}><Redo size={20} /></button>
            <button
              className="tool-btn danger"
              title={currentTool === 'select' ? L('Seçilileri Sil / Temizle', 'Delete Selected / Clear All') : `${L('Tümünü Temizle', 'Clear All')}${shortcutHint('clear')}`}
              aria-label={L('Temizle', 'Clear')}
              onClick={() => {
                if (currentTool === 'select' && activeCanvasRef.current?.getSelectedStrokeIds().length) requestDeleteSelected();
                else requestClear();
              }}
            ><Trash2 size={20} /></button>

            <div className="toolbar-divider" />

            {/* Colour */}
            <div className="shape-menu-container" data-menu="color">
              <button className="tool-btn" title={L('Renk', 'Color')} aria-label={L('Renk', 'Color')} onClick={() => toggleMenu('color')}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: currentColor, border: '1px solid rgba(var(--mp-fg-rgb), 0.2)' }} />
              </button>
              {openMenu === 'color' && (
                <div className={`color-popover ${popoverClass}`}>
                  <div className="color-popover-header">
                    <span>{L('Renk Seçici', 'Color Picker')}</span>
                    <button className="close-btn" onClick={() => setOpenMenu(null)}>×</button>
                  </div>
                  <div className="current-color-row">
                    <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} className="color-picker stroke-picker" />
                    <span style={{ fontSize: 13, color: 'var(--mp-text)' }}>{currentColor.toUpperCase()}</span>
                  </div>
                  <div className="color-popover-header" style={{ marginTop: 8 }}>
                    <span>{L('Favori Renkler', 'Favorite Colors')}</span>
                    <span style={{ fontSize: '11px', color: 'var(--mp-text-subtle)' }}>{favoriteColorsList.length}/12</span>
                  </div>
                  <div className="favorites-grid">
                    {favoriteColorsList.map((col, i) => (
                      <div key={`${col}-${i}`} className="favorite-swatch-wrapper" title={L(`${col} (Seçmek için tıkla, kaldırmak için × bas)`, `${col} (Click to select, click × to remove)`)}>
                        <div
                          className={`favorite-swatch ${currentColor.toLowerCase() === col.toLowerCase() ? 'active' : ''}`}
                          style={{ backgroundColor: col }}
                          onClick={() => setCurrentColor(col)}
                          onContextMenu={(e) => { e.preventDefault(); updateSettings({ favoriteColors: favoriteColorsList.filter((_, idx) => idx !== i) }); }}
                        />
                        <button className="favorite-remove-btn" title={L('Favorilerden kaldır', 'Remove from favorites')} onClick={(e) => { e.stopPropagation(); updateSettings({ favoriteColors: favoriteColorsList.filter((_, idx) => idx !== i) }); }}>×</button>
                      </div>
                    ))}
                  </div>
                  {favoriteColorsList.length < 12 && (
                    <div className="add-favorite-btn" onClick={() => { if (!favoriteColorsList.includes(currentColor)) updateSettings({ favoriteColors: [...favoriteColorsList, currentColor] }); }}>
                      {L('+ Mevcut Rengi Ekle', '+ Add Current Color')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="toolbar-divider" />

            {/* Brush size */}
            <div className="shape-menu-container" data-menu="brush">
              <button className="tool-btn" title={L('Fırça Boyutu', 'Brush Size')} aria-label={L('Fırça Boyutu', 'Brush Size')} onClick={() => toggleMenu('brush')}>
                <div style={{ width: Math.min(24, Math.max(4, currentWidth)), height: Math.min(24, Math.max(4, currentWidth)), borderRadius: '50%', backgroundColor: 'var(--mp-text)' }} />
              </button>
              {openMenu === 'brush' && (
                <div className={`color-popover brush-size-popover ${popoverClass}`} style={{ width: '200px' }}>
                  <div className="brush-size-header">
                    <span>{currentTool === 'laser' ? L('Lazer boyutu', 'Laser size') : L('Boyut', 'Size')}</span>
                    <span>{currentWidth}px</span>
                  </div>
                  <input type="range" className="brush-size-slider" min="0" max="100" step="0.2" value={brushSizeToSlider(currentWidth)} onChange={(e) => updateBrushSize(sliderToBrushSize(parseFloat(e.target.value)))} />
                </div>
              )}
            </div>

            <div className="toolbar-divider" />

            {/* MaliPen menu */}
            <div className="shape-menu-container" data-menu="settings">
              <button className={`tool-btn ${openMenu === 'settings' || aboutOpen ? 'active' : ''}`} title={`${L('Ayarlar', 'Settings')}${shortcutHint('settings')}`} aria-label={L('Menü', 'Menu')} onClick={() => { setAboutOpen(false); toggleMenu('settings'); }}>
                <SettingsIcon size={20} />
              </button>
              {openMenu === 'settings' && !aboutOpen && (
                <div className={`shape-popover settings-popover ${popoverClass}`} style={{ width: '200px', top: 'auto', bottom: '-8px' }}>
                  <div style={{ padding: '4px', borderBottom: '1px solid rgba(var(--mp-fg-rgb), 0.1)', color: 'var(--mp-text)', fontSize: '12px', fontWeight: 'bold', paddingLeft: '8px' }}>{L('MaliPen Menü', 'MaliPen Menu')}</div>
                  <button className="board-mode-btn" onClick={() => { setOpenMenu('settings'); setAboutOpen(true); }}>{L('Hakkında', 'About')}</button>
                  <button className="board-mode-btn" onClick={() => { closeMenus(); setShowHelp(true); }}>{L('Yardım', 'Help')}</button>
                  <button className="board-mode-btn" onClick={openSettingsPanel}>{L('Ayarlar', 'Settings')}</button>
                  <div style={{ margin: '4px 0', borderBottom: '1px solid rgba(var(--mp-fg-rgb), 0.1)' }} />
                  <button className="board-mode-btn" onClick={hideToolbarWindow} title={L('MaliPen tepside / menü çubuğunda çalışmaya devam eder', 'MaliPen keeps running in the tray / menu bar')}>{L('Araç çubuğunu gizle', 'Hide toolbar')}</button>
                  <button className="board-mode-btn" onClick={quitApp}>{L("MaliPen'den çık", 'Quit MaliPen')}</button>
                </div>
              )}

              {aboutOpen && (
                <div className={`shape-popover about-popover ${popoverClass}`} style={{ width: '250px', padding: '0', overflow: 'hidden', top: 'auto', bottom: '-8px' }}>
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--mp-text-secondary)', position: 'relative' }}>
                    <button onClick={() => { setAboutOpen(false); setOpenMenu(null); }} aria-label={L('Kapat', 'Close')} style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: 'var(--mp-text-muted)', cursor: 'pointer', fontSize: '18px' }}>×</button>
                    <h2 style={{ fontSize: '42px', fontWeight: 'bold', margin: 0, fontFamily: 'cursive', letterSpacing: '-1px', color: 'var(--mp-text)' }}>MaliPen</h2>
                    <div style={{ fontSize: '14px', color: 'var(--mp-text-muted)', marginBottom: '24px', fontWeight: 300 }}>professional</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>©2026 Mali Yıldırım</div>
                    <div style={{ fontSize: '12px', color: 'var(--mp-text-muted)' }}>{L('Versiyon', 'Version')} {__APP_VERSION__}</div>
                    <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--mp-accent)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowPrivacyPolicy(true)}>
                      {L('Gizlilik Politikasını Görüntüle', 'View Privacy Policy')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', height: '48px', borderTop: '1px solid rgba(var(--mp-fg-rgb), 0.1)' }}>
                    <div style={{ flex: 1, backgroundColor: 'rgba(var(--mp-fg-rgb), 0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--mp-text-secondary)', cursor: 'pointer' }} onClick={() => window.open('https://maliyildirimtr.com')}><Globe size={20} /></div>
                    <div style={{ flex: 1, backgroundColor: 'rgba(225, 48, 108, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#f25b90', cursor: 'pointer', borderLeft: '1px solid rgba(var(--mp-fg-rgb), 0.05)' }} onClick={() => window.open('https://www.instagram.com/mali_academy')}><Instagram size={20} /></div>
                    <div style={{ flex: 1, backgroundColor: 'rgba(51, 51, 51, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--mp-text)', cursor: 'pointer', borderLeft: '1px solid rgba(var(--mp-fg-rgb), 0.05)' }} onClick={() => window.open('https://github.com/maliyildirimtr/')}><Github size={20} /></div>
                    <div
                      className="about-link about-link-malipen"
                      role="link"
                      title="pen.maliyildirimtr.com"
                      aria-label={L('MaliPen web sitesi', 'MaliPen website')}
                      onClick={() => window.open('https://pen.maliyildirimtr.com/')}
                    >
                      {/* Transparent line mark used as a mask, so it takes the theme's text colour */}
                      <span className="malipen-mark" aria-hidden="true" style={{ WebkitMaskImage: `url(${malipenMarkUrl})`, maskImage: `url(${malipenMarkUrl})` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SCREEN CANVAS */}
      <div className="canvas-wrapper" style={{ display: boardMode === 'screen' ? 'block' : 'none', zIndex: 10, visibility: inkVisible ? 'visible' : 'hidden' }}>
        <DrawingCanvas ref={screenCanvasRef} isAnnotationMode={canDraw && boardMode === 'screen'} isActive={boardMode === 'screen'} {...canvasProps} />
      </div>

      {/* WHITEBOARD CANVAS */}
      <div className="canvas-wrapper" style={{ display: boardMode === 'whiteboard' ? 'block' : 'none', backgroundColor: BOARD_BACKGROUND.whiteboard, zIndex: 20, visibility: inkVisible ? 'visible' : 'hidden', position: 'relative' }}>
        <BoardPatternOverlay pattern={bgPattern} boardMode="whiteboard" />
        <DrawingCanvas ref={whiteboardCanvasRef} isAnnotationMode={canDraw && boardMode === 'whiteboard'} isActive={boardMode === 'whiteboard'} {...canvasProps} />
      </div>

      {/* BLACKBOARD CANVAS */}
      <div className="canvas-wrapper" style={{ display: boardMode === 'blackboard' ? 'block' : 'none', backgroundColor: BOARD_BACKGROUND.blackboard, zIndex: 20, visibility: inkVisible ? 'visible' : 'hidden', position: 'relative' }}>
        <BoardPatternOverlay pattern={bgPattern} boardMode="blackboard" />
        <DrawingCanvas ref={blackboardCanvasRef} isAnnotationMode={canDraw && boardMode === 'blackboard'} isActive={boardMode === 'blackboard'} {...canvasProps} />
      </div>

      {selectedStroke && contextualPanelPos && inkVisible && !cropTargetId && (
        <PropertiesPanel
          stroke={selectedStroke}
          position={contextualPanelPos}
          language={settings.language}
          onCrop={() => setCropTargetId(selectedStroke.id)}
          onChange={(updates, commit) => { activeCanvasRef.current?.updateStroke(selectedStroke.id, updates, commit); }}
          onClose={() => { setSelectedStroke(null); activeCanvasRef.current?.deselect(); }}
        />
      )}

      {showSettingsMenu && (
        <SettingsPanel
          settings={settings}
          failedShortcuts={failedShortcuts}
          onRecordingChange={setIsRecordingShortcut}
          position={settingsPanelPos || { top: 50, left: 50 }}
          onUpdate={(newSettings) => {
            if (settings.toolbarOrientation !== newSettings.toolbarOrientation) {
              if (newSettings.toolbarOrientation === 'horizontal') {
                setPosition({ x: Math.max(0, (window.innerWidth - (toolbarRef.current?.offsetWidth || 400)) / 2), y: 20 });
              } else {
                setPosition({ x: Math.max(0, window.innerWidth - 120), y: Math.max(20, (window.innerHeight - (toolbarRef.current?.offsetHeight || 600)) / 2) });
              }
            }
            updateSettings(newSettings);
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
          onCancel={() => { setIsCapturing(false); setFrozenImage(null); }}
        />
      )}

      {previewCanvas && (
        <div className="preview-modal-overlay">
          <div className="preview-modal">
            <h2>{L('Ekran Görüntüsü Önizleme', 'Screenshot Preview')}</h2>
            {previewImageUrl && <img src={previewImageUrl} alt="Capture Preview" className="preview-img" />}
            <div className="preview-controls">
              <label className="fill-toggle">
                <input type="checkbox" checked={previewIncludeAnnotations} onChange={(e) => setPreviewIncludeAnnotations(e.target.checked)} />
                {previewIncludeAnnotations ? <CheckSquare size={16} /> : <SquareOutline size={16} />}
                <span>{L('Çizimleri Dahil Et', 'Include Annotations')}</span>
              </label>
            </div>
            {saveStatus === 'error' && <div style={{ color: 'var(--mp-danger)', fontSize: 13 }}>{L('Kaydedilemedi. Ayarlardan kayıt klasörünü kontrol edin.', 'Could not save. Check the save folder in Settings.')}</div>}
            <div className="preview-actions">
              <button className="btn-secondary" onClick={handleCancelPreview}>{L('İptal', 'Cancel')}</button>
              <button className="btn-secondary" onClick={handleCopyPreview}>{L('Kopyala', 'Copy')}</button>
              <button className="btn-primary" onClick={() => handleSavePreview('png')} disabled={saveStatus === 'saving' || saveStatus === 'saved'}>
                {saveStatus === 'saving' ? L('Kaydediliyor...', 'Saving...') : saveStatus === 'saved' ? L('Kaydedildi', 'Saved') : L('PNG Kaydet', 'Save PNG')}
              </button>
              <button className="btn-primary" onClick={() => handleSavePreview('jpeg')} disabled={saveStatus === 'saving' || saveStatus === 'saved'}>
                {saveStatus === 'saving' ? L('Kaydediliyor...', 'Saving...') : saveStatus === 'saved' ? L('Kaydedildi', 'Saved') : L('JPEG Kaydet', 'Save JPEG')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tool change notification */}
      {toolToast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 48, transform: 'translateX(-50%)', zIndex: 100002, pointerEvents: 'none', background: 'rgba(var(--mp-surface-rgb), 0.9)', color: 'var(--mp-text)', padding: '8px 16px', borderRadius: 999, fontSize: 13, boxShadow: '0 6px 20px rgba(var(--mp-shadow-rgb), 0.35)' }}>
          {toolToast}
        </div>
      )}

      {/* Save / copy result */}
      {saveToast && (
        <div className="save-toast" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 100002, background: 'rgba(var(--mp-surface-rgb), 0.95)', color: 'var(--mp-text)', padding: '10px 14px', borderRadius: 10, fontSize: 13, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 10px 30px rgba(var(--mp-shadow-rgb), 0.4)' }}>
          <span>{saveToast.text}</span>
          {saveToast.path && api?.showItemInFolder && (
            <button className="update-toast-btn" onClick={() => { api.showItemInFolder(saveToast.path as string); setSaveToast(null); }}>
              {L('Klasörde göster', 'Show in folder')}
            </button>
          )}
        </div>
      )}

      {/* Brush size preview cursor (same size as the real stroke) */}
      {settings.showCursorPreview && canDraw && !['select', 'text'].includes(currentTool) && (
        <div
          ref={cursorPreviewRef}
          style={{
            position: 'fixed', top: 0, left: 0,
            width: `${previewSize}px`, height: `${previewSize}px`,
            borderRadius: '50%',
            border: '1px solid rgba(var(--mp-shadow-rgb), 0.5)',
            backgroundColor: currentTool === 'eraser' ? 'rgba(255,255,255,0.8)' : currentColor,
            opacity: 0.5,
            pointerEvents: 'none',
            zIndex: 99999,
            willChange: 'transform'
          }}
        />
      )}

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={L('Vazgeç', 'Cancel')}
          onConfirm={() => { const fn = confirmState.onConfirm; setConfirmState(null); fn(); }}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {(() => {
        const target = cropTargetId ? activeCanvasRef.current?.getStrokes().find(s => s.id === cropTargetId) : undefined;
        if (!target || !target.imageUrl) return null;
        return (
          <ImageCropModal
            imageUrl={target.imageUrl}
            initialCrop={target.crop}
            language={settings.language}
            onCancel={() => setCropTargetId(null)}
            onApply={(crop: CropRect) => {
              // Re-read the stroke: it may have moved since the editor opened
              const latest = activeCanvasRef.current?.getStrokes().find(s => s.id === target.id) || target;
              activeCanvasRef.current?.updateStroke(target.id, applyCropToStroke(latest, crop), true);
              setCropTargetId(null);
            }}
          />
        );
      })()}

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} language={settings.language} shortcuts={settings.shortcuts} />}

      {showPrivacyPolicy && <PrivacyPolicy onClose={() => setShowPrivacyPolicy(false)} language={settings.language} />}
    </div>
  )
}

export default App
