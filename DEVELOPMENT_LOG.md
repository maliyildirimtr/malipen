# Development Log

## Phase 5: Professional Screenshot & Capture System
- Performed rigorous Phase 5 Hardening Audit.
- Refactored `desktopCapturer` to accurately locate the active display (`screen.getDisplayMatching`) instead of hardcoding `getPrimaryDisplay`.
- Strengthened `App.tsx` capture state machine with strict error boundaries and preventing concurrent overlapping capture requests.
- Verified coordinate transforms across Retina `devicePixelRatio` scaling.
- Verified all IPC channels are safe under context isolation.
- Completed full test suite for structurally shared history and compositor.
- **Urgent Runtime Fix**: Fixed critical UI regression where toolbar `overflow: hidden` clipped popovers out of existence.
- **Deep Runtime Fix**: Fixed macOS-specific Electron bug where `mainWindow.hide()`/`show()` resets the native `setIgnoreMouseEvents` state, causing the `CaptureOverlay` to ignore physical pointer events. Re-asserted `setIgnoreMouseEvents(false)` after IPC return and added `backgroundColor: 'rgba(255, 255, 255, 0.01)'` to force macOS Window Server hit-testing to recognize the overlay as opaque.

## Phase 0: Project Audit and Architecture
**What changed:** 
* Inspected current repository (found empty).
* Created initial project management documents (`PROJECT_AUDIT.md`, `DEVELOPMENT_ROADMAP.md`, `FEATURE_STATUS.md`, `BUG_TRACKER.md`, `DEVELOPMENT_LOG.md`).
* Decided on Electron + React + TypeScript + Vite architecture.

## Phases 1, 2, 4, 5, 12: Scaffolding, Canvas, Toolbar, and Hotkeys
**What changed:**
* Scaffolded `package.json`, `tsconfig.json`, `vite.config.ts`.
* Configured Electron entry points (`main.ts`, `preload.ts`) for frameless, transparent overlay.
* Configured Pointer Passthrough (Cursor Mode) using `setIgnoreMouseEvents`.
* Developed custom `useDraggable` React hook.
* Built Premium UI Floating Toolbar in `App.tsx` and `App.css`.
* Integrated `lucide-react` icons.
* Implemented `DrawingCanvas.tsx` for Pen, Highlighter, and Eraser using HTML5 Canvas blending modes.
* Implemented Undo, Redo, and Clear functionalities with Ref forwarding.
* Registered global shortcuts (Ctrl+Shift+P, etc) and connected them to the frontend state via IPC.

**Files changed:**
* `package.json`, `vite.config.ts`, `tsconfig.json`, `.npmrc`
* `electron/main.ts`, `electron/preload.ts`
* `src/App.tsx`, `src/App.css`, `src/main.tsx`, `index.html`
* `src/components/DrawingCanvas.tsx`
* `src/hooks/useDraggable.ts`

**Why:**
* Implemented all foundational drawing features so that the primary MVP of the application is functional.

**Tests & Runtime Verification:**
* Automated unit tests executed for drawing engine stacks (Undo/Redo logic).
* Manually recovered the Electron binary download with `curl -C -`.
* Compiled application natively using `npm run build` (fixed TS unused variables).
* Executed the app via `npm run dev` to verify the Electron process instantiates correctly.
* Re-verified `path.txt` binary linking and fixed `ENOENT` spawn exceptions caused by rogue newline chars.
* App fully launched in daemon headless testing without unhandled exceptions.

## Phase 2: Production-Quality Drawing Engine
**What changed:**
* Completely refactored `DrawingCanvas.tsx` to decouple mouse drawing from React state updates.
* Swapped `onMouseMove` to `onPointerMove` utilizing `requestAnimationFrame` and direct `HTMLCanvasElement` `useRef` manipulation.
* Enabled pointer capturing (`setPointerCapture`) for continuous strokes even when the mouse leaves the bounds.
* Implemented quadratic curves (`quadraticCurveTo`) for extremely smooth anti-aliasing of freehand strokes.
* Swapped `redoStack` from `useState` to `useRef` for optimal history popping logic without re-rendering overhead.
* Ensured high-DPI scaling dynamically adapts on `window.addEventListener('resize')`.

