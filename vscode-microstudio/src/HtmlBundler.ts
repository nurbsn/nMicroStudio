import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class HtmlBundler {
    /**
     * Builds a self-contained HTML document for the given microStudio project.
     * @param forWebview When true, generates development preview with toolbar and console. When false, generates clean game without wrapper.
     * @param isPackage When true, uses relative URLs and external microstudio_play.js for packaged directory export.
     */
    public static async bundle(
        projectPath: string,
        extensionPath: string,
        forWebview: boolean = false,
        webview?: vscode.Webview,
        isPackage: boolean = false
    ): Promise<string> {
        const pjPath = path.join(projectPath, 'project.json');
        let projectJson: any = {
            title: path.basename(projectPath),
            slug: path.basename(projectPath),
            orientation: "landscape",
            aspect: "16:9",
            graphics: "standard",
            libs: []
        };

        if (fs.existsSync(pjPath)) {
            try {
                projectJson = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
            } catch (e) {}
        }

        const resources: any = {
            title: projectJson.title || path.basename(projectPath),
            slug: projectJson.slug || path.basename(projectPath),
            language: projectJson.language || "microscript",
            orientation: projectJson.orientation || "landscape",
            aspect: projectJson.aspect || "16:9",
            graphics: projectJson.graphics || "standard",
            libs: projectJson.libs || [],
            microscript: {},
            images: [],
            maps: [],
            sounds: [],
            music: [],
            assets: []
        };

        // 1. Read Code Scripts (ms/)
        const msDir = path.join(projectPath, 'ms');
        if (fs.existsSync(msDir)) {
            const files = fs.readdirSync(msDir);
            for (const file of files) {
                if (file.endsWith('.ms') || file.endsWith('.js') || file.endsWith('.py') || file.endsWith('.lua')) {
                    const fullPath = path.join(msDir, file);
                    resources.microscript[file] = fs.readFileSync(fullPath, 'utf8');
                }
            }
        }

        // 2. Read Sprites (sprites/)
        const spritesDir = path.join(projectPath, 'sprites');
        if (fs.existsSync(spritesDir)) {
            this.collectSpritesRecursively(spritesDir, '', resources, forWebview, webview, isPackage);
        }

        // 3. Read Maps (maps/)
        const mapsDir = path.join(projectPath, 'maps');
        if (fs.existsSync(mapsDir)) {
            const files = fs.readdirSync(mapsDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const name = path.basename(file, '.json');
                    const fullPath = path.join(mapsDir, file);
                    try {
                        const mapData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                        let mapUrl: string;
                        if (forWebview && webview) {
                            mapUrl = webview.asWebviewUri(vscode.Uri.file(fullPath)).toString();
                        } else if (isPackage) {
                            mapUrl = `maps/${file}`;
                        } else {
                            const b64 = Buffer.from(JSON.stringify(mapData)).toString('base64');
                            mapUrl = `data:application/json;base64,${b64}`;
                        }
                        resources.maps.push({
                            file: name + ".json",
                            version: 0,
                            properties: {},
                            url: mapUrl,
                            data: mapData
                        });
                    } catch (e) {}
                }
            }
        }

        // 4. Read Sounds, Music, Assets
        this.collectMediaFolder(projectPath, 'sounds', resources.sounds, forWebview, webview, 'audio/wav', isPackage);
        this.collectMediaFolder(projectPath, 'music', resources.music, forWebview, webview, 'audio/mp3', isPackage);
        this.collectMediaFolder(projectPath, 'assets', resources.assets, forWebview, webview, 'application/octet-stream', isPackage);

        // Combine microscript code
        const allCode = Object.values(resources.microscript).join('\n\n');

        // Read microstudio_play.js engine if inlining
        const playJsPath = path.join(extensionPath, 'media', 'microstudio_play.js');
        const playJsContent = (!isPackage && fs.existsSync(playJsPath)) ? fs.readFileSync(playJsPath, 'utf8') : '';

        const hasIcon = fs.existsSync(path.join(projectPath, 'icon.png'));

        // If forWebview is true: include toolbar, console, and interactive debug controls
        if (forWebview) {
            return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${this.escapeHtml(resources.title)}</title>
    ${hasIcon ? '<link rel="icon" type="image/png" href="icon.png">' : ''}
    <style>
        body, html {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: #111;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            user-select: none;
            -webkit-user-select: none;
        }
        #toolbar {
            height: 38px;
            background: #1f2937;
            border-bottom: 1px solid #374151;
            display: flex;
            align-items: center;
            padding: 0 12px;
            color: #f3f4f6;
            gap: 8px;
            flex-shrink: 0;
            z-index: 10;
        }
        .btn {
            background: #374151;
            color: #f9fafb;
            border: 1px solid #4b5563;
            padding: 4px 12px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: all 0.15s ease;
        }
        .btn:hover {
            background: #4b5563;
            border-color: #6b7280;
        }
        .btn-primary {
            background: #059669;
            border-color: #10b981;
        }
        .btn-primary:hover {
            background: #10b981;
        }
        #game-container {
            flex-grow: 1;
            position: relative;
            background: #000;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 0;
            min-width: 0;
        }
        #canvaswrapper {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        canvas {
            display: block;
            box-sizing: content-box;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
        }
        #console-container {
            height: 150px;
            background: #111827;
            border-top: 1px solid #374151;
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }
        #console-toolbar {
            height: 26px;
            background: #1f2937;
            color: #9ca3af;
            display: flex;
            align-items: center;
            padding: 0 10px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        #console-output {
            flex-grow: 1;
            overflow-y: auto;
            padding: 8px 12px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            color: #d1d5db;
            font-size: 12px;
            line-height: 1.4;
        }
        .log-line {
            margin-bottom: 3px;
            word-wrap: break-word;
        }
        .log-info { color: #e5e7eb; }
        .log-error { color: #f87171; font-weight: 600; }
        .log-warn { color: #fbbf24; }
    </style>
</head>
<body>
    <div id="toolbar">
        <button class="btn btn-primary" id="btn-play">▶ Play</button>
        <button class="btn" id="btn-pause">⏸ Pause</button>
        <button class="btn" id="btn-reload">↻ Reload</button>
        <span style="font-size: 13px; font-weight: 600; color: #9ca3af; margin-left: 8px;">${this.escapeHtml(resources.title)}</span>
        <button class="btn" id="btn-toggle-console" style="margin-left: auto;">Toggle Console</button>
    </div>
    
    <div id="game-container">
        <div id="canvaswrapper"></div>
    </div>
    
    <div id="console-container">
        <div id="console-toolbar">
            Console
            <button class="btn" id="btn-clear" style="padding: 1px 8px; font-size: 11px; margin-left: auto;">Clear</button>
        </div>
        <div id="console-output"></div>
    </div>

    <script id="code" type="text/microscript">${allCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</script>
    <script>
        window.skip_service_worker = true;
        window.exported_project = true;
    </script>
    <script>
${playJsContent}
    </script>
    <script>
        const resources = ${JSON.stringify(resources).replace(/</g, '\\u003c')};
        window.resources = resources;
        window.language = resources.language || "microscript";
        window.ms_aspect = resources.aspect || "16:9";
        window.ms_orientation = resources.orientation || "landscape";
        try {
            window.aspect = resources.aspect || "16:9";
            window.orientation = resources.orientation || "landscape";
        } catch (e) {}
        window.graphics = resources.graphics || "standard";
        window.ms_libs = resources.libs || [];
        window.exported_project = true;
        
        // Intercept Console
        const consoleOutput = document.getElementById('console-output');
        function appendLog(text, type) {
            if (!consoleOutput) return;
            const div = document.createElement('div');
            div.className = 'log-line log-' + type;
            div.textContent = typeof text === 'object' ? JSON.stringify(text) : text;
            consoleOutput.appendChild(div);
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
        
        const origInfo = console.info;
        const origLog = console.log;
        const origWarn = console.warn;
        const origError = console.error;
        
        console.info = function(...args) { appendLog(args.join(' '), 'info'); origInfo.apply(console, args); };
        console.log = function(...args) { appendLog(args.join(' '), 'info'); origLog.apply(console, args); };
        console.warn = function(...args) { appendLog(args.join(' '), 'warn'); origWarn.apply(console, args); };
        console.error = function(...args) { appendLog(args.join(' '), 'error'); origError.apply(console, args); };
        
        window.onerror = function(message, source, lineno, colno, error) {
            const loc = (error && error.stack) ? ('\\n' + error.stack) : (source ? (' at ' + source + ':' + lineno + ':' + colno) : '');
            appendLog(message + loc, 'error');
        };

        let player;
        try {
            window.player = player = new Player();
        } catch (err) {
            console.error("Player initialization error: " + (err && err.stack ? err.stack : err));
        }

        let vscodeApi = null;
        try {
            if (typeof acquireVsCodeApi === 'function') {
                vscodeApi = acquireVsCodeApi();
            } else if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
                vscodeApi = window.acquireVsCodeApi();
            }
        } catch (e) {
            vscodeApi = (typeof window !== 'undefined' && window._vscodeApi) ? window._vscodeApi : null;
        }
        if (vscodeApi && typeof window !== 'undefined') {
            window._vscodeApi = vscodeApi;
        }

        // UI Controls
        document.getElementById('btn-play').addEventListener('click', () => {
            if (player && player.runtime && player.runtime.started) {
                player.runtime.resume();
            }
            window.postMessage(JSON.stringify({ name: "resume" }), "*");
        });
        document.getElementById('btn-pause').addEventListener('click', () => {
            if (player && player.runtime) {
                player.runtime.stop();
            }
            window.postMessage(JSON.stringify({ name: "pause" }), "*");
        });
        const btnReload = document.getElementById('btn-reload');
        if (btnReload) {
            btnReload.addEventListener('click', () => {
                btnReload.style.opacity = '0.5';
                btnReload.textContent = '↻ ...';
                try {
                    if (player && player.runtime) {
                        player.runtime.stop();
                    }
                } catch (e) {}
                if (vscodeApi) {
                    vscodeApi.postMessage({ command: 'reload' });
                } else {
                    location.reload();
                }
            });
        }
        document.getElementById('btn-clear').addEventListener('click', () => {
            consoleOutput.innerHTML = '';
        });
        document.getElementById('btn-toggle-console').addEventListener('click', () => {
            const el = document.getElementById('console-container');
            el.style.display = el.style.display === 'none' ? 'flex' : 'none';
            if (player) {
                setTimeout(() => player.resize(), 20);
            }
        });

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                if (player) {
                    player.resize();
                }
            });
            const gc = document.getElementById('game-container');
            if (gc) ro.observe(gc);
        }
    </script>
</body>
</html>`;
        }

        // Clean Standalone Game (no toolbar, no buttons, no console)
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${this.escapeHtml(resources.title)}</title>
    ${hasIcon ? '<link rel="icon" type="image/png" href="icon.png">' : ''}
    <style>
        body, html {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: #000;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
            -webkit-user-select: none;
        }
        #canvaswrapper {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        canvas {
            display: block;
            box-sizing: content-box;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
        }
    </style>
</head>
<body>
    <div id="canvaswrapper"></div>

    <script id="code" type="text/microscript">${allCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</script>
    <script>
        window.skip_service_worker = true;
        window.exported_project = true;
    </script>
    ${isPackage ? '<script src="microstudio_play.js"></script>' : `<script>\n${playJsContent}\n    </script>`}
    <script>
        const resources = ${JSON.stringify(resources).replace(/</g, '\\u003c')};
        window.resources = resources;
        window.language = resources.language || "microscript";
        window.ms_aspect = resources.aspect || "16:9";
        window.ms_orientation = resources.orientation || "landscape";
        try {
            window.aspect = resources.aspect || "16:9";
            window.orientation = resources.orientation || "landscape";
        } catch (e) {}
        window.graphics = resources.graphics || "standard";
        window.ms_libs = resources.libs || [];
        window.exported_project = true;

        let player;
        try {
            window.player = player = new Player();
        } catch (err) {
            console.error("Player initialization error: " + (err && err.stack ? err.stack : err));
        }

        window.addEventListener("resize", () => {
            if (player) player.resize();
        });

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                if (player) {
                    player.resize();
                }
            });
            const wrapper = document.getElementById('canvaswrapper');
            if (wrapper) ro.observe(wrapper);
        }
    </script>
</body>
</html>`;
    }

    /**
     * Exports a complete package folder containing index.html, microstudio_play.js, and all project assets.
     */
    public static async exportPackage(
        projectPath: string,
        outputDir: string,
        extensionPath: string
    ): Promise<string> {
        fs.mkdirSync(outputDir, { recursive: true });

        // 1. Copy engine runtime
        const playJsPath = path.join(extensionPath, 'media', 'microstudio_play.js');
        if (fs.existsSync(playJsPath)) {
            fs.copyFileSync(playJsPath, path.join(outputDir, 'microstudio_play.js'));
        }

        // 2. Copy asset folders if present
        const foldersToCopy = ['sprites', 'maps', 'sounds', 'music', 'assets', 'ms'];
        for (const folder of foldersToCopy) {
            const srcFolder = path.join(projectPath, folder);
            if (fs.existsSync(srcFolder)) {
                this.copyDirSync(srcFolder, path.join(outputDir, folder));
            }
        }

        // 3. Copy project.json and icon.png if present
        const projectJsonPath = path.join(projectPath, 'project.json');
        if (fs.existsSync(projectJsonPath)) {
            fs.copyFileSync(projectJsonPath, path.join(outputDir, 'project.json'));
        }
        const iconPath = path.join(projectPath, 'icon.png');
        if (fs.existsSync(iconPath)) {
            fs.copyFileSync(iconPath, path.join(outputDir, 'icon.png'));
        }

        // 4. Generate clean index.html with package references (no toolbar, no console)
        const html = await this.bundle(projectPath, extensionPath, false, undefined, true);
        const indexHtmlPath = path.join(outputDir, 'index.html');
        fs.writeFileSync(indexHtmlPath, html, 'utf8');

        return indexHtmlPath;
    }

    public static async exportStandalone(
        projectPath: string,
        outputPath: string,
        extensionPath: string
    ): Promise<string> {
        const targetDir = outputPath.toLowerCase().endsWith('.html') ? path.dirname(outputPath) : outputPath;
        return await this.exportPackage(projectPath, targetDir, extensionPath);
    }

    private static copyDirSync(src: string, dest: string) {
        if (!fs.existsSync(src)) return;
        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                this.copyDirSync(srcPath, destPath);
            } else if (entry.isFile()) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    private static collectSpritesRecursively(
        dir: string,
        baseRelative: string,
        resources: any,
        forWebview: boolean,
        webview?: vscode.Webview,
        isPackage: boolean = false
    ) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativeName = baseRelative ? `${baseRelative}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                this.collectSpritesRecursively(fullPath, relativeName, resources, forWebview, webview, isPackage);
            } else if (entry.isFile() && entry.name.endsWith('.png')) {
                const spriteName = relativeName.replace(/\.png$/, '').replace(/\//g, '-');
                let spriteUrl: string;
                if (forWebview && webview) {
                    spriteUrl = webview.asWebviewUri(vscode.Uri.file(fullPath)).toString();
                } else if (isPackage) {
                    spriteUrl = `sprites/${relativeName}`;
                } else {
                    const b64 = fs.readFileSync(fullPath).toString('base64');
                    spriteUrl = `data:image/png;base64,${b64}`;
                }

                const msCompanionPath = fullPath.replace(/\.png$/, '.ms');
                let properties: any = {};
                if (fs.existsSync(msCompanionPath)) {
                    try {
                        properties = JSON.parse(fs.readFileSync(msCompanionPath, 'utf8'));
                    } catch (e) {}
                }

                resources.images.push({
                    file: spriteName + ".png",
                    version: 0,
                    properties: properties,
                    url: spriteUrl
                });
            }
        }
    }

    private static collectMediaFolder(
        projectPath: string,
        folderName: string,
        targetArray: any[],
        forWebview: boolean,
        webview?: vscode.Webview,
        mimeType: string = 'application/octet-stream',
        isPackage: boolean = false
    ) {
        const dir = path.join(projectPath, folderName);
        if (!fs.existsSync(dir)) return;

        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            if (file.isFile()) {
                const fullPath = path.join(dir, file.name);
                let mediaUrl: string;
                if (forWebview && webview) {
                    mediaUrl = webview.asWebviewUri(vscode.Uri.file(fullPath)).toString();
                } else if (isPackage) {
                    mediaUrl = `${folderName}/${file.name}`;
                } else {
                    const b64 = fs.readFileSync(fullPath).toString('base64');
                    mediaUrl = `data:${mimeType};base64,${b64}`;
                }
                targetArray.push({
                    file: file.name,
                    version: 0,
                    properties: {},
                    url: mediaUrl
                });
            }
        }
    }

    private static escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
