/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SpriteEditorProvider = void 0;
const vscode = __webpack_require__(1);
const path = __webpack_require__(2);
class MicroStudioCustomDocument {
    constructor(uri) {
        this.uri = uri;
        this.documentData = '';
        this.propertiesData = null;
    }
    dispose() { }
}
class SpriteEditorProvider {
    static register(context) {
        const provider = new SpriteEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider('microstudio.spriteEditor', provider, {
            webviewOptions: {
                retainContextWhenHidden: true,
            }
        });
        return providerRegistration;
    }
    constructor(context) {
        this.context = context;
        this.webviews = new Map();
        this._onDidChangeCustomDocument = new vscode.EventEmitter();
        this.onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
    }
    async resolveCustomEditor(document, webviewPanel, _token) {
        this.webviews.set(document.uri.toString(), webviewPanel);
        webviewPanel.onDidDispose(() => {
            this.webviews.delete(document.uri.toString());
        });
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'change':
                    document.documentData = e.data;
                    document.propertiesData = e.properties;
                    this._onDidChangeCustomDocument.fire({
                        document,
                        undo: () => { },
                        redo: () => { }
                    });
                    return;
                case 'save_command':
                    vscode.commands.executeCommand('workbench.action.files.save');
                    return;
                case 'log':
                    console.log("[Webview Log]:", e.message);
                    return;
            }
        });
        // Load initial data
        const data = await vscode.workspace.fs.readFile(document.uri);
        const base64Data = Buffer.from(data).toString('base64');
        let properties = null;
        try {
            const msUri = document.uri.with({ path: document.uri.path.replace(/\.png$/, '.ms') });
            const msData = await vscode.workspace.fs.readFile(msUri);
            properties = JSON.parse(Buffer.from(msData).toString('utf-8'));
        }
        catch (e) {
            // Ignore missing .ms file
        }
        const spriteData = {
            name: path.basename(document.uri.fsPath, '.png'),
            data: 'data:image/png;base64,' + base64Data,
            properties: properties
        };
        webviewPanel.webview.postMessage({
            type: 'load',
            ...spriteData
        });
    }
    getHtmlForWebview(webview) {
        const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'microstudio_all.css')));
        const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'microstudio_all.js')));
        const mockUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'VSCodeAppMock.js')));
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sprite Editor</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
                <link rel="stylesheet" href="${cssUri}">
                <style>
                    body, html { width: 100%; height: 100%; margin: 0; padding: 0; background-color: #222; color: #fff; overflow: hidden; }
                    #sprites-section { display: flex !important; width: 100%; height: 100%; }
                    #spriteeditor { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
                    .sprites-left { display: none !important; }
                    .sprites-splitbar { display: none !important; }
                    .sprites-right { left: 0 !important; right: 0 !important; width: auto !important; }
                </style>
            </head>
            <body>
                <div id="sprites-section"><div class="sprites-left"><div class="assets-bar" id="sprite-asset-bar"><div class="create-asset-button"><i class="fa fa-plus-square"></i> Sprite</div><i class="fa fa-folder-plus create-folder-button" title="New Folder"></i></div><div class="create-asset-button" id="create-sprite-button" style="display:none"><i class="fa fa-plus-square"></i> Add Sprite</div><div class="assets-drop"><div><i class="fas fa-arrow-circle-down"></i></div><div>You can drop PNG or JPEG files here</div></div><div class="assetlist" id="spritelist"><div class="asset-list" id="sprite-list"></div></div></div><div class="sprites-splitbar"></div><div class="sprites-right"><div class="spriteinfo" id="spriteinfo"><input type="text" value="" id="sprite-name"/><div class="validate-button-container" id="sprite-name-button"><div class="validate-button"><i class="fa fa-check"></i> Apply</div></div><input type="text" value="32" id="sprite-width"/><span>x</span><input type="text" value="32" id="sprite-height"/><div class="validate-button-container" id="sprite-size-button"><div class="validate-button"><i class="fa fa-check"></i> Apply</div></div><div class="buttons"><div id="save-sprite-btn" title="Save Sprite" style="position:relative;"><i class="fa fa-save"></i><span id="save-dot" style="display:none; color:#f00; font-size:10px; position:absolute; top:-4px; right:-4px;">●</span></div><div id="undo-sprite" title="Undo"><i class="fa fa-undo"></i></div><div id="redo-sprite" title="Redo"><i class="fa fa-redo"></i></div><div id="copy-sprite" title="Copy"><i class="fa fa-copy"></i></div><div id="cut-sprite" title="Cut"><i class="fa fa-cut"></i></div><div id="paste-sprite" title="Paste"><i class="fa fa-paste"></i></div><div id="delete-sprite" title="Delete Sprite"><i class="fa fa-trash"></i></div></div></div><div id="sprite-editor-locked"></div><div class="expanded" id="spriteeditorcontainer"><div class="spriteeditor" id="spriteeditor" tabindex="0"><canvas></canvas></div><div id="sprite-grab-info-container"><div id="sprite-grab-info"><i class="fa fa-hand-paper"></i><span>Hold down space bar to move view</span></div></div><div id="sprite-zoom"><i class="fa fa-search-plus" id="sprite-zoom-plus" title="Zoom in"></i><br/><i class="fa fa-search-minus" id="sprite-zoom-minus" title="Zoom out"></i></div></div><div class="collapsed" id="sprite-animation-title"><i class="fa fa-caret-down"></i><span>Animation</span></div><div class="collapsed" id="sprite-animation-panel"><div id="sprite-animation-preview"><canvas width="80" height="80"></canvas><input type="range"/></div><div id="sprite-animation-steps"><div id="sprite-animation-list"></div><div class="button" id="add-frame-button" title="Add new Frame"><i class="fa fa-plus-square"></i></div></div></div><div id="spriteeditor-bottombar"><div class="pick-color-button" id="sprite-background-color" title="Background"></div><div class="asset-code-tip" id="sprite-code-tip"><div><input type="text" spellcheck="false" readonly="readonly"/><i class="fa fa-copy" title="Copy Code"></i></div></div><div class="editor-coordinates" id="sprite-coordinates"></div></div><div class="spritebar" id="spritebar"><div class="spritetools" id="spritetools"></div><div class="spritetooloptions" id="spritetooloptions"><div class="spritetooloptionslist" id="spritetooloptionslist"></div><div id="colorpicker-group"><div class="colorpicker" id="colorpicker"></div><div class="colortext"><i class="fa fa-copy" id="colortext-copy" title="Copy Color"></i><input id="colortext" type="text" value="rgb" spellcheck="false"/></div><div class="spritetoolbutton" id="eyedropper"><i class="fa fa-eye-dropper"></i><br/><span>Eyedropper tool</span></div><div class="auto-palette"><div class="auto-palette-title">Palette <i id="auto-palette-lock" class="fa fa-lock-open" title="Lock palette"></i></div><div id="auto-palette-list"></div></div></div><div id="selection-group"><div class="selection-hint" id="selection-hint-move"><span>⇧</span> +<i class="fa fa-mouse-pointer"></i> Move</div><div class="selection-hint" id="selection-hint-clone"><span>Alt</span> +<i class="fa fa-mouse-pointer"></i> Clone</div><div class="selection-operation" id="selection-operation-film"><i class="fa fa-th"></i> <i class="fa fa-arrow-right"></i> <i class="fa fa-play"></i> <br /> Strip to animation</div><div class="selection-actions"><div class="spritetoolbutton transform" id="selection-action-horizontal-flip"><i class="fa fa-arrows-alt-h"></i><br/><span>Horizontal Flip</span></div><div class="spritetoolbutton transform" id="selection-action-vertical-flip"><i class="fa fa-arrows-alt-v"></i><br/><span>Vertical Flip</span></div><div class="spritetoolbutton transform" id="selection-action-rotate-left"><i class="fas fa-undo"></i><br/><span>Rotate Left</span></div><div class="spritetoolbutton transform" id="selection-action-rotate-right"><i class="fas fa-redo"></i><br/><span>Rotate Right</span></div></div></div></div><div class="spritehelpers"><div class="spritehelper" id="sprite-helper-tile"><i class="fa fa-th-large"></i><br/><span>Tile</span></div><div class="spritehelper" id="sprite-helper-vsymmetry"><i class="fa fa-arrows-alt-h"></i><br/><span>V Symmetry</span></div><div class="spritehelper" id="sprite-helper-hsymmetry"><i class="fa fa-arrows-alt-v"></i><br/><span>H Symmetry</span></div></div></div></div></div>
                
                <script>
                    const acquireVsCodeApi = window.acquireVsCodeApi;
                </script>
                <script src="${jsUri}"></script>
                <script src="${mockUri}"></script>
            </body>
            </html>
        `;
    }
    async saveDocument(document, data) {
        // Save base64 data to file
        const buffer = Buffer.from(data, 'base64');
        await vscode.workspace.fs.writeFile(document.uri, buffer);
    }
    // Required by CustomEditorProvider but handled natively for standard files
    async saveCustomDocument(document, cancellation) {
        if (document.documentData) {
            const buffer = Buffer.from(document.documentData, 'base64');
            await vscode.workspace.fs.writeFile(document.uri, buffer);
        }
        if (document.propertiesData) {
            const msUri = document.uri.with({ path: document.uri.path.replace(/\.png$/, '.ms') });
            const buffer = Buffer.from(JSON.stringify(document.propertiesData, null, 2), 'utf-8');
            await vscode.workspace.fs.writeFile(msUri, buffer);
        }
        const panel = this.webviews.get(document.uri.toString());
        if (panel) {
            panel.webview.postMessage({ type: 'saved' });
        }
    }
    async saveCustomDocumentAs(document, destination, cancellation) { }
    async revertCustomDocument(document, cancellation) { }
    async backupCustomDocument(document, context, cancellation) {
        return { id: document.uri.toString(), delete: () => { } };
    }
    async openCustomDocument(uri, openContext, token) {
        return new MicroStudioCustomDocument(uri);
    }
}
exports.SpriteEditorProvider = SpriteEditorProvider;


/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MapEditorProvider = void 0;
const vscode = __webpack_require__(1);
const path = __webpack_require__(2);
const fs = __webpack_require__(3);
class MapEditorProvider {
    static register(context) {
        const provider = new MapEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider('microstudio.mapEditor', provider, {
            webviewOptions: {
                retainContextWhenHidden: true,
            }
        });
        return providerRegistration;
    }
    constructor(context) {
        this.context = context;
    }
    async resolveCustomTextEditor(document, webviewPanel, _token) {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        // Load initial data
        const content = await vscode.workspace.fs.readFile(document.uri);
        const textContent = Buffer.from(content).toString('utf8');
        // Robust project root search (look for project.json or sprites/maps folder)
        let projectRoot = await this.findProjectRoot(document.uri);
        let spritesDir = vscode.Uri.joinPath(projectRoot, 'sprites');
        const loadAllSprites = async () => {
            const sprites = await this.scanSpritesDirectory(spritesDir);
            webviewPanel.webview.postMessage({
                type: 'load_sprites',
                sprites: sprites
            });
        };
        await loadAllSprites();
        function updateWebview() {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
            });
        }
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });
        // Watch for changes in sprites folder to auto-refresh sprites in map editor
        const spriteWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(projectRoot, 'sprites/**'));
        spriteWatcher.onDidChange(() => loadAllSprites());
        spriteWatcher.onDidCreate(() => loadAllSprites());
        spriteWatcher.onDidDelete(() => loadAllSprites());
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            spriteWatcher.dispose();
        });
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'save':
                    this.updateTextDocument(document, e.data);
                    return;
                case 'request_sprites':
                    loadAllSprites();
                    return;
            }
        });
        updateWebview();
    }
    async findProjectRoot(docUri) {
        let current = path.dirname(docUri.fsPath);
        for (let i = 0; i < 5; i++) {
            const pj = path.join(current, 'project.json');
            const sp = path.join(current, 'sprites');
            if (fs.existsSync(pj) || fs.existsSync(sp)) {
                return vscode.Uri.file(current);
            }
            const parent = path.dirname(current);
            if (parent === current)
                break;
            current = parent;
        }
        return vscode.Uri.joinPath(vscode.Uri.file(path.dirname(docUri.fsPath)), '..');
    }
    async scanSpritesDirectory(dirUri, prefix = '') {
        const sprites = {};
        try {
            const entries = await vscode.workspace.fs.readDirectory(dirUri);
            for (const [name, type] of entries) {
                const itemUri = vscode.Uri.joinPath(dirUri, name);
                if (type === vscode.FileType.Directory) {
                    const subPrefix = prefix ? `${prefix}-${name}` : name;
                    const subSprites = await this.scanSpritesDirectory(itemUri, subPrefix);
                    Object.assign(sprites, subSprites);
                }
                else if (type === vscode.FileType.File && name.endsWith('.png')) {
                    const baseName = name.replace(/\.png$/, '');
                    const spriteName = prefix ? `${prefix}-${baseName}` : baseName;
                    const fileData = await vscode.workspace.fs.readFile(itemUri);
                    const base64 = Buffer.from(fileData).toString('base64');
                    let properties = null;
                    try {
                        const msUri = vscode.Uri.joinPath(dirUri, baseName + '.ms');
                        const msData = await vscode.workspace.fs.readFile(msUri);
                        properties = JSON.parse(Buffer.from(msData).toString('utf-8'));
                    }
                    catch (e) { }
                    sprites[spriteName] = { data: base64, properties: properties };
                    // Also store with slash if nested for compatibility
                    if (prefix) {
                        const slashName = prefix.replace(/-/g, '/') + '/' + baseName;
                        sprites[slashName] = { data: base64, properties: properties };
                    }
                }
            }
        }
        catch (e) {
            console.warn('Sprites directory scan note:', e);
        }
        return sprites;
    }
    getHtmlForWebview(webview) {
        const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'microstudio_all.css')));
        const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'microstudio_all.js')));
        const mockUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'VSCodeAppMock.js')));
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Map Editor</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
                <link rel="stylesheet" href="${cssUri}">
                <style>
                    body, html { width: 100%; height: 100%; margin: 0; padding: 0; background-color: #222; color: #fff; overflow: hidden; }
                    #maps-section { display: flex !important; width: 100%; height: 100%; }
                    #mapeditor { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
                    .maps-left { display: none !important; }
                    .maps-splitbar { display: none !important; }
                    .maps-right { left: 0 !important; right: 0 !important; width: auto !important; }
                </style>
            </head>
            <body>
                <div id="maps-section"><div class="maps-left"><div class="assets-bar" id="map-asset-bar"><div class="create-asset-button"><i class="fa fa-plus-square"></i> Map</div><i class="fa fa-folder-plus create-folder-button" title="New Folder"></i></div><div class="create-asset-button" id="create-map-button" style="display:none"><i class="fa fa-plus-square"></i> Add Map</div><div class="assetlist" id="maplist"><div class="asset-list" id="map-list"></div></div></div><div class="maps-splitbar"></div><div class="maps-right"><div class="mapinfo" id="mapinfo"><input type="text" value="" id="map-name"/><div class="validate-button-container" id="map-name-button"><div class="validate-button"><i class="fa fa-check"></i> Apply</div></div><span>&nbsp;&nbsp;&nbsp;&nbsp;Map Size</span><input type="text" value="16" id="map-width"/><span>x</span><input type="text" value="10" id="map-height"/><div class="validate-button-container" id="map-size-button"><div class="validate-button"><i class="fa fa-check"></i> Apply</div></div><span>&nbsp;&nbsp;&nbsp;&nbsp;Block Size</span><input type="text" value="16" id="map-block-width"/><span>x</span><input type="text" value="16" id="map-block-height"/><div class="validate-button-container" id="map-blocksize-button"><div class="validate-button"><i class="fa fa-check"></i> Apply</div></div><div class="buttons"><div id="undo-map"><i class="fa fa-undo"></i></div><div id="redo-map"><i class="fa fa-redo"></i></div><div id="copy-map"><i class="fa fa-copy"></i></div><div id="cut-map"><i class="fa fa-cut"></i></div><div id="paste-map"><i class="fa fa-paste"></i></div><div id="delete-map"><i class="fa fa-trash"></i></div></div></div><div id="map-editor-locked"></div><div id="mapeditor-container"><div class="mapeditor" id="mapeditor"><div id="mapeditor-wrapper"></div><div id="mapeditor-bottombar"><div class="pick-color-button" id="map-background-color" title="Background"></div><select id="map-underlay-select"></select><div id="map-zoom-controls"><div class="zoom-btn" id="map-zoom-out" title="Zoom Out (-)"><i class="fa fa-search-minus"></i></div><div class="zoom-label" id="map-zoom-label" title="Reset Zoom">100%</div><div class="zoom-btn" id="map-zoom-in" title="Zoom In (+)"><i class="fa fa-search-plus"></i></div><div class="zoom-btn" id="map-zoom-fit" title="Fit to Screen"><i class="fa fa-compress-arrows-alt"></i></div><div class="zoom-btn" id="map-minimap-btn" title="Toggle Minimap"><i class="fa fa-map"></i></div></div><div class="asset-code-tip" id="map-code-tip"><div><input type="text" spellcheck="false" readonly="readonly"/><i class="fa fa-copy" title="Copy Code"></i></div></div><div class="editor-coordinates" id="map-coordinates"></div></div></div><div class="mapeditor-splitbar"></div><div class="mapbar" id="mapbar" tabindex="1"><div class="map-tilepicker" id="map-tilepicker"></div><div class="assetlist map-sprite-list" id="map-sprite-list"></div></div></div></div></div>
                
                <script>
                    const acquireVsCodeApi = window.acquireVsCodeApi;
                </script>
                <script src="${jsUri}"></script>
                <script src="${mockUri}"></script>
            </body>
            </html>
        `;
    }
    updateTextDocument(document, json) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), json);
        return vscode.workspace.applyEdit(edit);
    }
}
exports.MapEditorProvider = MapEditorProvider;


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MicroStudioSync = void 0;
const vscode = __webpack_require__(1);
const WebSocket = __webpack_require__(7);
const fs = __webpack_require__(3);
const path = __webpack_require__(2);
const i18n_1 = __webpack_require__(32);
class MicroStudioSync {
    constructor(context) {
        this.context = context;
        this.socket = null;
        this.token = null;
        this.username = null;
        this.pendingRequests = {};
        this.requestId = 0;
        this.isConnecting = false;
        this.connectionStateEmitter = new vscode.EventEmitter();
        this.onConnectionStateChanged = this.connectionStateEmitter.event;
        this.state = "disconnected";
        // Try to connect automatically on startup using saved credentials
        this.autoConnect();
    }
    getConnectionState() {
        return this.state;
    }
    getUsername() {
        return this.username;
    }
    setState(state) {
        this.state = state;
        this.connectionStateEmitter.fire(state);
        vscode.commands.executeCommand('setContext', 'microstudio:connected', state === 'connected');
    }
    async autoConnect() {
        const username = this.context.globalState.get('microstudio.username');
        const token = this.context.globalState.get('microstudio.token');
        if (username && token) {
            try {
                await this.connectWithToken(token, username, true);
            }
            catch (err) {
                // If token fails, try password
                const password = await this.context.secrets.get('microstudio.password');
                if (password) {
                    try {
                        await this.connectWithCredentials(username, password, true);
                    }
                    catch (e) {
                        console.error("Auto connect with password failed", e);
                    }
                }
            }
        }
    }
    async connect() {
        if (this.state === 'connected') {
            vscode.window.showInformationMessage(i18n_1.I18n.t('already_connected'));
            return;
        }
        const username = await vscode.window.showInputBox({
            prompt: i18n_1.I18n.t('login_username_prompt'),
            value: this.username || undefined
        });
        if (!username)
            return;
        const password = await vscode.window.showInputBox({
            prompt: i18n_1.I18n.t('login_password_prompt'),
            password: true
        });
        if (!password)
            return;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: i18n_1.I18n.t('login_connecting'),
            cancellable: false
        }, async (progress) => {
            try {
                await this.connectWithCredentials(username, password, false);
            }
            catch (err) {
                vscode.window.showErrorMessage(i18n_1.I18n.t('login_failed', err.message));
            }
        });
    }
    connectWithCredentials(username, password, silent = false) {
        if (this.isConnecting)
            return Promise.resolve();
        this.isConnecting = true;
        this.setState("connecting");
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket('wss://microstudio.dev/');
            this.socket.on('open', () => {
                this.sendRequest({
                    name: 'login',
                    nick: username,
                    password: password
                }, async (response) => {
                    if (response.name === 'error') {
                        this.isConnecting = false;
                        this.disconnect();
                        reject(new Error(response.error));
                    }
                    else if (response.name === 'logged_in') {
                        this.token = response.token;
                        this.username = username;
                        this.isConnecting = false;
                        this.setState("connected");
                        // Save credentials
                        await this.context.globalState.update('microstudio.username', username);
                        await this.context.globalState.update('microstudio.token', response.token);
                        if (password) {
                            await this.context.secrets.store('microstudio.password', password);
                        }
                        if (!silent) {
                            vscode.window.showInformationMessage(i18n_1.I18n.t('login_success', username));
                        }
                        resolve();
                    }
                });
            });
            this.setupSocketEvents(resolve, reject);
        });
    }
    connectWithToken(token, username, silent = true) {
        if (this.isConnecting)
            return Promise.resolve();
        this.isConnecting = true;
        this.setState("connecting");
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket('wss://microstudio.dev/');
            this.socket.on('open', () => {
                this.sendRequest({
                    name: 'token',
                    token: token
                }, async (response) => {
                    if (response.name === 'error') {
                        this.isConnecting = false;
                        this.disconnect();
                        reject(new Error(response.error));
                    }
                    else if (response.name === 'token_valid') {
                        this.token = token;
                        this.username = username;
                        this.isConnecting = false;
                        this.setState("connected");
                        if (!silent) {
                            vscode.window.showInformationMessage(i18n_1.I18n.t('login_success', username));
                        }
                        resolve();
                    }
                });
            });
            this.setupSocketEvents(resolve, reject);
        });
    }
    setupSocketEvents(resolve, reject) {
        if (!this.socket)
            return;
        this.socket.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.request_id !== undefined && this.pendingRequests[msg.request_id]) {
                    this.pendingRequests[msg.request_id](msg);
                    delete this.pendingRequests[msg.request_id];
                }
                else {
                    this.handleServerMessage(msg);
                }
            }
            catch (e) {
                console.error('Error parsing message', e);
            }
        });
        this.socket.on('error', (err) => {
            this.isConnecting = false;
            this.disconnect();
            reject(err);
        });
        this.socket.on('close', () => {
            this.isConnecting = false;
            this.disconnect();
        });
    }
    async logout() {
        this.disconnect();
        this.token = null;
        this.username = null;
        await this.context.globalState.update('microstudio.username', undefined);
        await this.context.globalState.update('microstudio.token', undefined);
        await this.context.secrets.delete('microstudio.password');
        vscode.window.showInformationMessage(i18n_1.I18n.t('logged_out'));
    }
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.setState("disconnected");
    }
    getRemoteProjects() {
        return new Promise((resolve, reject) => {
            if (this.state !== 'connected') {
                reject(new Error(i18n_1.I18n.t('login_required_download')));
                return;
            }
            this.sendRequest({ name: 'get_project_list' }, (response) => {
                if (response.name === 'error') {
                    reject(new Error(response.error));
                }
                else if (response.list) {
                    resolve(response.list);
                }
                else {
                    resolve([]);
                }
            });
        });
    }
    async downloadProject(project, localPath) {
        if (this.state !== 'connected') {
            throw new Error(i18n_1.I18n.t('login_required_download'));
        }
        const projectId = project.id;
        const folders = ["ms", "sprites", "maps", "sounds", "music", "assets", "doc"];
        // Ensure local directory exists
        if (!fs.existsSync(localPath)) {
            fs.mkdirSync(localPath, { recursive: true });
        }
        const projectFilesMetadata = {};
        for (const folder of folders) {
            const files = await this.listProjectFiles(projectId, folder);
            if (files && files.length > 0) {
                // Ensure the folder exists locally
                const localFolder = path.join(localPath, folder);
                if (!fs.existsSync(localFolder)) {
                    fs.mkdirSync(localFolder, { recursive: true });
                }
                for (const fileItem of files) {
                    const relativeFilePath = `${folder}/${fileItem.file}`;
                    const localFilePath = path.join(localPath, relativeFilePath);
                    // Download file content
                    const fileContent = await this.readProjectFile(projectId, relativeFilePath);
                    // Check if it is a text-based file
                    const isText = relativeFilePath.endsWith(".ms") ||
                        relativeFilePath.endsWith(".json") ||
                        relativeFilePath.endsWith(".md") ||
                        relativeFilePath.endsWith(".txt") ||
                        relativeFilePath.endsWith(".csv");
                    if (isText) {
                        fs.writeFileSync(localFilePath, fileContent, 'utf-8');
                    }
                    else {
                        fs.writeFileSync(localFilePath, Buffer.from(fileContent, 'base64'));
                    }
                    // Save metadata for project.json
                    projectFilesMetadata[relativeFilePath] = {
                        version: fileItem.version || 0,
                        size: fileItem.size || 0,
                        properties: fileItem.properties || {}
                    };
                }
            }
        }
        // Write local project.json
        const localProjectJson = {
            id: project.id,
            owner: project.owner?.nick || project.owner || "",
            title: project.title,
            slug: project.slug,
            tags: project.tags || [],
            orientation: project.orientation || "any",
            aspect: project.aspect || "free",
            platforms: project.platforms || ["computer", "phone", "tablet"],
            controls: project.controls || ["touch", "mouse"],
            type: project.type || "app",
            language: project.language || "microscript",
            graphics: project.graphics || "M1",
            networking: project.networking || false,
            libs: project.libs || [],
            tabs: project.tabs || { assets: true, sync: true },
            date_created: project.date_created || Date.now(),
            last_modified: project.last_modified || Date.now(),
            files: projectFilesMetadata,
            description: project.description || ""
        };
        const projectJsonPath = path.join(localPath, 'project.json');
        fs.writeFileSync(projectJsonPath, JSON.stringify(localProjectJson, null, 4), 'utf-8');
    }
    async uploadProject(localPath, progressCallback) {
        if (this.state !== 'connected') {
            throw new Error(i18n_1.I18n.t('login_required_upload'));
        }
        const pjPath = path.join(localPath, 'project.json');
        if (!fs.existsSync(pjPath)) {
            throw new Error(i18n_1.I18n.t('project_not_found'));
        }
        let projectJson = {};
        try {
            projectJson = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
        }
        catch (e) {
            throw new Error(`Error reading project.json: ${e.message}`);
        }
        const slug = projectJson.slug || path.basename(localPath);
        const title = projectJson.title || slug;
        // 1. Fetch remote projects list
        progressCallback?.(i18n_1.I18n.t('login_connecting'), 5);
        const remoteList = await this.getRemoteProjects();
        let targetProject = null;
        // A. Check if project.json already has an ID
        if (projectJson.id) {
            targetProject = remoteList.find((p) => p.id === projectJson.id);
        }
        // B. Search by slug or title
        if (!targetProject) {
            const clean = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const exactMatches = remoteList.filter((p) => (p.slug && p.slug.toLowerCase() === slug.toLowerCase()) ||
                (p.title && p.title.toLowerCase() === title.toLowerCase()) ||
                clean(p.slug) === clean(slug) ||
                clean(p.title) === clean(title));
            if (exactMatches.length === 1) {
                targetProject = exactMatches[0];
            }
            else {
                const items = [];
                if (exactMatches.length > 0) {
                    items.push({
                        label: i18n_1.I18n.t('suggested_matches'),
                        kind: vscode.QuickPickItemKind.Separator
                    });
                    for (const p of exactMatches) {
                        items.push({
                            label: `$(cloud) ${p.title}`,
                            description: `slug: ${p.slug}`,
                            detail: `ID: ${p.id}`,
                            project: p
                        });
                    }
                }
                items.push({
                    label: i18n_1.I18n.t('all_remote_projects'),
                    kind: vscode.QuickPickItemKind.Separator
                });
                for (const p of remoteList) {
                    if (!exactMatches.includes(p)) {
                        items.push({
                            label: `$(cloud) ${p.title}`,
                            description: `slug: ${p.slug}`,
                            detail: `ID: ${p.id}`,
                            project: p
                        });
                    }
                }
                items.push({
                    label: '---',
                    kind: vscode.QuickPickItemKind.Separator
                });
                items.push({
                    label: `$(plus) ${i18n_1.I18n.t('create_new_remote', title)}`,
                    description: slug,
                    createNew: true
                });
                const picked = await vscode.window.showQuickPick(items, {
                    placeHolder: i18n_1.I18n.t('select_remote_project_prompt', title),
                    title: i18n_1.I18n.t('select_remote_project_title')
                });
                if (!picked) {
                    throw new Error(i18n_1.I18n.t('upload_cancelling'));
                }
                if (picked.createNew) {
                    progressCallback?.(i18n_1.I18n.t('upload_creating_remote', title), 10);
                    targetProject = await this.createRemoteProject({
                        title: title,
                        slug: slug,
                        type: projectJson.type || 'game',
                        graphics: projectJson.graphics || 'standard',
                        language: projectJson.language || 'microscript_v2',
                        libs: projectJson.libs || []
                    });
                }
                else {
                    targetProject = picked.project;
                }
            }
        }
        if (!targetProject || !targetProject.id) {
            throw new Error("Could not pair remote project.");
        }
        const projectId = targetProject.id;
        console.log(`Uploading to remote project ID ${projectId} (${targetProject.title})`);
        // Save matched ID to project.json for fast future updates
        projectJson.id = targetProject.id;
        projectJson.slug = targetProject.slug;
        try {
            fs.writeFileSync(pjPath, JSON.stringify(projectJson, null, 4), 'utf8');
        }
        catch (e) { }
        // 3. Update project options
        progressCallback?.(i18n_1.I18n.t('upload_syncing_options'), 20);
        const optionsToSync = ['title', 'orientation', 'aspect', 'type', 'language', 'graphics', 'libs'];
        for (const opt of optionsToSync) {
            if (projectJson[opt] !== undefined) {
                try {
                    await this.setProjectOption(projectId, opt, projectJson[opt]);
                }
                catch (e) {
                    console.warn(`Failed to set option ${opt}:`, e);
                }
            }
        }
        // 4. Collect all local files
        const folders = ["ms", "sprites", "maps", "sounds", "music", "assets", "doc"];
        const filesToUpload = [];
        for (const folder of folders) {
            const folderPath = path.join(localPath, folder);
            if (fs.existsSync(folderPath)) {
                this.collectFilesRecursively(folderPath, folder, filesToUpload);
            }
        }
        // 5. Upload files sequentially
        const total = filesToUpload.length;
        for (let i = 0; i < total; i++) {
            const item = filesToUpload[i];
            const percent = 20 + Math.round(((i + 1) / (total || 1)) * 75);
            progressCallback?.(`Wysyłanie ${item.relativePath} (${i + 1}/${total})...`, percent);
            // microStudio server requires all source code files in ms/ to have .ms extension
            let remoteRelativePath = item.relativePath;
            if (remoteRelativePath.startsWith('ms/') && !remoteRelativePath.endsWith('.ms')) {
                remoteRelativePath = remoteRelativePath.replace(/\.(js|py|lua|txt)$/i, '') + '.ms';
            }
            const isText = item.relativePath.endsWith(".ms") ||
                item.relativePath.endsWith(".js") ||
                item.relativePath.endsWith(".py") ||
                item.relativePath.endsWith(".lua") ||
                item.relativePath.endsWith(".json") ||
                item.relativePath.endsWith(".md") ||
                item.relativePath.endsWith(".txt") ||
                item.relativePath.endsWith(".csv");
            let content;
            if (isText) {
                content = fs.readFileSync(item.fullPath, 'utf8');
            }
            else {
                content = fs.readFileSync(item.fullPath).toString('base64');
            }
            let properties = {};
            if (projectJson.files && projectJson.files[item.relativePath] && projectJson.files[item.relativePath].properties) {
                properties = projectJson.files[item.relativePath].properties;
            }
            try {
                await this.writeProjectFile(projectId, remoteRelativePath, content, properties);
            }
            catch (err) {
                console.warn(`Error uploading ${remoteRelativePath}:`, err);
            }
        }
        progressCallback?.("Zakończono synchronizację!", 100);
        return { title, slug };
    }
    collectFilesRecursively(dir, baseRelative, result) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = `${baseRelative}/${entry.name}`;
            if (entry.isDirectory()) {
                this.collectFilesRecursively(fullPath, relativePath, result);
            }
            else if (entry.isFile()) {
                result.push({ relativePath, fullPath });
            }
        }
    }
    createRemoteProject(data) {
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(async () => {
                try {
                    const list = await this.getRemoteProjects();
                    const found = list.find((p) => p.slug === data.slug || p.title === data.title);
                    if (found)
                        resolve(found);
                    else
                        reject(new Error("Timeout przy tworzeniu projektu zdalnego."));
                }
                catch (e) {
                    reject(new Error("Timeout przy tworzeniu projektu zdalnego."));
                }
            }, 5000);
            this.sendRequest({
                name: 'create_project',
                title: data.title,
                slug: data.slug,
                type: data.type || 'game',
                graphics: data.graphics || 'standard',
                language: data.language || 'microscript_v2',
                libs: data.libs || []
            }, async (response) => {
                clearTimeout(timeout);
                if (response.name === 'error') {
                    reject(new Error(response.error));
                }
                else if (response.id) {
                    resolve(response);
                }
                else if (response.name === 'project_created') {
                    const list = await this.getRemoteProjects();
                    const found = list.find((p) => p.slug === data.slug || p.title === data.title);
                    resolve(found || { id: response.id, slug: data.slug, title: data.title });
                }
                else {
                    resolve({ slug: data.slug, title: data.title });
                }
            });
        });
    }
    writeProjectFile(projectId, file, content, properties = {}) {
        return new Promise((resolve, reject) => {
            let resolved = false;
            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            }, 350);
            this.sendRequest({
                name: 'write_project_file',
                project: projectId,
                file: file,
                content: content,
                properties: properties
            }, (response) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    if (response.name === 'error') {
                        reject(new Error(response.error));
                    }
                    else {
                        resolve();
                    }
                }
            });
        });
    }
    setProjectOption(projectId, option, value) {
        return new Promise((resolve, reject) => {
            let resolved = false;
            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            }, 300);
            this.sendRequest({
                name: 'set_project_option',
                project: projectId,
                option: option,
                value: value
            }, (response) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    if (response.name === 'error') {
                        reject(new Error(response.error));
                    }
                    else {
                        resolve();
                    }
                }
            });
        });
    }
    listProjectFiles(projectId, folder) {
        return new Promise((resolve) => {
            this.sendRequest({
                name: 'list_project_files',
                project: projectId,
                folder: folder
            }, (response) => {
                if (response.files) {
                    resolve(response.files);
                }
                else {
                    resolve([]);
                }
            });
        });
    }
    readProjectFile(projectId, filePath) {
        return new Promise((resolve, reject) => {
            this.sendRequest({
                name: 'read_project_file',
                project: projectId,
                file: filePath
            }, (response) => {
                if (response.name === 'error') {
                    reject(new Error(response.error));
                }
                else if (response.content !== undefined) {
                    resolve(response.content);
                }
                else {
                    resolve('');
                }
            });
        });
    }
    sendRequest(msg, callback) {
        msg.request_id = this.requestId++;
        this.pendingRequests[msg.request_id] = callback;
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(msg));
        }
        else {
            // If socket is not open, trigger error response after short delay
            setTimeout(() => {
                if (this.pendingRequests[msg.request_id]) {
                    this.pendingRequests[msg.request_id]({
                        name: 'error',
                        error: 'Brak połączenia z serwerem.',
                        request_id: msg.request_id
                    });
                    delete this.pendingRequests[msg.request_id];
                }
            }, 100);
        }
    }
    handleServerMessage(msg) {
        if (msg.name === 'project_file_update') {
            console.log('Remote file updated', msg);
        }
    }
}
exports.MicroStudioSync = MicroStudioSync;


