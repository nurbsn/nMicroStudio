import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { I18n } from './i18n';

export class ProjectSettingsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'microstudio.projectDetails';
    private _view?: vscode.WebviewView;
    private _currentProjectUri?: vscode.Uri;
    private _currentProjectData: any = null;

    constructor(private readonly context: vscode.ExtensionContext) {
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

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.type) {
                case 'ready':
                    if (this._currentProjectUri) {
                        await this.loadProjectData(this._currentProjectUri);
                    } else {
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
                    } else {
                        await this.detectActiveProject();
                    }
                    break;
            }
        });

        // Initial detection
        if (this._currentProjectUri) {
            this.loadProjectData(this._currentProjectUri);
        } else {
            this.detectActiveProject();
        }
    }

    public async setProject(projectUri: vscode.Uri) {
        this._currentProjectUri = projectUri;
        await this.loadProjectData(projectUri);
    }

    public async detectActiveProject(uri?: vscode.Uri) {
        if (!uri) {
            if (vscode.window.activeTextEditor) {
                uri = vscode.window.activeTextEditor.document.uri;
            } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                uri = vscode.workspace.workspaceFolders[0].uri;
            }
        }
        if (!uri) {
            if (this._view) this._view.webview.postMessage({ type: 'empty' });
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
            if (parent === current) break;
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
                } catch (e) {}
            }
        }

        this._currentProjectData = null;
        if (this._view) {
            this._view.webview.postMessage({ type: 'empty' });
        }
    }

    private async loadProjectData(projectUri: vscode.Uri) {
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
        } catch (e) {
            console.error('Failed to parse project.json', e);
        }
    }

    private async saveProjectData(updatedData: any) {
        if (!this._currentProjectUri) return;
        const jsonPath = path.join(this._currentProjectUri.fsPath, 'project.json');
        try {
            // Merge existing data with updated data
            const merged = Object.assign({}, this._currentProjectData || {}, updatedData);
            fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2), 'utf8');
            this._currentProjectData = merged;
            vscode.window.showInformationMessage(I18n.t('settings_saved'));
            if (this._view) {
                this._view.webview.postMessage({ type: 'saved' });
            }
        } catch (e: any) {
            vscode.window.showErrorMessage(`Error: ${e.message}`);
        }
    }

    private getHtmlForWebview(): string {
        const t = (key: string) => I18n.t(key);

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
