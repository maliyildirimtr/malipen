import { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer, dialog, clipboard, nativeImage, shell, Tray, Menu, Display } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { toElectronAccelerator } from '../src/utils/accelerator';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const log = (...args: unknown[]) => { if (isDev) console.log(...args); };

// ─── Settings cache (main process is the single writer of settings.json) ──────
type MainSettings = {
  screenshotSaveMode?: 'ask' | 'folder';
  screenshotFolder?: string;
  checkUpdatesOnStartup?: boolean;
  whiteboardMode?: 'all' | 'single';
  whiteboardScreen?: string;
  [key: string]: unknown;
};

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
let currentSettings: MainSettings | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function readSettingsFile(): Promise<MainSettings | null> {
  try {
    const data = await fs.readFile(settingsPath(), 'utf-8');
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    // Corrupt or missing file: try the last good backup
    try {
      const data = await fs.readFile(settingsPath() + '.bak', 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}

/** Atomic write (tmp file + rename), serialized so two writes never interleave. */
function writeSettingsFile(settings: MainSettings): Promise<void> {
  writeChain = writeChain.then(async () => {
    const target = settingsPath();
    const tmp = `${target}.${process.pid}.tmp`;
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(tmp, JSON.stringify(settings, null, 2), 'utf-8');
      try { await fs.copyFile(target, target + '.bak'); } catch { /* first write */ }
      await fs.rename(tmp, target);
    } catch (e) {
      console.error('Failed to save settings:', e);
      try { await fs.unlink(tmp); } catch { /* ignore */ }
    }
  });
  return writeChain;
}

// ─── Window placement ─────────────────────────────────────────────────────────
function displayIndexFromLabel(label: string | undefined): number {
  const m = /(\d+)\s*$/.exec(label || '');
  return m ? Math.max(0, parseInt(m[1], 10) - 1) : 0;
}

/** The display the overlay should live on (single-screen whiteboard setting, else primary). */
function targetDisplay(): Display {
  const displays = screen.getAllDisplays();
  if (currentSettings?.whiteboardMode === 'single') {
    const idx = displayIndexFromLabel(currentSettings.whiteboardScreen);
    if (displays[idx]) return displays[idx];
  }
  return screen.getPrimaryDisplay();
}

function placeWindow() {
  if (!mainWindow) return;
  const { x, y, width, height } = targetDisplay().workArea;
  mainWindow.setBounds({ x, y, width, height });
}

function resolveAsset(file: string) {
  // Vite copies /public into /dist; in dev the files are still in /public
  return isDev
    ? path.join(__dirname, '../public', file)
    : path.join(__dirname, '../dist', file);
}

function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    return;
  }

  const { x, y, width, height } = targetDisplay().workArea;

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  if (isDev) {
    mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
      console.log(`[Renderer] ${message} (${sourceId}:${line})`);
    });
  }

  // Make the window ignore mouse events initially (cursor mode)
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Only open real web links, and only in the user's browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL);
    if (!allowed) event.preventDefault();
  });

  // "Close" from the OS keeps the app in the tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.platform === 'darwin') {
    app.setActivationPolicy('regular');
    app.dock?.show();
  }
}

function toggleWindowVisibility() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
}

