/**
 * Small colour toolkit used by the theme engine. Pure functions, no DOM access,
 * so they can be unit-tested and reused (e.g. by future export/print themes).
 */

export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number } // h: 0-360, s/l: 0-1

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Accepts #rgb, #rrggbb (case-insensitive). Returns null for anything else. */
export const parseHex = (hex: string): RGB | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
};

export const toHex = ({ r, g, b }: RGB): string =>
  '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

/** "r, g, b" — for use inside rgba(var(--token-rgb), alpha) in CSS. */
export const toRgbTriplet = ({ r, g, b }: RGB): string => `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;

export const rgbToHsl = ({ r, g, b }: RGB): HSL => {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
};

export const hslToRgb = ({ h, s, l }: HSL): RGB => {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp(s), ln = clamp(l);
  if (sn === 0) return { r: ln * 255, g: ln * 255, b: ln * 255 };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return { r: hue(hn + 1 / 3) * 255, g: hue(hn) * 255, b: hue(hn - 1 / 3) * 255 };
};

export const hsl = (h: number, s: number, l: number): RGB => hslToRgb({ h, s, l });

/** WCAG relative luminance (0 = black, 1 = white). */
export const luminance = ({ r, g, b }: RGB): number => {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};

/** WCAG contrast ratio between two colours (1–21). */
export const contrastRatio = (a: RGB, b: RGB): number => {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

/** Black or white text, whichever reads better on the given background. */
export const readableOn = (bg: RGB): RGB => {
  const white = { r: 255, g: 255, b: 255 };
  const ink = { r: 17, g: 17, b: 20 };
  return contrastRatio(bg, white) >= contrastRatio(bg, ink) ? white : ink;
};

export type ToneStep = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
export const TONE_STEPS: ToneStep[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * Where each step sits between the base colour (0) and the lightest (-1) or
 * darkest (+1) tone. Relative positions keep the scale monotonic for ANY base:
 * a dark navy and a pale yellow both get a full, evenly spaced ramp.
 */
const TONE_POSITION: Record<ToneStep, number> = {
  50: -1, 100: -0.86, 200: -0.66, 300: -0.45, 400: -0.22, 500: 0, 600: 0.2, 700: 0.4, 800: 0.58, 900: 0.76, 950: 0.9,
};
const LIGHTEST = 0.97;
const DARKEST = 0.07;

/**
 * A full tonal scale (50 = lightest … 950 = darkest) built around one base colour.
 * The user's exact colour is step 500; hue is kept, and saturation eases off towards
 * the extremes so very light/dark tones stay calm.
 */
export const toneScale = (baseHex: string): Record<ToneStep, string> => {
  const base = parseHex(baseHex) || { r: 255, g: 0, b: 127 };
  const { h, s, l: baseL } = rgbToHsl(base);
  const out = {} as Record<ToneStep, string>;
  for (const step of TONE_STEPS) {
    const t = TONE_POSITION[step];
    if (t === 0) { out[step] = toHex(base); continue; }
    const l = t < 0 ? baseL + (LIGHTEST - baseL) * -t : baseL - (baseL - DARKEST) * t;
    const sat = s * (1 - 0.3 * Math.abs(t));
    out[step] = toHex(hsl(h, sat, l));
  }
  return out;
};
