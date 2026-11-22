import { parseHex, toHex, toRgbTriplet, rgbToHsl, hsl, readableOn, toneScale, RGB } from './color';

export type ThemeMode = 'dark' | 'light' | 'colorful';

/**
 * Every colour the UI uses, by ROLE (not by look). Components only ever reference
 * these roles (as CSS variables, see applyTheme.ts), so adding a theme = adding one
 * function that fills this object. Nothing else needs to change.
 *
 * `*Rgb` values are "r, g, b" triplets for translucent use: rgba(var(--mp-fg-rgb), 0.1).
 */
export interface ThemeTokens {
  /** Panels, toolbar, popovers (used with transparency) */
  surfaceRgb: string;
  /** Opaque panel colour (dropdown lists, solid backgrounds) */
  surfaceSolid: string;
  /** Foreground used for hover fills, borders and dividers (with transparency) */
  fgRgb: string;
  /** Text */
  text: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  /** Main accent: active tool, primary buttons, sliders, selection */
  accent: string;
  accentRgb: string;
  accentStrong: string;   // hover / pressed
  accentLight: string;    // borders around accent fills
  accentText: string;     // accent-coloured text on the surface
  onAccent: string;       // text/icons placed ON the accent
  /** Selected tool in the toolbar (neutral in dark/light, accent-tinted in colourful) */
  activeBg: string;
  activeFg: string;
  /** Brand highlight (lock button, laser icon) */
  brand: string;
  brandRgb: string;
  danger: string;
  dangerRgb: string;
  shadowRgb: string;
  /** Native controls (scrollbars, date pickers) */
  colorScheme: 'dark' | 'light';
  /** Tonal scale of the accent, exposed for future components */
  tones: Record<string, string>;
}

export interface ThemeSettings {
  themeMode: ThemeMode;
  themeAccent: string;
}

export const DEFAULT_ACCENT = '#ff007f';

/** Ready-made accent choices shown in the palette (any colour can still be picked). */
export const ACCENT_PRESETS: { color: string; tr: string; en: string }[] = [
  { color: '#ff007f', tr: 'Mali Pembe', en: 'Mali Pink' },
  { color: '#ef4444', tr: 'Kırmızı', en: 'Red' },
  { color: '#f97316', tr: 'Turuncu', en: 'Orange' },
  { color: '#eab308', tr: 'Sarı', en: 'Yellow' },
  { color: '#22c55e', tr: 'Yeşil', en: 'Green' },
  { color: '#14b8a6', tr: 'Turkuaz', en: 'Teal' },
  { color: '#0ea5e9', tr: 'Gök Mavisi', en: 'Sky' },
  { color: '#3b82f6', tr: 'Mavi', en: 'Blue' },
  { color: '#6366f1', tr: 'Çivit', en: 'Indigo' },
  { color: '#a855f7', tr: 'Mor', en: 'Purple' },
  { color: '#ec4899', tr: 'Pembe', en: 'Pink' },
  { color: '#78716c', tr: 'Taş', en: 'Stone' },
];

const rgbOf = (hex: string, fallback: RGB) => parseHex(hex) || fallback;

const darkTheme = (): ThemeTokens => ({
  surfaceRgb: '20, 20, 20',
  surfaceSolid: '#191919',
  fgRgb: '255, 255, 255',
  text: '#ffffff',
  textSecondary: '#e4e4e7',
  textMuted: '#a1a1aa',
  textSubtle: '#71717a',
  accent: '#3b82f6',
  accentRgb: '59, 130, 246',
  accentStrong: '#2563eb',
  accentLight: '#60a5fa',
  accentText: '#93c5fd',
  onAccent: '#ffffff',
  activeBg: 'rgba(255, 255, 255, 0.15)',
  activeFg: '#ffffff',
  brand: '#ff007f',
  brandRgb: '255, 0, 127',
  danger: '#ef4444',
  dangerRgb: '239, 68, 68',
  shadowRgb: '0, 0, 0',
  colorScheme: 'dark',
  tones: toneScale('#3b82f6'),
});

const lightTheme = (): ThemeTokens => ({
  surfaceRgb: '250, 250, 252',
  surfaceSolid: '#ffffff',
  fgRgb: '24, 24, 27',
  text: '#18181b',
  textSecondary: '#3f3f46',
  textMuted: '#52525b',
  textSubtle: '#a1a1aa',
  accent: '#2563eb',
  accentRgb: '37, 99, 235',
  accentStrong: '#1d4ed8',
  accentLight: '#3b82f6',
  accentText: '#1d4ed8',
  onAccent: '#ffffff',
  activeBg: 'rgba(24, 24, 27, 0.1)',
  activeFg: '#18181b',
  brand: '#e11d74',
  brandRgb: '225, 29, 116',
  danger: '#dc2626',
  dangerRgb: '220, 38, 38',
  shadowRgb: '15, 23, 42',
  colorScheme: 'light',
  tones: toneScale('#2563eb'),
});

/**
 * Colourful theme: the chosen colour is the main colour, and every other role is a
 * tone of it — the panel is a very dark shade of the same hue, text and dividers are
 * tinted with it, hover/borders use lighter tones.
 */
const colorfulTheme = (accentHex: string): ThemeTokens => {
  const accent = rgbOf(accentHex, { r: 255, g: 0, b: 127 });
  const { h, s } = rgbToHsl(accent);
  // Greys (very low saturation) get a neutral-ish panel instead of a muddy tint
  const tint = Math.min(s, 0.45);
  const tones = toneScale(toHex(accent));
  const surface = hsl(h, tint * 0.9, 0.1);
  const fg = hsl(h, tint * 0.6, 0.96);
  return {
    surfaceRgb: toRgbTriplet(surface),
    surfaceSolid: toHex(hsl(h, tint * 0.9, 0.12)),
    fgRgb: toRgbTriplet(fg),
    text: toHex(hsl(h, tint * 0.5, 0.97)),
    textSecondary: toHex(hsl(h, tint * 0.55, 0.88)),
    textMuted: toHex(hsl(h, tint * 0.5, 0.72)),
    textSubtle: toHex(hsl(h, tint * 0.4, 0.55)),
    accent: toHex(accent),
    accentRgb: toRgbTriplet(accent),
    accentStrong: tones[600],
    accentLight: tones[400],
    accentText: tones[300],
    onAccent: toHex(readableOn(accent)),
    activeBg: `rgba(${toRgbTriplet(accent)}, 0.28)`,
    activeFg: tones[100],
    brand: toHex(accent),
    brandRgb: toRgbTriplet(accent),
    danger: '#ef4444',
    dangerRgb: '239, 68, 68',
    shadowRgb: toRgbTriplet(hsl(h, tint, 0.04)),
    colorScheme: 'dark',
    tones,
  };
};

/** Single entry point: settings in, complete token set out. */
export const buildTheme = ({ themeMode, themeAccent }: ThemeSettings): ThemeTokens => {
  switch (themeMode) {
    case 'light': return lightTheme();
    case 'colorful': return colorfulTheme(themeAccent || DEFAULT_ACCENT);
    case 'dark':
    default: return darkTheme();
  }
};
