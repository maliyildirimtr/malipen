# Project Audit

## Current Architecture
The current repository was found to be completely empty. No existing framework, package manager, or codebase exists.

## Existing Features
None. (Empty repository).

## Broken Features
None.

## Missing Features
All target product features are missing and must be developed from scratch:
* Transparent native overlay
* Drawing engine (pen, highlighter, eraser)
* Floating toolbar
* Annotation object model (undo/redo, shapes, text)
* Screen capture
* Whiteboard/Blackboard modes
* Global keyboard shortcuts
* Ghost mode / Cursor passthrough
* System Tray / Menu bar integration
* Multi-monitor and DPI scaling support
* Settings persistence

## Technical Risks
* **Transparent Windows:** Ensuring the overlay is truly transparent without a background color flash, especially across Windows and macOS.
* **Input Interception / Pointer Passthrough:** Toggling between annotation mode (intercepting mouse) and cursor mode (passing mouse clicks through to underlying applications).
* **Multi-monitor Support:** Ensuring the transparent window spans all monitors correctly or creating separate windows per monitor. Dealing with different DPI scalings and negative coordinates.
* **Global Shortcuts:** Registering hotkeys that work even when the annotation window is unfocused.
* **Performance:** Rendering fullscreen canvas on high-DPI displays (4K/5K) at 60Hz+ without significant CPU/GPU overhead.
* **Screen Capture:** Native APIs for capturing the screen underneath the transparent window.

## Recommended Architecture
**Electron + React + TypeScript + Vite**

* **Why Electron?** Electron has mature and well-tested APIs for transparent, frameless windows (`transparent: true`, `frame: false`), global shortcuts (`globalShortcut`), system tray (`Tray`), and crucially, pointer passthrough (`win.setIgnoreMouseEvents()`). It provides cross-platform support (macOS, Windows, Linux).
* **Why React/Vite?** Fast UI development for the toolbar and settings windows.
* **Drawing Engine:** HTML5 Canvas API (potentially with a 2D rendering engine like Fabric.js or raw Canvas for maximum performance) will handle the drawing layer.

## Development Roadmap
The roadmap has been defined in `DEVELOPMENT_ROADMAP.md` and follows the 20 phases requested, starting with scaffolding the new architecture.
