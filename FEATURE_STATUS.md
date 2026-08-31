# Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Native Transparent Overlay | STABLE | Verified runtime launch; frameless and always-on-top active |
| High-Performance Drawing Engine | STABLE | ## Phase 5: Professional Screenshot & Capture System<br>**Status**: `IMPLEMENTED_UNVERIFIED`<br>**Goal**: Integrate full screen and region capture into existing architecture using Freeze Mode.<br>**Key Features**: <br>- Freeze Mode desktop capture (desktopCapturer).<br>- Region Selection Overlay with CSS masking.<br>- Off-screen Canvas Compositing for "Screen + Annotations" handling devicePixelRatio.<br>- Export to PNG/JPEG via native save dialogs.<br>- Copy to clipboard via native clipboard image APIs.<br>- Preview Modal with glassmorphism UI.<br>**Open Issues**:<br>- Needs manual runtime verification. |
| Pen Tool | STABLE | Smooth anti-aliased quadratic curves rendering |
| Highlighter Tool | STABLE | Verified composite blending logic over frame renders |
| Eraser Tool | STABLE | Verified destination-out logic |
| Clear Annotations | STABLE | Verified canvas context reset |
| Floating Toolbar | STABLE | UI rendering and draggable hook verified |
| Screenshot System | IMPLEMENTED_UNVERIFIED | |
| Whiteboard Mode | NOT_STARTED | |
| Blackboard Mode | NOT_STARTED | |
| Fading Ink | NOT_STARTED | |
| Cursor Mode (Passthrough) | STABLE | IPC bounds mapping and `setIgnoreMouseEvents` verified |
| Cursor Highlighting | NOT_STARTED | |
| Global Keyboard Shortcuts | STABLE | Native `globalShortcut` registered via main.ts IPC |
| Ghost Mode | NOT_STARTED | |
| System Tray / Menu Bar | NOT_STARTED | |
| Multi-monitor Support | NOT_STARTED | |
| Stylus / Touch Support | NOT_STARTED | |
| Settings Persistence | NOT_STARTED | |
| Profiles | NOT_STARTED | |
