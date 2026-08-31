export interface Shortcuts {
  toggleToolbar: string;
  toggleInk: string;
  select: string;
  pen: string;
  highlighter: string;
  laser: string;
  eraser: string;
  clear: string;
  undo: string;
  redo: string;
  screenshot: string;
  increaseBrush: string;
  decreaseBrush: string;
  changeToLastColor: string;
  quickColor1: string;
  quickColor2: string;
  quickColor3: string;
  quickColor4: string;
  
  text: string;
  shapes: string;
  settings: string;
  delete: string;
  
  // Individual shapes
  shapeLine: string;
  shapeArrow: string;
  shapeDoubleArrow: string;
  shapeRectangle: string;
  shapeSquare: string;
  shapeEllipse: string;
  shapePolygon: string;
  shapeFreePolygon: string;
  shapeFreeEllipse: string;
}

export interface Settings {
  penSize: number;
  highlighterSize: number;
  laserSize: number;
  eraserSize: number;
  
  laserFadeDuration: number;
  laserMode: 'individual' | 'group';

  penStabilizer: 'off' | 'basic' | 'soft' | 'silky' | 'fluid';
  penOpacity: number;
  highlighterOpacity: number;
  penColor?: string;
  highlighterColor?: string;
  autoShapeRecognition?: boolean;

  showCursorPreview: boolean;
  favoriteColors: string[];
  confirmBeforeClearing: boolean;
  confirmBeforeDeleting: boolean;
  
  // New Epic Pen settings
  toolbarOrientation: 'vertical' | 'horizontal';
  rememberShortcutsOnClose: boolean;
  toolsTrackOwnSize: boolean;
  mouseWheelAdjustsPenSize: boolean;
  startOnWindowsStartup: boolean;
  checkUpdatesOnStartup: boolean;
  language: string;
  
  screenshotSaveMode: 'ask' | 'folder';
  screenshotFolder: string;
  captureFullDesktop: boolean;
  
  whiteboardMode: 'all' | 'single';
  whiteboardScreen: string;
  
  ghostMode: boolean;
  disableToolNotifications: boolean;
  
  disableShortcuts: boolean;

  shortcuts: Shortcuts;
}

export const DEFAULT_SETTINGS: Settings = {
  penSize: 5,
  highlighterSize: 20,
  laserSize: 8,
  laserFadeDuration: 2000,
  laserMode: 'individual',
  penStabilizer: 'basic',
  penOpacity: 1.0,
  highlighterOpacity: 0.35,
  penColor: '#000000',
  highlighterColor: '#ffff00',
  autoShapeRecognition: true,
  eraserSize: 30,
  
  showCursorPreview: true,
  favoriteColors: ['#ff0000', '#000000', '#00aa00', '#0066ff'],
  confirmBeforeClearing: true,
  confirmBeforeDeleting: true,
  
  toolbarOrientation: 'vertical',
  rememberShortcutsOnClose: false,
  toolsTrackOwnSize: false,
  mouseWheelAdjustsPenSize: false,
  startOnWindowsStartup: false,
  checkUpdatesOnStartup: false,
  language: 'Türkçe',
  
  screenshotSaveMode: 'folder',
  screenshotFolder: 'Masaüstü',
  captureFullDesktop: false,
  
  whiteboardMode: 'all',
  whiteboardScreen: 'Ekran 1',
  
  ghostMode: false,
  disableToolNotifications: false,
  
  disableShortcuts: false,
  
  shortcuts: {
    toggleToolbar: 'CmdOrCtrl+Shift+0',
    toggleInk: 'CmdOrCtrl+Shift+1',
    select: 'CmdOrCtrl+Shift+2',
    pen: 'CmdOrCtrl+Shift+3',
    highlighter: 'CmdOrCtrl+Shift+4',
    laser: 'CmdOrCtrl+Shift+8',
    eraser: 'CmdOrCtrl+Shift+5',
    clear: 'CmdOrCtrl+Shift+7',
    undo: 'CmdOrCtrl+Shift+6',
    redo: 'CmdOrCtrl+Shift+Y',
    screenshot: 'CmdOrCtrl+Shift+PrintScreen',
    increaseBrush: 'CmdOrCtrl+Shift+]',
    decreaseBrush: 'CmdOrCtrl+Shift+[',
    changeToLastColor: 'CmdOrCtrl+Shift+9',
    quickColor1: 'Alt+Shift+1',
    quickColor2: 'Alt+Shift+2',
    quickColor3: 'Alt+Shift+3',
    quickColor4: 'Alt+Shift+4',
    
    text: 'T',
    shapes: 'S',
    settings: 'O',
    delete: 'Backspace',
    
    shapeLine: '',
    shapeArrow: '',
    shapeDoubleArrow: '',
    shapeRectangle: '',
    shapeSquare: '',
    shapeEllipse: '',
    shapePolygon: '',
    shapeFreePolygon: '',
    shapeFreeEllipse: '',
  }
};

