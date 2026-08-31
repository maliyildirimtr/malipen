/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
    updateInteractionState: (state: any) => void;
    onShortcut: (callback: (action: string) => void) => void;
    captureScreen: () => Promise<Uint8Array>;
    saveImage: (buffer: Uint8Array, format: string, savePath?: string) => Promise<boolean>;
    copyToClipboard: (buffer: Uint8Array) => Promise<boolean>;
    loadSettings: () => Promise<any>;
    saveSettings: (settings: any) => Promise<void>;
    selectFolder: () => Promise<string | null>;
    selectImage: () => Promise<string | null>;
    getDisplays: () => Promise<Array<{id: number, bounds: any}>>;
    setOpenAtLogin: (openAtLogin: boolean) => Promise<void>;
  };
}
