import { describe, it, expect } from 'vitest';
import { migrateSettings } from '../src/utils/settingsMigration';
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from '../src/types/settings';

describe('settings migration (H2, H6, eksik ayarlar)', () => {
  it('fresh install gets defaults and the real Desktop folder', () => {
    const s = migrateSettings(null, '/Users/mali/Desktop');
    expect(s.screenshotFolder).toBe('/Users/mali/Desktop');
    expect(s.settingsVersion).toBe(SETTINGS_VERSION);
    expect(s.checkUpdatesOnStartup).toBe(true);
  });

  it('replaces the old non-path "Masaüstü" folder', () => {
    const s = migrateSettings({ screenshotFolder: 'Masaüstü' } as any, 'C:\\Users\\mali\\Desktop');
    expect(s.screenshotFolder).toBe('C:\\Users\\mali\\Desktop');
  });

  it('keeps a real folder the user chose', () => {
    const s = migrateSettings({ settingsVersion: 2, screenshotFolder: '/Users/mali/Pictures' } as any, '/Users/mali/Desktop');
    expect(s.screenshotFolder).toBe('/Users/mali/Pictures');
  });

  it('v1 files: shortcuts reset to the new non-conflicting defaults, updates back on', () => {
    const s = migrateSettings({ checkUpdatesOnStartup: false, rememberShortcutsOnClose: false, shortcuts: { pen: 'CmdOrCtrl+Shift+3' } } as any);
    expect(s.shortcuts.pen).toBe(DEFAULT_SETTINGS.shortcuts.pen);
    expect(s.shortcuts.pen.startsWith('CmdOrCtrl')).toBe(false);
    expect(s.checkUpdatesOnStartup).toBe(true);
    expect(s.rememberShortcutsOnClose).toBe(true);
  });

  it('v2 files keep custom shortcuts and the update choice', () => {
    const s = migrateSettings({ settingsVersion: 2, checkUpdatesOnStartup: false, rememberShortcutsOnClose: true, shortcuts: { pen: 'Alt + P' } } as any);
    expect(s.shortcuts.pen).toBe('Alt + P');
    expect(s.shortcuts.eraser).toBe(DEFAULT_SETTINGS.shortcuts.eraser);
    expect(s.checkUpdatesOnStartup).toBe(false);
  });

  it('repairs invalid sizes and empty favourites', () => {
    const s = migrateSettings({ settingsVersion: 2, penSize: -3, laserSize: NaN, favoriteColors: [] } as any);
    expect(s.penSize).toBe(DEFAULT_SETTINGS.penSize);
    expect(s.laserSize).toBe(DEFAULT_SETTINGS.laserSize);
    expect(s.favoriteColors.length).toBeGreaterThan(0);
  });
});