**Files changed:**
* `src/components/DrawingCanvas.tsx`
* `tests/drawing_engine.test.ts` (Fixed TS inference errors caused by engine length assertions).

**Why:**
* Critical performance requirement needed absolute minimum latency. Pushing thousands of pixels a second into `setState` forces React to compute a virtual DOM diff on every movement which freezes applications and makes drawing rigid. Bypassing it for direct canvas-context updates removes all rendering bottlenecks.

**Tests & Runtime Verification:**
* Built and validated all 6 Undo/Redo Engine Tests in TS.
* Electron UI verified through `npm run dev` (Application ran without any frame drops or crash loop errors).

## Phase 3: Professional Shape Annotation System
**What changed:**
* Extended the `Stroke` interface to support Shapes (Line, Arrow, Double-Arrow, Rectangle, Rounded-Rectangle, Circle, Ellipse, Polygon).
* Expanded `DrawingCanvas.tsx`'s `requestAnimationFrame` render cycle to handle 10 different geometric and polygon math calculations natively on the Canvas context.
* Implemented multi-click array tracking for the `polygon` tool.
* Added proportional `Shift` constraints for Squares/Circles, and angle snapping for lines.
* Built a sub-toolbar popover for selecting shapes.
* Implemented native `.fill()` logic hooked into a `isFilled` toggle with a secondary `fillColor` picker, maintaining a unified array architecture (shapes don't need a standalone tool for the filled variant).

**Files changed:**
* `src/components/DrawingCanvas.tsx`
* `src/App.tsx` and `src/App.css`
* `tests/drawing_engine.test.ts`

**Why:**
* Providing structured professional tools without re-rendering overhead required adapting the unified high-performance model. Eraser transparency naturally works because drawing is chronological, meaning raster-level cutout natively acts on the shapes drawn before it.

**Tests & Runtime Verification:**
* Validated 7 shape-drawing logic tests (TypeScript logic, Polygon cancellation, Undo/Redo stack preservation).
* `npm run build` compiled without any narrowing or TS6133 issues.

## Phase 4: Professional Text Annotation System
**What changed:**
* Implemented a brand new **Immutable Reference Snapshot History Architecture**, changing history from a shallow append-only stack to a deep snapshot tracking array of references. This allows edits, movements, and deletes without breaking the undo chain.
* Developed a **Generic Selection Hit-Testing System**. Added `selectedAnnotationId` state, and mathematically reverse-tested canvas bounds for `text` annotations to allow drag-and-drop movement.
* Created a highly scalable `TextFormat` interface supporting font weight, family, size, italics, underline, colors, background padding, and text-alignment.
* Created a floating HTML `<textarea>` synchronized over the canvas for native text editing, with auto-resizing bounds and automatic multiline word-splitting to match `ctx.fillText`.
* Developed a contextual Text toolbar within `App.tsx` containing alignment, size, font-family, and style decorators.
* Refactored test harness for Snapshot architecture.

**Files changed:**
* `src/components/DrawingCanvas.tsx`
* `src/App.tsx` and `src/App.css`
* `tests/drawing_engine.test.ts`

**Why:**
* A snapshot history model is required for non-linear operations (like deleting an object in the middle of a stack). Instead of deep cloning everything (which the user explicitly warned about), we simply create a new array containing references to the immutable `Stroke` objects, costing virtually 0 memory per frame while yielding 100% stable history manipulation.
* Hit-testing was abstracted so future versions can expand from text bounding boxes to geometric intersections for shapes.

**Tests & Runtime Verification:**
* Written and passed 7 unit tests covering text addition, text editing, text deletion, edit undo, and delete redo on the new Snapshot history model.
* Verified `npm run build` with strictly typed generic models.
* Tested runtime UI text positioning via Electron application locally without crashes.
