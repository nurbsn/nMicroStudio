# microStudio for VS Code (`vscode-microstudio`)

A complete IDE integration and toolkit for [microStudio](https://microstudio.dev/) inside Visual Studio Code. Develop, edit pixel art, paint maps, manage libraries, preview offline, and synchronize seamlessly with microStudio.dev.

---

## 🌟 Key Features

### 🎨 Visual Editors
- **Sprite Editor**: Draw pixel art, animations, frames, layers, color palettes, and configure anchor points directly in VS Code.
- **Map Editor**: Tilemap painting with multi-layer grid support, zoom in/out, minimap overview, and interactive sprite palette selector.

### ⚙️ Project Management & Configuration
- **Project Settings Sidebar**: Easily configure game title, slug, version, type (Game, App, Library), orientation, and aspect ratio.
- **Graphics Engine Selector**: Switch effortlessly between:
  - *Standard (2D Canvas)*
  - *PixiJS (2D WebGL)*
  - *Babylon.js (3D)*
  - *M2D (microStudio 2D)*
  - *M3D (microStudio 3D)*
  - *Three.js (3D)*
- **Library Manager**: Discover and inject official and community microStudio libraries into your project with a single click.

### ⚡ Offline HTML5 Compiler & Preview
- **Standalone HTML5 Bundler**: Compile your entire game (code, sprites, tilemaps, sounds, music) into a self-contained `.html` package with zero external network dependencies.
- **Instant Preview**: Play and test your game inside VS Code with embedded runtime error logs.
- **Export to Standalone HTML5**: Export ready-to-publish `.html` games playable in any modern browser.

### ☁️ Two-Way Cloud Sync with microstudio.dev
- **Download / Clone**: Browse remote projects on your microStudio account and clone them to your local disk.
- **Push / Upload**: Push local changes to microStudio.dev with automated file encoding, options sync, interactive project pairing, and persistent ID tracking.

### 🧠 IntelliSense & MicroScript Support
- Syntax highlighting for `.ms` (MicroScript v1 & v2).
- Autocompletion (`CompletionItemProvider`) and documentation hovers (`HoverProvider`) for:
  - `screen.*`, `keyboard.*`, `mouse.*`, `touch.*`, `audio.*`, `system.*`, `random.*`
  - `PIXI.*`, `BABYLON.*`, `M2D.*`, `M3D.*`, `Matter.*`

### 🌐 Internationalization (i18n)
- **Supported Languages**: English (`en`) and Polish (`pl`).
- Automatic detection based on VS Code display language (`vscode.env.language`) or manual override via `microstudio.language` setting.

---

## 🚀 Getting Started

### Installation & Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the assets and compile TypeScript:
   ```bash
   node build-assets.js
   npm run compile
   ```
3. Press `F5` in VS Code to launch the **Extension Development Host**.

---

## 🛠️ Configuration Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `microstudio.workspaceRoot` | `string` | `""` | Root folder on disk containing local microStudio projects |
| `microstudio.serverUrl` | `string` | `https://microstudio.dev` | microStudio WebSocket server URL |
| `microstudio.language` | `string` | `"auto"` | Extension interface language (`auto`, `en`, `pl`) |

---

## 📜 License
MIT License. Inspired by and built for the awesome [microStudio](https://microstudio.dev/) community!
