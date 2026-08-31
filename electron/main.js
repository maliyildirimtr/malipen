var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer, dialog, clipboard, nativeImage, shell } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { autoUpdater } from 'electron-updater';
var mainWindow = null;
function createWindow() {
    var _a;
    if (mainWindow) {
        mainWindow.show();
        return;
    }
    var _b = screen.getPrimaryDisplay().workAreaSize, width = _b.width, height = _b.height;
    mainWindow = new BrowserWindow({
        width: width,
        height: height,
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
    mainWindow.webContents.on('console-message', function (event, level, message, line, sourceId) {
        console.log("[Renderer] ".concat(message, " (").concat(sourceId, ":").concat(line, ")"));
    });
    // Make the window ignore mouse events initially (cursor mode)
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    // Maximizing for overlay
    mainWindow.maximize();
    mainWindow.setResizable(false);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.webContents.on('console-message', function (event, level, message) {
        console.log("[RENDERER]: ".concat(message));
    });
    mainWindow.webContents.setWindowOpenHandler(function (_a) {
        var url = _a.url;
        shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
    if (process.platform === 'darwin') {
        app.setActivationPolicy('regular');
        (_a = app.dock) === null || _a === void 0 ? void 0 : _a.show();
    }
}
function registerGlobalShortcuts() {
    globalShortcut.unregisterAll();
    // Capture Region
    globalShortcut.register('CommandOrControl+Shift+S', function () {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('shortcut-triggered', 'capture-region');
    });
    // Capture Full
    globalShortcut.register('CommandOrControl+Shift+F', function () {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('shortcut-triggered', 'capture-full');
    });
}
function registerIpcHandlers() {
    var _this = this;
    // Handle IPC to toggle mouse events
    ipcMain.on('set-ignore-mouse-events', function (event, ignore, options) {
        if (mainWindow) {
            // We ignore direct calls from the renderer on all platforms because 
            // the global setInterval handles it perfectly. Direct calls cause state desync.
            return;
        }
    });
    ipcMain.handle('capture-screen', function () { return __awaiter(_this, void 0, void 0, function () {
        var display_1, _a, width, height, scaleFactor, sources, source, dataUrl, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("IPC MAIN: capture-screen triggered");
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    if (mainWindow)
                        mainWindow.hide();
                    console.log("IPC MAIN: mainWindow hidden, waiting 150ms...");
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 150); })];
                case 2:
                    _b.sent(); // wait for OS compositing (UI to disappear)
                    display_1 = mainWindow ? screen.getDisplayMatching(mainWindow.getBounds()) : screen.getPrimaryDisplay();
                    _a = display_1.bounds, width = _a.width, height = _a.height;
                    scaleFactor = display_1.scaleFactor;
                    return [4 /*yield*/, desktopCapturer.getSources({
                            types: ['screen'],
                            thumbnailSize: { width: width * scaleFactor, height: height * scaleFactor }
                        })];
                case 3:
                    sources = _b.sent();
                    if (mainWindow) {
                        mainWindow.show();
                    }
                    source = sources.find(function (s) { return String(s.display_id) === String(display_1.id); }) || sources[0];
                    if (!source) {
                        return [2 /*return*/, null];
                    }
                    dataUrl = source.thumbnail.toDataURL();
                    return [2 /*return*/, dataUrl];
                case 4:
                    error_1 = _b.sent();
                    console.error("IPC MAIN: Error during capture", error_1);
                    if (mainWindow)
                        mainWindow.show();
                    throw error_1;
                case 5: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('save-image', function (event_1, _a) { return __awaiter(_this, [event_1, _a], void 0, function (event, _b) {
        var t0, finalPath, dialogResult, _c, canceled, filePath, t3, t4, t5, e_1;
        var buffer = _b.buffer, format = _b.format, savePath = _b.savePath;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 8, , 9]);
                    t0 = performance.now();
                    console.log("[PERF MAIN] MAIN_PROCESS_RECEIVE (Buffer length: ".concat(buffer.byteLength, ")"));
                    finalPath = savePath;
                    if (!!finalPath) return [3 /*break*/, 5];
                    console.log("[PERF MAIN] DIALOG_OPEN_START");
                    if (!mainWindow) return [3 /*break*/, 2];
                    return [4 /*yield*/, dialog.showSaveDialog(mainWindow, {
                            title: 'Save Capture',
                            defaultPath: "MaliPen_Capture_".concat(Date.now(), ".").concat(format),
                            filters: [{ name: 'Images', extensions: [format] }]
                        })];
                case 1:
                    _c = _d.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, dialog.showSaveDialog({
                        title: 'Save Capture',
                        defaultPath: "MaliPen_Capture_".concat(Date.now(), ".").concat(format),
                        filters: [{ name: 'Images', extensions: [format] }]
                    })];
                case 3:
                    _c = _d.sent();
                    _d.label = 4;
                case 4:
                    dialogResult = _c;
                    canceled = dialogResult.canceled, filePath = dialogResult.filePath;
                    t3 = performance.now();
                    console.log("[PERF MAIN] DIALOG_SELECTED (Dialog time: ".concat(t3 - t0, "ms)"));
                    if (canceled || !filePath)
                        return [2 /*return*/, null];
                    finalPath = filePath;
                    return [3 /*break*/, 6];
                case 5:
                    finalPath = path.join(finalPath, "MaliPen_Capture_".concat(Date.now(), ".").concat(format));
                    _d.label = 6;
                case 6:
                    console.log("[PERF MAIN] FILE_WRITE_START");
                    t4 = performance.now();
                    return [4 /*yield*/, fs.writeFile(finalPath, Buffer.from(buffer))];
                case 7:
                    _d.sent();
                    t5 = performance.now();
                    console.log("[PERF MAIN] FILE_WRITE_COMPLETE (Write time: ".concat(t5 - t4, "ms)"));
                    console.log("[PERF MAIN] SAVE_COMPLETE Main Total: ".concat(t5 - t0, "ms"));
                    return [2 /*return*/, finalPath];
                case 8:
                    e_1 = _d.sent();
                    console.error('Failed to save image:', e_1);
                    throw e_1;
                case 9: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('copy-to-clipboard', function (event, buffer) { return __awaiter(_this, void 0, void 0, function () {
        var image;
        return __generator(this, function (_a) {
            image = nativeImage.createFromBuffer(Buffer.from(buffer));
            clipboard.writeImage(image);
            return [2 /*return*/];
        });
    }); });
    var settingsPath = path.join(app.getPath('userData'), 'settings.json');
    ipcMain.handle('load-settings', function () { return __awaiter(_this, void 0, void 0, function () {
        var data, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs.readFile(settingsPath, 'utf-8')];
                case 1:
                    data = _a.sent();
                    return [2 /*return*/, JSON.parse(data)];
                case 2:
                    e_2 = _a.sent();
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('save-settings', function (event, settings) { return __awaiter(_this, void 0, void 0, function () {
        var e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    e_3 = _a.sent();
                    console.error('Failed to save settings:', e_3);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('select-folder', function () { return __awaiter(_this, void 0, void 0, function () {
        var targetWin, result, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    targetWin = mainWindow || BrowserWindow.getFocusedWindow();
                    if (!targetWin) return [3 /*break*/, 2];
                    return [4 /*yield*/, dialog.showOpenDialog(targetWin, { properties: ['openDirectory'] })];
                case 1:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, dialog.showOpenDialog({ properties: ['openDirectory'] })];
                case 3:
                    _a = _b.sent();
                    _b.label = 4;
                case 4:
                    result = _a;
                    return [2 /*return*/, result.canceled ? null : result.filePaths[0]];
            }
        });
    }); });
    ipcMain.handle('select-image', function () { return __awaiter(_this, void 0, void 0, function () {
        var targetWin, result, _a, filePath, data, ext, mime;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    targetWin = mainWindow || BrowserWindow.getFocusedWindow();
                    if (!targetWin) return [3 /*break*/, 2];
                    return [4 /*yield*/, dialog.showOpenDialog(targetWin, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp'] }] })];
                case 1:
                    _a = _c.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp'] }] })];
                case 3:
                    _a = _c.sent();
                    _c.label = 4;
                case 4:
                    result = _a;
                    if (result.canceled || result.filePaths.length === 0)
                        return [2 /*return*/, null];
                    filePath = result.filePaths[0];
                    return [4 /*yield*/, fs.readFile(filePath)];
                case 5:
                    data = _c.sent();
                    ext = (_b = filePath.split('.').pop()) === null || _b === void 0 ? void 0 : _b.toLowerCase();
                    mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                    return [2 /*return*/, "data:".concat(mime, ";base64,").concat(data.toString('base64'))];
            }
        });
    }); });
    ipcMain.handle('get-displays', function () {
        return screen.getAllDisplays().map(function (d) { return ({
            id: d.id,
            bounds: d.bounds
        }); });
    });
    ipcMain.handle('set-open-at-login', function (event, openAtLogin) {
        app.setLoginItemSettings({
            openAtLogin: openAtLogin,
            path: app.getPath('exe')
        });
    });
    ipcMain.on('install-update', function () {
        autoUpdater.quitAndInstall();
    });
    // Handle Windows click-through transparent region routing
    var interactionState = { shouldIgnoreBase: false, clickableRects: [] };
    var currentIgnoreState = true; // Started as true in createWindow
    ipcMain.on('update-interaction-state', function (event, state) {
        interactionState = state;
    });
    setInterval(function () {
        if (!mainWindow)
            return;
        if (!interactionState.shouldIgnoreBase) {
            if (currentIgnoreState) {
                mainWindow.setIgnoreMouseEvents(false);
                currentIgnoreState = false;
            }
            return;
        }
        var point = screen.getCursorScreenPoint();
        var bounds = mainWindow.getBounds();
        var relX = point.x - bounds.x;
        var relY = point.y - bounds.y;
        var isOverClickable = false;
        var BUFFER = 5; // 5px padding to catch fast mouse movements
        for (var _i = 0, _a = interactionState.clickableRects; _i < _a.length; _i++) {
            var rect = _a[_i];
            if (relX >= rect.x - BUFFER && relX <= rect.x + rect.width + BUFFER &&
                relY >= rect.y - BUFFER && relY <= rect.y + rect.height + BUFFER) {
                isOverClickable = true;
                break;
            }
        }
        if (isOverClickable) {
            if (!currentIgnoreState)
                return; // already receiving events
            mainWindow.setIgnoreMouseEvents(false);
            currentIgnoreState = false;
        }
        else {
            if (currentIgnoreState)
                return; // already ignoring
            mainWindow.setIgnoreMouseEvents(true, { forward: true });
            currentIgnoreState = true;
        }
    }, 50);
}
app.whenReady().then(function () {
    var _a;
    if (process.platform === 'darwin') {
        app.setActivationPolicy('regular');
        (_a = app.dock) === null || _a === void 0 ? void 0 : _a.show();
    }
    registerIpcHandlers();
    registerGlobalShortcuts();
    createWindow();
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-available', function (info) {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('update-available', info);
    });
    autoUpdater.on('update-downloaded', function (info) {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('update-downloaded', info);
    });
    autoUpdater.checkForUpdatesAndNotify().catch(function (err) {
        console.error('Failed to check for updates:', err);
    });
    app.on('activate', function () {
        var _a;
        if (process.platform === 'darwin') {
            app.setActivationPolicy('regular');
            (_a = app.dock) === null || _a === void 0 ? void 0 : _a.show();
        }
        if (BrowserWindow.getAllWindows().length === 0 || !mainWindow) {
            createWindow();
        }
        else {
            mainWindow.show();
        }
    });
});
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('will-quit', function () {
    globalShortcut.unregisterAll();
});
