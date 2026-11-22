import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

/** Subscribes to a main-process event and returns an unsubscribe function. */
const subscribe = <T>(channel: string, callback: (payload: T) => void) => {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => { ipcRenderer.removeListener(channel, listener); };
};

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  updateInteractionState: (state: unknown) => ipcRenderer.send('update-interaction-state', state),
  onShortcut: (callback: (action: string) => void) => subscribe<string>('shortcut-triggered', callback),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  saveImage: (buffer: Uint8Array, format: string) => ipcRenderer.invoke('save-image', { buffer, format }),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),
  copyToClipboard: (buffer: Uint8Array) => ipcRenderer.invoke('copy-to-clipboard', buffer),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('save-settings', settings),
  getDefaultPaths: () => ipcRenderer.invoke('get-default-paths'),
  registerShortcuts: (map: Record<string, string>) => ipcRenderer.invoke('register-shortcuts', map),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  setOpenAtLogin: (openAtLogin: boolean) => ipcRenderer.invoke('set-open-at-login', openAtLogin),
  hideWindow: () => ipcRenderer.send('hide-window'),
  quitApp: () => ipcRenderer.send('quit-app'),
  onUpdateAvailable: (callback: (info: unknown) => void) => subscribe('update-available', callback),
  onUpdateDownloaded: (callback: (info: unknown) => void) => subscribe('update-downloaded', callback),
  installUpdate: () => ipcRenderer.send('install-update')
});
