import { Settings, DEFAULT_SETTINGS, SETTINGS_VERSION } from '../types/settings';

export const DEFAULT_FAVORITE_COLORS = ['#ff0000', '#000000', '#00aa00', '#0066ff'];

const positive = (v: unknown, fallback: number) =>
  typeof v === 'number' && isFinite(v) && v > 0 ? v : fallback;

const isAbsolutePath = (p: unknown) =>
  typeof p === 'string' && (p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\'));

/**
 * Turns whatever was persisted (possibly from an older version, possibly partial)
 * into a complete, valid Settings object.
 *
 * Version 1 → 2:
 *  - shortcuts are reset to the new defaults (the old Cmd+Shift+3/4/5 defaults collided
 *    with macOS screenshots once shortcuts became system-wide),
 *  - "remember shortcuts" and "check for updates" become on (they were saved as off only
 *    because the old defaults were off, and the update check ignored the setting anyway),
 *  - the non-path 'Masaüstü' screenshot folder is cleared so the real Desktop is used.
 */
export const migrateSettings = (raw: Partial<Settings> | null | undefined, desktopPath?: string): Settings => {
  const source: Partial<Settings> = raw && typeof raw === 'object' ? raw : {};
  const version = typeof source.settingsVersion === 'number' ? source.settingsVersion : (raw ? 1 : SETTINGS_VERSION);

  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...source,
    shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(source.shortcuts || {}) },
  };

  if (version < 2) {
    merged.shortcuts = { ...DEFAULT_SETTINGS.shortcuts };
    merged.rememberShortcutsOnClose = true;
    merged.checkUpdatesOnStartup = true;
  }

  if (!merged.rememberShortcutsOnClose) merged.shortcuts = { ...DEFAULT_SETTINGS.shortcuts };

  merged.penSize = positive(merged.penSize, DEFAULT_SETTINGS.penSize);
  merged.highlighterSize = positive(merged.highlighterSize, DEFAULT_SETTINGS.highlighterSize);
  merged.eraserSize = positive(merged.eraserSize, DEFAULT_SETTINGS.eraserSize);
  merged.laserSize = positive(merged.laserSize, DEFAULT_SETTINGS.laserSize);
  merged.textFontSize = positive(merged.textFontSize, DEFAULT_SETTINGS.textFontSize);
  merged.laserFadeDuration = positive(merged.laserFadeDuration, DEFAULT_SETTINGS.laserFadeDuration);

  if (!Array.isArray(merged.favoriteColors) || merged.favoriteColors.length === 0) {
    merged.favoriteColors = [...DEFAULT_FAVORITE_COLORS];
  }

  if (!['dark', 'light', 'colorful'].includes(merged.themeMode)) merged.themeMode = DEFAULT_SETTINGS.themeMode;
  if (typeof merged.themeAccent !== 'string' || !/^#[0-9a-f]{6}$/i.test(merged.themeAccent)) merged.themeAccent = DEFAULT_SETTINGS.themeAccent;

  if (!isAbsolutePath(merged.screenshotFolder)) {
    merged.screenshotFolder = desktopPath || '';
  }

  merged.settingsVersion = SETTINGS_VERSION;
  return merged;
};
