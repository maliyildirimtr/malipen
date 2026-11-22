export type BgPattern = { type: 'none' | 'lines' | 'grid' | 'dots'; spacing: number; opacity: number };
export type BoardMode = 'screen' | 'whiteboard' | 'blackboard';

export const BOARD_BACKGROUND: Record<Exclude<BoardMode, 'screen'>, string> = {
  whiteboard: '#ffffff',
  blackboard: '#1e1e1e',
};

/** Pattern spacing is set in millimetres; 96 CSS px per inch. */
export const patternSpacingPx = (pattern: BgPattern) => Math.max(2, Math.round(pattern.spacing * (96 / 25.4)));

export const patternLineColor = (pattern: BgPattern, mode: Exclude<BoardMode, 'screen'>) =>
  mode === 'whiteboard' ? `rgba(0,0,0,${pattern.opacity})` : `rgba(255,255,255,${pattern.opacity})`;

/**
 * Paints a board (background colour + line/grid/dot pattern) onto a canvas in CSS
 * pixels, matching what BoardPatternOverlay shows on screen. Used for screenshots.
 */
export const paintBoard = (
  ctx: CanvasRenderingContext2D,
  mode: Exclude<BoardMode, 'screen'>,
  pattern: BgPattern,
  width: number,
  height: number
) => {
  ctx.fillStyle = BOARD_BACKGROUND[mode];
  ctx.fillRect(0, 0, width, height);
  if (pattern.type === 'none') return;

  const s = patternSpacingPx(pattern);
  const color = patternLineColor(pattern, mode);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  if (pattern.type === 'lines' || pattern.type === 'grid') {
    ctx.beginPath();
    for (let y = s; y <= height; y += s) {
      ctx.moveTo(0, y - 0.5);
      ctx.lineTo(width, y - 0.5);
    }
    if (pattern.type === 'grid') {
      for (let x = s; x <= width; x += s) {
        ctx.moveTo(x - 0.5, 0);
        ctx.lineTo(x - 0.5, height);
      }
    }
    ctx.stroke();
  } else {
    for (let y = s / 2; y < height; y += s) {
      for (let x = s / 2; x < width; x += s) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
};