export const translations = {
  tr: {
    settings: 'Ayarlar',
    tools: 'Araçlar',
    toolbarOrientation: 'Araç Çubuğu Konumu',
    toolbarOrientationVertical: 'Dikey',
    toolbarOrientationHorizontal: 'Yatay',
    rememberShortcutsOnClose: 'Kapatıldığında kısayolları hatırla',
    toolsTrackOwnSize: 'Her araç kendi boyutunu izler',
    mouseWheelAdjustsPenSize: 'Mouse tekerleği kalem boyutunu ayarlar',
    startOnWindowsStartup: 'Sistem oturumu açılınca başlat',
    checkUpdatesOnStartup: 'Başlangıçta güncellemeleri kontrol et',
    showCursorPreview: 'İmleç fırça boyutu önizlemesi',
    laserFadeDuration: 'Lazer Kaybolma Süresi',
    laserMode: 'Lazer Modu',
    laserModeIndividual: 'Kaybolan (Bireysel)',
    laserModeGroup: 'Bekleyen (Grup)',
    penStabilizer: 'Kalem Sabitleyici (Yumuşatma)',
    stabilizerOff: 'Kapalı (Ham)',
    stabilizerBasic: 'Temel',
    stabilizerSoft: 'Yumuşak',
    stabilizerSilky: 'İpeksi',
    stabilizerFluid: 'Akıcı',
    penOpacity: 'Kalem Opaklığı',
    highlighterOpacity: 'Vurgulayıcı Opaklığı',
    resetToDefault: 'Varsayılana Sıfırla',
    language: 'Dil',
    quickColors: 'Hızlı Renkler',
    quickColor1: 'Hızlı renk 1',
    quickColor2: 'Hızlı renk 2',
    quickColor3: 'Hızlı renk 3',
    quickColor4: 'Hızlı renk 4',
    screenshot: 'Ekran görüntüsü',
    askAlways: 'Her zaman nerede kaydedileceğini sor',
    saveAlwaysToFolder: 'Her zaman bu klasöre kaydet:',
    captureFullDesktop: 'Her zaman tam masaüstü görüntüsü al',
    whiteboard: 'Beyaz tahta',
    whiteboardAllScreens: 'Beyaz tahta tüm ekranlarda görünür',
    whiteboardSingleScreen: 'Beyaz tahta bir ekranda görünür',
    ghostMode: 'Hayalet modu',
    ghostModeDesc: 'Bu modu etkinleştirmek, araç çubuğunu gizlemenize ve araçları yalnızca kısayol tuşlarıyla kullanmaya devam etmenize imkan sağlar. Bu özellik devre dışı bırakıldığında, araç çubuğunu gizlemeye çalışmak mürekkebin de gizlenmesine neden olacaktır.',
    enableGhostMode: 'Hayalet modunu etkinleştir',
    disableToolNotifications: 'Araç bildirimlerini kapat',
    shortcuts: 'Kısayol tuşları',
    disableShortcuts: 'Kısayol tuşlarını devre dışı bırak',
    pressKey: 'Tuşa basın...',
    unassigned: 'Atanmadı',
    showSubShortcuts: 'Alt Kısayolları Göster',
    screenLabel: 'Ekran',

    // Shortcut Names
    shortcutToggleToolbar: 'Araç çubuğu görünürlüğünü değiştir',
    shortcutToggleInk: 'Mürekkep görünürlüğünü değiştir',
    shortcutSelect: 'Seçim Aracı',
    shortcutPen: 'Kalem',
    shortcutHighlighter: 'Vurgulayıcı',
    shortcutLaser: 'Lazer',
    shortcutEraser: 'Silgi',
    shortcutClear: 'Ekranı temizle',
    shortcutUndo: 'Geri al',
    shortcutRedo: 'İleri al',
    shortcutDelete: 'Sil',
    shortcutText: 'Metin',
    shortcutShapes: 'Şekiller Menüsü',
    shortcutShapeLine: 'Çizgi',
    shortcutShapeArrow: 'Ok',
    shortcutShapeDoubleArrow: 'Çift Ok',
    shortcutShapeRectangle: 'Dikdörtgen',
    shortcutShapeSquare: 'Kare',
    shortcutShapeEllipse: 'Elips',
    shortcutShapePolygon: 'Üçgen',
    shortcutShapeFreePolygon: 'Serbest Çokgen',
    shortcutShapeFreeEllipse: 'Serbest Elips',
    shortcutSettings: 'Ayarlar menüsü',
    shortcutScreenshot: 'Ekran görüntüsü al',
    shortcutIncreaseBrush: 'Fırça boyutu +',
    shortcutDecreaseBrush: 'Fırça boyutu -',
    shortcutChangeToLastColor: 'Son renge değiştir'
  },
  en: {
    settings: 'Settings',
    tools: 'Tools',
    toolbarOrientation: 'Toolbar Orientation',
    toolbarOrientationVertical: 'Vertical',
    toolbarOrientationHorizontal: 'Horizontal',
    rememberShortcutsOnClose: 'Remember shortcuts on close',
    toolsTrackOwnSize: 'Tools track their own size',
    mouseWheelAdjustsPenSize: 'Mouse wheel adjusts pen size',
    startOnWindowsStartup: 'Start on system startup',
    checkUpdatesOnStartup: 'Check for updates on startup',
    showCursorPreview: 'Cursor brush size preview',
    laserFadeDuration: 'Laser Fade Duration',
    laserMode: 'Laser Mode',
    laserModeIndividual: 'Individual Fade',
    laserModeGroup: 'Group / Idle Fade',
    penStabilizer: 'Pen Stabilizer',
    stabilizerOff: 'Off (Raw)',
    stabilizerBasic: 'Basic',
    stabilizerSoft: 'Soft',
    stabilizerSilky: 'Silky',
    stabilizerFluid: 'Fluid',
    penOpacity: 'Pen Opacity',
    highlighterOpacity: 'Highlighter Opacity',
    resetToDefault: 'Reset to Default',
    language: 'Language',
    quickColors: 'Quick Colors',
    quickColor1: 'Quick color 1',
    quickColor2: 'Quick color 2',
    quickColor3: 'Quick color 3',
    quickColor4: 'Quick color 4',
    screenshot: 'Screenshot',
    askAlways: 'Always ask where to save',
    saveAlwaysToFolder: 'Always save to this folder:',
    captureFullDesktop: 'Always capture full desktop',
    whiteboard: 'Whiteboard',
    whiteboardAllScreens: 'Whiteboard visible on all screens',
    whiteboardSingleScreen: 'Whiteboard visible on single screen',
    ghostMode: 'Ghost mode',
    ghostModeDesc: 'Enabling this mode allows you to hide the toolbar while continuing to draw using shortcuts. If disabled, hiding the toolbar will also hide your ink.',
    enableGhostMode: 'Enable ghost mode',
    disableToolNotifications: 'Disable tool notifications',
    shortcuts: 'Shortcuts',
    disableShortcuts: 'Disable shortcuts',
    pressKey: 'Press key...',
    unassigned: 'Unassigned',
    showSubShortcuts: 'Show Sub-Shortcuts',
    screenLabel: 'Screen',

    // Shortcut Names
    shortcutToggleToolbar: 'Toggle Toolbar',
    shortcutToggleInk: 'Toggle Ink',
    shortcutSelect: 'Selection Tool',
    shortcutPen: 'Pen',
    shortcutHighlighter: 'Highlighter',
    shortcutLaser: 'Laser',
    shortcutEraser: 'Eraser',
    shortcutClear: 'Clear All',
    shortcutUndo: 'Undo',
    shortcutRedo: 'Redo',
    shortcutDelete: 'Delete',
    shortcutText: 'Text',
    shortcutShapes: 'Shapes Menu',
    shortcutShapeLine: 'Line',
    shortcutShapeArrow: 'Arrow',
    shortcutShapeDoubleArrow: 'Double Arrow',
    shortcutShapeRectangle: 'Rectangle',
    shortcutShapeSquare: 'Square',
    shortcutShapeEllipse: 'Ellipse',
    shortcutShapePolygon: 'Triangle',
    shortcutShapeFreePolygon: 'Free Polygon',
    shortcutShapeFreeEllipse: 'Free Ellipse',
    shortcutSettings: 'Settings Menu',
    shortcutScreenshot: 'Take Screenshot',
    shortcutIncreaseBrush: 'Brush Size +',
    shortcutDecreaseBrush: 'Brush Size -',
    shortcutChangeToLastColor: 'Change to Last Color'
  }
};