/***/ }),
/* 7 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const createWebSocketStream = __webpack_require__(8);
const extension = __webpack_require__(29);
const PerMessageDeflate = __webpack_require__(18);
const Receiver = __webpack_require__(23);
const Sender = __webpack_require__(26);
const subprotocol = __webpack_require__(30);
const WebSocket = __webpack_require__(9);
const WebSocketServer = __webpack_require__(31);

WebSocket.createWebSocketStream = createWebSocketStream;
WebSocket.extension = extension;
WebSocket.PerMessageDeflate = PerMessageDeflate;
WebSocket.Receiver = Receiver;
WebSocket.Sender = Sender;
WebSocket.Server = WebSocketServer;
WebSocket.subprotocol = subprotocol;
WebSocket.WebSocket = WebSocket;
WebSocket.WebSocketServer = WebSocketServer;

module.exports = WebSocket;


/***/ }),
/* 8 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^WebSocket$" }] */


const WebSocket = __webpack_require__(9);
const { Duplex } = __webpack_require__(16);

/**
 * Emits the `'close'` event on a stream.
 *
 * @param {Duplex} stream The stream.
 * @private
 */
function emitClose(stream) {
  stream.emit('close');
}

/**
 * The listener of the `'end'` event.
 *
 * @private
 */
function duplexOnEnd() {
  if (!this.destroyed && this._writableState.finished) {
    this.destroy();
  }
}

/**
 * The listener of the `'error'` event.
 *
 * @param {Error} err The error
 * @private
 */
function duplexOnError(err) {
  this.removeListener('error', duplexOnError);
  this.destroy();
  if (this.listenerCount('error') === 0) {
    // Do not suppress the throwing behavior.
    this.emit('error', err);
  }
}

/**
 * Wraps a `WebSocket` in a duplex stream.
 *
 * @param {WebSocket} ws The `WebSocket` to wrap
 * @param {Object} [options] The options for the `Duplex` constructor
 * @return {Duplex} The duplex stream
 * @public
 */
function createWebSocketStream(ws, options) {
  let terminateOnDestroy = true;

  const duplex = new Duplex({
    ...options,
    autoDestroy: false,
    emitClose: false,
    objectMode: false,
    writableObjectMode: false
  });

  ws.on('message', function message(msg, isBinary) {
    const data =
      !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;

    if (!duplex.push(data)) ws.pause();
  });

  ws.once('error', function error(err) {
    if (duplex.destroyed) return;

    // Prevent `ws.terminate()` from being called by `duplex._destroy()`.
    //
    // - If the `'error'` event is emitted before the `'open'` event, then
    //   `ws.terminate()` is a noop as no socket is assigned.
    // - Otherwise, the error is re-emitted by the listener of the `'error'`
    //   event of the `Receiver` object. The listener already closes the
    //   connection by calling `ws.close()`. This allows a close frame to be
    //   sent to the other peer. If `ws.terminate()` is called right after this,
    //   then the close frame might not be sent.
    terminateOnDestroy = false;
    duplex.destroy(err);
  });

  ws.once('close', function close() {
    if (duplex.destroyed) return;

    duplex.push(null);
  });

  duplex._destroy = function (err, callback) {
    if (ws.readyState === ws.CLOSED) {
      callback(err);
      process.nextTick(emitClose, duplex);
      return;
    }

    let called = false;

    ws.once('error', function error(err) {
      called = true;
      callback(err);
    });

    ws.once('close', function close() {
      if (!called) callback(err);
      process.nextTick(emitClose, duplex);
    });

    if (terminateOnDestroy) ws.terminate();
  };

  duplex._final = function (callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        duplex._final(callback);
      });
      return;
    }

    // If the value of the `_socket` property is `null` it means that `ws` is a
    // client websocket and the handshake failed. In fact, when this happens, a
    // socket is never assigned to the websocket. Wait for the `'error'` event
    // that will be emitted by the websocket.
    if (ws._socket === null) return;

    if (ws._socket._writableState.finished) {
      callback();
      if (duplex._readableState.endEmitted) duplex.destroy();
    } else {
      ws._socket.once('finish', function finish() {
        // `duplex` is not destroyed here because the `'end'` event will be
        // emitted on `duplex` after this `'finish'` event. The EOF signaling
        // `null` chunk is, in fact, pushed when the websocket emits `'close'`.
        callback();
      });
      ws.close();
    }
  };

  duplex._read = function () {
    if (ws.isPaused) ws.resume();
  };

  duplex._write = function (chunk, encoding, callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        duplex._write(chunk, encoding, callback);
      });
      return;
    }

    ws.send(chunk, callback);
  };

  duplex.on('end', duplexOnEnd);
  duplex.on('error', duplexOnError);
  return duplex;
}

module.exports = createWebSocketStream;


/***/ }),
/* 9 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex|Readable$", "caughtErrors": "none" }] */



const EventEmitter = __webpack_require__(10);
const https = __webpack_require__(11);
const http = __webpack_require__(12);
const net = __webpack_require__(13);
const tls = __webpack_require__(14);
const { randomBytes, createHash } = __webpack_require__(15);
const { Duplex, Readable } = __webpack_require__(16);
const { URL } = __webpack_require__(17);

const PerMessageDeflate = __webpack_require__(18);
const Receiver = __webpack_require__(23);
const Sender = __webpack_require__(26);
const { isBlob } = __webpack_require__(24);

const {
  BINARY_TYPES,
  CLOSE_TIMEOUT,
  EMPTY_BUFFER,
  GUID,
  kForOnEventAttribute,
  kListener,
  kStatusCode,
  kWebSocket,
  NOOP
} = __webpack_require__(21);
const {
  EventTarget: { addEventListener, removeEventListener }
} = __webpack_require__(28);
const { format, parse } = __webpack_require__(29);
const { toBuffer } = __webpack_require__(20);

const kAborted = Symbol('kAborted');
const protocolVersions = [8, 13];
const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
const subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;

/**
 * Class representing a WebSocket.
 *
 * @extends EventEmitter
 */
class WebSocket extends EventEmitter {
  /**
   * Create a new `WebSocket`.
   *
   * @param {(String|URL)} address The URL to which to connect
   * @param {(String|String[])} [protocols] The subprotocols
   * @param {Object} [options] Connection options
   */
  constructor(address, protocols, options) {
    super();

    this._binaryType = BINARY_TYPES[0];
    this._closeCode = 1006;
    this._closeFrameReceived = false;
    this._closeFrameSent = false;
    this._closeMessage = EMPTY_BUFFER;
    this._closeTimer = null;
    this._errorEmitted = false;
    this._extensions = {};
    this._paused = false;
    this._protocol = '';
    this._readyState = WebSocket.CONNECTING;
    this._receiver = null;
    this._sender = null;
    this._socket = null;

    if (address !== null) {
      this._bufferedAmount = 0;
      this._isServer = false;
      this._redirects = 0;

      if (protocols === undefined) {
        protocols = [];
      } else if (!Array.isArray(protocols)) {
        if (typeof protocols === 'object' && protocols !== null) {
          options = protocols;
          protocols = [];
        } else {
          protocols = [protocols];
        }
      }

      initAsClient(this, address, protocols, options);
    } else {
      this._autoPong = options.autoPong;
      this._closeTimeout = options.closeTimeout;
      this._isServer = true;
    }
  }

  /**
   * For historical reasons, the custom "nodebuffer" type is used by the default
   * instead of "blob".
   *
   * @type {String}
   */
  get binaryType() {
    return this._binaryType;
  }

  set binaryType(type) {
    if (!BINARY_TYPES.includes(type)) return;

    this._binaryType = type;

    //
    // Allow to change `binaryType` on the fly.
    //
    if (this._receiver) this._receiver._binaryType = type;
  }

  /**
   * @type {Number}
   */
  get bufferedAmount() {
    if (!this._socket) return this._bufferedAmount;

    return this._socket._writableState.length + this._sender._bufferedBytes;
  }

  /**
   * @type {String}
   */
  get extensions() {
    return Object.keys(this._extensions).join();
  }

