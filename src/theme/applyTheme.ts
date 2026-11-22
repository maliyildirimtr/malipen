import { ThemeTokens } from './themes';

/**
 * Token → CSS custom property name. App.css and inline styles use ONLY these
 * variables (var(--mp-accent), rgba(var(--mp-fg-rgb), 0.1), …), never raw colours.
 */
export const CSS_VARS: Record<Exclude<keyof ThemeTokens, 'tones' | 'colorScheme'>, string> = {
  surfaceRgb: '--mp-surface-rgb',
  surfaceSolid: '--mp-surface-solid',
  fgRgb: '--mp-fg-rgb',
  text: '--mp-text',
  textSecondary: '--mp-text-secondary',
  textMuted: '--mp-text-muted',
  textSubtle: '--mp-text-subtle',
  accent: '--mp-accent',
  accentRgb: '--mp-accent-rgb',
  accentStrong: '--mp-accent-strong',
  accentLight: '--mp-accent-light',
  accentText: '--mp-accent-text',
  onAccent: '--mp-on-accent',
  activeBg: '--mp-active-bg',
  activeFg: '--mp-active-fg',
  brand: '--mp-brand',
  brandRgb: '--mp-brand-rgb',
  danger: '--mp-danger',
  dangerRgb: '--mp-danger-rgb',
  shadowRgb: '--mp-shadow-rgb',
};

/** All variables (including --mp-tone-50 … --mp-tone-950) as a plain object. */
export const themeToCssVars = (tokens: ThemeTokens): Record<string, string> => {
  const vars: Record<string, string> = {};
  (Object.keys(CSS_VARS) as (keyof typeof CSS_VARS)[]).forEach(key => {
    vars[CSS_VARS[key]] = tokens[key];
  });
  Object.entries(tokens.tones).forEach(([step, value]) => { vars[`--mp-tone-${step}`] = value; });
  return vars;
};

/** Writes the theme onto <html>; every component re-colours instantly via CSS. */
export const applyTheme = (tokens: ThemeTokens, mode: string, root: HTMLElement = document.documentElement) => {
  const vars = themeToCssVars(tokens);
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
  root.style.colorScheme = tokens.colorScheme;
  root.dataset.theme = mode;
};