function createTray() {
  try {
    let image = nativeImage.createFromPath(resolveAsset('icon.png'));
    if (image.isEmpty()) return;
    image = image.resize({ width: process.platform === 'darwin' ? 18 : 16 });
    tray = new Tray(image);
    tray.setToolTip('MaliPen');
    const isEn = () => currentSettings?.language === 'English';
    const buildMenu = () => Menu.buildFromTemplate([
      { label: isEn() ? 'Show / Hide MaliPen' : 'MaliPen\'i Göster / Gizle', click: toggleWindowVisibility },
      { label: isEn() ? 'Screenshot (region)' : 'Ekran görüntüsü (bölge)', click: () => { mainWindow?.show(); mainWindow?.webContents.send('shortcut-triggered', 'capture-region'); } },
      { label: isEn() ? 'Settings' : 'Ayarlar', click: () => { mainWindow?.show(); mainWindow?.webContents.send('shortcut-triggered', 'open-settings'); } },
      { type: 'separator' },
      { label: isEn() ? 'Quit MaliPen' : 'MaliPen\'den Çık', click: () => { isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(buildMenu());
    tray.on('click', () => { if (process.platform !== 'darwin') toggleWindowVisibility(); });
    // Rebuild menu labels when the language changes
    ipcMain.on('__tray-refresh', () => tray?.setContextMenu(buildMenu()));
  } catch (e) {
    console.error('Tray could not be created:', e);
  }
}

// ─── Global shortcuts ─────────────────────────────────────────────────────────
/**
 * The renderer sends { action: shortcutString }. Every shortcut that has a modifier is
 * registered system-wide so it works while another app has focus (cursor mode).
 * Returns the actions that were registered; the renderer handles the rest locally.
 */
function registerGlobalShortcuts(map: Record<string, string>): { registered: string[]; failed: string[] } {
  globalShortcut.unregisterAll();
  const registered: string[] = [];
  const failed: string[] = [];
  const used = new Set<string>();

  for (const [action, shortcut] of Object.entries(map || {})) {
    const accel = toElectronAccelerator(shortcut);
    if (!accel || used.has(accel)) continue;
    try {
      const ok = globalShortcut.register(accel, () => {
        // Hidden to the tray: the toolbar shortcut just brings MaliPen back
        if (action === 'toggleToolbar' && mainWindow && !mainWindow.isVisible()) { mainWindow.show(); return; }
        if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
        mainWindow?.webContents.send('shortcut-triggered', action);
      });
      if (ok) { registered.push(action); used.add(accel); }
      else failed.push(action); // taken by the OS or another app
    } catch {
      failed.push(action);
    }
  }
  return { registered, failed };
}

// ─── Mouse pass-through routing (shared state for IPC + dialogs) ──────────────
let interactionState = { shouldIgnoreBase: true, clickableRects: [] as { x: number, y: number, width: number, height: number }[] };
let currentIgnoreState = true; // Started as true in createWindow
let dialogOpen = false; // Pause routing while a native dialog is shown

function applyIgnoreState(ignore: boolean) {
  if (!mainWindow || ignore === currentIgnoreState) return;
  if (ignore) mainWindow.setIgnoreMouseEvents(true, { forward: true });
  else mainWindow.setIgnoreMouseEvents(false);
  currentIgnoreState = ignore;
}

function isCursorOverClickable(): boolean {
  if (!mainWindow) return false;
  const point = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();
  const relX = point.x - bounds.x;
  const relY = point.y - bounds.y;
  const BUFFER = 5; // padding to catch fast mouse movements
  return interactionState.clickableRects.some(rect =>
    relX >= rect.x - BUFFER && relX <= rect.x + rect.width + BUFFER &&
    relY >= rect.y - BUFFER && relY <= rect.y + rect.height + BUFFER);
}

function updateMouseRouting() {
  if (!mainWindow || dialogOpen) return;
  if (!interactionState.shouldIgnoreBase) { applyIgnoreState(false); return; }
  applyIgnoreState(!isCursorOverClickable());
}

/** Run a native dialog while pausing pass-through routing (macOS alwaysOnTop fix). */
async function withDialog<T>(fn: () => Promise<T>): Promise<T> {
  dialogOpen = true;
  if (mainWindow) {
    // alwaysOnTop windows sit above native dialogs; drop it while the dialog is up
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setIgnoreMouseEvents(false);
    currentIgnoreState = false;
  }
  try {
    return await fn();
  } finally {
    dialogOpen = false;
    mainWindow?.setAlwaysOnTop(true);
  }
}

async function isDirectory(p: string | undefined): Promise<boolean> {
  if (!p || !path.isAbsolute(p)) return false;
  try { return (await fs.stat(p)).isDirectory(); } catch { return false; }
}

function registerIpcHandlers() {
  // Kept for backwards compatibility; routing is driven by update-interaction-state.
  ipcMain.on('set-ignore-mouse-events', () => { /* no-op by design */ });

  ipcMain.on('update-interaction-state', (_event, state) => {
    if (state && Array.isArray(state.clickableRects)) {
      interactionState = state;
      updateMouseRouting();
    }
  });

  ipcMain.handle('capture-screen', async () => {
    try {
      if (!mainWindow) return null;
      const winBounds = mainWindow.getBounds();
      const display = screen.getDisplayMatching(winBounds);
      mainWindow.hide();
      await new Promise(r => setTimeout(r, 150)); // wait for the OS to remove the overlay

      const { width, height } = display.bounds;
      const scaleFactor = display.scaleFactor;
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: Math.round(width * scaleFactor), height: Math.round(height * scaleFactor) }
      });

      mainWindow.show();
      // macOS resets native hit-testing on hide()/show(): re-apply the current routing
      { const ig = currentIgnoreState; currentIgnoreState = !ig; applyIgnoreState(ig); }

      const source = sources.find(s => String(s.display_id) === String(display.id)) || sources[0];
      if (!source) return null;

      // The capture covers the whole display (menu bar / taskbar included) while the
      // overlay window only covers the work area. Crop to the window so that renderer
      // coordinates and image pixels line up exactly (fixes the offset + stretching).
      const img = source.thumbnail;
      const size = img.getSize();
      const sx = size.width / display.bounds.width;
      const sy = size.height / display.bounds.height;
      const crop = {
        x: Math.max(0, Math.round((winBounds.x - display.bounds.x) * sx)),
        y: Math.max(0, Math.round((winBounds.y - display.bounds.y) * sy)),
        width: Math.round(winBounds.width * sx),
        height: Math.round(winBounds.height * sy),
      };
      crop.width = Math.min(crop.width, size.width - crop.x);
      crop.height = Math.min(crop.height, size.height - crop.y);
      return img.crop(crop).toDataURL();
    } catch (error) {
      console.error('IPC MAIN: Error during capture', error);
      mainWindow?.show();
      throw error;
    }
  });

  // The save location is decided here from the persisted settings, never from a
  // path sent by the renderer.
  ipcMain.handle('save-image', async (_event, { buffer, format }) => {
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const fileName = `MaliPen_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
    try {
      let finalPath: string | null = null;
      const folder = currentSettings?.screenshotFolder;
      // The Mac App Store build is sandboxed: it may only write where the user picked in a dialog
      const askMode = process.mas || currentSettings?.screenshotSaveMode === 'ask';
      if (!askMode && await isDirectory(folder)) {
        finalPath = path.join(folder as string, fileName);
      } else if (!askMode) {
        // Folder mode but the folder is missing/invalid (e.g. the old 'Masaüstü' default): use Desktop
        finalPath = path.join(app.getPath('desktop'), fileName);
      } else {
        const { canceled, filePath } = await withDialog(() => dialog.showSaveDialog({
          title: currentSettings?.language === 'English' ? 'Save Capture' : 'Ekran Görüntüsünü Kaydet',
          defaultPath: path.join(app.getPath('desktop'), fileName),
          filters: [{ name: 'Images', extensions: [ext] }]
        }));
        if (canceled || !filePath) return null;
        finalPath = filePath;
      }
      await fs.writeFile(finalPath, Buffer.from(buffer));
      log(`[MAIN] Saved capture to ${finalPath}`);
      return finalPath;
    } catch (e) {
      console.error('Failed to save image:', e);
      throw e;
    }
  });

  ipcMain.handle('show-item-in-folder', (_event, filePath: string) => {
    if (typeof filePath === 'string' && path.isAbsolute(filePath)) shell.showItemInFolder(filePath);
  });

  ipcMain.handle('copy-to-clipboard', async (_event, buffer) => {
    const image = nativeImage.createFromBuffer(Buffer.from(buffer));
    clipboard.writeImage(image);
    return true;
  });

  ipcMain.handle('load-settings', async () => currentSettings);

  ipcMain.handle('save-settings', async (_event, settings) => {
    if (!settings || typeof settings !== 'object') return;
    const displayChanged = settings.whiteboardMode !== currentSettings?.whiteboardMode ||
      settings.whiteboardScreen !== currentSettings?.whiteboardScreen;
    const languageChanged = settings.language !== currentSettings?.language;
    currentSettings = settings;
    if (displayChanged) placeWindow();
    if (languageChanged) ipcMain.emit('__tray-refresh');
    await writeSettingsFile(settings);
  });

  ipcMain.handle('get-default-paths', () => ({ desktop: app.getPath('desktop') }));

  ipcMain.handle('register-shortcuts', (_event, map: Record<string, string>) => registerGlobalShortcuts(map));

  ipcMain.handle('select-folder', async () => {
    const result = await withDialog(() => dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] }));
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('select-image', async () => {
    const result = await withDialog(() => dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp'] }]
    }));

    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const data = await fs.readFile(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${data.toString('base64')}`;
  });

  ipcMain.handle('get-displays', () => {
    return screen.getAllDisplays().map(d => ({
      id: d.id,
      bounds: d.bounds
    }));
  });

  ipcMain.handle('set-open-at-login', (_event, openAtLogin: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: !!openAtLogin,
      path: app.getPath('exe')
    });
  });

  ipcMain.on('hide-window', () => mainWindow?.hide());
  ipcMain.on('quit-app', () => { isQuitting = true; app.quit(); });

  ipcMain.on('install-update', () => {
    if (!process.mas) {
      isQuitting = true;
      autoUpdater.quitAndInstall();
    }
  });

  // Pass-through needs the live cursor position, which the OS only gives us by polling.
  // Poll only while pass-through is active, i.e. there is something to hit-test.
  setInterval(() => {
    if (!mainWindow || dialogOpen || !mainWindow.isVisible()) return;
    if (interactionState.shouldIgnoreBase) updateMouseRouting();
  }, 50);
}