  /**
   * @type {Boolean}
   */
  get isPaused() {
    return this._paused;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onclose() {
    return null;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onerror() {
    return null;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onopen() {
    return null;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onmessage() {
    return null;
  }

  /**
   * @type {String}
   */
  get protocol() {
    return this._protocol;
  }

  /**
   * @type {Number}
   */
  get readyState() {
    return this._readyState;
  }

  /**
   * @type {String}
   */
  get url() {
    return this._url;
  }

  /**
   * Set up the socket and the internal resources.
   *
   * @param {Duplex} socket The network socket between the server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Object} options Options object
   * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
   *     multiple times in the same tick
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Number} [options.maxBufferedChunks=0] The maximum number of
   *     buffered data chunks
   * @param {Number} [options.maxFragments=0] The maximum number of message
   *     fragments
   * @param {Number} [options.maxPayload=0] The maximum allowed message size
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   * @private
   */
  setSocket(socket, head, options) {
    const receiver = new Receiver({
      allowSynchronousEvents: options.allowSynchronousEvents,
      binaryType: this.binaryType,
      extensions: this._extensions,
      isServer: this._isServer,
      maxBufferedChunks: options.maxBufferedChunks,
      maxFragments: options.maxFragments,
      maxPayload: options.maxPayload,
      skipUTF8Validation: options.skipUTF8Validation
    });

    const sender = new Sender(socket, this._extensions, options.generateMask);

    this._receiver = receiver;
    this._sender = sender;
    this._socket = socket;

    receiver[kWebSocket] = this;
    sender[kWebSocket] = this;
    socket[kWebSocket] = this;

    receiver.on('conclude', receiverOnConclude);
    receiver.on('drain', receiverOnDrain);
    receiver.on('error', receiverOnError);
    receiver.on('message', receiverOnMessage);
    receiver.on('ping', receiverOnPing);
    receiver.on('pong', receiverOnPong);

    sender.onerror = senderOnError;

    //
    // These methods may not be available if `socket` is just a `Duplex`.
    //
    if (socket.setTimeout) socket.setTimeout(0);
    if (socket.setNoDelay) socket.setNoDelay();

    if (head.length > 0) socket.unshift(head);

    socket.on('close', socketOnClose);
    socket.on('data', socketOnData);
    socket.on('end', socketOnEnd);
    socket.on('error', socketOnError);

    this._readyState = WebSocket.OPEN;
    this.emit('open');
  }

  /**
   * Emit the `'close'` event.
   *
   * @private
   */
  emitClose() {
    if (!this._socket) {
      this._readyState = WebSocket.CLOSED;
      this.emit('close', this._closeCode, this._closeMessage);
      return;
    }

    if (this._extensions[PerMessageDeflate.extensionName]) {
      this._extensions[PerMessageDeflate.extensionName].cleanup();
    }

    this._receiver.removeAllListeners();
    this._readyState = WebSocket.CLOSED;
    this.emit('close', this._closeCode, this._closeMessage);
  }

  /**
   * Start a closing handshake.
   *
   *          +----------+   +-----------+   +----------+
   *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
   *    |     +----------+   +-----------+   +----------+     |
   *          +----------+   +-----------+         |
   * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
   *          +----------+   +-----------+   |
   *    |           |                        |   +---+        |
   *                +------------------------+-->|fin| - - - -
   *    |         +---+                      |   +---+
   *     - - - - -|fin|<---------------------+
   *              +---+
   *
   * @param {Number} [code] Status code explaining why the connection is closing
   * @param {(String|Buffer)} [data] The reason why the connection is
   *     closing
   * @public
   */
  close(code, data) {
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      abortHandshake(this, this._req, msg);
      return;
    }

    if (this.readyState === WebSocket.CLOSING) {
      if (
        this._closeFrameSent &&
        (this._closeFrameReceived || this._receiver._writableState.errorEmitted)
      ) {
        this._socket.end();
      }

      return;
    }

    this._readyState = WebSocket.CLOSING;
    this._sender.close(code, data, !this._isServer, (err) => {
      //
      // This error is handled by the `'error'` listener on the socket. We only
      // want to know if the close frame has been sent here.
      //
      if (err) return;

      this._closeFrameSent = true;

      if (
        this._closeFrameReceived ||
        this._receiver._writableState.errorEmitted
      ) {
        this._socket.end();
      }
    });

    setCloseTimer(this);
  }

  /**
   * Pause the socket.
   *
   * @public
   */
  pause() {
    if (
      this.readyState === WebSocket.CONNECTING ||
      this.readyState === WebSocket.CLOSED
    ) {
      return;
    }

    this._paused = true;
    this._socket.pause();
  }

  /**
   * Send a ping.
   *
   * @param {*} [data] The data to send
   * @param {Boolean} [mask] Indicates whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when the ping is sent
   * @public
   */
  ping(data, mask, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof data === 'function') {
      cb = data;
      data = mask = undefined;
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = undefined;
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    if (mask === undefined) mask = !this._isServer;
    this._sender.ping(data || EMPTY_BUFFER, mask, cb);
  }

  /**
   * Send a pong.
   *
   * @param {*} [data] The data to send
   * @param {Boolean} [mask] Indicates whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when the pong is sent
   * @public
   */
  pong(data, mask, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof data === 'function') {
      cb = data;
      data = mask = undefined;
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = undefined;
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    if (mask === undefined) mask = !this._isServer;
    this._sender.pong(data || EMPTY_BUFFER, mask, cb);
  }

  /**
   * Resume the socket.
   *
   * @public
   */
  resume() {
    if (
      this.readyState === WebSocket.CONNECTING ||
      this.readyState === WebSocket.CLOSED
    ) {
      return;
    }

    this._paused = false;
    if (!this._receiver._writableState.needDrain) this._socket.resume();
  }

  /**
   * Send a data message.
   *
   * @param {*} data The message to send
   * @param {Object} [options] Options object
   * @param {Boolean} [options.binary] Specifies whether `data` is binary or
   *     text
   * @param {Boolean} [options.compress] Specifies whether or not to compress
   *     `data`
   * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
   *     last one
   * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when data is written out
   * @public
   */
  send(data, options, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    const opts = {
      binary: typeof data !== 'string',
      mask: !this._isServer,
      compress: true,
      fin: true,
      ...options
    };

    if (!this._extensions[PerMessageDeflate.extensionName]) {
      opts.compress = false;
    }

    this._sender.send(data || EMPTY_BUFFER, opts, cb);
  }

  /**
   * Forcibly close the connection.
   *
   * @public
   */
  terminate() {
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      abortHandshake(this, this._req, msg);
      return;
    }

    if (this._socket) {
      this._readyState = WebSocket.CLOSING;
      this._socket.destroy();
    }
  }
}

/**
 * @constant {Number} CONNECTING
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CONNECTING', {
  enumerable: true,
  value: readyStates.indexOf('CONNECTING')
});

/**
 * @constant {Number} CONNECTING
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CONNECTING', {
  enumerable: true,
  value: readyStates.indexOf('CONNECTING')
});

/**
 * @constant {Number} OPEN
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'OPEN', {
  enumerable: true,
  value: readyStates.indexOf('OPEN')
});

/**
 * @constant {Number} OPEN
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'OPEN', {
  enumerable: true,
  value: readyStates.indexOf('OPEN')
});

/**
 * @constant {Number} CLOSING
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CLOSING', {
  enumerable: true,
  value: readyStates.indexOf('CLOSING')
});

/**
 * @constant {Number} CLOSING
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CLOSING', {
  enumerable: true,
  value: readyStates.indexOf('CLOSING')
});

/**
 * @constant {Number} CLOSED
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CLOSED', {
  enumerable: true,
  value: readyStates.indexOf('CLOSED')
});

/**
 * @constant {Number} CLOSED
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CLOSED', {
  enumerable: true,
  value: readyStates.indexOf('CLOSED')
});

[
  'binaryType',
  'bufferedAmount',
  'extensions',
  'isPaused',
  'protocol',
  'readyState',
  'url'
].forEach((property) => {
  Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
});

//
// Add the `onopen`, `onerror`, `onclose`, and `onmessage` attributes.
// See https://html.spec.whatwg.org/multipage/comms.html#the-websocket-interface
//
['open', 'error', 'close', 'message'].forEach((method) => {
  Object.defineProperty(WebSocket.prototype, `on${method}`, {
    enumerable: true,
    get() {
      for (const listener of this.listeners(method)) {
        if (listener[kForOnEventAttribute]) return listener[kListener];
      }

      return null;
    },
    set(handler) {
      for (const listener of this.listeners(method)) {
        if (listener[kForOnEventAttribute]) {
          this.removeListener(method, listener);
          break;
        }
      }

      if (typeof handler !== 'function') return;

      this.addEventListener(method, handler, {
        [kForOnEventAttribute]: true
      });
    }
  });
});

WebSocket.prototype.addEventListener = addEventListener;
WebSocket.prototype.removeEventListener = removeEventListener;

module.exports = WebSocket;

/**
 * Initialize a WebSocket client.
 *
 * @param {WebSocket} websocket The client to initialize
 * @param {(String|URL)} address The URL to which to connect
 * @param {Array} protocols The subprotocols
 * @param {Object} [options] Connection options
 * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether any
 *     of the `'message'`, `'ping'`, and `'pong'` events can be emitted multiple
 *     times in the same tick
 * @param {Boolean} [options.autoPong=true] Specifies whether or not to
 *     automatically send a pong in response to a ping
 * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to wait
 *     for the closing handshake to finish after `websocket.close()` is called
 * @param {Function} [options.finishRequest] A function which can be used to
 *     customize the headers of each http request before it is sent
 * @param {Boolean} [options.followRedirects=false] Whether or not to follow
 *     redirects
 * @param {Function} [options.generateMask] The function used to generate the
 *     masking key
 * @param {Number} [options.handshakeTimeout] Timeout in milliseconds for the
 *     handshake request
 * @param {Number} [options.maxBufferedChunks=1048576] The maximum number of
 *     buffered data chunks
 * @param {Number} [options.maxFragments=131072] The maximum number of message
 *     fragments
 * @param {Number} [options.maxPayload=104857600] The maximum allowed message
 *     size
 * @param {Number} [options.maxRedirects=10] The maximum number of redirects
 *     allowed
 * @param {String} [options.origin] Value of the `Origin` or
 *     `Sec-WebSocket-Origin` header
 * @param {(Boolean|Object)} [options.perMessageDeflate=true] Enable/disable
 *     permessage-deflate
 * @param {Number} [options.protocolVersion=13] Value of the
 *     `Sec-WebSocket-Version` header
 * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
 *     not to skip UTF-8 validation for text and close messages
 * @private
 */
function initAsClient(websocket, address, protocols, options) {
  const opts = {
    allowSynchronousEvents: true,
    autoPong: true,
    closeTimeout: CLOSE_TIMEOUT,
    protocolVersion: protocolVersions[1],
    maxBufferedChunks: 1024 * 1024,
    maxFragments: 128 * 1024,
    maxPayload: 100 * 1024 * 1024,
    skipUTF8Validation: false,
    perMessageDeflate: true,
    followRedirects: false,
    maxRedirects: 10,
    ...options,
    socketPath: undefined,
    hostname: undefined,
    protocol: undefined,
    timeout: undefined,
    method: 'GET',
    host: undefined,
    path: undefined,
    port: undefined
  };

  websocket._autoPong = opts.autoPong;
  websocket._closeTimeout = opts.closeTimeout;

  if (!protocolVersions.includes(opts.protocolVersion)) {
    throw new RangeError(
      `Unsupported protocol version: ${opts.protocolVersion} ` +
        `(supported versions: ${protocolVersions.join(', ')})`
    );
  }

  let parsedUrl;

  if (address instanceof URL) {
    parsedUrl = address;
  } else {
    try {
      parsedUrl = new URL(address);
    } catch {
      throw new SyntaxError(`Invalid URL: ${address}`);
    }
  }

  if (parsedUrl.protocol === 'http:') {
    parsedUrl.protocol = 'ws:';
  } else if (parsedUrl.protocol === 'https:') {
    parsedUrl.protocol = 'wss:';
  }

  websocket._url = parsedUrl.href;

  const isSecure = parsedUrl.protocol === 'wss:';
  const isIpcUrl = parsedUrl.protocol === 'ws+unix:';
  let invalidUrlMessage;

  if (parsedUrl.protocol !== 'ws:' && !isSecure && !isIpcUrl) {
    invalidUrlMessage =
      'The URL\'s protocol must be one of "ws:", "wss:", ' +
      '"http:", "https:", or "ws+unix:"';
  } else if (isIpcUrl && !parsedUrl.pathname) {
    invalidUrlMessage = "The URL's pathname is empty";
  } else if (parsedUrl.hash) {
    invalidUrlMessage = 'The URL contains a fragment identifier';
  }

  if (invalidUrlMessage) {
    const err = new SyntaxError(invalidUrlMessage);

    if (websocket._redirects === 0) {
      throw err;
    } else {
      emitErrorAndClose(websocket, err);
      return;
    }
  }

  const defaultPort = isSecure ? 443 : 80;
  const key = randomBytes(16).toString('base64');
  const request = isSecure ? https.request : http.request;
  const protocolSet = new Set();
  let perMessageDeflate;

  opts.createConnection =
    opts.createConnection || (isSecure ? tlsConnect : netConnect);
  opts.defaultPort = opts.defaultPort || defaultPort;
  opts.port = parsedUrl.port || defaultPort;
  opts.host = parsedUrl.hostname.startsWith('[')
    ? parsedUrl.hostname.slice(1, -1)
    : parsedUrl.hostname;
  opts.headers = {
    ...opts.headers,
    'Sec-WebSocket-Version': opts.protocolVersion,
    'Sec-WebSocket-Key': key,
    Connection: 'Upgrade',
    Upgrade: 'websocket'
  };
  opts.path = parsedUrl.pathname + parsedUrl.search;
  opts.timeout = opts.handshakeTimeout;

  if (opts.perMessageDeflate) {
    perMessageDeflate = new PerMessageDeflate({
      ...opts.perMessageDeflate,
      isServer: false,
      maxPayload: opts.maxPayload
    });
    opts.headers['Sec-WebSocket-Extensions'] = format({
      [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
    });
  }
  if (protocols.length) {
    for (const protocol of protocols) {
      if (
        typeof protocol !== 'string' ||
        !subprotocolRegex.test(protocol) ||
        protocolSet.has(protocol)
      ) {
        throw new SyntaxError(
          'An invalid or duplicated subprotocol was specified'
        );
      }

      protocolSet.add(protocol);
    }

    opts.headers['Sec-WebSocket-Protocol'] = protocols.join(',');
  }
  if (opts.origin) {
    if (opts.protocolVersion < 13) {
      opts.headers['Sec-WebSocket-Origin'] = opts.origin;
    } else {
      opts.headers.Origin = opts.origin;
    }
  }
  if (parsedUrl.username || parsedUrl.password) {
    opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
  }

  if (isIpcUrl) {
    const parts = opts.path.split(':');

    opts.socketPath = parts[0];
    opts.path = parts[1];
  }

  let req;

  if (opts.followRedirects) {
    if (websocket._redirects === 0) {
      websocket._originalIpc = isIpcUrl;
      websocket._originalSecure = isSecure;
      websocket._originalHostOrSocketPath = isIpcUrl
        ? opts.socketPath
        : parsedUrl.host;

      const headers = options && options.headers;

      //
      // Shallow copy the user provided options so that headers can be changed
      // without mutating the original object.
      //
      options = { ...options, headers: {} };

      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          options.headers[key.toLowerCase()] = value;
        }
      }
    } else if (websocket.listenerCount('redirect') === 0) {
      const isSameHost = isIpcUrl
        ? websocket._originalIpc
          ? opts.socketPath === websocket._originalHostOrSocketPath
          : false
        : websocket._originalIpc
          ? false
          : parsedUrl.host === websocket._originalHostOrSocketPath;

      if (!isSameHost || (websocket._originalSecure && !isSecure)) {
        //
        // Match curl 7.77.0 behavior and drop the following headers. These
        // headers are also dropped when following a redirect to a subdomain.
        //
        delete opts.headers.authorization;
        delete opts.headers.cookie;

        if (!isSameHost) delete opts.headers.host;

        opts.auth = undefined;
      }
    }

    //
    // Match curl 7.77.0 behavior and make the first `Authorization` header win.
    // If the `Authorization` header is set, then there is nothing to do as it
    // will take precedence.
    //
    if (opts.auth && !options.headers.authorization) {
      options.headers.authorization =
        'Basic ' + Buffer.from(opts.auth).toString('base64');
    }

    req = websocket._req = request(opts);

    if (websocket._redirects) {
      //
      // Unlike what is done for the `'upgrade'` event, no early exit is
      // triggered here if the user calls `websocket.close()` or
      // `websocket.terminate()` from a listener of the `'redirect'` event. This
      // is because the user can also call `request.destroy()` with an error
      // before calling `websocket.close()` or `websocket.terminate()` and this
      // would result in an error being emitted on the `request` object with no
      // `'error'` event listeners attached.
      //
      websocket.emit('redirect', websocket.url, req);
    }
  } else {
    req = websocket._req = request(opts);
  }

  if (opts.timeout) {
    req.on('timeout', () => {
      abortHandshake(websocket, req, 'Opening handshake has timed out');
    });
  }

  req.on('error', (err) => {
    if (req === null || req[kAborted]) return;

    req = websocket._req = null;
    emitErrorAndClose(websocket, err);
  });

  req.on('response', (res) => {
    const location = res.headers.location;
    const statusCode = res.statusCode;

    if (
      location &&
      opts.followRedirects &&
      statusCode >= 300 &&
      statusCode < 400
    ) {
      if (++websocket._redirects > opts.maxRedirects) {
        abortHandshake(websocket, req, 'Maximum redirects exceeded');
        return;
      }

      req.abort();

      let addr;

      try {
        addr = new URL(location, address);
      } catch (e) {
        const err = new SyntaxError(`Invalid URL: ${location}`);
        emitErrorAndClose(websocket, err);
        return;
      }

      initAsClient(websocket, addr, protocols, options);
    } else if (!websocket.emit('unexpected-response', req, res)) {
      abortHandshake(
        websocket,
        req,
        `Unexpected server response: ${res.statusCode}`
      );
    }
  });

  req.on('upgrade', (res, socket, head) => {
    websocket.emit('upgrade', res);

    //
    // The user may have closed the connection from a listener of the
    // `'upgrade'` event.
    //
    if (websocket.readyState !== WebSocket.CONNECTING) return;

    req = websocket._req = null;

    const upgrade = res.headers.upgrade;

    if (upgrade === undefined || upgrade.toLowerCase() !== 'websocket') {
      abortHandshake(websocket, socket, 'Invalid Upgrade header');
      return;
    }

    const digest = createHash('sha1')
      .update(key + GUID)
      .digest('base64');

    if (res.headers['sec-websocket-accept'] !== digest) {
      abortHandshake(websocket, socket, 'Invalid Sec-WebSocket-Accept header');
      return;
    }

    const serverProt = res.headers['sec-websocket-protocol'];
    let protError;

    if (serverProt !== undefined) {
      if (!protocolSet.size) {
        protError = 'Server sent a subprotocol but none was requested';
      } else if (!protocolSet.has(serverProt)) {
        protError = 'Server sent an invalid subprotocol';
      }
    } else if (protocolSet.size) {
      protError = 'Server sent no subprotocol';
    }

    if (protError) {
      abortHandshake(websocket, socket, protError);
      return;
    }

    if (serverProt) websocket._protocol = serverProt;

    const secWebSocketExtensions = res.headers['sec-websocket-extensions'];

    if (secWebSocketExtensions !== undefined) {
      if (!perMessageDeflate) {
        const message =
          'Server sent a Sec-WebSocket-Extensions header but no extension ' +
          'was requested';
        abortHandshake(websocket, socket, message);
        return;
      }

      let extensions;

      try {
        extensions = parse(secWebSocketExtensions);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Extensions header';
        abortHandshake(websocket, socket, message);
        return;
      }

      const extensionNames = Object.keys(extensions);

      if (
        extensionNames.length !== 1 ||
        extensionNames[0] !== PerMessageDeflate.extensionName
      ) {
        const message = 'Server indicated an extension that was not requested';
        abortHandshake(websocket, socket, message);
        return;
      }

      try {
        perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Extensions header';
        abortHandshake(websocket, socket, message);
        return;
      }

      websocket._extensions[PerMessageDeflate.extensionName] =
        perMessageDeflate;
    }

    websocket.setSocket(socket, head, {
      allowSynchronousEvents: opts.allowSynchronousEvents,
      generateMask: opts.generateMask,
      maxBufferedChunks: opts.maxBufferedChunks,
      maxFragments: opts.maxFragments,
      maxPayload: opts.maxPayload,
      skipUTF8Validation: opts.skipUTF8Validation
    });
  });

  if (opts.finishRequest) {
    opts.finishRequest(req, websocket);
  } else {
    req.end();
  }
}

/**
 * Emit the `'error'` and `'close'` events.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {Error} The error to emit
 * @private
 */
function emitErrorAndClose(websocket, err) {
  websocket._readyState = WebSocket.CLOSING;
  //
  // The following assignment is practically useless and is done only for
  // consistency.
  //
  websocket._errorEmitted = true;
  websocket.emit('error', err);
  websocket.emitClose();
}

/**
 * Create a `net.Socket` and initiate a connection.
 *
 * @param {Object} options Connection options
 * @return {net.Socket} The newly created socket used to start the connection
 * @private
 */
function netConnect(options) {
  options.path = options.socketPath;
  return net.connect(options);
}

/**
 * Create a `tls.TLSSocket` and initiate a connection.
 *
 * @param {Object} options Connection options
 * @return {tls.TLSSocket} The newly created socket used to start the connection
 * @private
 */
function tlsConnect(options) {
  options.path = undefined;

  if (!options.servername && options.servername !== '') {
    options.servername = net.isIP(options.host) ? '' : options.host;
  }

  return tls.connect(options);
}

/**
 * Abort the handshake and emit an error.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {(http.ClientRequest|net.Socket|tls.Socket)} stream The request to
 *     abort or the socket to destroy
 * @param {String} message The error message
 * @private
 */
function abortHandshake(websocket, stream, message) {
  websocket._readyState = WebSocket.CLOSING;

  const err = new Error(message);
  Error.captureStackTrace(err, abortHandshake);

  if (stream.setHeader) {
    stream[kAborted] = true;
    stream.abort();

    if (stream.socket && !stream.socket.destroyed) {
      //
      // On Node.js >= 14.3.0 `request.abort()` does not destroy the socket if
      // called after the request completed. See
      // https://github.com/websockets/ws/issues/1869.
      //
      stream.socket.destroy();
    }

    process.nextTick(emitErrorAndClose, websocket, err);
  } else {
    stream.destroy(err);
    stream.once('error', websocket.emit.bind(websocket, 'error'));
    stream.once('close', websocket.emitClose.bind(websocket));
  }
}

/**
 * Handle cases where the `ping()`, `pong()`, or `send()` methods are called
 * when the `readyState` attribute is `CLOSING` or `CLOSED`.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {*} [data] The data to send
 * @param {Function} [cb] Callback
 * @private
 */
function sendAfterClose(websocket, data, cb) {
  if (data) {
    const length = isBlob(data) ? data.size : toBuffer(data).length;

    //
    // The `_bufferedAmount` property is used only when the peer is a client and
    // the opening handshake fails. Under these circumstances, in fact, the
    // `setSocket()` method is not called, so the `_socket` and `_sender`
    // properties are set to `null`.
    //
    if (websocket._socket) websocket._sender._bufferedBytes += length;
    else websocket._bufferedAmount += length;
  }

  if (cb) {
    const err = new Error(
      `WebSocket is not open: readyState ${websocket.readyState} ` +
        `(${readyStates[websocket.readyState]})`
    );
    process.nextTick(cb, err);
  }
}

/**
 * The listener of the `Receiver` `'conclude'` event.
 *
 * @param {Number} code The status code
 * @param {Buffer} reason The reason for closing
 * @private
 */
function receiverOnConclude(code, reason) {
  const websocket = this[kWebSocket];

  websocket._closeFrameReceived = true;
  websocket._closeMessage = reason;
  websocket._closeCode = code;

  if (websocket._socket[kWebSocket] === undefined) return;

  websocket._socket.removeListener('data', socketOnData);
  process.nextTick(resume, websocket._socket);

  if (code === 1005) websocket.close();
  else websocket.close(code, reason);
}

/**
 * The listener of the `Receiver` `'drain'` event.
 *
 * @private
 */
function receiverOnDrain() {
  const websocket = this[kWebSocket];

  if (!websocket.isPaused) websocket._socket.resume();
}

/**
 * The listener of the `Receiver` `'error'` event.
 *
 * @param {(RangeError|Error)} err The emitted error
 * @private
 */
function receiverOnError(err) {
  const websocket = this[kWebSocket];

  if (websocket._socket[kWebSocket] !== undefined) {
    websocket._socket.removeListener('data', socketOnData);

    //
    // On Node.js < 14.0.0 the `'error'` event is emitted synchronously. See
    // https://github.com/websockets/ws/issues/1940.
    //
    process.nextTick(resume, websocket._socket);

    websocket.close(err[kStatusCode]);
  }

  if (!websocket._errorEmitted) {
    websocket._errorEmitted = true;
    websocket.emit('error', err);
  }
}

/**
 * The listener of the `Receiver` `'finish'` event.
 *
 * @private
 */
function receiverOnFinish() {
  this[kWebSocket].emitClose();
}

/**
 * The listener of the `Receiver` `'message'` event.
 *
 * @param {Buffer|ArrayBuffer|Buffer[])} data The message
 * @param {Boolean} isBinary Specifies whether the message is binary or not
 * @private
 */
function receiverOnMessage(data, isBinary) {
  this[kWebSocket].emit('message', data, isBinary);
}

/**
 * The listener of the `Receiver` `'ping'` event.
 *
 * @param {Buffer} data The data included in the ping frame
 * @private
 */
function receiverOnPing(data) {
  const websocket = this[kWebSocket];

  if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
  websocket.emit('ping', data);
}

/**
 * The listener of the `Receiver` `'pong'` event.
 *
 * @param {Buffer} data The data included in the pong frame
 * @private
 */
function receiverOnPong(data) {
  this[kWebSocket].emit('pong', data);
}

/**
 * Resume a readable stream
 *
 * @param {Readable} stream The readable stream
 * @private
 */
function resume(stream) {
  stream.resume();
}

/**
 * The `Sender` error event handler.
 *
 * @param {Error} The error
 * @private
 */
function senderOnError(err) {
  const websocket = this[kWebSocket];

  if (websocket.readyState === WebSocket.CLOSED) return;
  if (websocket.readyState === WebSocket.OPEN) {
    websocket._readyState = WebSocket.CLOSING;
    setCloseTimer(websocket);
  }

  //
  // `socket.end()` is used instead of `socket.destroy()` to allow the other
  // peer to finish sending queued data. There is no need to set a timer here
  // because `CLOSING` means that it is already set or not needed.
  //
  this._socket.end();

  if (!websocket._errorEmitted) {
    websocket._errorEmitted = true;
    websocket.emit('error', err);
  }
}

/**
 * Set a timer to destroy the underlying raw socket of a WebSocket.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @private
 */
function setCloseTimer(websocket) {
  websocket._closeTimer = setTimeout(
    websocket._socket.destroy.bind(websocket._socket),
    websocket._closeTimeout
  );
}

/**
 * The listener of the socket `'close'` event.
 *
 * @private
 */
function socketOnClose() {
  const websocket = this[kWebSocket];

  this.removeListener('close', socketOnClose);
  this.removeListener('data', socketOnData);
  this.removeListener('end', socketOnEnd);

  websocket._readyState = WebSocket.CLOSING;

  //
  // The close frame might not have been received or the `'end'` event emitted,
  // for example, if the socket was destroyed due to an error. Ensure that the
  // `receiver` stream is closed after writing any remaining buffered data to
  // it. If the readable side of the socket is in flowing mode then there is no
  // buffered data as everything has been already written. If instead, the
  // socket is paused, any possible buffered data will be read as a single
  // chunk.
  //
  if (
    !this._readableState.endEmitted &&
    !websocket._closeFrameReceived &&
    !websocket._receiver._writableState.errorEmitted &&
    this._readableState.length !== 0
  ) {
    const chunk = this.read(this._readableState.length);

    websocket._receiver.write(chunk);
  }

  websocket._receiver.end();

  this[kWebSocket] = undefined;

  clearTimeout(websocket._closeTimer);

  if (
    websocket._receiver._writableState.finished ||
    websocket._receiver._writableState.errorEmitted
  ) {
    websocket.emitClose();
  } else {
    websocket._receiver.on('error', receiverOnFinish);
    websocket._receiver.on('finish', receiverOnFinish);
  }
}

/**
 * The listener of the socket `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function socketOnData(chunk) {
  if (!this[kWebSocket]._receiver.write(chunk)) {
    this.pause();
  }
}

/**
 * The listener of the socket `'end'` event.
 *
 * @private
 */
function socketOnEnd() {
  const websocket = this[kWebSocket];

  websocket._readyState = WebSocket.CLOSING;
  websocket._receiver.end();
  this.end();
}

/**
 * The listener of the socket `'error'` event.
 *
 * @private
 */
function socketOnError() {
  const websocket = this[kWebSocket];

  this.removeListener('error', socketOnError);
  this.on('error', NOOP);

  if (websocket) {
    websocket._readyState = WebSocket.CLOSING;
    this.destroy();
  }
}


/***/ }),
/* 10 */
/***/ ((module) => {

module.exports = require("events");

/***/ }),
/* 11 */
/***/ ((module) => {

module.exports = require("https");

/***/ }),
/* 12 */
/***/ ((module) => {

module.exports = require("http");

/***/ }),
/* 13 */
/***/ ((module) => {

module.exports = require("net");

/***/ }),
/* 14 */
/***/ ((module) => {

module.exports = require("tls");

/***/ }),
/* 15 */
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),
/* 16 */
/***/ ((module) => {

module.exports = require("stream");

/***/ }),
/* 17 */
/***/ ((module) => {

module.exports = require("url");

/***/ }),
/* 18 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const zlib = __webpack_require__(19);

const bufferUtil = __webpack_require__(20);
const Limiter = __webpack_require__(22);
const { kStatusCode } = __webpack_require__(21);

const FastBuffer = Buffer[Symbol.species];
const TRAILER = Buffer.from([0x00, 0x00, 0xff, 0xff]);
const kPerMessageDeflate = Symbol('permessage-deflate');
const kTotalLength = Symbol('total-length');
const kCallback = Symbol('callback');
const kBuffers = Symbol('buffers');
const kError = Symbol('error');

//
// We limit zlib concurrency, which prevents severe memory fragmentation
// as documented in https://github.com/nodejs/node/issues/8871#issuecomment-250915913
// and https://github.com/websockets/ws/issues/1202
//
// Intentionally global; it's the global thread pool that's an issue.
//
let zlibLimiter;

/**
 * permessage-deflate implementation.
 */
class PerMessageDeflate {
  /**
   * Creates a PerMessageDeflate instance.
   *
   * @param {Object} [options] Configuration options
   * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
   *     for, or request, a custom client window size
   * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
   *     acknowledge disabling of client context takeover
   * @param {Number} [options.concurrencyLimit=10] The number of concurrent
   *     calls to zlib
   * @param {Boolean} [options.isServer=false] Create the instance in either
   *     server or client mode
   * @param {Number} [options.maxPayload=0] The maximum allowed message length
   * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
   *     use of a custom server window size
   * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
   *     disabling of server context takeover
   * @param {Number} [options.threshold=1024] Size (in bytes) below which
   *     messages should not be compressed if context takeover is disabled
   * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
   *     deflate
   * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
   *     inflate
   */
  constructor(options) {
    this._options = options || {};
    this._threshold =
      this._options.threshold !== undefined ? this._options.threshold : 1024;
    this._maxPayload = this._options.maxPayload | 0;
    this._isServer = !!this._options.isServer;
    this._deflate = null;
    this._inflate = null;

    this.params = null;

    if (!zlibLimiter) {
      const concurrency =
        this._options.concurrencyLimit !== undefined
          ? this._options.concurrencyLimit
          : 10;
      zlibLimiter = new Limiter(concurrency);
    }
  }

  /**
   * @type {String}
   */
  static get extensionName() {
    return 'permessage-deflate';
  }

  /**
   * Create an extension negotiation offer.
   *
   * @return {Object} Extension parameters
   * @public
   */
  offer() {
    const params = {};

    if (this._options.serverNoContextTakeover) {
      params.server_no_context_takeover = true;
    }
    if (this._options.clientNoContextTakeover) {
      params.client_no_context_takeover = true;
    }
    if (this._options.serverMaxWindowBits) {
      params.server_max_window_bits = this._options.serverMaxWindowBits;
    }
    if (this._options.clientMaxWindowBits) {
      params.client_max_window_bits = this._options.clientMaxWindowBits;
    } else if (this._options.clientMaxWindowBits == null) {
      params.client_max_window_bits = true;
    }

    return params;
  }

  /**
   * Accept an extension negotiation offer/response.
   *
   * @param {Array} configurations The extension negotiation offers/reponse
   * @return {Object} Accepted configuration
   * @public
   */
  accept(configurations) {
    configurations = this.normalizeParams(configurations);

    this.params = this._isServer
      ? this.acceptAsServer(configurations)
      : this.acceptAsClient(configurations);

    return this.params;
  }

  /**
   * Releases all resources used by the extension.
   *
   * @public
   */
  cleanup() {
    if (this._inflate) {
      this._inflate.close();
      this._inflate = null;
    }

    if (this._deflate) {
      const callback = this._deflate[kCallback];

      this._deflate.close();
      this._deflate = null;

      if (callback) {
        callback(
          new Error(
            'The deflate stream was closed while data was being processed'
          )
        );
      }
    }
  }

  /**
   *  Accept an extension negotiation offer.
   *
   * @param {Array} offers The extension negotiation offers
   * @return {Object} Accepted configuration
   * @private
   */
  acceptAsServer(offers) {
    const opts = this._options;
    const accepted = offers.find((params) => {
      if (
        (opts.serverNoContextTakeover === false &&
          params.server_no_context_takeover) ||
        (params.server_max_window_bits &&
          (opts.serverMaxWindowBits === false ||
            (typeof opts.serverMaxWindowBits === 'number' &&
              opts.serverMaxWindowBits > params.server_max_window_bits))) ||
        (typeof opts.clientMaxWindowBits === 'number' &&
          !params.client_max_window_bits)
      ) {
        return false;
      }

      return true;
    });

    if (!accepted) {
      throw new Error('None of the extension offers can be accepted');
    }

    if (opts.serverNoContextTakeover) {
      accepted.server_no_context_takeover = true;
    }
    if (opts.clientNoContextTakeover) {
      accepted.client_no_context_takeover = true;
    }
    if (typeof opts.serverMaxWindowBits === 'number') {
      accepted.server_max_window_bits = opts.serverMaxWindowBits;
    }
    if (typeof opts.clientMaxWindowBits === 'number') {
      accepted.client_max_window_bits = opts.clientMaxWindowBits;
    } else if (
      accepted.client_max_window_bits === true ||
      opts.clientMaxWindowBits === false
    ) {
      delete accepted.client_max_window_bits;
    }

    return accepted;
  }

  /**
   * Accept the extension negotiation response.
   *
   * @param {Array} response The extension negotiation response
   * @return {Object} Accepted configuration
   * @private
   */
  acceptAsClient(response) {
    const params = response[0];

    if (
      this._options.clientNoContextTakeover === false &&
      params.client_no_context_takeover
    ) {
      throw new Error('Unexpected parameter "client_no_context_takeover"');
    }

    if (!params.client_max_window_bits) {
      if (typeof this._options.clientMaxWindowBits === 'number') {
        params.client_max_window_bits = this._options.clientMaxWindowBits;
      }
    } else if (
      this._options.clientMaxWindowBits === false ||
      (typeof this._options.clientMaxWindowBits === 'number' &&
        params.client_max_window_bits > this._options.clientMaxWindowBits)
    ) {
      throw new Error(
        'Unexpected or invalid parameter "client_max_window_bits"'
      );
    }

    return params;
  }

  /**
   * Normalize parameters.
   *
   * @param {Array} configurations The extension negotiation offers/reponse
   * @return {Array} The offers/response with normalized parameters
   * @private
   */
  normalizeParams(configurations) {
    configurations.forEach((params) => {
      Object.keys(params).forEach((key) => {
        let value = params[key];

        if (value.length > 1) {
          throw new Error(`Parameter "${key}" must have only a single value`);
        }

        value = value[0];

        if (key === 'client_max_window_bits') {
          if (value !== true) {
            const num = +value;
            if (!Number.isInteger(num) || num < 8 || num > 15) {
              throw new TypeError(
                `Invalid value for parameter "${key}": ${value}`
              );
            }
            value = num;
          } else if (!this._isServer) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
        } else if (key === 'server_max_window_bits') {
          const num = +value;
          if (!Number.isInteger(num) || num < 8 || num > 15) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
          value = num;
        } else if (
          key === 'client_no_context_takeover' ||
          key === 'server_no_context_takeover'
        ) {
          if (value !== true) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
        } else {
          throw new Error(`Unknown parameter "${key}"`);
        }

        params[key] = value;
      });
    });

    return configurations;
  }

  /**
   * Decompress data. Concurrency limited.
   *
   * @param {Buffer} data Compressed data
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @public
   */
  decompress(data, fin, callback) {
    zlibLimiter.add((done) => {
      this._decompress(data, fin, (err, result) => {
        done();
        callback(err, result);
      });
    });
  }

  /**
   * Compress data. Concurrency limited.
   *
   * @param {(Buffer|String)} data Data to compress
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @public
   */
  compress(data, fin, callback) {
    zlibLimiter.add((done) => {
      this._compress(data, fin, (err, result) => {
        done();
        callback(err, result);
      });
    });
  }

  /**
   * Decompress data.
   *
   * @param {Buffer} data Compressed data
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @private
   */
  _decompress(data, fin, callback) {
    const endpoint = this._isServer ? 'client' : 'server';

    if (!this._inflate) {
      const key = `${endpoint}_max_window_bits`;
      const windowBits =
        typeof this.params[key] !== 'number'
          ? zlib.Z_DEFAULT_WINDOWBITS
          : this.params[key];

      this._inflate = zlib.createInflateRaw({
        ...this._options.zlibInflateOptions,
        windowBits
      });
      this._inflate[kPerMessageDeflate] = this;
      this._inflate[kTotalLength] = 0;
      this._inflate[kBuffers] = [];
      this._inflate.on('error', inflateOnError);
      this._inflate.on('data', inflateOnData);
    }

    this._inflate[kCallback] = callback;

    this._inflate.write(data);
    if (fin) this._inflate.write(TRAILER);

    this._inflate.flush(() => {
      const err = this._inflate[kError];

      if (err) {
        this._inflate.close();
        this._inflate = null;
        callback(err);
        return;
      }

      const data = bufferUtil.concat(
        this._inflate[kBuffers],
        this._inflate[kTotalLength]
      );

      if (this._inflate._readableState.endEmitted) {
        this._inflate.close();
        this._inflate = null;
      } else {
        this._inflate[kTotalLength] = 0;
        this._inflate[kBuffers] = [];

        if (fin && this.params[`${endpoint}_no_context_takeover`]) {
          this._inflate.reset();
        }
      }

      callback(null, data);
    });
  }

  /**
   * Compress data.
   *
   * @param {(Buffer|String)} data Data to compress
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @private
   */
  _compress(data, fin, callback) {
    const endpoint = this._isServer ? 'server' : 'client';

    if (!this._deflate) {
      const key = `${endpoint}_max_window_bits`;
      const windowBits =
        typeof this.params[key] !== 'number'
          ? zlib.Z_DEFAULT_WINDOWBITS
          : this.params[key];

      this._deflate = zlib.createDeflateRaw({
        ...this._options.zlibDeflateOptions,
        windowBits
      });

      this._deflate[kTotalLength] = 0;
      this._deflate[kBuffers] = [];

      this._deflate.on('data', deflateOnData);
    }

    this._deflate[kCallback] = callback;

    this._deflate.write(data);
    this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
      if (!this._deflate) {
        //
        // The deflate stream was closed while data was being processed.
        //
        return;
      }

      let data = bufferUtil.concat(
        this._deflate[kBuffers],
        this._deflate[kTotalLength]
      );

      if (fin) {
        data = new FastBuffer(data.buffer, data.byteOffset, data.length - 4);
      }

      //
      // Ensure that the callback will not be called again in
      // `PerMessageDeflate#cleanup()`.
      //
      this._deflate[kCallback] = null;

      this._deflate[kTotalLength] = 0;
      this._deflate[kBuffers] = [];

      if (fin && this.params[`${endpoint}_no_context_takeover`]) {
        this._deflate.reset();
      }

      callback(null, data);
    });
  }
}

module.exports = PerMessageDeflate;

/**
 * The listener of the `zlib.DeflateRaw` stream `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function deflateOnData(chunk) {
  this[kBuffers].push(chunk);
  this[kTotalLength] += chunk.length;
}

/**
 * The listener of the `zlib.InflateRaw` stream `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function inflateOnData(chunk) {
  this[kTotalLength] += chunk.length;

  if (
    this[kPerMessageDeflate]._maxPayload < 1 ||
    this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload
  ) {
    this[kBuffers].push(chunk);
    return;
  }

  this[kError] = new RangeError('Max payload size exceeded');
  this[kError].code = 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH';
  this[kError][kStatusCode] = 1009;
  this.removeListener('data', inflateOnData);

  //
  // The choice to employ `zlib.reset()` over `zlib.close()` is dictated by the
  // fact that in Node.js versions prior to 13.10.0, the callback for
  // `zlib.flush()` is not called if `zlib.close()` is used. Utilizing
  // `zlib.reset()` ensures that either the callback is invoked or an error is
  // emitted.
  //
  this.reset();
}

/**
 * The listener of the `zlib.InflateRaw` stream `'error'` event.
 *
 * @param {Error} err The emitted error
 * @private
 */
