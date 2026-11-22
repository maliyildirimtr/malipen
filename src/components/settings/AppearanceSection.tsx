import React, { useMemo } from 'react';
import { ACCENT_PRESETS, ThemeMode, buildTheme, toneScale, TONE_STEPS } from '../../theme';

interface AppearanceSectionProps {
  mode: ThemeMode;
  accent: string;
  language: string;
  labels: {
    appearance: string;
    themeDark: string;
    themeLight: string;
    themeColorful: string;
    themeAccent: string;
    themeCustomColor: string;
    themeTones: string;
  };
  onChange: (next: { themeMode?: ThemeMode; themeAccent?: string }) => void;
}

/** Mini toolbar drawn with a theme's own colours, so each card previews itself. */
const ThemePreview: React.FC<{ mode: ThemeMode; accent: string }> = ({ mode, accent }) => {
  const t = useMemo(() => buildTheme({ themeMode: mode, themeAccent: accent }), [mode, accent]);
  return (
    <div className="mp-theme-preview" style={{ background: `rgb(${t.surfaceRgb})` }} aria-hidden="true">
      <span style={{ background: t.accent }} />
      <span style={{ background: t.textMuted }} />
      <span style={{ background: t.textSubtle }} />
      <span style={{ background: t.brand }} />
    </div>
  );
};

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({ mode, accent, language, labels, onChange }) => {
  const isEn = language === 'English';
  const tones = useMemo(() => toneScale(accent), [accent]);
  const cards: { id: ThemeMode; label: string }[] = [
    { id: 'dark', label: labels.themeDark },
    { id: 'light', label: labels.themeLight },
    { id: 'colorful', label: labels.themeColorful },
  ];

  return (
    <div>
      <div className="epic-section-title">{labels.appearance}</div>

      <div className="mp-theme-grid" role="radiogroup" aria-label={labels.appearance}>
        {cards.map(card => (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={mode === card.id}
            className={`mp-theme-card ${mode === card.id ? 'active' : ''}`}
            onClick={() => onChange({ themeMode: card.id })}
          >
            <ThemePreview mode={card.id} accent={accent} />
            <span>{card.label}</span>
          </button>
        ))}
      </div>

      {mode === 'colorful' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--mp-text-muted)', fontWeight: 600 }}>{labels.themeAccent}</div>
          <div className="mp-palette" role="radiogroup" aria-label={labels.themeAccent}>
            {ACCENT_PRESETS.map(p => (
              <button
                key={p.color}
                type="button"
                role="radio"
                aria-checked={accent.toLowerCase() === p.color}
                aria-label={isEn ? p.en : p.tr}
                title={isEn ? p.en : p.tr}
                className={`mp-swatch ${accent.toLowerCase() === p.color ? 'active' : ''}`}
                style={{ background: p.color }}
                onClick={() => onChange({ themeAccent: p.color })}
              />
            ))}
          </div>

          <label className="mp-custom-color">
            <input type="color" value={accent} onChange={(e) => onChange({ themeAccent: e.target.value })} />
            <span>{labels.themeCustomColor}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'monospace', color: 'var(--mp-text-muted)' }}>{accent.toUpperCase()}</span>
          </label>

          {/* The generated tone scale: 50 (lightest) … 950 (darkest), the chosen colour in the middle */}
          <div className="mp-tone-strip" aria-hidden="true">
            {TONE_STEPS.map(step => <span key={step} style={{ background: tones[step] }} title={`${step}: ${tones[step]}`} />)}
          </div>
          <div className="mp-tone-caption">{labels.themeTones}</div>
        </>
      )}
    </div>
  );
};
