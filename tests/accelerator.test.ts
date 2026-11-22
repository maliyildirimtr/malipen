import { describe, it, expect } from 'vitest';
import { toElectronAccelerator, hasModifier } from '../src/utils/accelerator';

describe('global shortcut conversion (H6)', () => {
  it('converts stored formats to Electron accelerators', () => {
    expect(toElectronAccelerator('Ctrl+Shift+3')).toBe('Control+Shift+3');
    expect(toElectronAccelerator('CmdOrCtrl+Shift+Y')).toBe('CommandOrControl+Shift+Y');
    expect(toElectronAccelerator('Ctrl + Shift + A')).toBe('Control+Shift+A');
    expect(toElectronAccelerator('Cmd + Alt + SPACE')).toBe('Command+Alt+Space');
    expect(toElectronAccelerator('Shift + Ctrl + PrintScreen')).toBe('Control+Shift+PrintScreen');
    expect(toElectronAccelerator('Ctrl+Shift+]')).toBe('Control+Shift+]');
    expect(toElectronAccelerator('Alt + F5')).toBe('Alt+F5');
    expect(toElectronAccelerator('Ctrl++')).toBe('Control+Plus');
  });

  it('never registers bare keys system-wide', () => {
    expect(toElectronAccelerator('T')).toBeNull();
    expect(toElectronAccelerator('Backspace')).toBeNull();
    expect(hasModifier('T')).toBe(false);
  });

  it('keeps chords and unknown keys local', () => {
    expect(toElectronAccelerator('Ctrl + S + 1')).toBeNull();
    expect(toElectronAccelerator('Ctrl + Shift')).toBeNull();
    expect(toElectronAccelerator('Ctrl + Ğ')).toBeNull();
    expect(toElectronAccelerator('')).toBeNull();
  });
});