function inflateOnError(err) {
  //
  // There is no need to call `Zlib#close()` as the handle is automatically
  // closed when an error is emitted.
  //
  this[kPerMessageDeflate]._inflate = null;

  if (this[kError]) {
    this[kCallback](this[kError]);
    return;
  }

  err[kStatusCode] = 1007;
  this[kCallback](err);
}


/***/ }),
/* 19 */
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),
/* 20 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { EMPTY_BUFFER } = __webpack_require__(21);

const FastBuffer = Buffer[Symbol.species];

/**
 * Merges an array of buffers into a new buffer.
 *
 * @param {Buffer[]} list The array of buffers to concat
 * @param {Number} totalLength The total length of buffers in the list
 * @return {Buffer} The resulting buffer
 * @public
 */
function concat(list, totalLength) {
  if (list.length === 0) return EMPTY_BUFFER;
  if (list.length === 1) return list[0];

  const target = Buffer.allocUnsafe(totalLength);
  let offset = 0;

  for (let i = 0; i < list.length; i++) {
    const buf = list[i];
    target.set(buf, offset);
    offset += buf.length;
  }

  if (offset < totalLength) {
    return new FastBuffer(target.buffer, target.byteOffset, offset);
  }

  return target;
}

/**
 * Masks a buffer using the given mask.
 *
 * @param {Buffer} source The buffer to mask
 * @param {Buffer} mask The mask to use
 * @param {Buffer} output The buffer where to store the result
 * @param {Number} offset The offset at which to start writing
 * @param {Number} length The number of bytes to mask.
 * @public
 */
function _mask(source, mask, output, offset, length) {
  for (let i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ mask[i & 3];
  }
}

/**
 * Unmasks a buffer using the given mask.
 *
 * @param {Buffer} buffer The buffer to unmask
 * @param {Buffer} mask The mask to use
 * @public
 */
function _unmask(buffer, mask) {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= mask[i & 3];
  }
}

/**
 * Converts a buffer to an `ArrayBuffer`.
 *
 * @param {Buffer} buf The buffer to convert
 * @return {ArrayBuffer} Converted buffer
 * @public
 */
function toArrayBuffer(buf) {
  if (buf.length === buf.buffer.byteLength) {
    return buf.buffer;
  }

  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

/**
 * Converts `data` to a `Buffer`.
 *
 * @param {*} data The data to convert
 * @return {Buffer} The buffer
 * @throws {TypeError}
 * @public
 */
function toBuffer(data) {
  toBuffer.readOnly = true;

  if (Buffer.isBuffer(data)) return data;

  let buf;

  if (data instanceof ArrayBuffer) {
    buf = new FastBuffer(data);
  } else if (ArrayBuffer.isView(data)) {
    buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
  } else {
    buf = Buffer.from(data);
    toBuffer.readOnly = false;
  }

  return buf;
}

module.exports = {
  concat,
  mask: _mask,
  toArrayBuffer,
  toBuffer,
  unmask: _unmask
};

/* istanbul ignore else  */
if (!process.env.WS_NO_BUFFER_UTIL) {
  try {
    const bufferUtil = __webpack_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module 'bufferutil'"); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

    module.exports.mask = function (source, mask, output, offset, length) {
      if (length < 48) _mask(source, mask, output, offset, length);
      else bufferUtil.mask(source, mask, output, offset, length);
    };

    module.exports.unmask = function (buffer, mask) {
      if (buffer.length < 32) _unmask(buffer, mask);
      else bufferUtil.unmask(buffer, mask);
    };
  } catch (e) {
    // Continue regardless of the error.
  }
}


/***/ }),
/* 21 */
/***/ ((module) => {



const BINARY_TYPES = ['nodebuffer', 'arraybuffer', 'fragments'];
const hasBlob = typeof Blob !== 'undefined';

if (hasBlob) BINARY_TYPES.push('blob');

module.exports = {
  BINARY_TYPES,
  CLOSE_TIMEOUT: 30000,
  EMPTY_BUFFER: Buffer.alloc(0),
  GUID: '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
  hasBlob,
  kForOnEventAttribute: Symbol('kIsForOnEventAttribute'),
  kListener: Symbol('kListener'),
  kStatusCode: Symbol('status-code'),
  kWebSocket: Symbol('websocket'),
  NOOP: () => {}
};


/***/ }),
/* 22 */
/***/ ((module) => {



const kDone = Symbol('kDone');
const kRun = Symbol('kRun');

/**
 * A very simple job queue with adjustable concurrency. Adapted from
 * https://github.com/STRML/async-limiter
 */
class Limiter {
  /**
   * Creates a new `Limiter`.
   *
   * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
   *     to run concurrently
   */
  constructor(concurrency) {
    this[kDone] = () => {
      this.pending--;
      this[kRun]();
    };
    this.concurrency = concurrency || Infinity;
    this.jobs = [];
    this.pending = 0;
  }

  /**
   * Adds a job to the queue.
   *
   * @param {Function} job The job to run
   * @public
   */
  add(job) {
    this.jobs.push(job);
    this[kRun]();
  }

  /**
   * Removes a job from the queue and runs it if possible.
   *
   * @private
   */
  [kRun]() {
    if (this.pending === this.concurrency) return;

    if (this.jobs.length) {
      const job = this.jobs.shift();

      this.pending++;
      job(this[kDone]);
    }
  }
}

module.exports = Limiter;


/***/ }),
/* 23 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { Writable } = __webpack_require__(16);

const PerMessageDeflate = __webpack_require__(18);
const {
  BINARY_TYPES,
  EMPTY_BUFFER,
  kStatusCode,
  kWebSocket
} = __webpack_require__(21);
const { concat, toArrayBuffer, unmask } = __webpack_require__(20);
const { isValidStatusCode, isValidUTF8 } = __webpack_require__(24);

const FastBuffer = Buffer[Symbol.species];

const GET_INFO = 0;
const GET_PAYLOAD_LENGTH_16 = 1;
const GET_PAYLOAD_LENGTH_64 = 2;
const GET_MASK = 3;
const GET_DATA = 4;
const INFLATING = 5;
const DEFER_EVENT = 6;

/**
 * HyBi Receiver implementation.
 *
 * @extends Writable
 */
class Receiver extends Writable {
  /**
   * Creates a Receiver instance.
   *
   * @param {Object} [options] Options object
   * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
   *     multiple times in the same tick
   * @param {String} [options.binaryType=nodebuffer] The type for binary data
   * @param {Object} [options.extensions] An object containing the negotiated
   *     extensions
   * @param {Boolean} [options.isServer=false] Specifies whether to operate in
   *     client or server mode
   * @param {Number} [options.maxBufferedChunks=0] The maximum number of
   *     buffered data chunks
   * @param {Number} [options.maxFragments=0] The maximum number of message
   *     fragments
   * @param {Number} [options.maxPayload=0] The maximum allowed message length
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   */
  constructor(options = {}) {
    super();

    this._allowSynchronousEvents =
      options.allowSynchronousEvents !== undefined
        ? options.allowSynchronousEvents
        : true;
    this._binaryType = options.binaryType || BINARY_TYPES[0];
    this._extensions = options.extensions || {};
    this._isServer = !!options.isServer;
    this._maxBufferedChunks = options.maxBufferedChunks | 0;
    this._maxFragments = options.maxFragments | 0;
    this._maxPayload = options.maxPayload | 0;
    this._skipUTF8Validation = !!options.skipUTF8Validation;
    this[kWebSocket] = undefined;

    this._bufferedBytes = 0;
    this._buffers = [];

    this._compressed = false;
    this._payloadLength = 0;
    this._mask = undefined;
    this._fragmented = 0;
    this._masked = false;
    this._fin = false;
    this._opcode = 0;

    this._totalPayloadLength = 0;
    this._messageLength = 0;
    this._fragments = [];

    this._errored = false;
    this._loop = false;
    this._state = GET_INFO;
  }

  /**
   * Implements `Writable.prototype._write()`.
   *
   * @param {Buffer} chunk The chunk of data to write
   * @param {String} encoding The character encoding of `chunk`
   * @param {Function} cb Callback
   * @private
   */
  _write(chunk, encoding, cb) {
    if (this._opcode === 0x08 && this._state == GET_INFO) return cb();

    if (
      this._maxBufferedChunks > 0 &&
      this._buffers.length >= this._maxBufferedChunks
    ) {
      cb(
        this.createError(
          RangeError,
          'Too many buffered chunks',
          false,
          1008,
          'WS_ERR_TOO_MANY_BUFFERED_PARTS'
        )
      );
      return;
    }

    this._bufferedBytes += chunk.length;
    this._buffers.push(chunk);
    this.startLoop(cb);
  }

  /**
   * Consumes `n` bytes from the buffered data.
   *
   * @param {Number} n The number of bytes to consume
   * @return {Buffer} The consumed bytes
   * @private
   */
  consume(n) {
    this._bufferedBytes -= n;

    if (n === this._buffers[0].length) return this._buffers.shift();

    if (n < this._buffers[0].length) {
      const buf = this._buffers[0];
      this._buffers[0] = new FastBuffer(
        buf.buffer,
        buf.byteOffset + n,
        buf.length - n
      );

      return new FastBuffer(buf.buffer, buf.byteOffset, n);
    }

    const dst = Buffer.allocUnsafe(n);

    do {
      const buf = this._buffers[0];
      const offset = dst.length - n;

      if (n >= buf.length) {
        dst.set(this._buffers.shift(), offset);
      } else {
        dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
        this._buffers[0] = new FastBuffer(
          buf.buffer,
          buf.byteOffset + n,
          buf.length - n
        );
      }

      n -= buf.length;
    } while (n > 0);

    return dst;
  }

  /**
   * Starts the parsing loop.
   *
   * @param {Function} cb Callback
   * @private
   */
  startLoop(cb) {
    this._loop = true;

    do {
      switch (this._state) {
        case GET_INFO:
          this.getInfo(cb);
          break;
        case GET_PAYLOAD_LENGTH_16:
          this.getPayloadLength16(cb);
          break;
        case GET_PAYLOAD_LENGTH_64:
          this.getPayloadLength64(cb);
          break;
        case GET_MASK:
          this.getMask();
          break;
        case GET_DATA:
          this.getData(cb);
          break;
        case INFLATING:
        case DEFER_EVENT:
          this._loop = false;
          return;
      }
    } while (this._loop);

    if (!this._errored) cb();
  }

  /**
   * Reads the first two bytes of a frame.
   *
   * @param {Function} cb Callback
   * @private
   */
  getInfo(cb) {
    if (this._bufferedBytes < 2) {
      this._loop = false;
      return;
    }

    const buf = this.consume(2);

    if ((buf[0] & 0x30) !== 0x00) {
      const error = this.createError(
        RangeError,
        'RSV2 and RSV3 must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_RSV_2_3'
      );

      cb(error);
      return;
    }

    const compressed = (buf[0] & 0x40) === 0x40;

    if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
      const error = this.createError(
        RangeError,
        'RSV1 must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_RSV_1'
      );

      cb(error);
      return;
    }

    this._fin = (buf[0] & 0x80) === 0x80;
    this._opcode = buf[0] & 0x0f;
    this._payloadLength = buf[1] & 0x7f;

    if (this._opcode === 0x00) {
      if (compressed) {
        const error = this.createError(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );

        cb(error);
        return;
      }

      if (!this._fragmented) {
        const error = this.createError(
          RangeError,
          'invalid opcode 0',
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );

        cb(error);
        return;
      }

      this._opcode = this._fragmented;
    } else if (this._opcode === 0x01 || this._opcode === 0x02) {
      if (this._fragmented) {
        const error = this.createError(
          RangeError,
          `invalid opcode ${this._opcode}`,
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );

        cb(error);
        return;
      }

      this._compressed = compressed;
    } else if (this._opcode > 0x07 && this._opcode < 0x0b) {
      if (!this._fin) {
        const error = this.createError(
          RangeError,
          'FIN must be set',
          true,
          1002,
          'WS_ERR_EXPECTED_FIN'
        );

        cb(error);
        return;
      }

      if (compressed) {
        const error = this.createError(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );

        cb(error);
        return;
      }

      if (
        this._payloadLength > 0x7d ||
        (this._opcode === 0x08 && this._payloadLength === 1)
      ) {
        const error = this.createError(
          RangeError,
          `invalid payload length ${this._payloadLength}`,
          true,
          1002,
          'WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH'
        );

        cb(error);
        return;
      }
    } else {
      const error = this.createError(
        RangeError,
        `invalid opcode ${this._opcode}`,
        true,
        1002,
        'WS_ERR_INVALID_OPCODE'
      );

      cb(error);
      return;
    }

    if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
    this._masked = (buf[1] & 0x80) === 0x80;

    if (this._isServer) {
      if (!this._masked) {
        const error = this.createError(
          RangeError,
          'MASK must be set',
          true,
          1002,
          'WS_ERR_EXPECTED_MASK'
        );

        cb(error);
        return;
      }
    } else if (this._masked) {
      const error = this.createError(
        RangeError,
        'MASK must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_MASK'
      );

      cb(error);
      return;
    }

    if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
    else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
    else this.haveLength(cb);
  }

  /**
   * Gets extended payload length (7+16).
   *
   * @param {Function} cb Callback
   * @private
   */
  getPayloadLength16(cb) {
    if (this._bufferedBytes < 2) {
      this._loop = false;
      return;
    }

    this._payloadLength = this.consume(2).readUInt16BE(0);
    this.haveLength(cb);
  }

  /**
   * Gets extended payload length (7+64).
   *
   * @param {Function} cb Callback
   * @private
   */
  getPayloadLength64(cb) {
    if (this._bufferedBytes < 8) {
      this._loop = false;
      return;
    }

    const buf = this.consume(8);
    const num = buf.readUInt32BE(0);

    //
    // The maximum safe integer in JavaScript is 2^53 - 1. An error is returned
    // if payload length is greater than this number.
    //
    if (num > Math.pow(2, 53 - 32) - 1) {
      const error = this.createError(
        RangeError,
        'Unsupported WebSocket frame: payload length > 2^53 - 1',
        false,
        1009,
        'WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH'
      );

      cb(error);
      return;
    }

    this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
    this.haveLength(cb);
  }

  /**
   * Payload length has been read.
   *
   * @param {Function} cb Callback
   * @private
   */
  haveLength(cb) {
    if (this._payloadLength && this._opcode < 0x08) {
      this._totalPayloadLength += this._payloadLength;
      if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
        const error = this.createError(
          RangeError,
          'Max payload size exceeded',
          false,
          1009,
          'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
        );

        cb(error);
        return;
      }
    }

    if (this._masked) this._state = GET_MASK;
    else this._state = GET_DATA;
  }

  /**
   * Reads mask bytes.
   *
   * @private
   */
  getMask() {
    if (this._bufferedBytes < 4) {
      this._loop = false;
      return;
    }

    this._mask = this.consume(4);
    this._state = GET_DATA;
  }

  /**
   * Reads data bytes.
   *
   * @param {Function} cb Callback
   * @private
   */
  getData(cb) {
    let data = EMPTY_BUFFER;

    if (this._payloadLength) {
      if (this._bufferedBytes < this._payloadLength) {
        this._loop = false;
        return;
      }

      data = this.consume(this._payloadLength);

      if (
        this._masked &&
        (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0
      ) {
        unmask(data, this._mask);
      }
    }

    if (this._opcode > 0x07) {
      this.controlMessage(data, cb);
      return;
    }

    if (this._compressed) {
      this._state = INFLATING;
      this.decompress(data, cb);
      return;
    }

    if (data.length) {
      if (
        this._maxFragments > 0 &&
        this._fragments.length >= this._maxFragments
      ) {
        const error = this.createError(
          RangeError,
          'Too many message fragments',
          false,
          1008,
          'WS_ERR_TOO_MANY_BUFFERED_PARTS'
        );

        cb(error);
        return;
      }

      //
      // This message is not compressed so its length is the sum of the payload
      // length of all fragments.
      //
      this._messageLength = this._totalPayloadLength;
      this._fragments.push(data);
    }

    this.dataMessage(cb);
  }

  /**
   * Decompresses data.
   *
   * @param {Buffer} data Compressed data
   * @param {Function} cb Callback
   * @private
   */
  decompress(data, cb) {
    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];

    perMessageDeflate.decompress(data, this._fin, (err, buf) => {
      if (err) return cb(err);

      if (buf.length) {
        this._messageLength += buf.length;
        if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
          const error = this.createError(
            RangeError,
            'Max payload size exceeded',
            false,
            1009,
            'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
          );

          cb(error);
          return;
        }

        if (
          this._maxFragments > 0 &&
          this._fragments.length >= this._maxFragments
        ) {
          const error = this.createError(
            RangeError,
            'Too many message fragments',
            false,
            1008,
            'WS_ERR_TOO_MANY_BUFFERED_PARTS'
          );

          cb(error);
          return;
        }

        this._fragments.push(buf);
      }

      this.dataMessage(cb);
      if (this._state === GET_INFO) this.startLoop(cb);
    });
  }

  /**
   * Handles a data message.
   *
   * @param {Function} cb Callback
   * @private
   */
  dataMessage(cb) {
    if (!this._fin) {
      this._state = GET_INFO;
      return;
    }

    const messageLength = this._messageLength;
    const fragments = this._fragments;

    this._totalPayloadLength = 0;
    this._messageLength = 0;
    this._fragmented = 0;
    this._fragments = [];

    if (this._opcode === 2) {
      let data;

      if (this._binaryType === 'nodebuffer') {
        data = concat(fragments, messageLength);
      } else if (this._binaryType === 'arraybuffer') {
        data = toArrayBuffer(concat(fragments, messageLength));
      } else if (this._binaryType === 'blob') {
        data = new Blob(fragments);
      } else {
        data = fragments;
      }

      if (this._allowSynchronousEvents) {
        this.emit('message', data, true);
        this._state = GET_INFO;
      } else {
        this._state = DEFER_EVENT;
        setImmediate(() => {
          this.emit('message', data, true);
          this._state = GET_INFO;
          this.startLoop(cb);
        });
      }
    } else {
      const buf = concat(fragments, messageLength);

      if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
        const error = this.createError(
          Error,
          'invalid UTF-8 sequence',
          true,
          1007,
          'WS_ERR_INVALID_UTF8'
        );

        cb(error);
        return;
      }

      if (this._state === INFLATING || this._allowSynchronousEvents) {
        this.emit('message', buf, false);
        this._state = GET_INFO;
      } else {
        this._state = DEFER_EVENT;
        setImmediate(() => {
          this.emit('message', buf, false);
          this._state = GET_INFO;
          this.startLoop(cb);
        });
      }
    }
  }

  /**
   * Handles a control message.
   *
   * @param {Buffer} data Data to handle
   * @return {(Error|RangeError|undefined)} A possible error
   * @private
   */
  controlMessage(data, cb) {
    if (this._opcode === 0x08) {
      if (data.length === 0) {
        this._loop = false;
        this.emit('conclude', 1005, EMPTY_BUFFER);
        this.end();
      } else {
        const code = data.readUInt16BE(0);

        if (!isValidStatusCode(code)) {
          const error = this.createError(
            RangeError,
            `invalid status code ${code}`,
            true,
            1002,
            'WS_ERR_INVALID_CLOSE_CODE'
          );

          cb(error);
          return;
        }

        const buf = new FastBuffer(
          data.buffer,
          data.byteOffset + 2,
          data.length - 2
        );

        if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
          const error = this.createError(
            Error,
            'invalid UTF-8 sequence',
            true,
            1007,
            'WS_ERR_INVALID_UTF8'
          );

          cb(error);
          return;
        }

        this._loop = false;
        this.emit('conclude', code, buf);
        this.end();
      }

      this._state = GET_INFO;
      return;
    }

    if (this._allowSynchronousEvents) {
      this.emit(this._opcode === 0x09 ? 'ping' : 'pong', data);
      this._state = GET_INFO;
    } else {
      this._state = DEFER_EVENT;
      setImmediate(() => {
        this.emit(this._opcode === 0x09 ? 'ping' : 'pong', data);
        this._state = GET_INFO;
        this.startLoop(cb);
      });
    }
  }

  /**
   * Builds an error object.
   *
   * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
   * @param {String} message The error message
   * @param {Boolean} prefix Specifies whether or not to add a default prefix to
   *     `message`
   * @param {Number} statusCode The status code
   * @param {String} errorCode The exposed error code
   * @return {(Error|RangeError)} The error
   * @private
   */
  createError(ErrorCtor, message, prefix, statusCode, errorCode) {
    this._loop = false;
    this._errored = true;

    const err = new ErrorCtor(
      prefix ? `Invalid WebSocket frame: ${message}` : message
    );

    Error.captureStackTrace(err, this.createError);
    err.code = errorCode;
    err[kStatusCode] = statusCode;
    return err;
  }
}

module.exports = Receiver;


/***/ }),
/* 24 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { isUtf8 } = __webpack_require__(25);

const { hasBlob } = __webpack_require__(21);

//
// Allowed token characters:
//
// '!', '#', '$', '%', '&', ''', '*', '+', '-',
// '.', 0-9, A-Z, '^', '_', '`', a-z, '|', '~'
//
// tokenChars[32] === 0 // ' '
// tokenChars[33] === 1 // '!'
// tokenChars[34] === 0 // '"'
// ...
//
// prettier-ignore
const tokenChars = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0 - 15
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
  0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, // 32 - 47
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, // 48 - 63
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 64 - 79
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, // 80 - 95
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 96 - 111
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0 // 112 - 127
];

/**
 * Checks if a status code is allowed in a close frame.
 *
 * @param {Number} code The status code
 * @return {Boolean} `true` if the status code is valid, else `false`
 * @public
 */
function isValidStatusCode(code) {
  return (
    (code >= 1000 &&
      code <= 1014 &&
      code !== 1004 &&
      code !== 1005 &&
      code !== 1006) ||
    (code >= 3000 && code <= 4999)
  );
}

/**
 * Checks if a given buffer contains only correct UTF-8.
 * Ported from https://www.cl.cam.ac.uk/%7Emgk25/ucs/utf8_check.c by
 * Markus Kuhn.
 *
 * @param {Buffer} buf The buffer to check
 * @return {Boolean} `true` if `buf` contains only correct UTF-8, else `false`
 * @public
 */
function _isValidUTF8(buf) {
  const len = buf.length;
  let i = 0;

  while (i < len) {
    if ((buf[i] & 0x80) === 0) {
      // 0xxxxxxx
      i++;
    } else if ((buf[i] & 0xe0) === 0xc0) {
      // 110xxxxx 10xxxxxx
      if (
        i + 1 === len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i] & 0xfe) === 0xc0 // Overlong
      ) {
        return false;
      }

      i += 2;
    } else if ((buf[i] & 0xf0) === 0xe0) {
      // 1110xxxx 10xxxxxx 10xxxxxx
      if (
        i + 2 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i] === 0xe0 && (buf[i + 1] & 0xe0) === 0x80) || // Overlong
        (buf[i] === 0xed && (buf[i + 1] & 0xe0) === 0xa0) // Surrogate (U+D800 - U+DFFF)
      ) {
        return false;
      }

      i += 3;
    } else if ((buf[i] & 0xf8) === 0xf0) {
      // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      if (
        i + 3 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i + 3] & 0xc0) !== 0x80 ||
        (buf[i] === 0xf0 && (buf[i + 1] & 0xf0) === 0x80) || // Overlong
        (buf[i] === 0xf4 && buf[i + 1] > 0x8f) ||
        buf[i] > 0xf4 // > U+10FFFF
      ) {
        return false;
      }

      i += 4;
    } else {
      return false;
    }
  }

  return true;
}

/**
 * Determines whether a value is a `Blob`.
 *
 * @param {*} value The value to be tested
 * @return {Boolean} `true` if `value` is a `Blob`, else `false`
 * @private
 */
function isBlob(value) {
  return (
    hasBlob &&
    typeof value === 'object' &&
    typeof value.arrayBuffer === 'function' &&
    typeof value.type === 'string' &&
    typeof value.stream === 'function' &&
    (value[Symbol.toStringTag] === 'Blob' ||
      value[Symbol.toStringTag] === 'File')
  );
}

module.exports = {
  isBlob,
  isValidStatusCode,
  isValidUTF8: _isValidUTF8,
  tokenChars
};

if (isUtf8) {
  module.exports.isValidUTF8 = function (buf) {
    return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
  };
} /* istanbul ignore else  */ else if (!process.env.WS_NO_UTF_8_VALIDATE) {
  try {
    const isValidUTF8 = __webpack_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module 'utf-8-validate'"); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

    module.exports.isValidUTF8 = function (buf) {
      return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
    };
  } catch (e) {
    // Continue regardless of the error.
  }
}


/***/ }),
/* 25 */
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),
/* 26 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex" }] */



const { Duplex } = __webpack_require__(16);
const { randomFillSync } = __webpack_require__(15);
const {
  types: { isUint8Array }
} = __webpack_require__(27);

const PerMessageDeflate = __webpack_require__(18);
const { EMPTY_BUFFER, kWebSocket, NOOP } = __webpack_require__(21);
const { isBlob, isValidStatusCode } = __webpack_require__(24);
const { mask: applyMask, toBuffer } = __webpack_require__(20);

const kByteLength = Symbol('kByteLength');
const maskBuffer = Buffer.alloc(4);
const RANDOM_POOL_SIZE = 8 * 1024;
let randomPool;
let randomPoolPointer = RANDOM_POOL_SIZE;

const DEFAULT = 0;
const DEFLATING = 1;
const GET_BLOB_DATA = 2;

/**
 * HyBi Sender implementation.
 */
class Sender {
  /**
   * Creates a Sender instance.
   *
   * @param {Duplex} socket The connection socket
   * @param {Object} [extensions] An object containing the negotiated extensions
   * @param {Function} [generateMask] The function used to generate the masking
   *     key
   */
  constructor(socket, extensions, generateMask) {
    this._extensions = extensions || {};

    if (generateMask) {
      this._generateMask = generateMask;
      this._maskBuffer = Buffer.alloc(4);
    }

    this._socket = socket;

    this._firstFragment = true;
    this._compress = false;

    this._bufferedBytes = 0;
    this._queue = [];
    this._state = DEFAULT;
    this.onerror = NOOP;
    this[kWebSocket] = undefined;
  }

  /**
   * Frames a piece of data according to the HyBi WebSocket protocol.
   *
   * @param {(Buffer|String)} data The data to frame
   * @param {Object} options Options object
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
   *     key
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @return {(Buffer|String)[]} The framed data
   * @public
   */
  static frame(data, options) {
    let mask;
    let merge = false;
    let offset = 2;
    let skipMasking = false;

    if (options.mask) {
      mask = options.maskBuffer || maskBuffer;

      if (options.generateMask) {
        options.generateMask(mask);
      } else {
        if (randomPoolPointer === RANDOM_POOL_SIZE) {
          /* istanbul ignore else  */
          if (randomPool === undefined) {
            //
            // This is lazily initialized because server-sent frames must not
            // be masked so it may never be used.
            //
            randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
          }

          randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
          randomPoolPointer = 0;
        }

        mask[0] = randomPool[randomPoolPointer++];
        mask[1] = randomPool[randomPoolPointer++];
        mask[2] = randomPool[randomPoolPointer++];
        mask[3] = randomPool[randomPoolPointer++];
      }

      skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
      offset = 6;
    }

    let dataLength;

    if (typeof data === 'string') {
      if (
        (!options.mask || skipMasking) &&
        options[kByteLength] !== undefined
      ) {
        dataLength = options[kByteLength];
      } else {
        data = Buffer.from(data);
        dataLength = data.length;
      }
    } else {
      dataLength = data.length;
      merge = options.mask && options.readOnly && !skipMasking;
    }

    let payloadLength = dataLength;

    if (dataLength >= 65536) {
      offset += 8;
      payloadLength = 127;
    } else if (dataLength > 125) {
      offset += 2;
      payloadLength = 126;
    }

    const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);

    target[0] = options.fin ? options.opcode | 0x80 : options.opcode;
    if (options.rsv1) target[0] |= 0x40;

    target[1] = payloadLength;