// Single instance: a second launch just shows the running overlay
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { mainWindow?.show(); });

  app.whenReady().then(async () => {
    if (process.platform === 'darwin') {
      app.setActivationPolicy('regular');
      app.dock?.show();
    }

    currentSettings = await readSettingsFile();

    registerIpcHandlers();
    createWindow();
    createTray();

    // Keep the overlay matched to its display when resolution, scaling or monitors change
    const onDisplaysChanged = () => placeWindow();
    screen.on('display-metrics-changed', onDisplaysChanged);
    screen.on('display-added', onDisplaysChanged);
    screen.on('display-removed', onDisplaysChanged);

    // Auto-update only in packaged, non-App-Store builds and only if the user allows it.
    // A settings file from before this option was honoured has no settingsVersion: treat as on.
    const updatesAllowed = currentSettings?.settingsVersion === undefined || currentSettings?.checkUpdatesOnStartup !== false;
    if (!process.mas && app.isPackaged && updatesAllowed) {
      autoUpdater.autoDownload = true;
      autoUpdater.on('update-available', (info) => {
        mainWindow?.webContents.send('update-available', info);
      });
      autoUpdater.on('update-downloaded', (info) => {
        mainWindow?.webContents.send('update-downloaded', info);
      });

      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('Failed to check for updates:', err);
      });
    }

    app.on('activate', () => {
      if (process.platform === 'darwin') {
        app.setActivationPolicy('regular');
        app.dock?.show();
      }
      if (BrowserWindow.getAllWindows().length === 0 || !mainWindow) {
        createWindow();
      } else {
        mainWindow.show();
      }
    });
  });
}

app.on('before-quit', () => { isQuitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
