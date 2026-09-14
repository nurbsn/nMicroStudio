# Changelog

All notable changes to the **MicroStudio for VS Code** extension will be documented in this file.

## [0.1.13] - 2026-09-14

### Added
- **Rich Live Documentation & IntelliSense**: Added complete in-editor API documentation, tooltips, parameter descriptions, and examples for all core microStudio modules (`screen`, `audio`, `mouse`, `touch`, `keyboard`, `gamepad`, `storage`, `system`, lifecycle hooks, and math).
- **Library API Reference & Autocompletion**: Added built-in documentation and method definitions for official microStudio libraries including `m2d` (micro2D physics), `matter` (Matter.js), `tween` (Tween.js), `howler` (Howler.js), `pixi` (PixiJS), `three` (Three.js), and `matrix` (Vector math).
- **Signature Help Provider**: Added parameter hints and active argument highlighting inside parentheses when typing function calls (`(` and `,`).
- **Dynamic Project & Library Code Scanner**: Automatically analyzes functions, classes, and preceding doc-comments across project `.ms` and `.js` files, as well as `doc/*.md` files, providing hover and auto-complete support for custom code and downloaded libraries.

---

## [0.1.12] - 2026-09-05

### Added
- **HTML5 Package Export**: Export games as a complete, self-contained directory package containing `index.html`, `microstudio_play.js`, and all project assets (`sprites/`, `maps/`, `sounds/`, `music/`, `assets/`, `ms/`). Ready to be zipped and published to itch.io, Newgrounds, GitHub Pages, or any web server.
- **Export Directory Selector**: Interactive folder picker for choosing the destination export folder (defaulting to `<project>/export`).
- **Post-Export Actions**: One-click buttons to "Open Folder" in file explorer or "Open in Browser".

### Changed
- **Clean HTML Export**: Removed development toolbar, debug buttons (Play, Pause, Reload), and console from the exported game. The game now renders pure full-screen canvas with responsive aspect ratio scaling and auto-starts on load.
- Kept development toolbar, reload button, and live console exclusively in the VS Code Preview window.

---

## [0.1.11] - 2026-09-05

### Fixed
- **Preview Reload Button**: Fixed an issue where the Reload button in the preview toolbar did not restart the game due to webview HTML string equality checks in VS Code.
- **Unsaved Editor State**: Added automatic saving of all dirty editor documents before bundling the preview.
- **Live Preview on Save**: Added debounced watcher on document save (`Ctrl+S`) to automatically refresh the live preview when project files are modified.

---

## [0.1.10] - 2026-09-05

### Fixed
- Fixed runtime crash `Cannot set properties of undefined (setting 'width')` in `Screen.prototype.updateInterface` across 2D, Pixi, Babylon, and 3D screen renderers.
- Fixed string escaping for error stack traces in generated preview bundles.

---

## [0.1.9] - 2026-09-04

### Fixed
- Improved canvas scaling and aspect ratio preservation in the preview panel.
- Added `ResizeObserver` for dynamic canvas resizing when splitting editor panes.

---

## [0.1.6] - 2026-09-01

### Added
- Interactive toolbar in the preview panel with Play, Pause, Reload, and Toggle Console buttons.
- In-game console output capture and display.

---

## [0.1.5] - 2026-08-31

### Fixed
- Fixed WebSocket login request_id 0 falsy evaluation.
- Added timeout and cancellation support for cloud synchronization.

---

## [0.1.4] - 2026-08-30

### Added
- Official Activity Bar icon for microStudio.
- Multi-account manager for microstudio.dev.
- Unified resource creation wizard (`+ Sprite`, `+ Map`, `+ Script`, `+ Sound`, `+ Music`, `Import Asset`).
- MicroScript autocompletion and hover documentation.

---

## [0.1.2] - 2026-08-30

### Added
- Multilingual support: French (`fr`), German (`de`), Spanish (`es`), and Italian (`it`).

---

## [0.1.1] - 2026-08-30

### Added
- Polish language support (`pl`).
- Visual Sprite and Tilemap editor integration.

---

## [0.1.0] - 2026-08-29

### Added
- Initial release of MicroStudio for VS Code.
- Offline preview engine and MicroScript syntax highlighting.
- Cloud synchronization with microstudio.dev.
