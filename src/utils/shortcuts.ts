export const isMac = navigator.userAgent.toLowerCase().includes('mac');

export const isTextInput = (target: EventTarget | null): boolean => {
  if (!target) return false;
  const el = target as HTMLElement;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return false;
};

// Global set of currently pressed keys (normalized)
export const activeKeys = new Set<string>();

export const getNormalizedKey = (e: KeyboardEvent): string => {
  let codeKey = e.code.toLowerCase();
  if (codeKey.startsWith('key')) codeKey = codeKey.replace('key', '');
  if (codeKey.startsWith('digit')) codeKey = codeKey.replace('digit', '');
  if (codeKey === 'space') return 'space';
  
  // Fallback to e.key if it's not a standard alpha-numeric (e.g., symbols)
  let eventKey = e.key.toLowerCase();
  if (eventKey === 'delete') return 'backspace';
  if (e.key === 'Backspace' || e.key === 'Delete') return 'backspace';
  
  return codeKey || eventKey;
};

// Advanced parsing: 'CmdOrCtrl+S+1'
export const matchesShortcut = (e: KeyboardEvent, shortcut: string): boolean => {
  if (isTextInput(e.target) || !shortcut) return false;

  let s = shortcut.toLowerCase();
  let parts: string[] = [];
  
  if (s.endsWith('++')) {
    parts = s.slice(0, -2).split('+');
    parts.push('+');
  } else {
    parts = s.split('+');
  }
  
  parts = parts.map(p => p.trim()).filter(p => p !== '');
  if (parts.length === 0) return false;
  
  const requiresCmd = parts.includes('cmd') || (parts.includes('cmdorctrl') && isMac);
  const requiresCtrl = parts.includes('ctrl') || (parts.includes('cmdorctrl') && !isMac);
  const requiresShift = parts.includes('shift');
  const requiresAlt = parts.includes('alt');
  
  // Check modifiers strictly!
  if (requiresCmd !== e.metaKey) return false;
  if (requiresCtrl !== e.ctrlKey) return false;
  if (requiresShift !== e.shiftKey) return false;
  if (requiresAlt !== e.altKey) return false;

  // Extract non-modifier keys
  const nonModifiers = parts.filter(p => !['cmd', 'ctrl', 'cmdorctrl', 'shift', 'alt'].includes(p));
  
  if (nonModifiers.length === 0) return false;

  // For a match, EVERY non-modifier key must currently be in the activeKeys set.
  // We also ensure that the key that triggered THIS event is one of the non-modifiers,
  // or it's a modifier itself.
  for (const key of nonModifiers) {
    if (!activeKeys.has(key)) {
      // Special check: sometimes e.key is what was saved instead of e.code
      let normalizedEventKey = e.key.toLowerCase();
      if (normalizedEventKey === 'delete') normalizedEventKey = 'backspace';
      if (key !== normalizedEventKey && !activeKeys.has(key)) {
         return false;
      }
    }
  }

  // To prevent 'S' from matching when the user presses 'S + 1', we check if activeKeys 
  // has MORE non-modifier keys pressed than the shortcut requires.
  // However, because we only know about non-modifiers, we can just check length.
  let currentNonModifierCount = 0;
  activeKeys.forEach(k => {
    if (!['meta', 'control', 'shift', 'alt'].includes(k)) {
      currentNonModifierCount++;
    }
  });

  // If the user is holding down 2 standard keys (S and 1), but the shortcut only asks for 'S',
  // we SHOULD NOT trigger 'S'. We only trigger if the count perfectly matches.
  if (currentNonModifierCount > nonModifiers.length) return false;

  return true;
};
