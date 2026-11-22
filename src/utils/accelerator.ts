/**
 * Converts MaliPen's stored shortcut strings ("CmdOrCtrl+Shift+3", "Ctrl + Shift + A",
 * "Cmd + Alt + SPACE") into Electron accelerators ("CommandOrControl+Shift+3").
 *
 * Returns null when the shortcut must NOT be registered globally:
 *  - it has no modifier (a bare "T" or "Backspace" would hijack typing in every app),
 *  - it is a chord of several non-modifier keys ("S + 1"), which Electron cannot express,
 *  - it is empty or uses a key Electron does not know.
 * Such shortcuts keep working inside MaliPen's own window (see utils/shortcuts.ts).
 *
 * Pure function: shared by the main process and the unit tests.
 */
const MODIFIERS: Record<string, string> = {
  cmdorctrl: 'CommandOrControl',
  commandorcontrol: 'CommandOrControl',
  cmd: 'Command',
  command: 'Command',
  meta: 'Command',
  ctrl: 'Control',
  control: 'Control',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
};

const KEY_NAMES: Record<string, string> = {
  space: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  escape: 'Escape',
  esc: 'Escape',
  printscreen: 'PrintScreen',
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
  '+': 'Plus',
  plus: 'Plus',
};

const SYMBOLS = new Set([')', '!', '@', '#', '$', '%', '^', '&', '*', '(', ':', ';', '<', '=', '>', '?', '_', '-', '.', ',', '/', '`', '~', '[', '{', ']', '}', '|', '\\', "'", '"']);

export const splitShortcut = (shortcut: string): string[] => {
  const s = (shortcut || '').trim();
  if (!s) return [];
  // "Ctrl++" or "Ctrl + +" -> the last key is a literal plus
  let parts: string[];
  if (/\+\s*\+$/.test(s)) {
    parts = s.replace(/\+\s*\+$/, '').split('+');
    parts.push('+');
  } else {
    parts = s.split('+');
  }
  return parts.map(p => p.trim()).filter(p => p !== '');
};

export const hasModifier = (shortcut: string): boolean =>
  splitShortcut(shortcut).some(p => MODIFIERS[p.toLowerCase()] !== undefined);

export const toElectronAccelerator = (shortcut: string): string | null => {
  const parts = splitShortcut(shortcut);
  if (parts.length === 0) return null;

  const mods: string[] = [];
  const keys: string[] = [];
  for (const raw of parts) {
    const lower = raw.toLowerCase();
    const mod = MODIFIERS[lower];
    if (mod) {
      if (!mods.includes(mod)) mods.push(mod);
      continue;
    }
    let key: string | null = null;
    if (KEY_NAMES[lower]) key = KEY_NAMES[lower];
    else if (/^[a-z0-9]$/i.test(raw)) key = raw.toUpperCase();
    else if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(raw)) key = raw.toUpperCase();
    else if (raw.length === 1 && SYMBOLS.has(raw)) key = raw;
    if (!key) return null; // unknown key name
    keys.push(key);
  }

  if (mods.length === 0) return null; // never hijack bare keys system-wide
  if (keys.length !== 1) return null; // chords / modifier-only are local only

  // Stable order Electron expects: modifiers first
  const order = ['CommandOrControl', 'Command', 'Control', 'Alt', 'Shift'];
  mods.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return [...mods, keys[0]].join('+');
};
