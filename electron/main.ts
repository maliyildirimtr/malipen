import { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer, dialog, clipboard, nativeImage, shell } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  // Make the window ignore mouse events initially (cursor mode)
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Maximizing for overlay
  mainWindow.maximize();
  mainWindow.setResizable(false);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[RENDERER]: ${message}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.platform === 'darwin') {
    app.setActivationPolicy('regular');
    app.dock?.show();
  }
}

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll();

  // Capture Region
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    mainWindow?.webContents.send('shortcut-triggered', 'capture-region');
  });
  
  // Capture Full
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    mainWindow?.webContents.send('shortcut-triggered', 'capture-full');
  });
}

function registerIpcHandlers() {
  // Handle IPC to toggle mouse events
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    if (mainWindow) {
      // We ignore direct calls from the renderer on all platforms because 
      // the global setInterval handles it perfectly. Direct calls cause state desync.
      return;
    }
  });

  ipcMain.handle('capture-screen', async () => {
    console.log("IPC MAIN: capture-screen triggered");
    try {
      if (mainWindow) mainWindow.hide();
      console.log("IPC MAIN: mainWindow hidden, waiting 150ms...");
      await new Promise(r => setTimeout(r, 150)); // wait for OS compositing (UI to disappear)

      // Get the display where the window is currently located
      const display = mainWindow ? screen.getDisplayMatching(mainWindow.getBounds()) : screen.getPrimaryDisplay();
      const { width, height } = display.bounds;
      const scaleFactor = display.scaleFactor;

      const sources = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: { width: width * scaleFactor, height: height * scaleFactor } 
      });

      if (mainWindow) {
        mainWindow.show();
      }

      // Find the correct source for the display
      const source = sources.find(s => String(s.display_id) === String(display.id)) || sources[0];
      if (!source) {
        return null;
      }
      
      const dataUrl = source.thumbnail.toDataURL();
      return dataUrl;
    } catch (error) {
      console.error("IPC MAIN: Error during capture", error);
      if (mainWindow) mainWindow.show();
      throw error;
    }
  });

  ipcMain.handle('save-image', async (event, { buffer, format, savePath }) => {
    const withDialog = (global as any).__withDialog as <T>(fn: () => Promise<T>) => Promise<T>;
    try {
      const t0 = performance.now();
      console.log(`[PERF MAIN] MAIN_PROCESS_RECEIVE (Buffer length: ${buffer.byteLength})`);
      
      let finalPath = savePath;
      if (!finalPath) {
        console.log(`[PERF MAIN] DIALOG_OPEN_START`);
        const dialogResult = await withDialog(() => dialog.showSaveDialog({
          title: 'Save Capture',
          defaultPath: `MaliPen_Capture_${Date.now()}.${format}`,
          filters: [{ name: 'Images', extensions: [format] }]
        }));
        const { canceled, filePath } = dialogResult;
        const t3 = performance.now();
        console.log(`[PERF MAIN] DIALOG_SELECTED (Dialog time: ${t3 - t0}ms)`);
        
        if (canceled || !filePath) return null;
        finalPath = filePath;
      } else {
        finalPath = path.join(finalPath, `MaliPen_Capture_${Date.now()}.${format}`);
      }

      console.log(`[PERF MAIN] FILE_WRITE_START`);
      const t4 = performance.now();
      await fs.writeFile(finalPath, Buffer.from(buffer));
      const t5 = performance.now();
      console.log(`[PERF MAIN] FILE_WRITE_COMPLETE (Write time: ${t5 - t4}ms)`);
      console.log(`[PERF MAIN] SAVE_COMPLETE Main Total: ${t5 - t0}ms`);
      return finalPath;
    } catch (e) {
      console.error('Failed to save image:', e);
      throw e;
    }
  });

  ipcMain.handle('copy-to-clipboard', async (event, buffer) => {
    const image = nativeImage.createFromBuffer(Buffer.from(buffer));
    clipboard.writeImage(image);
  });

  const settingsPath = path.join(app.getPath('userData'), 'settings.json');

  ipcMain.handle('load-settings', async () => {
    try {
      const data = await fs.readFile(settingsPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle('save-settings', async (event, settings) => {
    try {
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  });

  ipcMain.handle('select-folder', async () => {
    const withDialog = (global as any).__withDialog as <T>(fn: () => Promise<T>) => Promise<T>;
    const result = await withDialog(() => dialog.showOpenDialog({ properties: ['openDirectory'] }));
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('select-image', async () => {
    const withDialog = (global as any).__withDialog as <T>(fn: () => Promise<T>) => Promise<T>;
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

  ipcMain.handle('set-open-at-login', (event, openAtLogin: boolean) => {
    app.setLoginItemSettings({
      openAtLogin,
      path: app.getPath('exe')
    });
  });

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  // Handle Windows click-through transparent region routing
  let interactionState = { shouldIgnoreBase: false, clickableRects: [] as {x: number, y: number, width: number, height: number}[] };
  let currentIgnoreState = true; // Started as true in createWindow
  let dialogOpen = false; // Pause interval while a native dialog is shown

  ipcMain.on('update-interaction-state', (event, state) => {
    interactionState = state;
  });

  // Helper: run a dialog while pausing the mouse-event interval
  async function withDialog<T>(fn: () => Promise<T>): Promise<T> {
    dialogOpen = true;
    if (mainWindow) {
      // CRITICAL macOS fix: alwaysOnTop windows sit above native dialogs,
      // making the dialog appear but clicks going to the Electron overlay.
      // Temporarily disable alwaysOnTop so the dialog is truly on top.
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setIgnoreMouseEvents(false);
      currentIgnoreState = false;
    }
    try {
      return await fn();
    } finally {
      dialogOpen = false;
      if (mainWindow) {
        mainWindow.setAlwaysOnTop(true); // Restore after dialog closes
      }
    }
  }

  // Expose withDialog for IPC handlers above
  (global as any).__withDialog = withDialog;

  setInterval(() => {
    if (!mainWindow || dialogOpen) return; // Do NOT touch mouse state while a dialog is open

    if (!interactionState.shouldIgnoreBase) {
      if (currentIgnoreState) {
        mainWindow.setIgnoreMouseEvents(false);
        currentIgnoreState = false;
      }
      return;
    }

    const point = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();
    const relX = point.x - bounds.x;
    const relY = point.y - bounds.y;

    let isOverClickable = false;
    const BUFFER = 5; // 5px padding to catch fast mouse movements
    for (const rect of interactionState.clickableRects) {
      if (relX >= rect.x - BUFFER && relX <= rect.x + rect.width + BUFFER &&
          relY >= rect.y - BUFFER && relY <= rect.y + rect.height + BUFFER) {
        isOverClickable = true;
        break;
      }
    }

    if (isOverClickable) {
      if (!currentIgnoreState) return; // already receiving events
      mainWindow.setIgnoreMouseEvents(false);
      currentIgnoreState = false;
    } else {
      if (currentIgnoreState) return; // already ignoring
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      currentIgnoreState = true;
    }
  }, 50);
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.setActivationPolicy('regular');
    app.dock?.show();
  }

  registerIpcHandlers();
  registerGlobalShortcuts();
  createWindow();

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

