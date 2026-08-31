// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { matchesShortcut, isTextInput } from '../src/utils/shortcuts';

describe('Shortcut Manager', () => {
  it('correctly identifies text inputs', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const div = document.createElement('div');
    const editableDiv = document.createElement('div');
    editableDiv.contentEditable = 'true';

    expect(isTextInput(input)).toBe(true);
    expect(isTextInput(textarea)).toBe(true);
    expect(isTextInput(div)).toBe(false);
    // Note: jsdom doesn't fully implement isContentEditable reliably in all old versions, but we assume true for test if set.
    expect(isTextInput(editableDiv)).toBe(true);
  });

  it('matches single key shortcuts', () => {
    const e = new KeyboardEvent('keydown', { key: 'p' });
    expect(matchesShortcut(e, 'P')).toBe(true);
    expect(matchesShortcut(e, 'H')).toBe(false);
  });

  it('matches modifier shortcuts', () => {
    // CmdOrCtrl+Z
    const e1 = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    expect(matchesShortcut(e1, 'CmdOrCtrl+Z')).toBe(true);

    // CmdOrCtrl+Shift+Z
    const e2 = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(e2, 'CmdOrCtrl+Shift+Z')).toBe(true);
    expect(matchesShortcut(e2, 'CmdOrCtrl+Z')).toBe(false); // Should not match because shift is pressed
  });

  it('matches delete/backspace interchangeably for clear actions', () => {
    const e = new KeyboardEvent('keydown', { key: 'Backspace' });
    expect(matchesShortcut(e, 'Backspace')).toBe(true);
    
    const e2 = new KeyboardEvent('keydown', { key: 'Delete' });
    expect(matchesShortcut(e2, 'Backspace')).toBe(true);
  });

  it('ignores shortcuts in text inputs', () => {
    const input = document.createElement('input');
    const e = new KeyboardEvent('keydown', { key: 'p' });
    Object.defineProperty(e, 'target', { value: input, enumerable: true });
    
    expect(matchesShortcut(e, 'P')).toBe(false);
  });
});