    if (payloadLength === 126) {
      target.writeUInt16BE(dataLength, 2);
    } else if (payloadLength === 127) {
      target[2] = target[3] = 0;
      target.writeUIntBE(dataLength, 4, 6);
    }

    if (!options.mask) return [target, data];

    target[1] |= 0x80;
    target[offset - 4] = mask[0];
    target[offset - 3] = mask[1];
    target[offset - 2] = mask[2];
    target[offset - 1] = mask[3];

    if (skipMasking) return [target, data];

    if (merge) {
      applyMask(data, mask, target, offset, dataLength);
      return [target];
    }

    applyMask(data, mask, data, 0, dataLength);
    return [target, data];
  }

  /**
   * Sends a close message to the other peer.
   *
   * @param {Number} [code] The status code component of the body
   * @param {(String|Buffer)} [data] The message component of the body
   * @param {Boolean} [mask=false] Specifies whether or not to mask the message
   * @param {Function} [cb] Callback
   * @public
   */
  close(code, data, mask, cb) {
    let buf;

    if (code === undefined) {
      buf = EMPTY_BUFFER;
    } else if (typeof code !== 'number' || !isValidStatusCode(code)) {
      throw new TypeError('First argument must be a valid error code number');
    } else if (data === undefined || !data.length) {
      buf = Buffer.allocUnsafe(2);
      buf.writeUInt16BE(code, 0);
    } else {
      const length = Buffer.byteLength(data);

      if (length > 123) {
        throw new RangeError('The message must not be greater than 123 bytes');
      }

      buf = Buffer.allocUnsafe(2 + length);
      buf.writeUInt16BE(code, 0);

      if (typeof data === 'string') {
        buf.write(data, 2);
      } else if (isUint8Array(data)) {
        buf.set(data, 2);
      } else {
        throw new TypeError('Second argument must be a string or a Uint8Array');
      }
    }

    const options = {
      [kByteLength]: buf.length,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x08,
      readOnly: false,
      rsv1: false
    };

    if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, buf, false, options, cb]);
    } else {
      this.sendFrame(Sender.frame(buf, options), cb);
    }
  }

  /**
   * Sends a ping message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback
   * @public
   */
  ping(data, mask, cb) {
    let byteLength;
    let readOnly;

    if (typeof data === 'string') {
      byteLength = Buffer.byteLength(data);
      readOnly = false;
    } else if (isBlob(data)) {
      byteLength = data.size;
      readOnly = false;
    } else {
      data = toBuffer(data);
      byteLength = data.length;
      readOnly = toBuffer.readOnly;
    }

    if (byteLength > 125) {
      throw new RangeError('The data size must not be greater than 125 bytes');
    }

    const options = {
      [kByteLength]: byteLength,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x09,
      readOnly,
      rsv1: false
    };

    if (isBlob(data)) {
      if (this._state !== DEFAULT) {
        this.enqueue([this.getBlobData, data, false, options, cb]);
      } else {
        this.getBlobData(data, false, options, cb);
      }
    } else if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, data, false, options, cb]);
    } else {
      this.sendFrame(Sender.frame(data, options), cb);
    }
  }

  /**
   * Sends a pong message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback
   * @public
   */
  pong(data, mask, cb) {
    let byteLength;
    let readOnly;

    if (typeof data === 'string') {
      byteLength = Buffer.byteLength(data);
      readOnly = false;
    } else if (isBlob(data)) {
      byteLength = data.size;
      readOnly = false;
    } else {
      data = toBuffer(data);
      byteLength = data.length;
      readOnly = toBuffer.readOnly;
    }

    if (byteLength > 125) {
      throw new RangeError('The data size must not be greater than 125 bytes');
    }

    const options = {
      [kByteLength]: byteLength,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x0a,
      readOnly,
      rsv1: false
    };

    if (isBlob(data)) {
      if (this._state !== DEFAULT) {
        this.enqueue([this.getBlobData, data, false, options, cb]);
      } else {
        this.getBlobData(data, false, options, cb);
      }
    } else if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, data, false, options, cb]);
    } else {
      this.sendFrame(Sender.frame(data, options), cb);
    }
  }

  /**
   * Sends a data message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Object} options Options object
   * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
   *     or text
   * @param {Boolean} [options.compress=false] Specifies whether or not to
   *     compress `data`
   * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
   *     last one
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Function} [cb] Callback
   * @public
   */
  send(data, options, cb) {
    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
    let opcode = options.binary ? 2 : 1;
    let rsv1 = options.compress;

    let byteLength;
    let readOnly;

    if (typeof data === 'string') {
      byteLength = Buffer.byteLength(data);
      readOnly = false;
    } else if (isBlob(data)) {
      byteLength = data.size;
      readOnly = false;
    } else {
      data = toBuffer(data);
      byteLength = data.length;
      readOnly = toBuffer.readOnly;
    }

    if (this._firstFragment) {
      this._firstFragment = false;
      if (
        rsv1 &&
        perMessageDeflate &&
        perMessageDeflate.params[
          perMessageDeflate._isServer
            ? 'server_no_context_takeover'
            : 'client_no_context_takeover'
        ]
      ) {
        rsv1 = byteLength >= perMessageDeflate._threshold;
      }
      this._compress = rsv1;
    } else {
      rsv1 = false;
      opcode = 0;
    }

    if (options.fin) this._firstFragment = true;

    const opts = {
      [kByteLength]: byteLength,
      fin: options.fin,
      generateMask: this._generateMask,
      mask: options.mask,
      maskBuffer: this._maskBuffer,
      opcode,
      readOnly,
      rsv1
    };

    if (isBlob(data)) {
      if (this._state !== DEFAULT) {
        this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
      } else {
        this.getBlobData(data, this._compress, opts, cb);
      }
    } else if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, data, this._compress, opts, cb]);
    } else {
      this.dispatch(data, this._compress, opts, cb);
    }
  }

  /**
   * Gets the contents of a blob as binary data.
   *
   * @param {Blob} blob The blob
   * @param {Boolean} [compress=false] Specifies whether or not to compress
   *     the data
   * @param {Object} options Options object
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
   *     key
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @param {Function} [cb] Callback
   * @private
   */
  getBlobData(blob, compress, options, cb) {
    this._bufferedBytes += options[kByteLength];
    this._state = GET_BLOB_DATA;

    blob
      .arrayBuffer()
      .then((arrayBuffer) => {
        if (this._socket.destroyed) {
          const err = new Error(
            'The socket was closed while the blob was being read'
          );

          //
          // `callCallbacks` is called in the next tick to ensure that errors
          // that might be thrown in the callbacks behave like errors thrown
          // outside the promise chain.
          //
          process.nextTick(callCallbacks, this, err, cb);
          return;
        }

        this._bufferedBytes -= options[kByteLength];
        const data = toBuffer(arrayBuffer);

        if (!compress) {
          this._state = DEFAULT;
          this.sendFrame(Sender.frame(data, options), cb);
          this.dequeue();
        } else {
          this.dispatch(data, compress, options, cb);
        }
      })
      .catch((err) => {
        //
        // `onError` is called in the next tick for the same reason that
        // `callCallbacks` above is.
        //
        process.nextTick(onError, this, err, cb);
      });
  }

  /**
   * Dispatches a message.
   *
   * @param {(Buffer|String)} data The message to send
   * @param {Boolean} [compress=false] Specifies whether or not to compress
   *     `data`
   * @param {Object} options Options object
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
   *     key
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @param {Function} [cb] Callback
   * @private
   */
  dispatch(data, compress, options, cb) {
    if (!compress) {
      this.sendFrame(Sender.frame(data, options), cb);
      return;
    }

    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];

    this._bufferedBytes += options[kByteLength];
    this._state = DEFLATING;
    perMessageDeflate.compress(data, options.fin, (_, buf) => {
      if (this._socket.destroyed) {
        const err = new Error(
          'The socket was closed while data was being compressed'
        );

        callCallbacks(this, err, cb);
        return;
      }

      this._bufferedBytes -= options[kByteLength];
      this._state = DEFAULT;
      options.readOnly = false;
      this.sendFrame(Sender.frame(buf, options), cb);
      this.dequeue();
    });
  }

  /**
   * Executes queued send operations.
   *
   * @private
   */
  dequeue() {
    while (this._state === DEFAULT && this._queue.length) {
      const params = this._queue.shift();

      this._bufferedBytes -= params[3][kByteLength];
      Reflect.apply(params[0], this, params.slice(1));
    }
  }

  /**
   * Enqueues a send operation.
   *
   * @param {Array} params Send operation parameters.
   * @private
   */
  enqueue(params) {
    this._bufferedBytes += params[3][kByteLength];
    this._queue.push(params);
  }

  /**
   * Sends a frame.
   *
   * @param {(Buffer | String)[]} list The frame to send
   * @param {Function} [cb] Callback
   * @private
   */
  sendFrame(list, cb) {
    if (list.length === 2) {
      this._socket.cork();
      this._socket.write(list[0]);
      this._socket.write(list[1], cb);
      this._socket.uncork();
    } else {
      this._socket.write(list[0], cb);
    }
  }
}

module.exports = Sender;

/**
 * Calls queued callbacks with an error.
 *
 * @param {Sender} sender The `Sender` instance
 * @param {Error} err The error to call the callbacks with
 * @param {Function} [cb] The first callback
 * @private
 */
function callCallbacks(sender, err, cb) {
  if (typeof cb === 'function') cb(err);

  for (let i = 0; i < sender._queue.length; i++) {
    const params = sender._queue[i];
    const callback = params[params.length - 1];

    if (typeof callback === 'function') callback(err);
  }
}

/**
 * Handles a `Sender` error.
 *
 * @param {Sender} sender The `Sender` instance
 * @param {Error} err The error
 * @param {Function} [cb] The first pending callback
 * @private
 */
function onError(sender, err, cb) {
  callCallbacks(sender, err, cb);
  sender.onerror(err);
}


/***/ }),
/* 27 */
/***/ ((module) => {

module.exports = require("util");

/***/ }),
/* 28 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { kForOnEventAttribute, kListener } = __webpack_require__(21);

const kCode = Symbol('kCode');
const kData = Symbol('kData');
const kError = Symbol('kError');
const kMessage = Symbol('kMessage');
const kReason = Symbol('kReason');
const kTarget = Symbol('kTarget');
const kType = Symbol('kType');
const kWasClean = Symbol('kWasClean');

/**
 * Class representing an event.
 */
class Event {
  /**
   * Create a new `Event`.
   *
   * @param {String} type The name of the event
   * @throws {TypeError} If the `type` argument is not specified
   */
  constructor(type) {
    this[kTarget] = null;
    this[kType] = type;
  }

  /**
   * @type {*}
   */
  get target() {
    return this[kTarget];
  }

  /**
   * @type {String}
   */
  get type() {
    return this[kType];
  }
}

Object.defineProperty(Event.prototype, 'target', { enumerable: true });
Object.defineProperty(Event.prototype, 'type', { enumerable: true });

/**
 * Class representing a close event.
 *
 * @extends Event
 */
class CloseEvent extends Event {
  /**
   * Create a new `CloseEvent`.
   *
   * @param {String} type The name of the event
   * @param {Object} [options] A dictionary object that allows for setting
   *     attributes via object members of the same name
   * @param {Number} [options.code=0] The status code explaining why the
   *     connection was closed
   * @param {String} [options.reason=''] A human-readable string explaining why
   *     the connection was closed
   * @param {Boolean} [options.wasClean=false] Indicates whether or not the
   *     connection was cleanly closed
   */
  constructor(type, options = {}) {
    super(type);

    this[kCode] = options.code === undefined ? 0 : options.code;
    this[kReason] = options.reason === undefined ? '' : options.reason;
    this[kWasClean] = options.wasClean === undefined ? false : options.wasClean;
  }

  /**
   * @type {Number}
   */
  get code() {
    return this[kCode];
  }

  /**
   * @type {String}
   */
  get reason() {
    return this[kReason];
  }

  /**
   * @type {Boolean}
   */
  get wasClean() {
    return this[kWasClean];
  }
}

Object.defineProperty(CloseEvent.prototype, 'code', { enumerable: true });
Object.defineProperty(CloseEvent.prototype, 'reason', { enumerable: true });
Object.defineProperty(CloseEvent.prototype, 'wasClean', { enumerable: true });

/**
 * Class representing an error event.
 *
 * @extends Event
 */
class ErrorEvent extends Event {
  /**
   * Create a new `ErrorEvent`.
   *
   * @param {String} type The name of the event
   * @param {Object} [options] A dictionary object that allows for setting
   *     attributes via object members of the same name
   * @param {*} [options.error=null] The error that generated this event
   * @param {String} [options.message=''] The error message
   */
  constructor(type, options = {}) {
    super(type);

    this[kError] = options.error === undefined ? null : options.error;
    this[kMessage] = options.message === undefined ? '' : options.message;
  }

  /**
   * @type {*}
   */
  get error() {
    return this[kError];
  }

  /**
   * @type {String}
   */
  get message() {
    return this[kMessage];
  }
}

Object.defineProperty(ErrorEvent.prototype, 'error', { enumerable: true });
Object.defineProperty(ErrorEvent.prototype, 'message', { enumerable: true });

/**
 * Class representing a message event.
 *
 * @extends Event
 */
class MessageEvent extends Event {
  /**
   * Create a new `MessageEvent`.
   *
   * @param {String} type The name of the event
   * @param {Object} [options] A dictionary object that allows for setting
   *     attributes via object members of the same name
   * @param {*} [options.data=null] The message content
   */
  constructor(type, options = {}) {
    super(type);

    this[kData] = options.data === undefined ? null : options.data;
  }

  /**
   * @type {*}
   */
  get data() {
    return this[kData];
  }
}

Object.defineProperty(MessageEvent.prototype, 'data', { enumerable: true });

/**
 * This provides methods for emulating the `EventTarget` interface. It's not
 * meant to be used directly.
 *
 * @mixin
 */
