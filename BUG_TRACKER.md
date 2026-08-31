# Bug Tracker

## Fixed in Phase 5 Hardening
- **Bug**: `vitest` startup failure on macOS due to `rolldown` native binding missing. **Fix**: Downgraded test suite to `vitest@1.6.0` to restore stability.
- **Bug**: `captureScreen` IPC hardcoded to primary monitor. **Fix**: Now queries `screen.getDisplayMatching(mainWindow.getBounds())` to target the active monitor.
- **Bug**: Missing error handling in `App.tsx` async capture chain. **Fix**: Implemented full try/catch blocks with state resets.
- **Bug**: Shapes and Capture buttons did not open their popovers. **Fix**: Removed `overflow: hidden` from `.toolbar` container in `App.css` which was mathematically clipping the absolute-positioned child popovers out of existence. Added border-radius directly to the drag handle instead.
- **Bug**: Capture region selection ignored physical pointer events (passed through to desktop). **Fix**: (1) Rewrote `setIgnoreMouseEvents` architecture to use reactive `useEffect`. (2) Explicitly re-asserted `setIgnoreMouseEvents(false)` after `captureScreen` IPC because macOS `mainWindow.hide()`/`show()` resets the native hit-testing state. (3) Added `backgroundColor: 'rgba(255, 255, 255, 0.01)'` to `CaptureOverlay` because macOS Window Server ignores clicks on transparent Electron windows even if `backgroundImage` is set.


| ID | Description | Severity | Root Cause | Fix | Verification |
|---|---|---|---|---|---|
| BUG-001 | Single-click dot was not drawn on canvas | Medium | In `drawStroke`, if `stroke.points.length === 1`, only `moveTo` was called without `lineTo`, producing no stroke | Added single-point handling with `lineTo(p.x + 0.1, p.y + 0.1)` | Verified in drawing engine unit tests |
| BUG-002 | Highlighter blend mode `multiply` ineffective on transparent background | Medium | `multiply` blend on `rgba(0,0,0,0)` produces transparent or dark artifacts on transparent window canvas | Switched highlighter to `source-over` with `globalAlpha = 0.35` and increased stroke width multiplier | Verified in unit test & canvas draw model |
| BUG-003 | Electron `npm install` post-install failed due to network reset (`ECONNRESET`) | High | Large binary download dropped by network TLS connection | Added `.npmrc` mirror and background `curl` installer bypassing npm post-install | FIXED (Manual curl resume script) |
| BUG-004 | Electron startup crashed with `ENOENT` for binary spawn | High | Manual `echo` into `path.txt` added a `\n` newline character at the end of the binary path, preventing Node from resolving the executable | Replaced `echo` with `printf` to write the `path.txt` exactly without trailing newlines | Verified (App launched without crash) |
| BUG-005 | `App.tsx` failed `vite build` due to unused variables | Low | Unused lucide icons imported for future phases | Removed unused imports and corrected TypeScript interfaces | Verified (`tsc && vite build` succeeded) |
| BUG-006 | React state rendering latency on mouse move | High | Pushing new points to React state inside `onMouseMove` caused continuous heavy re-renders while drawing | Refactored active strokes to `useRef` and mapped `pointerMove` to a direct native `requestAnimationFrame` loop on a 2D Canvas context | Verified in Phase 2 implementation |
| BUG-007 | `drawing_engine.test.ts` TypeScript type narrowing error | Low | Type narrowing on array length caused TS to complain when comparing `strokes.length !== 2` | Casted length bounds using `as number` to bypass static analyzer limits | Tests passing |
