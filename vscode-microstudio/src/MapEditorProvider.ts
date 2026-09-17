import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class MapEditorProvider implements vscode.CustomTextEditorProvider {
    
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new MapEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            'microstudio.mapEditor',
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                }
            }
        );
        return providerRegistration;
    }

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
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

        let isLocalChange = false;

        const updateTextDocument = async (json: string) => {
            if (document.getText().trim() === json.trim()) return;
            isLocalChange = true;
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
                document.uri,
                new vscode.Range(0, 0, document.lineCount, 0),
                json
            );
            await vscode.workspace.applyEdit(edit);
            isLocalChange = false;
        };

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString() && !isLocalChange) {
                updateWebview();
            }
        });

        const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.uri.toString() === document.uri.toString()) {
                webviewPanel.webview.postMessage({ type: 'saved' });
            }
        });

        // Watch for changes in sprites folder to auto-refresh sprites in map editor
        const spriteWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(projectRoot, 'sprites/**')
        );
        spriteWatcher.onDidChange(() => loadAllSprites());
        spriteWatcher.onDidCreate(() => loadAllSprites());
        spriteWatcher.onDidDelete(() => loadAllSprites());

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            saveDocumentSubscription.dispose();
            spriteWatcher.dispose();
        });

        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'save':
                case 'change':
                    let jsonString = e.data;
                    if (typeof jsonString === 'object') {
                        jsonString = JSON.stringify(jsonString, null, 2);
                    }
                    updateTextDocument(jsonString);
                    return;
                case 'save_command':
                    vscode.commands.executeCommand('workbench.action.files.save');
                    return;
                case 'request_sprites':
                    loadAllSprites();
                    return;
            }
        });

        updateWebview();
    }

    private async findProjectRoot(docUri: vscode.Uri): Promise<vscode.Uri> {
        let current = path.dirname(docUri.fsPath);
        for (let i = 0; i < 5; i++) {
            const pj = path.join(current, 'project.json');
            const sp = path.join(current, 'sprites');
            if (fs.existsSync(pj) || fs.existsSync(sp)) {
                return vscode.Uri.file(current);
            }
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }
        return vscode.Uri.joinPath(vscode.Uri.file(path.dirname(docUri.fsPath)), '..');
    }

    private async scanSpritesDirectory(dirUri: vscode.Uri, prefix = ''): Promise<Record<string, any>> {
        const sprites: Record<string, any> = {};
        try {
            const entries = await vscode.workspace.fs.readDirectory(dirUri);
            for (const [name, type] of entries) {
                const itemUri = vscode.Uri.joinPath(dirUri, name);
                if (type === vscode.FileType.Directory) {
                    const subPrefix = prefix ? `${prefix}-${name}` : name;
                    const subSprites = await this.scanSpritesDirectory(itemUri, subPrefix);
                    Object.assign(sprites, subSprites);
                } else if (type === vscode.FileType.File && name.endsWith('.png')) {
                    const baseName = name.replace(/\.png$/, '');
                    const spriteName = prefix ? `${prefix}-${baseName}` : baseName;
                    const fileData = await vscode.workspace.fs.readFile(itemUri);
                    const base64 = Buffer.from(fileData).toString('base64');

                    let properties = null;
                    try {
                        const msUri = vscode.Uri.joinPath(dirUri, baseName + '.ms');
                        const msData = await vscode.workspace.fs.readFile(msUri);
                        properties = JSON.parse(Buffer.from(msData).toString('utf-8'));
                    } catch (e) {}

                    sprites[spriteName] = { data: base64, properties: properties };
                    // Also store with slash if nested for compatibility
                    if (prefix) {
                        const slashName = prefix.replace(/-/g, '/') + '/' + baseName;
                        sprites[slashName] = { data: base64, properties: properties };
                    }
                }
            }
        } catch (e) {
            console.warn('Sprites directory scan note:', e);
        }
        return sprites;
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
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
                    body, html { 
                        width: 100%; 
                        height: 100%; 
                        margin: 0; 
                        padding: 0; 
                        background-color: #222; 
                        color: #fff; 
                        overflow: hidden; 
                    }
                    #maps-section { 
                        display: flex !important; 
                        width: 100%; 
                        height: 100%; 
                        position: relative;
                        overflow: hidden;
                    }
                    .maps-left { display: none !important; }
                    .maps-splitbar { display: none !important; }
                    .maps-right { 
                        position: absolute !important;
                        left: 0 !important; 
                        right: 0 !important; 
                        top: 0 !important;
                        bottom: 0 !important;
                        width: 100% !important; 
                        overflow: hidden !important;
                    }
                    .mapinfo {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        height: 40px !important;
                        z-index: 100 !important;
                        background: hsl(200, 30%, 30%) !important;
                        display: flex !important;
                        align-items: center !important;
                        padding: 0 10px !important;
                        box-sizing: border-box !important;
                        overflow-x: auto !important;
                        overflow-y: hidden !important;
                    }
                    #mapeditor-container {
                        position: absolute !important;
                        top: 40px !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        overflow: hidden !important;
                        z-index: 1 !important;
                    }
                    #mapeditor {
                        position: absolute !important;
                        top: 0 !important;
                        bottom: 0 !important;
                        left: 0 !important;
                        overflow: hidden !important;
                        z-index: 1 !important;
                    }
                    #mapeditor-wrapper {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 40px !important;
                        overflow: hidden !important;
                        z-index: 1 !important;
                    }
                    #mapeditor-wrapper canvas {
                        box-shadow: 0 0 30px #000 !important;
                        border: solid 1px rgba(255, 255, 255, 0.2) !important;
                        border-radius: 4px !important;
                        display: block !important;
                        cursor: crosshair !important;
                    }
                    #mapeditor-bottombar {
                        position: absolute !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        height: 40px !important;
                        z-index: 50 !important;
                        background: hsl(200, 30%, 30%) !important;
                    }
                    .mapeditor-splitbar {
                        z-index: 60 !important;
                        position: absolute !important;
                        top: 0 !important;
                        bottom: 0 !important;
                    }
                    .mapbar {
                        position: absolute !important;
                        top: 0 !important;
                        bottom: 0 !important;
                        right: 0 !important;
                        z-index: 50 !important;
                        background: rgba(0, 0, 0, 0.4) !important;
                        overflow-y: auto !important;
                    }
                    .map-tilepicker {
                        text-align: center !important;
                    }
                    .map-tilepicker canvas {
                        margin: 10px auto !important;
                        box-shadow: 0 0 3px #FFF !important;
                        cursor: crosshair !important;
                    }
                    .map-sprite-list {
                        position: absolute !important;
                        top: 140px !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        text-align: center !important;
                        padding: 2px !important;
                        overflow-y: auto !important;
                    }
                    #map-minimap-container {
                        z-index: 40 !important;
                    }
                    #save-map-btn {
                        margin-left: 1px;
                        padding: 10px 15px;
                        cursor: pointer;
                        background: hsl(160, 50%, 40%);
                        display: inline-block;
                    }
                    #save-map-btn:hover {
                        background: hsl(160, 50%, 60%);
                    }
                </style>
            </head>
            <body>
                <div id="maps-section"><div class="maps-left"><div class="assets-bar" id="map-asset-bar"><div class="create-asset-button"><i class="fa fa-plus-square"></i> Map</div><i class="fa fa-folder-plus create-folder-button" title="New Folder"></i></div><div class="create-asset-button" id="create-map-button" style="display:none"><i class="fa fa-plus-square"></i> Add Map</div><div class="assetlist" id="maplist"><div class="asset-list" id="map-list"></div></div></div><div class="maps-splitbar"></div><div class="maps-right"><div class="mapinfo" id="mapinfo"><input type="text" value="" id="map-name"/><div class="validate-button-container" id="map-name-button"><div class="validate-button"><i class="fa fa-check"></i> Apply</div></div><span>&nbsp;&nbsp;Map Size</span><input type="text" value="16" id="map-width"/><span>x</span><input type="text" value="10" id="map-height"/><div class="validate-button-container" id="map-size-button"><div class="validate-button"><i class="fa fa-check"></i> Apply</div></div><span>&nbsp;&nbsp;Block Size</span><input type="text" value="16" id="map-block-width"/><span>x</span><input type="text" value="16" id="map-block-height"/><div class="validate-button-container" id="map-blocksize-button"><div class="validate-button"><i class="fa fa-check"></i> Apply</div></div><div class="buttons"><div id="save-map-btn" title="Save Map" style="position:relative;"><i class="fa fa-save"></i><span id="save-dot" style="display:none; color:#f00; font-size:10px; position:absolute; top:-4px; right:-4px;">●</span></div><div id="undo-map" title="Undo"><i class="fa fa-undo"></i></div><div id="redo-map" title="Redo"><i class="fa fa-redo"></i></div><div id="copy-map" title="Copy"><i class="fa fa-copy"></i></div><div id="cut-map" title="Cut"><i class="fa fa-cut"></i></div><div id="paste-map" title="Paste"><i class="fa fa-paste"></i></div><div id="delete-map" title="Clear Map"><i class="fa fa-trash"></i></div></div></div><div id="map-editor-locked"></div><div id="mapeditor-container"><div class="mapeditor" id="mapeditor"><div id="mapeditor-wrapper"></div><div id="mapeditor-bottombar"><div class="pick-color-button" id="map-background-color" title="Background"></div><select id="map-underlay-select"></select><div id="map-zoom-controls"><div class="zoom-btn" id="map-zoom-out" title="Zoom Out (-)"><i class="fa fa-search-minus"></i></div><div class="zoom-label" id="map-zoom-label" title="Reset Zoom">100%</div><div class="zoom-btn" id="map-zoom-in" title="Zoom In (+)"><i class="fa fa-search-plus"></i></div><div class="zoom-btn" id="map-zoom-fit" title="Fit to Screen"><i class="fa fa-compress-arrows-alt"></i></div><div class="zoom-btn" id="map-minimap-btn" title="Toggle Minimap"><i class="fa fa-map"></i></div></div><div class="asset-code-tip" id="map-code-tip"><div><input type="text" spellcheck="false" readonly="readonly"/><i class="fa fa-copy" title="Copy Code"></i></div></div><div class="editor-coordinates" id="map-coordinates"></div></div></div><div class="mapeditor-splitbar"></div><div class="mapbar" id="mapbar" tabindex="1"><div class="map-tilepicker" id="map-tilepicker"></div><div class="assetlist map-sprite-list" id="map-sprite-list"></div></div></div></div></div>
                
                <script>
                    const acquireVsCodeApi = window.acquireVsCodeApi;
                </script>
                <script src="${jsUri}"></script>
                <script src="${mockUri}"></script>
            </body>
            </html>
        `;
    }
}
