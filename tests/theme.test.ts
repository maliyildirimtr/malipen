import { describe, it, expect } from 'vitest';
import { buildTheme, toneScale, TONE_STEPS, parseHex, rgbToHsl, contrastRatio, themeToCssVars, CSS_VARS, ACCENT_PRESETS } from '../src/theme';

const L = (hex: string) => rgbToHsl(parseHex(hex)!).l;

describe('tone scale', () => {
  it('keeps the chosen colour as step 500 and runs light → dark', () => {
    for (const base of ['#ff007f', '#22c55e', '#eab308', '#1e3a8a', '#78716c']) {
      const tones = toneScale(base);
      expect(tones[500]).toBe(base);
      for (let i = 1; i < TONE_STEPS.length; i++) {
        expect(L(tones[TONE_STEPS[i - 1]])).toBeGreaterThan(L(tones[TONE_STEPS[i]]));
      }
    }
  });

  it('keeps the hue of the chosen colour', () => {
    const baseHue = rgbToHsl(parseHex('#22c55e')!).h;
    const tones = toneScale('#22c55e');
    for (const step of [200, 400, 700, 900] as const) {
      expect(Math.abs(rgbToHsl(parseHex(tones[step])!).h - baseHue)).toBeLessThan(6);
    }
  });
});

describe('themes', () => {
  it('every theme fills every CSS variable', () => {
    for (const mode of ['dark', 'light', 'colorful'] as const) {
      const vars = themeToCssVars(buildTheme({ themeMode: mode, themeAccent: '#ff007f' }));
      for (const name of Object.values(CSS_VARS)) {
        expect(typeof vars[name] === 'string' && vars[name].length > 0).toBe(true);
      }
      expect(vars['--mp-tone-500'].length).toBe(7);
    }
  });

  it('colourful theme is built from the chosen colour', () => {
    const t = buildTheme({ themeMode: 'colorful', themeAccent: '#22c55e' });
    expect(t.accent).toBe('#22c55e');
    expect(t.brand).toBe('#22c55e');
    // the panel is a dark shade of the same hue
    const [r, g, b] = t.surfaceRgb.split(',').map(Number);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('text on the accent stays readable for every preset colour', () => {
    for (const p of ACCENT_PRESETS) {
      const t = buildTheme({ themeMode: 'colorful', themeAccent: p.color });
      expect(contrastRatio(parseHex(t.accent)!, parseHex(t.onAccent)!)).toBeGreaterThan(3);
    }
  });

  it('main text has strong contrast on the panel in every theme', () => {
    for (const mode of ['dark', 'light', 'colorful'] as const) {
      const t = buildTheme({ themeMode: mode, themeAccent: '#a855f7' });
      const [r, g, b] = t.surfaceRgb.split(',').map(Number);
      expect(contrastRatio({ r, g, b }, parseHex(t.text)!)).toBeGreaterThan(7);
      expect(contrastRatio({ r, g, b }, parseHex(t.textMuted)!)).toBeGreaterThan(4.5);
    }
  });

  it('falls back safely for an invalid colour', () => {
    const t = buildTheme({ themeMode: 'colorful', themeAccent: 'not-a-colour' });
    expect(parseHex(t.accent)).not.toBeNull();
  });
});