const EventTarget = {
  /**
   * Register an event listener.
   *
   * @param {String} type A string representing the event type to listen for
   * @param {(Function|Object)} handler The listener to add
   * @param {Object} [options] An options object specifies characteristics about
   *     the event listener
   * @param {Boolean} [options.once=false] A `Boolean` indicating that the
   *     listener should be invoked at most once after being added. If `true`,
   *     the listener would be automatically removed when invoked.
   * @public
   */
  addEventListener(type, handler, options = {}) {
    for (const listener of this.listeners(type)) {
      if (
        !options[kForOnEventAttribute] &&
        listener[kListener] === handler &&
        !listener[kForOnEventAttribute]
      ) {
        return;
      }
    }

    let wrapper;

    if (type === 'message') {
      wrapper = function onMessage(data, isBinary) {
        const event = new MessageEvent('message', {
          data: isBinary ? data : data.toString()
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'close') {
      wrapper = function onClose(code, message) {
        const event = new CloseEvent('close', {
          code,
          reason: message.toString(),
          wasClean: this._closeFrameReceived && this._closeFrameSent
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'error') {
      wrapper = function onError(error) {
        const event = new ErrorEvent('error', {
          error,
          message: error.message
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'open') {
      wrapper = function onOpen() {
        const event = new Event('open');

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else {
      return;
    }

    wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
    wrapper[kListener] = handler;

    if (options.once) {
      this.once(type, wrapper);
    } else {
      this.on(type, wrapper);
    }
  },

  /**
   * Remove an event listener.
   *
   * @param {String} type A string representing the event type to remove
   * @param {(Function|Object)} handler The listener to remove
   * @public
   */
  removeEventListener(type, handler) {
    for (const listener of this.listeners(type)) {
      if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
        this.removeListener(type, listener);
        break;
      }
    }
  }
};

module.exports = {
  CloseEvent,
  ErrorEvent,
  Event,
  EventTarget,
  MessageEvent
};

/**
 * Call an event listener
 *
 * @param {(Function|Object)} listener The listener to call
 * @param {*} thisArg The value to use as `this`` when calling the listener
 * @param {Event} event The event to pass to the listener
 * @private
 */
function callListener(listener, thisArg, event) {
  if (typeof listener === 'object' && listener.handleEvent) {
    listener.handleEvent.call(listener, event);
  } else {
    listener.call(thisArg, event);
  }
}


/***/ }),
/* 29 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { tokenChars } = __webpack_require__(24);

/**
 * Adds an offer to the map of extension offers or a parameter to the map of
 * parameters.
 *
 * @param {Object} dest The map of extension offers or parameters
 * @param {String} name The extension or parameter name
 * @param {(Object|Boolean|String)} elem The extension parameters or the
 *     parameter value
 * @private
 */
function push(dest, name, elem) {
  if (dest[name] === undefined) dest[name] = [elem];
  else dest[name].push(elem);
}

/**
 * Parses the `Sec-WebSocket-Extensions` header into an object.
 *
 * @param {String} header The field value of the header
 * @return {Object} The parsed object
 * @public
 */
function parse(header) {
  const offers = Object.create(null);
  let params = Object.create(null);
  let mustUnescape = false;
  let isEscaping = false;
  let inQuotes = false;
  let extensionName;
  let paramName;
  let start = -1;
  let code = -1;
  let end = -1;
  let i = 0;

  for (; i < header.length; i++) {
    code = header.charCodeAt(i);

    if (extensionName === undefined) {
      if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (
        i !== 0 &&
        (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
      ) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x3b /* ';' */ || code === 0x2c /* ',' */) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        const name = header.slice(start, end);
        if (code === 0x2c) {
          push(offers, name, params);
          params = Object.create(null);
        } else {
          extensionName = name;
        }

        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    } else if (paramName === undefined) {
      if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (code === 0x20 || code === 0x09) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x3b || code === 0x2c) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        push(params, header.slice(start, end), true);
        if (code === 0x2c) {
          push(offers, extensionName, params);
          params = Object.create(null);
          extensionName = undefined;
        }

        start = end = -1;
      } else if (code === 0x3d /* '=' */ && start !== -1 && end === -1) {
        paramName = header.slice(start, i);
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    } else {
      //
      // The value of a quoted-string after unescaping must conform to the
      // token ABNF, so only token characters are valid.
      // Ref: https://tools.ietf.org/html/rfc6455#section-9.1
      //
      if (isEscaping) {
        if (tokenChars[code] !== 1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
        if (start === -1) start = i;
        else if (!mustUnescape) mustUnescape = true;
        isEscaping = false;
      } else if (inQuotes) {
        if (tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (code === 0x22 /* '"' */ && start !== -1) {
          inQuotes = false;
          end = i;
        } else if (code === 0x5c /* '\' */) {
          isEscaping = true;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      } else if (code === 0x22 && header.charCodeAt(i - 1) === 0x3d) {
        inQuotes = true;
      } else if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (start !== -1 && (code === 0x20 || code === 0x09)) {
        if (end === -1) end = i;
      } else if (code === 0x3b || code === 0x2c) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        let value = header.slice(start, end);
        if (mustUnescape) {
          value = value.replace(/\\/g, '');
          mustUnescape = false;
        }
        push(params, paramName, value);
        if (code === 0x2c) {
          push(offers, extensionName, params);
          params = Object.create(null);
          extensionName = undefined;
        }

        paramName = undefined;
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    }
  }

  if (start === -1 || inQuotes || code === 0x20 || code === 0x09) {
    throw new SyntaxError('Unexpected end of input');
  }

  if (end === -1) end = i;
  const token = header.slice(start, end);
  if (extensionName === undefined) {
    push(offers, token, params);
  } else {
    if (paramName === undefined) {
      push(params, token, true);
    } else if (mustUnescape) {
      push(params, paramName, token.replace(/\\/g, ''));
    } else {
      push(params, paramName, token);
    }
    push(offers, extensionName, params);
  }

  return offers;
}

/**
 * Builds the `Sec-WebSocket-Extensions` header field value.
 *
 * @param {Object} extensions The map of extensions and parameters to format
 * @return {String} A string representing the given object
 * @public
 */
function format(extensions) {
  return Object.keys(extensions)
    .map((extension) => {
      let configurations = extensions[extension];
      if (!Array.isArray(configurations)) configurations = [configurations];
      return configurations
        .map((params) => {
          return [extension]
            .concat(
              Object.keys(params).map((k) => {
                let values = params[k];
                if (!Array.isArray(values)) values = [values];
                return values
                  .map((v) => (v === true ? k : `${k}=${v}`))
                  .join('; ');
              })
            )
            .join('; ');
        })
        .join(', ');
    })
    .join(', ');
}

module.exports = { format, parse };


/***/ }),
/* 30 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { tokenChars } = __webpack_require__(24);

/**
 * Parses the `Sec-WebSocket-Protocol` header into a set of subprotocol names.
 *
 * @param {String} header The field value of the header
 * @return {Set} The subprotocol names
 * @public
 */
function parse(header) {
  const protocols = new Set();
  let start = -1;
  let end = -1;
  let i = 0;

  for (i; i < header.length; i++) {
    const code = header.charCodeAt(i);

    if (end === -1 && tokenChars[code] === 1) {
      if (start === -1) start = i;
    } else if (
      i !== 0 &&
      (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
    ) {
      if (end === -1 && start !== -1) end = i;
    } else if (code === 0x2c /* ',' */) {
      if (start === -1) {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }

      if (end === -1) end = i;

      const protocol = header.slice(start, end);

      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }

      protocols.add(protocol);
      start = end = -1;
    } else {
      throw new SyntaxError(`Unexpected character at index ${i}`);
    }
  }

  if (start === -1 || end !== -1) {
    throw new SyntaxError('Unexpected end of input');
  }

  const protocol = header.slice(start, i);

  if (protocols.has(protocol)) {
    throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
  }

  protocols.add(protocol);
  return protocols;
}

module.exports = { parse };


/***/ }),
/* 31 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex$", "caughtErrors": "none" }] */



const EventEmitter = __webpack_require__(10);
const http = __webpack_require__(12);
const { Duplex } = __webpack_require__(16);
const { createHash } = __webpack_require__(15);

const extension = __webpack_require__(29);
const PerMessageDeflate = __webpack_require__(18);
const subprotocol = __webpack_require__(30);
const WebSocket = __webpack_require__(9);
const { CLOSE_TIMEOUT, GUID, kWebSocket } = __webpack_require__(21);

const keyRegex = /^[+/0-9A-Za-z]{22}==$/;

const RUNNING = 0;
const CLOSING = 1;
const CLOSED = 2;

/**
 * Class representing a WebSocket server.
 *
 * @extends EventEmitter
 */
class WebSocketServer extends EventEmitter {
  /**
   * Create a `WebSocketServer` instance.
   *
   * @param {Object} options Configuration options
   * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
   *     multiple times in the same tick
   * @param {Boolean} [options.autoPong=true] Specifies whether or not to
   *     automatically send a pong in response to a ping
   * @param {Number} [options.backlog=511] The maximum length of the queue of
   *     pending connections
   * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
   *     track clients
   * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
   *     wait for the closing handshake to finish after `websocket.close()` is
   *     called
   * @param {Function} [options.handleProtocols] A hook to handle protocols
   * @param {String} [options.host] The hostname where to bind the server
   * @param {Number} [options.maxBufferedChunks=1048576] The maximum number of
   *     buffered data chunks
   * @param {Number} [options.maxFragments=131072] The maximum number of message
   *     fragments
   * @param {Number} [options.maxPayload=104857600] The maximum allowed message
   *     size
   * @param {Boolean} [options.noServer=false] Enable no server mode
   * @param {String} [options.path] Accept only connections matching this path
   * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
   *     permessage-deflate
   * @param {Number} [options.port] The port where to bind the server
   * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
   *     server to use
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   * @param {Function} [options.verifyClient] A hook to reject connections
   * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
   *     class to use. It must be the `WebSocket` class or class that extends it
   * @param {Function} [callback] A listener for the `listening` event
   */
  constructor(options, callback) {
    super();

    options = {
      allowSynchronousEvents: true,
      autoPong: true,
      maxBufferedChunks: 1024 * 1024,
      maxFragments: 128 * 1024,
      maxPayload: 100 * 1024 * 1024,
      skipUTF8Validation: false,
      perMessageDeflate: false,
      handleProtocols: null,
      clientTracking: true,
      closeTimeout: CLOSE_TIMEOUT,
      verifyClient: null,
      noServer: false,
      backlog: null, // use default (511 as implemented in net.js)
      server: null,
      host: null,
      path: null,
      port: null,
      WebSocket,
      ...options
    };

    if (
      (options.port == null && !options.server && !options.noServer) ||
      (options.port != null && (options.server || options.noServer)) ||
      (options.server && options.noServer)
    ) {
      throw new TypeError(
        'One and only one of the "port", "server", or "noServer" options ' +
          'must be specified'
      );
    }

    if (options.port != null) {
      this._server = http.createServer((req, res) => {
        const body = http.STATUS_CODES[426];

        res.writeHead(426, {
          'Content-Length': body.length,
          'Content-Type': 'text/plain'
        });
        res.end(body);
      });
      this._server.listen(
        options.port,
        options.host,
        options.backlog,
        callback
      );
    } else if (options.server) {
      this._server = options.server;
    }

    if (this._server) {
      const emitConnection = this.emit.bind(this, 'connection');

      this._removeListeners = addListeners(this._server, {
        listening: this.emit.bind(this, 'listening'),
        error: this.emit.bind(this, 'error'),
        upgrade: (req, socket, head) => {
          this.handleUpgrade(req, socket, head, emitConnection);
        }
      });
    }

    if (options.perMessageDeflate === true) options.perMessageDeflate = {};
    if (options.clientTracking) {
      this.clients = new Set();
      this._shouldEmitClose = false;
    }

    this.options = options;
    this._state = RUNNING;
  }

  /**
   * Returns the bound address, the address family name, and port of the server
   * as reported by the operating system if listening on an IP socket.
   * If the server is listening on a pipe or UNIX domain socket, the name is
   * returned as a string.
   *
   * @return {(Object|String|null)} The address of the server
   * @public
   */
  address() {
    if (this.options.noServer) {
      throw new Error('The server is operating in "noServer" mode');
    }

    if (!this._server) return null;
    return this._server.address();
  }

  /**
   * Stop the server from accepting new connections and emit the `'close'` event
   * when all existing connections are closed.
   *
   * @param {Function} [cb] A one-time listener for the `'close'` event
   * @public
   */
  close(cb) {
    if (this._state === CLOSED) {
      if (cb) {
        this.once('close', () => {
          cb(new Error('The server is not running'));
        });
      }

      process.nextTick(emitClose, this);
      return;
    }

    if (cb) this.once('close', cb);

    if (this._state === CLOSING) return;
    this._state = CLOSING;

    if (this.options.noServer || this.options.server) {
      if (this._server) {
        this._removeListeners();
        this._removeListeners = this._server = null;
      }

      if (this.clients) {
        if (!this.clients.size) {
          process.nextTick(emitClose, this);
        } else {
          this._shouldEmitClose = true;
        }
      } else {
        process.nextTick(emitClose, this);
      }
    } else {
      const server = this._server;

      this._removeListeners();
      this._removeListeners = this._server = null;

      //
      // The HTTP/S server was created internally. Close it, and rely on its
      // `'close'` event.
      //
      server.close(() => {
        emitClose(this);
      });
    }
  }

  /**
   * See if a given request should be handled by this server instance.
   *
   * @param {http.IncomingMessage} req Request object to inspect
   * @return {Boolean} `true` if the request is valid, else `false`
   * @public
   */
  shouldHandle(req) {
    if (this.options.path) {
      const index = req.url.indexOf('?');
      const pathname = index !== -1 ? req.url.slice(0, index) : req.url;

      if (pathname !== this.options.path) return false;
    }

    return true;
  }

  /**
   * Handle a HTTP Upgrade request.
   *
   * @param {http.IncomingMessage} req The request object
   * @param {Duplex} socket The network socket between the server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Function} cb Callback
   * @public
   */
  handleUpgrade(req, socket, head, cb) {
    socket.on('error', socketOnError);

    const key = req.headers['sec-websocket-key'];
    const upgrade = req.headers.upgrade;
    const version = +req.headers['sec-websocket-version'];

    if (req.method !== 'GET') {
      const message = 'Invalid HTTP method';
      abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
      return;
    }

    if (upgrade === undefined || upgrade.toLowerCase() !== 'websocket') {
      const message = 'Invalid Upgrade header';
      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
      return;
    }

    if (key === undefined || !keyRegex.test(key)) {
      const message = 'Missing or invalid Sec-WebSocket-Key header';
      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
      return;
    }

    if (version !== 13 && version !== 8) {
      const message = 'Missing or invalid Sec-WebSocket-Version header';
      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
        'Sec-WebSocket-Version': '13, 8'
      });
      return;
    }

    if (!this.shouldHandle(req)) {
      abortHandshake(socket, 400);
      return;
    }

    const secWebSocketProtocol = req.headers['sec-websocket-protocol'];
    let protocols = new Set();

    if (secWebSocketProtocol !== undefined) {
      try {
        protocols = subprotocol.parse(secWebSocketProtocol);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Protocol header';
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }
    }

    const secWebSocketExtensions = req.headers['sec-websocket-extensions'];
    const extensions = {};

    if (
      this.options.perMessageDeflate &&
      secWebSocketExtensions !== undefined
    ) {
      const perMessageDeflate = new PerMessageDeflate({
        ...this.options.perMessageDeflate,
        isServer: true,
        maxPayload: this.options.maxPayload
      });

      try {
        const offers = extension.parse(secWebSocketExtensions);

        if (offers[PerMessageDeflate.extensionName]) {
          perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
          extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
      } catch (err) {
        const message =
          'Invalid or unacceptable Sec-WebSocket-Extensions header';
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }
    }

    //
    // Optionally call external client verification handler.
    //
    if (this.options.verifyClient) {
      const info = {
        origin:
          req.headers[`${version === 8 ? 'sec-websocket-origin' : 'origin'}`],
        secure: !!(req.socket.authorized || req.socket.encrypted),
        req
      };

      if (this.options.verifyClient.length === 2) {
        this.options.verifyClient(info, (verified, code, message, headers) => {
          if (!verified) {
            return abortHandshake(socket, code || 401, message, headers);
          }

          this.completeUpgrade(
            extensions,
            key,
            protocols,
            req,
            socket,
            head,
            cb
          );
        });
        return;
      }

      if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
    }

    this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
  }

  /**
   * Upgrade the connection to WebSocket.
   *
   * @param {Object} extensions The accepted extensions
   * @param {String} key The value of the `Sec-WebSocket-Key` header
   * @param {Set} protocols The subprotocols
   * @param {http.IncomingMessage} req The request object
   * @param {Duplex} socket The network socket between the server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Function} cb Callback
   * @throws {Error} If called more than once with the same socket
   * @private
   */
  completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
    //
    // Destroy the socket if the client has already sent a FIN packet.
    //
    if (!socket.readable || !socket.writable) return socket.destroy();

    if (socket[kWebSocket]) {
      throw new Error(
        'server.handleUpgrade() was called more than once with the same ' +
          'socket, possibly due to a misconfiguration'
      );
    }

    if (this._state > RUNNING) return abortHandshake(socket, 503);

    const digest = createHash('sha1')
      .update(key + GUID)
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${digest}`
    ];

    const ws = new this.options.WebSocket(null, undefined, this.options);

    if (protocols.size) {
      //
      // Optionally call external protocol selection handler.
      //
      const protocol = this.options.handleProtocols
        ? this.options.handleProtocols(protocols, req)
        : protocols.values().next().value;

      if (protocol) {
        headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
        ws._protocol = protocol;
      }
    }

    if (extensions[PerMessageDeflate.extensionName]) {
      const params = extensions[PerMessageDeflate.extensionName].params;
      const value = extension.format({
        [PerMessageDeflate.extensionName]: [params]
      });
      headers.push(`Sec-WebSocket-Extensions: ${value}`);
      ws._extensions = extensions;
    }

    //
    // Allow external modification/inspection of handshake headers.
    //
    this.emit('headers', headers, req);

    socket.write(headers.concat('\r\n').join('\r\n'));
    socket.removeListener('error', socketOnError);

    ws.setSocket(socket, head, {
      allowSynchronousEvents: this.options.allowSynchronousEvents,
      maxBufferedChunks: this.options.maxBufferedChunks,
      maxFragments: this.options.maxFragments,
      maxPayload: this.options.maxPayload,
      skipUTF8Validation: this.options.skipUTF8Validation
    });

    if (this.clients) {
      this.clients.add(ws);
      ws.on('close', () => {
        this.clients.delete(ws);

        if (this._shouldEmitClose && !this.clients.size) {
          process.nextTick(emitClose, this);
        }
      });
    }

    cb(ws, req);
  }
}

module.exports = WebSocketServer;

/**
 * Add event listeners on an `EventEmitter` using a map of <event, listener>
 * pairs.
 *
 * @param {EventEmitter} server The event emitter
 * @param {Object.<String, Function>} map The listeners to add
 * @return {Function} A function that will remove the added listeners when
 *     called
 * @private
 */
function addListeners(server, map) {
  for (const event of Object.keys(map)) server.on(event, map[event]);

  return function removeListeners() {
    for (const event of Object.keys(map)) {
      server.removeListener(event, map[event]);
    }
  };
}

/**
 * Emit a `'close'` event on an `EventEmitter`.
 *
 * @param {EventEmitter} server The event emitter
 * @private
 */
function emitClose(server) {
  server._state = CLOSED;
  server.emit('close');
}

/**
 * Handle socket errors.
 *
 * @private
 */
function socketOnError() {
  this.destroy();
}

/**
 * Close the connection when preconditions are not fulfilled.
 *
 * @param {Duplex} socket The socket of the upgrade request
 * @param {Number} code The HTTP response status code
 * @param {String} [message] The HTTP response body
 * @param {Object} [headers] Additional HTTP response headers
 * @private
 */
function abortHandshake(socket, code, message, headers) {
  //
  // The socket is writable unless the user destroyed or ended it before calling
  // `server.handleUpgrade()` or in the `verifyClient` function, which is a user
  // error. Handling this does not make much sense as the worst that can happen
  // is that some of the data written by the user might be discarded due to the
  // call to `socket.end()` below, which triggers an `'error'` event that in
  // turn causes the socket to be destroyed.
  //
  message = message || http.STATUS_CODES[code];
  headers = {
    Connection: 'close',
    'Content-Type': 'text/html',
    'Content-Length': Buffer.byteLength(message),
    ...headers
  };

  socket.once('finish', socket.destroy);

  socket.end(
    `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r\n` +
      Object.keys(headers)
        .map((h) => `${h}: ${headers[h]}`)
        .join('\r\n') +
      '\r\n\r\n' +
      message
  );
}

/**
 * Emit a `'wsClientError'` event on a `WebSocketServer` if there is at least
 * one listener for it, otherwise call `abortHandshake()`.
 *
 * @param {WebSocketServer} server The WebSocket server
 * @param {http.IncomingMessage} req The request object
 * @param {Duplex} socket The socket of the upgrade request
 * @param {Number} code The HTTP response status code
 * @param {String} message The HTTP response body
 * @param {Object} [headers] The HTTP response headers
 * @private
 */
function abortHandshakeOrEmitwsClientError(
  server,
  req,
  socket,
  code,
  message,
  headers
) {
  if (server.listenerCount('wsClientError')) {
    const err = new Error(message);
    Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);

    server.emit('wsClientError', err, socket, req);
  } else {
    abortHandshake(socket, code, message, headers);
  }
}


/***/ }),
/* 32 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.I18n = void 0;
const vscode = __webpack_require__(1);
const translations = {
    en: {
        // General & Project Settings
        'no_active_project': 'No active microStudio project.',
        'select_project_or_open': 'Select a project file or open a folder containing project.json.',
        'project_title': 'Project Title:',
        'slug': 'Slug:',
        'version': 'Version:',
        'engine_config': 'Engine Configuration',
        'language': 'Language:',
        'graphics_engine': 'Graphics Engine:',
        'project_type': 'Type:',
        'type_game': 'Game',
        'type_app': 'App',
        'type_library': 'Library',
        'orientation': 'Orientation:',
        'orientation_landscape': 'Landscape',
        'orientation_portrait': 'Portrait',
        'orientation_any': 'Any',
        'aspect': 'Aspect Ratio:',
        'aspect_free': 'Free',
        'libraries': 'Libraries',
        'browse_libraries': 'Browse',
        'no_connected_libs': 'No connected libraries',
        'save_settings': 'Save Settings',
        'settings_saved': 'Project settings saved successfully.',
        'push_to_server': 'Push to microStudio.dev',
        'edit_json': 'JSON',
        // Resource Creator
        'new_sprite_prompt': 'Enter new Sprite name (e.g. player, enemies/boss):',
        'new_sprite_created': 'Created new Sprite: {0}',
        'sprite_already_exists': 'Sprite "{0}" already exists!',
        'new_map_prompt': 'Enter new Map name (e.g. map1, world/level1):',
        'new_map_created': 'Created new Map: {0}',
        'map_already_exists': 'Map "{0}" already exists!',
        'new_script_prompt': 'Enter new Script file name (e.g. player, ui/menu) [extension .ms]:',
        'new_script_created': 'Created new Script: {0}.ms',
        'script_already_exists': 'Script file "{0}.ms" already exists!',
        'new_sound_prompt': 'Enter new Sound file name (e.g. jump, explosion):',
        'new_sound_created': 'Created Sound file: {0}.wav',
        'new_music_prompt': 'Enter new Music file name (e.g. theme, battle):',
        'new_music_created': 'Created Music file: {0}.mp3',
        'import_assets_title': 'Select files to import to assets/',
        'imported_assets': 'Imported {0} file(s) to assets/',
        'name_cannot_be_empty': 'Name cannot be empty',
        'project_not_found': 'No active microStudio project found (missing project.json).',
        // Project Explorer & Sync
        'set_workspace_root': 'Set Projects Root Directory...',
        'set_workspace_root_dialog': 'Select Projects Root Directory',
        'workspace_root_set': 'Set projects root folder: {0}',
        'no_local_projects': 'No local microStudio projects found in directory.',
        'local_projects_error': 'Error reading projects directory.',
        'already_connected': 'Already connected to microstudio.dev',
        'login_username_prompt': 'Enter microStudio username',
        'login_password_prompt': 'Enter microStudio password',
        'login_connecting': 'Connecting to microstudio.dev...',
        'login_success': 'Logged in as {0}',
        'login_failed': 'Login error: {0}',
        'login_required_download': 'You must be logged in to download projects.',
        'login_required_upload': 'You must be logged in to microstudio.dev to upload projects.',
        'login_action': 'Log In',
        'logged_out': 'Logged out from microstudio.dev',
        'clone_project_title': 'Downloading project "{0}"...',
        'clone_project_success': 'Project "{0}" downloaded successfully.',
        'clone_project_failed': 'Download error: {0}',
        'directory_exists_overwrite': 'Directory "{0}" already exists. Do you want to overwrite it?',
        'yes': 'Yes',
        'open_project_current_window': 'Open in current window',
        'open_project_new_window': 'Open in new window',
        'project_already_open': 'Project "{0}" is already open in the current window.',
        'delete_project_confirm': 'Are you sure you want to delete local project "{0}"?',
        'delete_project_success': 'Deleted project "{0}".',
        'delete_project_failed': 'Failed to delete project: {0}',
        'select_remote_project_title': 'Select Target Project on microstudio.dev',
        'select_remote_project_prompt': 'Select the remote project on microstudio.dev to push "{0}" to:',
        'suggested_matches': 'Suggested matches on your account:',
        'all_remote_projects': 'All your remote projects:',
        'create_new_remote': 'Create new project on microstudio.dev: "{0}"',
        'upload_cancelling': 'Project upload cancelled.',
        'upload_creating_remote': 'Creating new project "{0}" on server...',
        'upload_syncing_options': 'Syncing project options...',
        'uploading_file': 'Uploading {0} ({1}/{2})...',
        'upload_finished': 'Project "{0}" successfully updated on microStudio server!',
        'upload_failed': 'Upload error: {0}',
        // HTML Export & Preview
        'export_html_title': 'Exporting game to HTML5...',
        'export_html_success': 'Successfully exported game to: {0}',
        'open_in_browser': 'Open in Browser',
        'preview_project_not_found': 'No microStudio project found to preview.'
    },
    pl: {
        // General & Project Settings
        'no_active_project': 'Brak aktywnego projektu microStudio.',
        'select_project_or_open': 'Wybierz plik projektu lub otwórz katalog z project.json.',
        'project_title': 'Tytuł projektu (Title):',
        'slug': 'Slug:',
        'version': 'Wersja:',
        'engine_config': 'Konfiguracja Silnika',
        'language': 'Język:',
        'graphics_engine': 'Silnik graficzny (Graphics):',
        'project_type': 'Typ:',
        'type_game': 'Gra (Game)',
        'type_app': 'Aplikacja (App)',
        'type_library': 'Biblioteka (Library)',
        'orientation': 'Orientacja:',
        'orientation_landscape': 'Pozioma (Landscape)',
        'orientation_portrait': 'Pionowa (Portrait)',
        'orientation_any': 'Dowolna (Any)',
        'aspect': 'Proporcje (Aspect):',
        'aspect_free': 'Swobodne (Free)',
        'libraries': 'Biblioteki (Libraries)',
        'browse_libraries': 'Biblioteki',
        'no_connected_libs': 'Brak podłączonych bibliotek',
        'save_settings': 'Zapisz ustawienia',
        'settings_saved': 'Ustawienia projektu zostały pomyślnie zapisane.',
        'push_to_server': 'Wyślij na serwer (Push)',
        'edit_json': 'JSON',
        // Resource Creator
        'new_sprite_prompt': 'Podaj nazwę nowego Sprite\'a (np. gracz, wrogowie/boss):',
        'new_sprite_created': 'Utworzono nowy Sprite: {0}',
        'sprite_already_exists': 'Sprite o nazwie "{0}" już istnieje!',
        'new_map_prompt': 'Podaj nazwę nowej Mapy (np. mapa1, swiat/poziom1):',
        'new_map_created': 'Utworzono nową Mapę: {0}',
        'map_already_exists': 'Mapa o nazwie "{0}" już istnieje!',
        'new_script_prompt': 'Podaj nazwę nowego pliku skryptu (np. gracz, ui/menu) [rozszerzenie .ms]:',
        'new_script_created': 'Utworzono skrypt: {0}.ms',
        'script_already_exists': 'Plik skryptu "{0}.ms" już istnieje!',
        'new_sound_prompt': 'Podaj nazwę pliku dźwiękowego (np. skok, wybuch):',
        'new_sound_created': 'Utworzono plik dźwiękowy: {0}.wav',
        'new_music_prompt': 'Podaj nazwę pliku muzycznego (np. tlo, bitwa):',
        'new_music_created': 'Utworzono plik muzyczny: {0}.mp3',
        'import_assets_title': 'Wybierz pliki do zaimportowania do assets/',
        'imported_assets': 'Zaimportowano {0} plik(ów) do assets/',
        'name_cannot_be_empty': 'Nazwa nie może być pusta',
        'project_not_found': 'Nie znaleziono aktywnego projektu microStudio (brak pliku project.json).',
        // Project Explorer & Sync
        'set_workspace_root': 'Ustaw katalog główny projektów...',
        'set_workspace_root_dialog': 'Wybierz katalog główny projektów',
        'workspace_root_set': 'Ustawiono katalog główny projektów: {0}',
        'no_local_projects': 'Brak lokalnych projektów w katalogu.',
        'local_projects_error': 'Błąd odczytu katalogu głównego.',
        'already_connected': 'Już połączono z microstudio.dev',
        'login_username_prompt': 'Wpisz nazwę użytkownika microStudio',
        'login_password_prompt': 'Wpisz hasło microStudio',
        'login_connecting': 'Łączenie z microstudio.dev...',
        'login_success': 'Zalogowano jako {0}',
        'login_failed': 'Błąd logowania: {0}',
        'login_required_download': 'Musisz być zalogowany, aby pobrać projekt.',
        'login_required_upload': 'Musisz być zalogowany do microstudio.dev, aby wysłać projekt.',
        'login_action': 'Zaloguj się',
        'logged_out': 'Wylogowano z microstudio.dev',
        'clone_project_title': 'Pobieranie projektu "{0}"...',
        'clone_project_success': 'Projekt "{0}" został pobrany.',
        'clone_project_failed': 'Błąd pobierania projektu: {0}',
        'directory_exists_overwrite': 'Katalog "{0}" już istnieje. Czy chcesz go nadpisać?',
        'yes': 'Tak',
        'open_project_current_window': 'Otwórz w bieżącym oknie',
        'open_project_new_window': 'Otwórz w nowym oknie',
        'project_already_open': 'Projekt "{0}" jest już otwarty w bieżącym oknie.',
        'delete_project_confirm': 'Czy na pewno chcesz usunąć lokalny projekt "{0}"?',
        'delete_project_success': 'Usunięto projekt "{0}".',
        'delete_project_failed': 'Nie udało się usunąć projektu: {0}',
        'select_remote_project_title': 'Wybór zdalnego projektu docelowego',
        'select_remote_project_prompt': 'Wybierz zdalny projekt na microstudio.dev, do którego chcesz wysłać "{0}":',
        'suggested_matches': 'Sugerowane dopasowania na Twoim koncie:',
        'all_remote_projects': 'Wszystkie Twoje projekty zdalne:',
        'create_new_remote': 'Utwórz nowy projekt na microstudio.dev: "{0}"',
        'upload_cancelling': 'Anulowano wysyłanie projektu.',
        'upload_creating_remote': 'Tworzenie nowego projektu "{0}" na serwerze...',
        'upload_syncing_options': 'Aktualizacja opcji projektu...',
        'uploading_file': 'Wysyłanie {0} ({1}/{2})...',
        'upload_finished': 'Projekt "{0}" został pomyślnie zaktualizowany na serwerze microStudio!',
        'upload_failed': 'Błąd wysyłania projektu: {0}',
        // HTML Export & Preview
        'export_html_title': 'Eksportowanie gry do HTML5...',
        'export_html_success': 'Pomyślnie wyeksportowano grę do: {0}',
        'open_in_browser': 'Otwórz w przeglądarce',
        'preview_project_not_found': 'Nie znaleziono projektu microStudio do uruchomienia podglądu.'
    }
};
class I18n {
    static getLocale() {
        const config = vscode.workspace.getConfiguration('microstudio');
        const langSetting = config.get('language', 'auto');
        if (langSetting === 'pl' || langSetting === 'en') {
            return langSetting;
        }
        const vscodeLang = vscode.env.language.toLowerCase();
        if (vscodeLang.startsWith('pl')) {
            return 'pl';
        }
        return 'en';
    }
    static t(key, ...args) {
        const locale = this.getLocale();
        let template = translations[locale]?.[key] || translations['en']?.[key] || key;
        if (args && args.length > 0) {
            args.forEach((arg, index) => {
                template = template.replace(new RegExp(`\\{${index}\\}`, 'g'), String(arg));
            });
        }
        return template;
    }
    static getAll(locale) {
        const loc = locale || this.getLocale();
        return translations[loc] || translations['en'];
    }
}
exports.I18n = I18n;


/***/ }),
/* 33 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RemoteProjectsProvider = exports.RemoteProjectTreeItem = exports.LocalProjectsProvider = exports.LocalProjectTreeItem = void 0;
const vscode = __webpack_require__(1);
const fs = __webpack_require__(3);
const path = __webpack_require__(2);
const i18n_1 = __webpack_require__(32);
class LocalProjectTreeItem extends vscode.TreeItem {
    constructor(title, slug, fsPath) {
        super(title, vscode.TreeItemCollapsibleState.None);
        this.title = title;
        this.slug = slug;
        this.fsPath = fsPath;
        this.description = slug;
        this.contextValue = 'localProject';
        this.iconPath = new vscode.ThemeIcon('folder');
        this.tooltip = `${title} (${slug})\n${fsPath}`;
        this.command = {
            command: 'microstudio.selectLocalProject',
            title: 'Select',
            arguments: [this]
        };
    }
}
exports.LocalProjectTreeItem = LocalProjectTreeItem;
class LocalProjectsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Refresh when configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('microstudio.workspaceRoot') || e.affectsConfiguration('microstudio.language')) {
                this.refresh();
            }
        });
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            return [];
        }
        const config = vscode.workspace.getConfiguration('microstudio');
        const workspaceRoot = config.get('workspaceRoot');
        if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
            const setupItem = new vscode.TreeItem(i18n_1.I18n.t('set_workspace_root'));
            setupItem.command = {
                command: 'microstudio.setWorkspaceRoot',
                title: i18n_1.I18n.t('set_workspace_root')
            };
            setupItem.iconPath = new vscode.ThemeIcon('settings-gear');
            return [setupItem];
        }
        try {
            const dirs = fs.readdirSync(workspaceRoot, { withFileTypes: true });
            const projects = [];
            for (const dir of dirs) {
                if (dir.isDirectory()) {
                    const projectDir = path.join(workspaceRoot, dir.name);
                    const projectJsonPath = path.join(projectDir, 'project.json');
                    if (fs.existsSync(projectJsonPath)) {
                        try {
                            const data = fs.readFileSync(projectJsonPath, 'utf8');
                            const projectJson = JSON.parse(data);
                            const title = projectJson.title || dir.name;
                            const slug = projectJson.slug || dir.name;
                            projects.push(new LocalProjectTreeItem(title, slug, projectDir));
                        }
                        catch (err) {
                            console.error(`Error reading project.json in ${projectDir}`, err);
                        }
                    }
                }
            }
            if (projects.length === 0) {
                const emptyItem = new vscode.TreeItem(i18n_1.I18n.t('no_local_projects'));
                emptyItem.iconPath = new vscode.ThemeIcon('info');
                return [emptyItem];
            }
            // Sort projects by title
            return projects.sort((a, b) => a.title.localeCompare(b.title));
        }
        catch (err) {
            console.error('Error listing workspaceRoot', err);
            const errorItem = new vscode.TreeItem(i18n_1.I18n.t('local_projects_error'));
            errorItem.iconPath = new vscode.ThemeIcon('error');
            return [errorItem];
        }
    }
}
exports.LocalProjectsProvider = LocalProjectsProvider;
class RemoteProjectTreeItem extends vscode.TreeItem {
    constructor(project) {
        super(project.title, vscode.TreeItemCollapsibleState.None);
        this.project = project;
        this.description = `by ${project.owner.nick}`;
        this.contextValue = 'remoteProject';
        this.iconPath = new vscode.ThemeIcon('cloud');
        let sizeKb = 0;
        if (project.size) {
            sizeKb = Math.round(project.size / 1024);
        }
        this.tooltip = `${project.title}\nID: ${project.id}\nOwner: ${project.owner.nick}\nSize: ${sizeKb} KB\nLanguage: ${project.language || 'microscript'}`;
    }
}
exports.RemoteProjectTreeItem = RemoteProjectTreeItem;
class RemoteProjectsProvider {
    constructor(syncService) {
        this.syncService = syncService;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.cachedProjects = null;
        // Refresh when connection status changes
        this.syncService.onConnectionStateChanged(() => {
            this.cachedProjects = null;
            this.refresh();
        });
    }
    refresh() {
        this.cachedProjects = null;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            return [];
        }
        const state = this.syncService.getConnectionState();
        if (state === 'disconnected') {
            const loginItem = new vscode.TreeItem(i18n_1.I18n.t('login_username_prompt') + '...');
            loginItem.command = {
                command: 'microstudio.login',
                title: i18n_1.I18n.t('login_action')
            };
            loginItem.iconPath = new vscode.ThemeIcon('key');
            return [loginItem];
        }
        if (state === 'connecting') {
            const connectingItem = new vscode.TreeItem(i18n_1.I18n.t('login_connecting'));
            connectingItem.iconPath = new vscode.ThemeIcon('loading~spin');
            return [connectingItem];
        }
        if (this.cachedProjects) {
            return this.cachedProjects.map(p => new RemoteProjectTreeItem(p));
        }
        try {
            const projects = await this.syncService.getRemoteProjects();
            this.cachedProjects = projects;
            if (projects.length === 0) {
                const emptyItem = new vscode.TreeItem(i18n_1.I18n.t('no_local_projects'));
                emptyItem.iconPath = new vscode.ThemeIcon('info');
                return [emptyItem];
            }
            return projects
                .sort((a, b) => a.title.localeCompare(b.title))
                .map(p => new RemoteProjectTreeItem(p));
        }
        catch (err) {
            console.error('Error fetching remote projects', err);
            const errorItem = new vscode.TreeItem(`${err.message}`);
            errorItem.iconPath = new vscode.ThemeIcon('error');
            return [errorItem];
        }
    }
}
exports.RemoteProjectsProvider = RemoteProjectsProvider;


/***/ }),
/* 34 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ProjectSettingsViewProvider = void 0;
const vscode = __webpack_require__(1);
const path = __webpack_require__(2);
const fs = __webpack_require__(3);
const i18n_1 = __webpack_require__(32);
class ProjectSettingsViewProvider {
    constructor(context) {
        this.context = context;
        this._currentProjectData = null;
        // Watch for active editor changes to switch active project
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.detectActiveProject(editor.document.uri);
            }
        });
        // Watch for project.json changes on disk
        const watcher = vscode.workspace.createFileSystemWatcher('**/project.json');
        watcher.onDidChange(uri => {
            if (this._currentProjectUri && uri.fsPath === path.join(this._currentProjectUri.fsPath, 'project.json')) {
                this.loadProjectData(this._currentProjectUri);
            }
        });
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        webviewView.webview.html = this.getHtmlForWebview();
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'ready':
                    if (this._currentProjectUri) {
                        await this.loadProjectData(this._currentProjectUri);
                    }
                    else {
                        await this.detectActiveProject();
                    }
                    break;
                case 'save':
                    await this.saveProjectData(message.data);
                    break;
                case 'open_json':
                    if (this._currentProjectUri) {
                        const jsonUri = vscode.Uri.joinPath(this._currentProjectUri, 'project.json');
                        const doc = await vscode.workspace.openTextDocument(jsonUri);
                        vscode.window.showTextDocument(doc);
                    }
                    break;
                case 'browse_libraries':
                    vscode.commands.executeCommand('microstudio.manageLibraries');
                    break;
                case 'push':
                    if (this._currentProjectUri) {
                        vscode.commands.executeCommand('microstudio.pushProject', { fsPath: this._currentProjectUri.fsPath, title: this._currentProjectData?.title || 'Project' });
                    }
                    break;
                case 'refresh':
                    if (this._currentProjectUri) {
                        await this.loadProjectData(this._currentProjectUri);
                    }
                    else {
                        await this.detectActiveProject();
                    }
                    break;
            }
        });
        // Initial detection
        if (this._currentProjectUri) {
            this.loadProjectData(this._currentProjectUri);
        }
        else {
            this.detectActiveProject();
        }
    }
    async setProject(projectUri) {
        this._currentProjectUri = projectUri;
        await this.loadProjectData(projectUri);
    }
    async detectActiveProject(uri) {
        if (!uri) {
            if (vscode.window.activeTextEditor) {
                uri = vscode.window.activeTextEditor.document.uri;
            }
            else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                uri = vscode.workspace.workspaceFolders[0].uri;
            }
        }
        if (!uri) {
            if (this._view)
                this._view.webview.postMessage({ type: 'empty' });
            return;
        }
        let current = uri.fsPath;
        if (fs.existsSync(current) && fs.statSync(current).isFile()) {
            current = path.dirname(current);
        }
        for (let i = 0; i < 6; i++) {
            const pj = path.join(current, 'project.json');
            if (fs.existsSync(pj)) {
                const projectUri = vscode.Uri.file(current);
                this._currentProjectUri = projectUri;
                await this.loadProjectData(projectUri);
                return;
            }
            const parent = path.dirname(current);
            if (parent === current)
                break;
            current = parent;
        }
        // Also check direct subdirectories of workspaceFolders
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                try {
                    const entries = fs.readdirSync(folder.uri.fsPath, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory()) {
                            const subPj = path.join(folder.uri.fsPath, entry.name, 'project.json');
                            if (fs.existsSync(subPj)) {
                                const projectUri = vscode.Uri.file(path.join(folder.uri.fsPath, entry.name));
                                this._currentProjectUri = projectUri;
                                await this.loadProjectData(projectUri);
                                return;
                            }
                        }
                    }
                }
                catch (e) { }
            }
        }
        this._currentProjectData = null;
        if (this._view) {
            this._view.webview.postMessage({ type: 'empty' });
        }
    }
    async loadProjectData(projectUri) {
        const jsonPath = path.join(projectUri.fsPath, 'project.json');
        if (!fs.existsSync(jsonPath)) {
            this._currentProjectData = null;
            if (this._view) {
                this._view.webview.postMessage({ type: 'empty' });
            }
            return;
        }
        try {
            const content = fs.readFileSync(jsonPath, 'utf8');
            this._currentProjectData = JSON.parse(content);
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'load',
                    data: this._currentProjectData,
                    folderName: path.basename(projectUri.fsPath),
                    fsPath: projectUri.fsPath
                });
            }
        }
        catch (e) {
            console.error('Failed to parse project.json', e);
        }
    }
    async saveProjectData(updatedData) {
        if (!this._currentProjectUri)
            return;
        const jsonPath = path.join(this._currentProjectUri.fsPath, 'project.json');
        try {
            // Merge existing data with updated data
            const merged = Object.assign({}, this._currentProjectData || {}, updatedData);
            fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2), 'utf8');
            this._currentProjectData = merged;
            vscode.window.showInformationMessage(i18n_1.I18n.t('settings_saved'));
            if (this._view) {
                this._view.webview.postMessage({ type: 'saved' });
            }
        }
        catch (e) {
            vscode.window.showErrorMessage(`Error: ${e.message}`);
        }
    }
    getHtmlForWebview() {
        const t = (key) => i18n_1.I18n.t(key);
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
                <style>
                    body {
                        font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, sans-serif);
                        font-size: var(--vscode-font-size, 13px);
                        color: var(--vscode-foreground, #ccc);
                        background-color: transparent;
                        padding: 10px;
                        margin: 0;
                        box-sizing: border-box;
                    }
                    .section-title {
                        font-size: 11px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        color: var(--vscode-descriptionForeground, #888);
                        margin: 12px 0 6px 0;
                        font-weight: 600;
                    }
                    .field {
                        margin-bottom: 10px;
                    }
                    label {
                        display: block;
                        margin-bottom: 3px;
                        font-size: 12px;
                    }
                    input[type="text"], select, textarea {
                        width: 100%;
                        box-sizing: border-box;
                        background: var(--vscode-input-background, #2d2d2d);
                        color: var(--vscode-input-foreground, #fff);
                        border: 1px solid var(--vscode-input-border, #444);
                        border-radius: 4px;
                        padding: 5px 8px;
                        font-size: 12px;
                    }
                    input[type="text"]:focus, select:focus {
                        outline: 1px solid var(--vscode-focusBorder, #007acc);
                        border-color: var(--vscode-focusBorder, #007acc);
                    }
                    .row {
                        display: flex;
                        gap: 8px;
                    }
                    .row > div {
                        flex: 1;
                    }
                    .btn-primary {
                        width: 100%;
                        background: hsl(160, 50%, 38%);
                        color: #fff;
                        border: none;
                        border-radius: 4px;
                        padding: 7px 12px;
                        cursor: pointer;
                        font-weight: 600;
                        margin-top: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        transition: background 0.2s;
                    }
                    .btn-primary:hover {
                        background: hsl(160, 50%, 48%);
                    }
                    .btn-secondary {
                        background: var(--vscode-button-secondaryBackground, #3a3d41);
                        color: var(--vscode-button-secondaryForeground, #fff);
                        border: none;
                        border-radius: 4px;
                        padding: 5px 10px;
                        cursor: pointer;
                        font-size: 11px;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .btn-secondary:hover {
                        background: var(--vscode-button-secondaryHoverBackground, #45494e);
                    }
                    .libs-container {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 4px;
                        margin-top: 4px;
                        min-height: 24px;
                    }
                    .lib-tag {
                        background: rgba(0, 180, 255, 0.2);
                        border: 1px solid rgba(0, 180, 255, 0.4);
                        color: #5cd8ff;
                        padding: 2px 6px;
                        border-radius: 12px;
                        font-size: 11px;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .lib-tag i {
                        cursor: pointer;
                        opacity: 0.7;
                    }
                    .lib-tag i:hover {
                        opacity: 1;
                        color: #ff6b6b;
                    }
                    #no-project {
                        text-align: center;
                        padding: 30px 10px;
                        color: var(--vscode-descriptionForeground, #888);
                    }
                    #project-form {
                        display: none;
                    }
                    .header-banner {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding-bottom: 8px;
                        border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.1));
                        margin-bottom: 10px;
                    }
                    .project-title-display {
                        font-weight: bold;
                        font-size: 14px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                </style>
            </head>
            <body>
                <div id="no-project">
                    <i class="fa fa-folder-open" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    ${t('no_active_project')}<br>
                    <small style="opacity: 0.7;">${t('select_project_or_open')}</small>
                </div>

                <div id="project-form">
                    <div class="header-banner">
                        <div class="project-title-display" id="display-name">Project</div>
                        <button class="btn-secondary" id="btn-open-json" title="${t('edit_json')}">
                            <i class="fa fa-code"></i> ${t('edit_json')}
                        </button>
                    </div>

                    <div class="field">
                        <label>${t('project_title')}</label>
                        <input type="text" id="inp-title" placeholder="My Game" />
                    </div>

                    <div class="row">
                        <div class="field">
                            <label>${t('slug')}</label>
                            <input type="text" id="inp-slug" placeholder="my_game" />
                        </div>
                        <div class="field">
                            <label>${t('version')}</label>
                            <input type="text" id="inp-version" placeholder="1.0.0" />
                        </div>
                    </div>

                    <div class="section-title">${t('engine_config')}</div>

                    <div class="row">
                        <div class="field">
                            <label>${t('language')}</label>
                            <select id="sel-language">
                                <option value="microscript_v2">MicroScript v2</option>
                                <option value="microscript_v1">MicroScript v1</option>
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="lua">Lua</option>
                            </select>
                        </div>
                        <div class="field">
                            <label>${t('project_type')}</label>
                            <select id="sel-type">
                                <option value="game">${t('type_game')}</option>
                                <option value="app">${t('type_app')}</option>
                                <option value="library">${t('type_library')}</option>
                            </select>
                        </div>
                    </div>

                    <div class="row">
                        <div class="field">
                            <label>${t('graphics_engine')}</label>
                            <select id="sel-graphics">
                                <option value="standard">Standard (2D Canvas)</option>
                                <option value="M2D">M2D (microStudio 2D)</option>
                                <option value="M3D">M3D (microStudio 3D)</option>
                                <option value="PIXI">PixiJS (2D WebGL)</option>
                                <option value="BABYLON">Babylon.js (3D)</option>
                                <option value="THREE">Three.js (3D)</option>
                            </select>
                        </div>
                    </div>

                    <div class="row">
                        <div class="field">
                            <label>${t('orientation')}</label>
                            <select id="sel-orientation">
                                <option value="landscape">${t('orientation_landscape')}</option>
                                <option value="portrait">${t('orientation_portrait')}</option>
                                <option value="any">${t('orientation_any')}</option>
                            </select>
                        </div>
                        <div class="field">
                            <label>${t('aspect')}</label>
                            <select id="sel-aspect">
                                <option value="16:9">16:9</option>
                                <option value="4:3">4:3</option>
                                <option value="1:1">1:1</option>
                                <option value="16:10">16:10</option>
                                <option value="free">${t('aspect_free')}</option>
                            </select>
                        </div>
                    </div>

                    <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${t('libraries')}</span>
                        <button class="btn-secondary" id="btn-browse-libs" style="padding: 2px 6px; font-size: 10px;">
                            <i class="fa fa-cubes"></i> ${t('browse_libraries')}
                        </button>
                    </div>

                    <div class="libs-container" id="libs-list"></div>

                    <button class="btn-primary" id="btn-save">
                        <i class="fa fa-save"></i> ${t('save_settings')}
                    </button>
                    <button class="btn-primary" id="btn-push" style="background: hsl(205, 60%, 40%); margin-top: 6px;">
                        <i class="fa fa-cloud-upload-alt"></i> ${t('push_to_server')}
                    </button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    let currentData = {};

                    const noProjectEl = document.getElementById('no-project');
                    const projectFormEl = document.getElementById('project-form');
                    const displayNameEl = document.getElementById('display-name');
                    const inpTitle = document.getElementById('inp-title');
                    const inpSlug = document.getElementById('inp-slug');
                    const inpVersion = document.getElementById('inp-version');
                    const selLanguage = document.getElementById('sel-language');
                    const selGraphics = document.getElementById('sel-graphics');
                    const selType = document.getElementById('sel-type');
                    const selOrientation = document.getElementById('sel-orientation');
                    const selAspect = document.getElementById('sel-aspect');
                    const libsListEl = document.getElementById('libs-list');

                    window.addEventListener('message', event => {
                        const msg = event.data;
                        if (msg.type === 'load') {
                            currentData = msg.data || {};
                            noProjectEl.style.display = 'none';
                            projectFormEl.style.display = 'block';

                            displayNameEl.textContent = currentData.title || msg.folderName;
                            inpTitle.value = currentData.title || '';
                            inpSlug.value = currentData.slug || msg.folderName || '';
                            inpVersion.value = currentData.version || '1.0.0';
                            selLanguage.value = currentData.language || 'microscript_v2';
                            selGraphics.value = currentData.graphics || 'standard';
                            selType.value = currentData.type || 'game';
                            selOrientation.value = currentData.orientation || 'landscape';
                            selAspect.value = currentData.aspect || '16:9';

                            renderLibs(currentData.libs || []);
                        } else if (msg.type === 'empty') {
                            noProjectEl.style.display = 'block';
                            projectFormEl.style.display = 'none';
                        }
                    });

                    function renderLibs(libs) {
                        libsListEl.innerHTML = '';
                        if (!libs || libs.length === 0) {
                            libsListEl.innerHTML = '<small style="opacity:0.5; font-size:11px;">${t('no_connected_libs')}</small>';
                            return;
                        }
                        libs.forEach(lib => {
                            const tag = document.createElement('div');
                            tag.className = 'lib-tag';
                            tag.innerHTML = '<span>' + lib + '</span><i class="fa fa-times" title="Delete"></i>';
                            tag.querySelector('i').addEventListener('click', () => {
                                currentData.libs = currentData.libs.filter(l => l !== lib);
                                renderLibs(currentData.libs);
                            });
                            libsListEl.appendChild(tag);
                        });
                    }

                    document.getElementById('btn-save').addEventListener('click', () => {
                        const updated = {
                            title: inpTitle.value.trim(),
                            slug: inpSlug.value.trim(),
                            version: inpVersion.value.trim(),
                            language: selLanguage.value,
                            graphics: selGraphics.value,
                            type: selType.value,
                            orientation: selOrientation.value,
                            aspect: selAspect.value,
                            libs: currentData.libs || []
                        };
                        vscode.postMessage({ type: 'save', data: updated });
                    });

                    document.getElementById('btn-push').addEventListener('click', () => {
                        vscode.postMessage({ type: 'push' });
                    });

                    document.getElementById('btn-open-json').addEventListener('click', () => {
                        vscode.postMessage({ type: 'open_json' });
                    });

                    document.getElementById('btn-browse-libs').addEventListener('click', () => {
                        vscode.postMessage({ type: 'browse_libraries' });
                    });

                    // Signal ready to load project
                    vscode.postMessage({ type: 'ready' });
                </script>
            </body>
            </html>
        `;
    }
}
exports.ProjectSettingsViewProvider = ProjectSettingsViewProvider;
ProjectSettingsViewProvider.viewType = 'microstudio.projectDetails';


/***/ }),
/* 35 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ResourceCreator = void 0;
const vscode = __webpack_require__(1);
const path = __webpack_require__(2);
const fs = __webpack_require__(3);
const i18n_1 = __webpack_require__(32);
// 16x16 transparent PNG base64
const EMPTY_16X16_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEUlEQVR42mNk+M9Qz0AEYBxVGAA+9w/5gScdlwAAAABJRU5ErkJggg==';
class ResourceCreator {
    static async findProjectUri(targetUri) {
        if (targetUri) {
            let current = targetUri.fsPath;
            if (fs.statSync(current).isFile()) {
                current = path.dirname(current);
            }
            for (let i = 0; i < 5; i++) {
                if (fs.existsSync(path.join(current, 'project.json'))) {
                    return vscode.Uri.file(current);
                }
                const parent = path.dirname(current);
                if (parent === current)
                    break;
                current = parent;
            }
        }
        // Check active editor
        if (vscode.window.activeTextEditor) {
            let current = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath);
            for (let i = 0; i < 5; i++) {
                if (fs.existsSync(path.join(current, 'project.json'))) {
                    return vscode.Uri.file(current);
                }
                const parent = path.dirname(current);
                if (parent === current)
                    break;
                current = parent;
            }
        }
        // Check workspace folders
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            for (const folder of vscode.workspace.workspaceFolders) {
                if (fs.existsSync(path.join(folder.uri.fsPath, 'project.json'))) {
                    return folder.uri;
                }
                // Check direct subdirectories
                try {
                    const subs = fs.readdirSync(folder.uri.fsPath, { withFileTypes: true });
                    for (const sub of subs) {
                        if (sub.isDirectory() && fs.existsSync(path.join(folder.uri.fsPath, sub.name, 'project.json'))) {
                            return vscode.Uri.joinPath(folder.uri, sub.name);
                        }
                    }
                }
                catch (e) { }
            }
        }
        vscode.window.showWarningMessage(i18n_1.I18n.t('project_not_found'));
        return undefined;
    }
    static async createNewSprite(targetUri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri)
            return;
        const name = await vscode.window.showInputBox({
            prompt: i18n_1.I18n.t('new_sprite_prompt'),
            placeHolder: 'sprite_name',
            validateInput: text => (!text || text.trim() === '' ? i18n_1.I18n.t('name_cannot_be_empty') : null)
        });
        if (!name)
            return;
        const cleanName = name.trim().replace(/\.png$/, '');
        const spritesFolder = path.join(projectUri.fsPath, 'sprites');
        const targetFilePath = path.join(spritesFolder, `${cleanName}.png`);
        const targetMsPath = path.join(spritesFolder, `${cleanName}.ms`);
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        if (fs.existsSync(targetFilePath)) {
            vscode.window.showErrorMessage(i18n_1.I18n.t('sprite_already_exists', cleanName));
            return;
        }
        // Write default 16x16 PNG and companion .ms file
        fs.writeFileSync(targetFilePath, Buffer.from(EMPTY_16X16_PNG_BASE64, 'base64'));
        fs.writeFileSync(targetMsPath, JSON.stringify({ frames: 1, fps: 5 }, null, 2), 'utf8');
        const docUri = vscode.Uri.file(targetFilePath);
        vscode.window.showInformationMessage(i18n_1.I18n.t('new_sprite_created', cleanName));
        await vscode.commands.executeCommand('vscode.openWith', docUri, 'microstudio.spriteEditor');
    }
    static async createNewMap(targetUri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri)
            return;
        const name = await vscode.window.showInputBox({
            prompt: i18n_1.I18n.t('new_map_prompt'),
            placeHolder: 'map_name',
            validateInput: text => (!text || text.trim() === '' ? i18n_1.I18n.t('name_cannot_be_empty') : null)
        });
        if (!name)
            return;
        const cleanName = name.trim().replace(/\.json$/, '');
        const mapsFolder = path.join(projectUri.fsPath, 'maps');
        const targetFilePath = path.join(mapsFolder, `${cleanName}.json`);
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        if (fs.existsSync(targetFilePath)) {
            vscode.window.showErrorMessage(i18n_1.I18n.t('map_already_exists', cleanName));
            return;
        }
        const defaultMap = {
            width: 24,
            height: 16,
            block_width: 16,
            block_height: 16,
            data: []
        };
        fs.writeFileSync(targetFilePath, JSON.stringify(defaultMap, null, 2), 'utf8');
        const docUri = vscode.Uri.file(targetFilePath);
        vscode.window.showInformationMessage(i18n_1.I18n.t('new_map_created', cleanName));
        await vscode.commands.executeCommand('vscode.openWith', docUri, 'microstudio.mapEditor');
    }
    static async createNewSource(targetUri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri)
            return;
        const name = await vscode.window.showInputBox({
            prompt: i18n_1.I18n.t('new_script_prompt'),
            placeHolder: 'script_name',
            validateInput: text => (!text || text.trim() === '' ? i18n_1.I18n.t('name_cannot_be_empty') : null)
        });
        if (!name)
            return;
        const cleanName = name.trim().replace(/\.(ms|js|py|lua)$/i, '');
        const msFolder = path.join(projectUri.fsPath, 'ms');
        const targetFilePath = path.join(msFolder, `${cleanName}.ms`);
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        if (fs.existsSync(targetFilePath)) {
            vscode.window.showErrorMessage(i18n_1.I18n.t('script_already_exists', cleanName));
            return;
        }
        const defaultCode = `// ${cleanName}.ms\n`;
        fs.writeFileSync(targetFilePath, defaultCode, 'utf8');
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFilePath));
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(i18n_1.I18n.t('new_script_created', cleanName));
    }
    static async createNewSound(targetUri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri)
            return;
        const name = await vscode.window.showInputBox({
            prompt: i18n_1.I18n.t('new_sound_prompt'),
            placeHolder: 'sound_name',
            validateInput: text => (!text || text.trim() === '' ? i18n_1.I18n.t('name_cannot_be_empty') : null)
        });
        if (!name)
            return;
        const cleanName = name.trim();
        const soundsFolder = path.join(projectUri.fsPath, 'sounds');
        const targetFilePath = path.join(soundsFolder, `${cleanName}.json`);
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        fs.writeFileSync(targetFilePath, JSON.stringify({ name: cleanName }, null, 2), 'utf8');
        vscode.window.showInformationMessage(i18n_1.I18n.t('new_sound_created', cleanName));
    }
    static async createNewMusic(targetUri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri)
            return;
        const name = await vscode.window.showInputBox({
            prompt: i18n_1.I18n.t('new_music_prompt'),
            placeHolder: 'music_name',
            validateInput: text => (!text || text.trim() === '' ? i18n_1.I18n.t('name_cannot_be_empty') : null)
        });
        if (!name)
            return;
        const cleanName = name.trim();
        const musicFolder = path.join(projectUri.fsPath, 'music');
        const targetFilePath = path.join(musicFolder, `${cleanName}.json`);
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        fs.writeFileSync(targetFilePath, JSON.stringify({ name: cleanName }, null, 2), 'utf8');
        vscode.window.showInformationMessage(i18n_1.I18n.t('new_music_created', cleanName));
    }
    static async importAsset(targetUri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri)
            return;
        const fileUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            openLabel: 'Import'
        });
        if (!fileUris || fileUris.length === 0)
            return;
        const assetsFolder = path.join(projectUri.fsPath, 'assets');
        fs.mkdirSync(assetsFolder, { recursive: true });
        let count = 0;
        for (const uri of fileUris) {
            const fileName = path.basename(uri.fsPath);
            const dest = path.join(assetsFolder, fileName);
            fs.copyFileSync(uri.fsPath, dest);
            count++;
        }
        vscode.window.showInformationMessage(i18n_1.I18n.t('imported_assets', count));
    }
}
exports.ResourceCreator = ResourceCreator;


/***/ }),
/* 36 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LibraryManager = exports.BUILTIN_LIBRARIES = void 0;
const vscode = __webpack_require__(1);
const path = __webpack_require__(2);
const fs = __webpack_require__(3);
const ResourceCreator_1 = __webpack_require__(35);
exports.BUILTIN_LIBRARIES = [
    {
        id: 'm2d',
        title: 'micro2D (Physics & Engine)',
        description: 'Oficjalny silnik fizyki i zestaw narzędzi 2D dla microStudio.',
        author: 'microstudio',
        category: 'physics'
    },
    {
        id: 'matter',
        title: 'Matter.js',
        description: 'Wydajny, elastyczny silnik fizyki 2D dla platformówek, łamigłówek i symulacji.',
        author: 'liabru',
        category: 'physics'
    },
    {
        id: 'pixi',
        title: 'PixiJS',
        description: 'Superszybki silnik renderowania grafiki 2D wykorzystujący WebGL.',
        author: 'pixijs',
        category: 'graphics'
    },
    {
        id: 'cannon',
        title: 'Cannon.js',
        description: 'Silnik fizyki 3D dla gier trójwymiarowych w microStudio.',
        author: 'schteppe',
        category: '3d'
    },
    {
        id: 'babylon',
        title: 'Babylon.js',
        description: 'Pełnowymiarowy, zaawansowany silnik graficzny i fizyczny 3D.',
        author: 'babylonjs',
        category: '3d'
    },
    {
        id: 'three',
        title: 'Three.js',
        description: 'Popularna biblioteka grafiki trójwymiarowej w przeglądarce.',
        author: 'mrdoob',
        category: '3d'
    },
    {
        id: 'tween',
        title: 'Tween.js',
        description: 'Biblioteka do płynnej interpolacji wartości i animacji (tweening).',
        author: 'tweenjs',
        category: 'utility'
    },
    {
        id: 'howler',
        title: 'Howler.js',
        description: 'Zaawansowana obsługa dźwięków, muzyki przestrzennej i audio sprite.',
        author: 'goldfire',
        category: 'audio'
    },
    {
        id: 'font',
        title: 'Bitmap Font',
        description: 'Renderowanie i obsługa niestandardowych czcionek bitmapowych.',
        author: 'microstudio',
        category: 'utility'
    },
    {
        id: 'matrix',
        title: 'Matrix & Vector Math',
        description: 'Zaawansowane operacje na wektorach, macierzach i transformacjach 2D/3D.',
        author: 'microstudio',
        category: 'utility'
    },
    {
        id: 'microengine',
        title: 'MicroEngine',
        description: 'Rozszerzony zestaw helperów, stanów gry i narzędzi ułatwiających tworzenie gier.',
        author: 'microstudio',
        category: 'utility'
    }
];
class LibraryManager {
    static async showLibraryBrowser(targetUri) {
        const projectUri = await ResourceCreator_1.ResourceCreator.findProjectUri(targetUri);
        if (!projectUri)
            return;
        const jsonPath = path.join(projectUri.fsPath, 'project.json');
        if (!fs.existsSync(jsonPath)) {
            vscode.window.showErrorMessage('Nie znaleziono pliku project.json w wybranym projekcie.');
            return;
        }
        let projectData = {};
        try {
            projectData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        }
        catch (e) {
            vscode.window.showErrorMessage('Nie udało się sparsować project.json.');
            return;
        }
        const activeLibs = projectData.libs || [];
        // Build QuickPick items
        const items = [];
        // Custom library action
        items.push({
            label: '$(add) Dodaj inną bibliotekę po nazwie (slug)...',
            description: 'Wpisz dowolny identyfikator biblioteki microStudio',
            alwaysShow: true
        });
        items.push({
            label: '--- Oficjalne i popularne biblioteki microStudio ---',
            kind: vscode.QuickPickItemKind.Separator
        });
        for (const lib of exports.BUILTIN_LIBRARIES) {
            const isInstalled = activeLibs.includes(lib.id);
            items.push({
                label: `${isInstalled ? '$(check) ' : '$(circle-large-outline) '}${lib.title}`,
                description: `ID: "${lib.id}" | Autor: ${lib.author} | [${lib.category.toUpperCase()}]`,
                detail: `${isInstalled ? '✅ [ZAINSTALOWANA - kliknij, aby usunąć] ' : '➕ [Kliknij, aby dodać] '} ${lib.description}`
            });
        }
        const selected = await vscode.window.showQuickPick(items, {
            title: `Zarządzanie bibliotekami: ${projectData.title || path.basename(projectUri.fsPath)}`,
            placeHolder: 'Wybierz bibliotekę, aby ją włączyć lub wyłączyć z projektu...'
        });
        if (!selected)
            return;
        if (selected.label.startsWith('$(add)')) {
            const customName = await vscode.window.showInputBox({
                prompt: 'Podaj identyfikator / slug biblioteki microStudio (np. matter, my_lib)',
                placeHolder: 'slug_biblioteki',
                validateInput: t => (!t || t.trim() === '' ? 'Identyfikator nie może być pusty' : null)
            });
            if (customName) {
                const clean = customName.trim();
                await this.toggleLibrary(projectUri, clean);
            }
            return;
        }
        // Find which library was clicked
        for (const lib of exports.BUILTIN_LIBRARIES) {
            if (selected.label.includes(lib.title)) {
                await this.toggleLibrary(projectUri, lib.id);
                break;
            }
        }
    }
    static async toggleLibrary(projectUri, libId) {
        const jsonPath = path.join(projectUri.fsPath, 'project.json');
        try {
            const projectData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            if (!Array.isArray(projectData.libs)) {
                projectData.libs = [];
            }
            const idx = projectData.libs.indexOf(libId);
            if (idx >= 0) {
                projectData.libs.splice(idx, 1);
                fs.writeFileSync(jsonPath, JSON.stringify(projectData, null, 2), 'utf8');
                vscode.window.showInformationMessage(`Usunięto bibliotekę "${libId}" z project.json`);
            }
            else {
                projectData.libs.push(libId);
                fs.writeFileSync(jsonPath, JSON.stringify(projectData, null, 2), 'utf8');
                vscode.window.showInformationMessage(`Dodano bibliotekę "${libId}" do project.json`);
            }
        }
        catch (e) {
            vscode.window.showErrorMessage(`Błąd aktualizacji bibliotek w project.json: ${e.message}`);
        }
    }
}
exports.LibraryManager = LibraryManager;


/***/ }),
/* 37 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HtmlBundler = void 0;
const vscode = __webpack_require__(1);
const path = __webpack_require__(2);
const fs = __webpack_require__(3);
class HtmlBundler {
    /**
     * Builds a self-contained HTML document for the given microStudio project.
     */
    static async bundle(projectPath, extensionPath, forWebview = false, webview) {
        const pjPath = path.join(projectPath, 'project.json');
        let projectJson = {
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
            }
            catch (e) { }
        }
        const resources = {
            title: projectJson.title || path.basename(projectPath),
            slug: projectJson.slug || path.basename(projectPath),
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
            this.collectSpritesRecursively(spritesDir, '', resources, forWebview, webview);
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
                        let mapUrl;
                        if (forWebview && webview) {
                            mapUrl = webview.asWebviewUri(vscode.Uri.file(fullPath)).toString();
                        }
                        else {
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
                    }
                    catch (e) { }
                }
            }
        }
        // 4. Read Sounds, Music, Assets
        this.collectMediaFolder(projectPath, 'sounds', resources.sounds, forWebview, webview, 'audio/wav');
        this.collectMediaFolder(projectPath, 'music', resources.music, forWebview, webview, 'audio/mp3');
        this.collectMediaFolder(projectPath, 'assets', resources.assets, forWebview, webview, 'application/octet-stream');
        // Combine microscript code
        const allCode = Object.values(resources.microscript).join('\n\n');
        // Read microstudio_play.js engine
        const playJsPath = path.join(extensionPath, 'media', 'microstudio_play.js');
        const playJsContent = fs.existsSync(playJsPath) ? fs.readFileSync(playJsPath, 'utf8') : '';
        // Generate HTML
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${this.escapeHtml(resources.title)}</title>
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
        }
        canvas {
            display: block;
            max-width: 100%;
            max-height: 100%;
            margin: auto;
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
    <script>window.skip_service_worker = true;</script>
    <script>
${playJsContent}
    </script>
    <script>
        const resources = ${JSON.stringify(resources)};
        resources.sources = null; // Force fallback to #code
        window.aspect = resources.aspect || "16x9";
        window.orientation = resources.orientation || "landscape";
        window.graphics = resources.graphics || "standard";
        window.ms_libs = resources.libs || [];
        
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
            appendLog(message, 'error');
        };

        let player;
        try {
            player = new Player();
        } catch (err) {
            console.error("Player initialization error: " + err);
        }

        // UI Controls
        document.getElementById('btn-play').addEventListener('click', () => {
            window.postMessage(JSON.stringify({ name: "resume" }), "*");
        });
        document.getElementById('btn-pause').addEventListener('click', () => {
            window.postMessage(JSON.stringify({ name: "pause" }), "*");
        });
        document.getElementById('btn-reload').addEventListener('click', () => {
            location.reload();
        });
        document.getElementById('btn-clear').addEventListener('click', () => {
            consoleOutput.innerHTML = '';
        });
        document.getElementById('btn-toggle-console').addEventListener('click', () => {
            const el = document.getElementById('console-container');
            el.style.display = el.style.display === 'none' ? 'flex' : 'none';
        });
    </script>
