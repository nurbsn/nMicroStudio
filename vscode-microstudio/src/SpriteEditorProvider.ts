import * as vscode from 'vscode';
import * as path from 'path';

class MicroStudioCustomDocument implements vscode.CustomDocument {
    constructor(public readonly uri: vscode.Uri) {}
    public dispose() {}
    public documentData: string = '';
    public propertiesData: any = null;
}

export class SpriteEditorProvider implements vscode.CustomEditorProvider<MicroStudioCustomDocument> {
    
    private webviews = new Map<string, vscode.WebviewPanel>();

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new SpriteEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            'microstudio.spriteEditor',
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

    public async resolveCustomEditor(
        document: MicroStudioCustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
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
                        undo: () => {},
                        redo: () => {}
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
        } catch (e) {
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

    private async saveDocument(document: vscode.CustomDocument, data: string) {
        // Save base64 data to file
        const buffer = Buffer.from(data, 'base64');
        await vscode.workspace.fs.writeFile(document.uri, buffer);
    }

    // Required by CustomEditorProvider but handled natively for standard files
    async saveCustomDocument(document: MicroStudioCustomDocument, cancellation: vscode.CancellationToken): Promise<void> {
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
    async saveCustomDocumentAs(document: MicroStudioCustomDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {}
    async revertCustomDocument(document: MicroStudioCustomDocument, cancellation: vscode.CancellationToken): Promise<void> {}
    async backupCustomDocument(document: MicroStudioCustomDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        return { id: document.uri.toString(), delete: () => {} };
    }
    async openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): Promise<MicroStudioCustomDocument> {
        return new MicroStudioCustomDocument(uri);
    }
    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<MicroStudioCustomDocument>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
}
