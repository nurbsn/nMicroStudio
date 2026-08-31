# MicroStudio for VS Code

A complete game development suite for [microStudio](https://microstudio.dev/) inside Visual Studio Code. Create pixel art, design tilemaps, code games with IntelliSense, test offline with instant preview, export standalone HTML5 games, and synchronize with your microStudio.dev account.

---

## 🎮 User Guide & Features

### 1. 📂 Managing Projects
- **Set Projects Folder**: Click the **microStudio** icon in the Activity Bar. If you haven't set a root directory yet, click **Set Projects Root Directory** to choose where your microStudio projects are stored.
- **Local Projects Explorer**: Browse, open, and manage all your local microStudio projects directly from the sidebar.
- **Project Structure**: Any folder with a `project.json` file is recognized automatically.

---

### 2. 🎨 Visual Editors
- **Sprite Editor (Pixel Art & Animations)**:
  - Open any sprite in the `sprites/` folder or click **`+ Sprite`** in the status bar/sidebar.
  - Draw pixel art with pencils, erasers, bucket fill, color pickers, and color palettes.
  - Create animations with multiple frames, frame rates, and onion skinning.
- **Map Editor (Tilemap Level Designer)**:
  - Open any map in the `maps/` folder or click **`+ Map`**.
  - Paint tilemaps with an interactive sprite picker palette.
  - Multi-layer support, zoom in/out controls, and a minimap navigator.

---

### 3. ⚙️ Project Settings & Graphics Engines
Open the **Project Settings** tab in the sidebar to configure your game:
- **Game Metadata**: Title, slug, version, project type (*Game*, *App*, *Library*).
- **Display Options**: Orientation (*Landscape*, *Portrait*, *Any*) and Aspect Ratio (*Free*, *16:9*, *4:3*, *1:1*).
- **Graphics Engine Selector**: Switch between rendering backends seamlessly:
  - *Standard (2D Canvas)*
  - *PixiJS (2D WebGL)*
  - *Babylon.js (3D)*
  - *M2D (microStudio 2D)*
  - *M3D (microStudio 3D)*
  - *Three.js (3D)*
- **Library Manager**: Discover and attach official and community microStudio libraries (*Matter.js physics, audio synths, etc.*).

---

### 4. ⚡ Offline Preview & Standalone HTML5 Export
- **Instant Game Preview**: Run and play your game directly inside VS Code with embedded live runtime logs.
- **Standalone HTML5 Export**: Export your entire game (*code, sprites, tilemaps, sounds, music, libraries*) into a single, self-contained `.html` file that runs in any modern web browser without needing internet or a server.

---

### 5. ☁️ Cloud Sync (microStudio.dev)
- **Login & Clone**: Log into your microStudio account from the sidebar to browse and download your cloud projects to your computer.
- **Push to Cloud**: Click **Push to microStudio.dev** to upload your local modifications, new sprites, maps, and code to the microStudio web editor.

---

### 6. 🧠 Code IntelliSense & Syntax Highlighting
- Full syntax highlighting for `.ms` (MicroScript v1 & v2).
- Autocompletion and documentation hovers for microStudio built-in APIs (`screen`, `keyboard`, `mouse`, `touch`, `audio`, `system`, `random`) as well as `PIXI`, `BABYLON`, `M2D`, `M3D`, and `Matter`.

---

## ⌨️ Command Palette Shortcuts (`Ctrl+Shift+P` / `Cmd+Shift+P`)

| Command | Description |
|---|---|
| `microStudio: Open Preview` | Launches the interactive live game preview |
| `microStudio: Export to Standalone HTML5` | Bundles and exports the game to a single HTML5 file |
| `microStudio: Push to microStudio.dev` | Uploads current project changes to microStudio.dev |
| `microStudio: New Sprite...` | Creates a new sprite in `sprites/` |
| `microStudio: New Map...` | Creates a new tilemap in `maps/` |
| `microStudio: New Script...` | Creates a new script in `ms/` |
| `microStudio: New Sound...` | Creates a new sound in `sounds/` |
| `microStudio: New Music...` | Creates a new music track in `music/` |
| `microStudio: Import Asset...` | Imports files into `assets/` |
| `microStudio: Manage Libraries...` | Opens the library browser |

---

## 🛠️ Configuration Settings

You can customize the extension behavior in VS Code Settings (`Ctrl+,` -> search for `microstudio`):

- **`microstudio.workspaceRoot`**: Path to the folder containing your local microStudio projects.
- **`microstudio.language`**: Interface language (`auto`, `en`, `pl`, `fr`, `de`, `es`, `it`).
- **`microstudio.serverUrl`**: WebSocket server address (default: `https://microstudio.dev`).

---

## 🌐 Supported Languages
The extension interface fully supports **6 languages**:
- 🇬🇧 English (`en`)
- 🇵🇱 Polski (`pl`)
- 🇫🇷 Français (`fr`)
- 🇩🇪 Deutsch (`de`)
- 🇪🇸 Español (`es`)
- 🇮🇹 Italiano (`it`)

---

## 📜 License
MIT License. Built for the [microStudio](https://microstudio.dev/) community!
