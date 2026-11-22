import { useEffect, useMemo } from 'react';
import { buildTheme, ThemeSettings, ThemeTokens } from './themes';
import { applyTheme } from './applyTheme';

export * from './color';
export * from './themes';
export * from './applyTheme';

/**
 * Builds the token set for the current settings and applies it to the document.
 * Returns the tokens for the few places that need real colour values in JS
 * (e.g. canvas selection outlines, which cannot read CSS variables).
 */
export const useTheme = ({ themeMode, themeAccent }: ThemeSettings): ThemeTokens => {
  const tokens = useMemo(() => buildTheme({ themeMode, themeAccent }), [themeMode, themeAccent]);
  useEffect(() => { applyTheme(tokens, themeMode); }, [tokens, themeMode]);
  return tokens;
};