</body>
</html>`;
    }
    static async exportStandalone(projectPath, outputFilePath, extensionPath) {
        const html = await this.bundle(projectPath, extensionPath, false);
        fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
        fs.writeFileSync(outputFilePath, html, 'utf8');
        return outputFilePath;
    }
    static collectSpritesRecursively(dir, baseRelative, resources, forWebview, webview) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativeName = baseRelative ? `${baseRelative}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                this.collectSpritesRecursively(fullPath, relativeName, resources, forWebview, webview);
            }
            else if (entry.isFile() && entry.name.endsWith('.png')) {
                const spriteName = relativeName.replace(/\.png$/, '').replace(/\//g, '-');
                let spriteUrl;
                if (forWebview && webview) {
                    spriteUrl = webview.asWebviewUri(vscode.Uri.file(fullPath)).toString();
                }
                else {
                    const b64 = fs.readFileSync(fullPath).toString('base64');
                    spriteUrl = `data:image/png;base64,${b64}`;
                }
                const msCompanionPath = fullPath.replace(/\.png$/, '.ms');
                let properties = {};
                if (fs.existsSync(msCompanionPath)) {
                    try {
                        properties = JSON.parse(fs.readFileSync(msCompanionPath, 'utf8'));
                    }
                    catch (e) { }
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
    static collectMediaFolder(projectPath, folderName, targetArray, forWebview, webview, mimeType = 'application/octet-stream') {
        const dir = path.join(projectPath, folderName);
        if (!fs.existsSync(dir))
            return;
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            if (file.isFile()) {
                const fullPath = path.join(dir, file.name);
                let mediaUrl;
                if (forWebview && webview) {
                    mediaUrl = webview.asWebviewUri(vscode.Uri.file(fullPath)).toString();
                }
                else {
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
    static escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
exports.HtmlBundler = HtmlBundler;


/***/ }),
/* 38 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MicroScriptCompletionProvider = void 0;
const vscode = __webpack_require__(1);
class MicroScriptCompletionProvider {
    constructor() {
        this.items = [
            // Life cycle
            {
                label: 'init',
                kind: vscode.CompletionItemKind.Function,
                detail: 'init = function()',
                doc: 'Funkcja wywoływana jednorazowo przy starcie gry microStudio.',
                snippet: 'init = function()\n\t$0\nend'
            },
            {
                label: 'update',
                kind: vscode.CompletionItemKind.Function,
                detail: 'update = function()',
                doc: 'Główna pętla logiki gry (domyślnie 60 razy na sekundę).',
                snippet: 'update = function()\n\t$0\nend'
            },
            {
                label: 'draw',
                kind: vscode.CompletionItemKind.Function,
                detail: 'draw = function()',
                doc: 'Główna pętla renderowania grafiki na ekranie.',
                snippet: 'draw = function()\n\tscreen.clear()\n\t$0\nend'
            },
            {
                label: 'print',
                kind: vscode.CompletionItemKind.Function,
                detail: 'print(value)',
                doc: 'Wypisuje wartość w konsoli microStudio.',
                snippet: 'print($1)'
            },
            // screen
            {
                label: 'screen.clear',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.clear(color)',
                doc: 'Czyści ekran wybranym kolorem (np. "rgb(0,0,0)", "#111", "rgba(0,0,0,0.5)").',
                snippet: 'screen.clear("${1:#000}")'
            },
            {
                label: 'screen.drawSprite',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.drawSprite(name, x, y, width, height)',
                doc: 'Rysuje Sprite o podanej nazwie na podanych współrzędnych ekranu.',
                snippet: 'screen.drawSprite("${1:sprite_name}", ${2:0}, ${3:0}, ${4:32}, ${5:32})'
            },
            {
                label: 'screen.drawMap',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.drawMap(name, x, y, width, height)',
                doc: 'Rysuje Mapę kafelkową na ekranie.',
                snippet: 'screen.drawMap("${1:map_name}", ${2:0}, ${3:0}, ${4:screen.width}, ${5:screen.height})'
            },
            {
                label: 'screen.fillRect',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.fillRect(x, y, width, height, color)',
                doc: 'Rysuje wypełniony prostokąt.',
                snippet: 'screen.fillRect(${1:0}, ${2:0}, ${3:50}, ${4:50}, "${5:#fff}")'
            },
            {
                label: 'screen.drawRect',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.drawRect(x, y, width, height, color)',
                doc: 'Rysuje obrys prostokąta.',
                snippet: 'screen.drawRect(${1:0}, ${2:0}, ${3:50}, ${4:50}, "${5:#fff}")'
            },
            {
                label: 'screen.fillRound',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.fillRound(x, y, width, height, color)',
                doc: 'Rysuje wypełnione koło / elipsę.',
                snippet: 'screen.fillRound(${1:0}, ${2:0}, ${3:30}, ${4:30}, "${5:#f00}")'
            },
            {
                label: 'screen.drawRound',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.drawRound(x, y, width, height, color)',
                doc: 'Rysuje obrys koła / elipsy.',
                snippet: 'screen.drawRound(${1:0}, ${2:0}, ${3:30}, ${4:30}, "${5:#f00}")'
            },
            {
                label: 'screen.drawLine',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.drawLine(x1, y1, x2, y2, color)',
                doc: 'Rysuje linię między dwoma punktami.',
                snippet: 'screen.drawLine(${1:0}, ${2:0}, ${3:50}, ${4:50}, "${5:#fff}")'
            },
            {
                label: 'screen.drawText',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.drawText(text, x, y, size, color)',
                doc: 'Wyświetla napis na ekranie.',
                snippet: 'screen.drawText("${1:Hello}", ${2:0}, ${3:0}, ${4:20}, "${5:#fff}")'
            },
            {
                label: 'screen.textWidth',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.textWidth(text, size)',
                doc: 'Zwraca szerokość tekstu w pikselach.',
                snippet: 'screen.textWidth("${1:text}", ${2:20})'
            },
            {
                label: 'screen.setAlpha',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.setAlpha(alpha)',
                doc: 'Ustawia globalną przezroczystość rysowania (od 0 do 1).',
                snippet: 'screen.setAlpha(${1:1.0})'
            },
            {
                label: 'screen.setTranslation',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.setTranslation(x, y)',
                doc: 'Przesuwa układ współrzędnych kamery ekranu.',
                snippet: 'screen.setTranslation(${1:x}, ${2:y})'
            },
            {
                label: 'screen.setScale',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.setScale(sx, sy)',
                doc: 'Skaluje układ współrzędnych.',
                snippet: 'screen.setScale(${1:1}, ${2:1})'
            },
            {
                label: 'screen.setRotation',
                kind: vscode.CompletionItemKind.Method,
                detail: 'screen.setRotation(angle)',
                doc: 'Obraca układ współrzędnych o podany kąt w stopniach.',
                snippet: 'screen.setRotation(${1:0})'
            },
            {
                label: 'screen.width',
                kind: vscode.CompletionItemKind.Property,
                detail: 'screen.width',
                doc: 'Szerokość ekranu gry w pikselach wirtualnych.'
            },
            {
                label: 'screen.height',
                kind: vscode.CompletionItemKind.Property,
                detail: 'screen.height',
                doc: 'Wysokość ekranu gry w pikselach wirtualnych.'
            },
            // keyboard
            {
                label: 'keyboard.UP',
                kind: vscode.CompletionItemKind.Property,
                detail: 'keyboard.UP',
                doc: 'Czy strzałka w górę jest wciśnięta (1 lub 0).'
            },
            {
                label: 'keyboard.DOWN',
                kind: vscode.CompletionItemKind.Property,
                detail: 'keyboard.DOWN',
                doc: 'Czy strzałka w dół jest wciśnięta (1 lub 0).'
            },
            {
                label: 'keyboard.LEFT',
                kind: vscode.CompletionItemKind.Property,
                detail: 'keyboard.LEFT',
                doc: 'Czy strzałka w lewo jest wciśnięta (1 lub 0).'
            },
            {
                label: 'keyboard.RIGHT',
                kind: vscode.CompletionItemKind.Property,
                detail: 'keyboard.RIGHT',
                doc: 'Czy strzałka w prawo jest wciśnięta (1 lub 0).'
            },
            {
                label: 'keyboard.SPACE',
                kind: vscode.CompletionItemKind.Property,
                detail: 'keyboard.SPACE',
                doc: 'Czy spacja jest wciśnięta (1 lub 0).'
            },
            {
                label: 'keyboard.ENTER',
                kind: vscode.CompletionItemKind.Property,
                detail: 'keyboard.ENTER',
                doc: 'Czy klawisz Enter jest wciśnięty.'
            },
            {
                label: 'keyboard.A',
                kind: vscode.CompletionItemKind.Property,
                detail: 'keyboard.A',
                doc: 'Stan klawisza A.'
            },
            {
                label: 'keyboard.W',
                kind: vscode.CompletionItemKind.Property,
                detail: 'keyboard.W',
                doc: 'Stan klawisza W.'
            },
            {
                label: 'keyboard.S',
                kind: vscode.CompletionItemKind.Property,
                detail: 'keyboard.S',
                doc: 'Stan klawisza S.'
            },
            {
                label: 'keyboard.D',
                kind: vscode.CompletionItemKind.Property,
                detail: 'keyboard.D',
                doc: 'Stan klawisza D.'
            },
            // mouse & touch
            {
                label: 'mouse.x',
                kind: vscode.CompletionItemKind.Property,
                detail: 'mouse.x',
                doc: 'Współrzędna X kursora myszy na ekranie gry.'
            },
            {
                label: 'mouse.y',
                kind: vscode.CompletionItemKind.Property,
                detail: 'mouse.y',
                doc: 'Współrzędna Y kursora myszy na ekranie gry.'
            },
            {
                label: 'mouse.pressed',
                kind: vscode.CompletionItemKind.Property,
                detail: 'mouse.pressed',
                doc: 'Czy lewy przycisk myszy jest wciśnięty (1 lub 0).'
            },
            {
                label: 'mouse.right',
                kind: vscode.CompletionItemKind.Property,
                detail: 'mouse.right',
                doc: 'Czy prawy przycisk myszy jest wciśnięty.'
            },
            {
                label: 'touch.touching',
                kind: vscode.CompletionItemKind.Property,
                detail: 'touch.touching',
                doc: 'Czy ekran dotykowy jest aktualnie dotykany.'
            },
            {
                label: 'touch.touches',
                kind: vscode.CompletionItemKind.Property,
                detail: 'touch.touches',
                doc: 'Tablica aktywnych punktów dotyku [{x, y, id}, ...].'
            },
            // audio
            {
                label: 'audio.beep',
                kind: vscode.CompletionItemKind.Method,
                detail: 'audio.beep(synthString)',
                doc: 'Odtwarza dźwięk syntezatora microStudio.',
                snippet: 'audio.beep("${1:square;c4;8}")'
            },
            {
                label: 'audio.playSound',
                kind: vscode.CompletionItemKind.Method,
                detail: 'audio.playSound(name, volume, pitch, pan, loop)',
                doc: 'Odtwarza plik dźwiękowy z folderu sounds/.',
                snippet: 'audio.playSound("${1:sound_name}", ${2:1.0})'
            },
            {
                label: 'audio.playMusic',
                kind: vscode.CompletionItemKind.Method,
                detail: 'audio.playMusic(name, volume, loop)',
                doc: 'Odtwarza utwór muzyczny z folderu music/.',
                snippet: 'audio.playMusic("${1:music_name}", ${2:1.0}, ${3:true})'
            },
            {
                label: 'audio.stopMusic',
                kind: vscode.CompletionItemKind.Method,
                detail: 'audio.stopMusic()',
                doc: 'Zatrzymuje aktualnie odtwarzaną muzykę.'
            },
            // system & random
            {
                label: 'system.time',
                kind: vscode.CompletionItemKind.Method,
                detail: 'system.time()',
                doc: 'Zwraca aktualny czas w milisekundach.'
            },
            {
                label: 'system.pause',
                kind: vscode.CompletionItemKind.Method,
                detail: 'system.pause()',
                doc: 'Wstrzymuje wykonywanie gry.'
            },
            {
                label: 'random.next',
                kind: vscode.CompletionItemKind.Method,
                detail: 'random.next()',
                doc: 'Losuje liczbę zmiennoprzecinkową od 0.0 do 1.0.'
            },
            {
                label: 'random.nextInt',
                kind: vscode.CompletionItemKind.Method,
                detail: 'random.nextInt(max)',
                doc: 'Losuje liczbę całkowitą od 0 do max - 1.',
                snippet: 'random.nextInt(${1:10})'
            },
            // PIXI (PixiJS 2D Engine)
            {
                label: 'PIXI.Application',
                kind: vscode.CompletionItemKind.Class,
                detail: 'new PIXI.Application(options)',
                doc: 'Główna aplikacja PixiJS do renderowania 2D WebGL.',
                snippet: 'new PIXI.Application({ width: ${1:800}, height: ${2:600} })'
            },
            {
                label: 'PIXI.Sprite',
                kind: vscode.CompletionItemKind.Class,
                detail: 'new PIXI.Sprite(texture)',
                doc: 'Obiekt Sprite w PixiJS.',
                snippet: 'new PIXI.Sprite(${1:texture})'
            },
            {
                label: 'PIXI.Container',
                kind: vscode.CompletionItemKind.Class,
                detail: 'new PIXI.Container()',
                doc: 'Kontener na obiekty graficzne w drzewie sceny PixiJS.'
            },
            {
                label: 'PIXI.Graphics',
                kind: vscode.CompletionItemKind.Class,
                detail: 'new PIXI.Graphics()',
                doc: 'Kształty wektorowe w PixiJS.'
            },
            // BABYLON (Babylon.js 3D Engine)
            {
                label: 'BABYLON.Engine',
                kind: vscode.CompletionItemKind.Class,
                detail: 'new BABYLON.Engine(canvas, antialias)',
                doc: 'Główny silnik WebGL dla Babylon.js 3D.'
            },
            {
                label: 'BABYLON.Scene',
                kind: vscode.CompletionItemKind.Class,
                detail: 'new BABYLON.Scene(engine)',
                doc: 'Scena 3D w Babylon.js.',
                snippet: 'new BABYLON.Scene(${1:engine})'
            },
            {
                label: 'BABYLON.Vector3',
                kind: vscode.CompletionItemKind.Class,
                detail: 'new BABYLON.Vector3(x, y, z)',
                doc: 'Wektor 3D w przestrzeni (x, y, z).',
                snippet: 'new BABYLON.Vector3(${1:0}, ${2:0}, ${3:0})'
            },
            {
                label: 'BABYLON.MeshBuilder.CreateBox',
                kind: vscode.CompletionItemKind.Method,
                detail: 'BABYLON.MeshBuilder.CreateBox(name, options, scene)',
                doc: 'Tworzy sześcian 3D.',
                snippet: 'BABYLON.MeshBuilder.CreateBox("${1:box}", { size: ${2:1} }, ${3:scene})'
            },
            {
                label: 'BABYLON.MeshBuilder.CreateSphere',
                kind: vscode.CompletionItemKind.Method,
                detail: 'BABYLON.MeshBuilder.CreateSphere(name, options, scene)',
                doc: 'Tworzy kulę 3D.',
                snippet: 'BABYLON.MeshBuilder.CreateSphere("${1:sphere}", { diameter: ${2:1} }, ${3:scene})'
            },
            // M2D / M3D
            {
                label: 'M2D.Scene',
                kind: vscode.CompletionItemKind.Class,
                detail: 'new M2D.Scene()',
                doc: 'Scena 2D w silniku micro2D.'
            },
            {
                label: 'M2D.Camera',
                kind: vscode.CompletionItemKind.Class,
                detail: 'new M2D.Camera(fov, x, y)',
                doc: 'Kamera 2D w silniku micro2D.'
            },
            {
                label: 'M3D.Scene',
                kind: vscode.CompletionItemKind.Class,
                detail: 'new M3D.Scene()',
                doc: 'Scena 3D w silniku micro3D.'
            },
            // Matter.js 2D Physics
            {
                label: 'Matter.Engine.create',
                kind: vscode.CompletionItemKind.Method,
                detail: 'Matter.Engine.create()',
                doc: 'Tworzy silnik fizyki 2D Matter.js.'
            },
            {
                label: 'Matter.Bodies.rectangle',
                kind: vscode.CompletionItemKind.Method,
                detail: 'Matter.Bodies.rectangle(x, y, width, height, options)',
                doc: 'Tworzy prostokątne ciało fizyczne.',
                snippet: 'Matter.Bodies.rectangle(${1:x}, ${2:y}, ${3:width}, ${4:height}, ${5:{ isStatic: false }})'
            },
            {
                label: 'Matter.Bodies.circle',
                kind: vscode.CompletionItemKind.Method,
                detail: 'Matter.Bodies.circle(x, y, radius, options)',
                doc: 'Tworzy okrągłe ciało fizyczne.',
                snippet: 'Matter.Bodies.circle(${1:x}, ${2:y}, ${3:radius}, ${4:{}})'
            },
            {
                label: 'Matter.Composite.add',
                kind: vscode.CompletionItemKind.Method,
                detail: 'Matter.Composite.add(world, body)',
                doc: 'Dodaje ciało do świata fizyki.',
                snippet: 'Matter.Composite.add(${1:engine.world}, ${2:body})'
            }
        ];
    }
    provideCompletionItems(document, position, token, context) {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        return this.items.map(item => {
            const ci = new vscode.CompletionItem(item.label, item.kind);
            ci.detail = item.detail;
            ci.documentation = new vscode.MarkdownString(item.doc);
            if (item.snippet) {
                ci.insertText = new vscode.SnippetString(item.snippet);
            }
            return ci;
        });
    }
    provideHover(document, position, token) {
        const range = document.getWordRangeAtPosition(position, /[\w\.]+/);
        if (!range)
            return null;
        const word = document.getText(range);
        const match = this.items.find(i => i.label === word || i.label.split('.').pop() === word);
        if (match) {
            const md = new vscode.MarkdownString();
            md.appendCodeblock(match.detail, 'microscript');
            md.appendMarkdown('\n\n' + match.doc);
            return new vscode.Hover(md, range);
        }
        return null;
    }
}
exports.MicroScriptCompletionProvider = MicroScriptCompletionProvider;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __webpack_require__(1);
const path = __webpack_require__(2);
const fs = __webpack_require__(3);
const SpriteEditorProvider_1 = __webpack_require__(4);
const MapEditorProvider_1 = __webpack_require__(5);
const MicroStudioSync_1 = __webpack_require__(6);
const ProjectExplorer_1 = __webpack_require__(33);
const ProjectSettingsView_1 = __webpack_require__(34);
const ResourceCreator_1 = __webpack_require__(35);
const LibraryManager_1 = __webpack_require__(36);
const HtmlBundler_1 = __webpack_require__(37);
const MicroScriptCompletionProvider_1 = __webpack_require__(38);
const i18n_1 = __webpack_require__(32);
function activate(context) {
    console.log('MicroStudio VS Code extension is now active!');
    // Register our custom editors
    context.subscriptions.push(SpriteEditorProvider_1.SpriteEditorProvider.register(context));
    context.subscriptions.push(MapEditorProvider_1.MapEditorProvider.register(context));
    // Register MicroScript IntelliSense / Completion & Hover Provider
    const completionProvider = new MicroScriptCompletionProvider_1.MicroScriptCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('microscript', completionProvider, '.'));
    context.subscriptions.push(vscode.languages.registerHoverProvider('microscript', completionProvider));
    // Register Preview command
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.preview', async () => {
        let projectRootPath;
        // 1. Check active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            let current = path.dirname(activeEditor.document.uri.fsPath);
            for (let i = 0; i < 5; i++) {
                const pj = path.join(current, 'project.json');
                if (fs.existsSync(pj)) {
                    projectRootPath = current;
                    break;
                }
                const parent = path.dirname(current);
                if (parent === current)
                    break;
                current = parent;
            }
        }
        // 2. Check workspace folders
        if (!projectRootPath && vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                const pj = path.join(folder.uri.fsPath, 'project.json');
                if (fs.existsSync(pj)) {
                    projectRootPath = folder.uri.fsPath;
                    break;
                }
            }
        }
        // 3. Fallback to findFiles
        if (!projectRootPath) {
            const projectJsonFiles = await vscode.workspace.findFiles('**/project.json');
            if (projectJsonFiles.length > 0) {
                projectRootPath = path.dirname(projectJsonFiles[0].fsPath);
            }
        }
        if (!projectRootPath) {
            vscode.window.showWarningMessage('Nie znaleziono projektu microStudio do uruchomienia podglądu.');
            return;
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const roots = [
            vscode.Uri.file(path.join(context.extensionPath, 'media')),
            vscode.Uri.file(projectRootPath)
        ];
        if (workspaceFolders) {
            roots.push(workspaceFolders[0].uri);
        }
        const panel = vscode.window.createWebviewPanel('microstudioPreview', 'microStudio Preview', vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: roots
        });
        panel.webview.html = await HtmlBundler_1.HtmlBundler.bundle(projectRootPath, context.extensionPath, true, panel.webview);
    }));
    // Register Sync command and Project Explorer panel
    const syncService = new MicroStudioSync_1.MicroStudioSync(context);
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.connect', async () => {
        await syncService.connect();
    }));
    const localProjectsProvider = new ProjectExplorer_1.LocalProjectsProvider();
    const remoteProjectsProvider = new ProjectExplorer_1.RemoteProjectsProvider(syncService);
    vscode.window.registerTreeDataProvider('microstudio.localProjects', localProjectsProvider);
    vscode.window.registerTreeDataProvider('microstudio.remoteProjects', remoteProjectsProvider);
    // Register Project Settings View Provider
    const projectSettingsProvider = new ProjectSettingsView_1.ProjectSettingsViewProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ProjectSettingsView_1.ProjectSettingsViewProvider.viewType, projectSettingsProvider));
    // Command: Select Local Project (activates it in Project Settings)
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.selectLocalProject', async (item) => {
        if (item && item.fsPath) {
            const folderUri = vscode.Uri.file(item.fsPath);
            await projectSettingsProvider.setProject(folderUri);
        }
    }));
    // Command: Set Workspace Root
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.setWorkspaceRoot', async () => {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Wybierz katalog główny projektów'
        });
        if (uris && uris.length > 0) {
            const folderPath = uris[0].fsPath;
            await vscode.workspace.getConfiguration('microstudio').update('workspaceRoot', folderPath, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Ustawiono katalog główny projektów: ${folderPath}`);
            localProjectsProvider.refresh();
        }
    }));
    // Command: Refresh Projects
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.refreshProjects', () => {
        localProjectsProvider.refresh();
        remoteProjectsProvider.refresh();
        projectSettingsProvider.detectActiveProject();
    }));
    // Command: Login
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.login', async () => {
        await syncService.connect();
    }));
    // Command: Logout
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.logout', async () => {
        await syncService.logout();
    }));
    // Command: Open Folder
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.openProject', async (item) => {
        if (item && item.fsPath) {
            const folderUri = vscode.Uri.file(item.fsPath);
            await projectSettingsProvider.setProject(folderUri);
            const isAlreadyOpened = vscode.workspace.workspaceFolders?.some(f => f.uri.fsPath.toLowerCase() === item.fsPath.toLowerCase());
            if (isAlreadyOpened) {
                vscode.window.showInformationMessage(`Projekt "${item.title}" jest już otwarty w bieżącym oknie.`);
                return;
            }
            const choice = await vscode.window.showQuickPick([
                { label: '$(folder) Otwórz w bieżącym oknie', newWindow: false },
                { label: '$(window) Otwórz w nowym oknie', newWindow: true }
            ], {
                placeHolder: `Otworzyć projekt "${item.title}"?`
            });
            if (choice) {
                await vscode.commands.executeCommand('vscode.openFolder', folderUri, choice.newWindow);
            }
        }
    }));
    // Command: Delete Local Project
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.deleteLocalProject', async (item) => {
        if (item && item.fsPath) {
            const confirm = await vscode.window.showWarningMessage(`Czy na pewno chcesz usunąć lokalny projekt "${item.title}"?`, { modal: true }, 'Tak');
            if (confirm === 'Tak') {
                try {
                    await vscode.workspace.fs.delete(vscode.Uri.file(item.fsPath), { recursive: true });
                    vscode.window.showInformationMessage(`Usunięto projekt "${item.title}"`);
                    localProjectsProvider.refresh();
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Nie udało się usunąć projektu: ${err.message}`);
                }
            }
        }
    }));
    // Command: Clone Remote Project
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.cloneProject', async (item) => {
        if (!item || !item.project)
            return;
        const config = vscode.workspace.getConfiguration('microstudio');
        let workspaceRoot = config.get('workspaceRoot');
        if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
            vscode.window.showErrorMessage('Musisz najpierw ustawić katalog główny projektów.');
            await vscode.commands.executeCommand('microstudio.setWorkspaceRoot');
            workspaceRoot = config.get('workspaceRoot');
            if (!workspaceRoot || !fs.existsSync(workspaceRoot))
                return;
        }
        const project = item.project;
        const localPath = path.join(workspaceRoot, project.slug);
        if (fs.existsSync(localPath)) {
            const confirm = await vscode.window.showWarningMessage(`Katalog "${project.slug}" już istnieje. Czy chcesz go nadpisać?`, { modal: true }, 'Tak');
            if (confirm !== 'Tak')
                return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Pobieranie projektu "${project.title}"...`,
            cancellable: false
        }, async (progress) => {
            try {
                await syncService.downloadProject(project, localPath);
                vscode.window.showInformationMessage(`Projekt "${project.title}" został pobrany.`);
                localProjectsProvider.refresh();
            }
            catch (err) {
                vscode.window.showErrorMessage(`Błąd pobierania projektu: ${err.message}`);
            }
        });
    }));
    // Register Resource Creation Commands
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.newSprite', async (uri) => {
        await ResourceCreator_1.ResourceCreator.createNewSprite(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.newMap', async (uri) => {
        await ResourceCreator_1.ResourceCreator.createNewMap(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.newSource', async (uri) => {
        await ResourceCreator_1.ResourceCreator.createNewSource(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.newSound', async (uri) => {
        await ResourceCreator_1.ResourceCreator.createNewSound(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.newMusic', async (uri) => {
        await ResourceCreator_1.ResourceCreator.createNewMusic(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.importAsset', async (uri) => {
        await ResourceCreator_1.ResourceCreator.importAsset(uri);
    }));
    // Register Library Manager Command
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.manageLibraries', async (uri) => {
        await LibraryManager_1.LibraryManager.showLibraryBrowser(uri);
    }));
    // Register Export HTML command
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.exportHtml', async (targetItem) => {
        let projectPath;
        if (targetItem && targetItem.fsPath) {
            projectPath = targetItem.fsPath;
        }
        else {
            const uri = await ResourceCreator_1.ResourceCreator.findProjectUri();
            if (uri)
                projectPath = uri.fsPath;
        }
        if (!projectPath)
            return;
        const defaultExportUri = vscode.Uri.file(path.join(projectPath, 'export', 'index.html'));
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: defaultExportUri,
            filters: { 'HTML Game': ['html'] },
            saveLabel: i18n_1.I18n.t('export_html_title')
        });
        if (!saveUri)
            return;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: i18n_1.I18n.t('export_html_title'),
            cancellable: false
        }, async () => {
            await HtmlBundler_1.HtmlBundler.exportStandalone(projectPath, saveUri.fsPath, context.extensionPath);
            const action = await vscode.window.showInformationMessage(i18n_1.I18n.t('export_html_success', saveUri.fsPath), i18n_1.I18n.t('open_in_browser'));
            if (action === i18n_1.I18n.t('open_in_browser')) {
                vscode.env.openExternal(saveUri);
            }
        });
    }));
    // Register Push to Remote command
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.pushProject', async (targetItem) => {
        let projectPath;
        if (targetItem && targetItem.fsPath) {
            projectPath = targetItem.fsPath;
        }
        else {
            const uri = await ResourceCreator_1.ResourceCreator.findProjectUri();
            if (uri)
                projectPath = uri.fsPath;
        }
        if (!projectPath)
            return;
        if (syncService.getConnectionState() !== 'connected') {
            const doLogin = await vscode.window.showWarningMessage(i18n_1.I18n.t('login_required_upload'), i18n_1.I18n.t('login_action'));
            if (doLogin === i18n_1.I18n.t('login_action')) {
                await syncService.connect();
                if (syncService.getConnectionState() !== 'connected')
                    return;
            }
            else {
                return;
            }
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: i18n_1.I18n.t('push_to_server'),
            cancellable: false
        }, async (progress) => {
            try {
                const result = await syncService.uploadProject(projectPath, (status, percent) => {
                    progress.report({ message: status, increment: percent });
                });
                vscode.window.showInformationMessage(i18n_1.I18n.t('upload_finished', result.title));
                remoteProjectsProvider.refresh();
            }
            catch (err) {
                vscode.window.showErrorMessage(i18n_1.I18n.t('upload_failed', err.message));
            }
        });
    }));
}
function deactivate() { }

})();

var __webpack_export_target__ = exports;
for(var __webpack_i__ in __webpack_exports__) __webpack_export_target__[__webpack_i__] = __webpack_exports__[__webpack_i__];
if(__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", { value: true });
/******/ })()
;
//# sourceMappingURL=extension.js.map