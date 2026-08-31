import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    setIgnoreMouseEvents: function (ignore, options) {
        return ipcRenderer.send('set-ignore-mouse-events', ignore, options);
    },
    updateInteractionState: function (state) { return ipcRenderer.send('update-interaction-state', state); },
    onShortcut: function (callback) {
        ipcRenderer.on('shortcut-triggered', function (_event, action) { return callback(action); });
    },
    captureScreen: function () { return ipcRenderer.invoke('capture-screen'); },
    saveImage: function (buffer, format, savePath) { return ipcRenderer.invoke('save-image', { buffer: buffer, format: format, savePath: savePath }); },
    copyToClipboard: function (buffer) { return ipcRenderer.invoke('copy-to-clipboard', buffer); },
    loadSettings: function () { return ipcRenderer.invoke('load-settings'); },
    saveSettings: function (settings) { return ipcRenderer.invoke('save-settings', settings); },
    selectFolder: function () { return ipcRenderer.invoke('select-folder'); },
    selectImage: function () { return ipcRenderer.invoke('select-image'); },
    getDisplays: function () { return ipcRenderer.invoke('get-displays'); },
    setOpenAtLogin: function (openAtLogin) { return ipcRenderer.invoke('set-open-at-login', openAtLogin); },
    onUpdateAvailable: function (callback) {
        ipcRenderer.on('update-available', function (_event, info) { return callback(info); });
    },
    onUpdateDownloaded: function (callback) {
        ipcRenderer.on('update-downloaded', function (_event, info) { return callback(info); });
    },
    installUpdate: function () { return ipcRenderer.send('install-update'); }
});
