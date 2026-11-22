/// <reference types="vite/client" />

/** Version from package.json, injected by vite.config.ts */
declare const __APP_VERSION__: string;

type Unsubscribe = () => void;

interface ElectronAPI {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  updateInteractionState: (state: { shouldIgnoreBase: boolean; clickableRects: { x: number; y: number; width: number; height: number }[] }) => void;
  onShortcut: (callback: (action: string) => void) => Unsubscribe;
  /** Data URL of the screen behind the overlay, cropped to the overlay window. */
  captureScreen: () => Promise<string | null>;
  /** Returns the saved file path, or null if the user cancelled. */
  saveImage: (buffer: Uint8Array, format: 'png' | 'jpeg') => Promise<string | null>;
  showItemInFolder: (filePath: string) => Promise<void>;
  copyToClipboard: (buffer: Uint8Array) => Promise<boolean>;
  loadSettings: () => Promise<Record<string, unknown> | null>;
  saveSettings: (settings: unknown) => Promise<void>;
  getDefaultPaths: () => Promise<{ desktop: string }>;
  registerShortcuts: (map: Record<string, string>) => Promise<{ registered: string[]; failed: string[] }>;
  selectFolder: () => Promise<string | null>;
  selectImage: () => Promise<string | null>;
  getDisplays: () => Promise<Array<{ id: number; bounds: { x: number; y: number; width: number; height: number } }>>;
  setOpenAtLogin: (openAtLogin: boolean) => Promise<void>;
  hideWindow: () => void;
  quitApp: () => void;
  onUpdateAvailable: (callback: (info: { version?: string }) => void) => Unsubscribe;
  onUpdateDownloaded: (callback: (info: { version?: string }) => void) => Unsubscribe;
  installUpdate: () => void;
}

interface Window {
  /** Undefined when the UI runs in a plain browser (vite dev without Electron). */
  electronAPI?: ElectronAPI;
}
