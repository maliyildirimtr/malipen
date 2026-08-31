import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => 
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  updateInteractionState: (state: any) => ipcRenderer.send('update-interaction-state', state),
  onShortcut: (callback: (action: string) => void) => {
    ipcRenderer.on('shortcut-triggered', (_event, action) => callback(action));
  },
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  saveImage: (buffer: Uint8Array, format: string, savePath?: string) => ipcRenderer.invoke('save-image', { buffer, format, savePath }),
  copyToClipboard: (buffer: Uint8Array) => ipcRenderer.invoke('copy-to-clipboard', buffer),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  setOpenAtLogin: (openAtLogin: boolean) => ipcRenderer.invoke('set-open-at-login', openAtLogin),
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
  installUpdate: () => ipcRenderer.send('install-update')
});
