import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { I18n } from './i18n';

// 16x16 transparent PNG base64
const EMPTY_16X16_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEUlEQVR42mNk+M9Qz0AEYBxVGAA+9w/5gScdlwAAAABJRU5ErkJggg==';

export class ResourceCreator {
    public static async findProjectUri(targetUri?: vscode.Uri): Promise<vscode.Uri | undefined> {
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
                if (parent === current) break;
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
                if (parent === current) break;
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
                } catch (e) {}
            }
        }

        vscode.window.showWarningMessage(I18n.t('project_not_found'));
        return undefined;
    }

    public static async createNewSprite(targetUri?: vscode.Uri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri) return;

        const name = await vscode.window.showInputBox({
            prompt: I18n.t('new_sprite_prompt'),
            placeHolder: 'sprite_name',
            validateInput: text => (!text || text.trim() === '' ? I18n.t('name_cannot_be_empty') : null)
        });

        if (!name) return;
        const cleanName = name.trim().replace(/\.png$/, '');
        const spritesFolder = path.join(projectUri.fsPath, 'sprites');
        const targetFilePath = path.join(spritesFolder, `${cleanName}.png`);
        const targetMsPath = path.join(spritesFolder, `${cleanName}.ms`);

        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });

        if (fs.existsSync(targetFilePath)) {
            vscode.window.showErrorMessage(I18n.t('sprite_already_exists', cleanName));
            return;
        }

        // Write default 16x16 PNG and companion .ms file
        fs.writeFileSync(targetFilePath, Buffer.from(EMPTY_16X16_PNG_BASE64, 'base64'));
        fs.writeFileSync(targetMsPath, JSON.stringify({ frames: 1, fps: 5 }, null, 2), 'utf8');

        const docUri = vscode.Uri.file(targetFilePath);
        vscode.window.showInformationMessage(I18n.t('new_sprite_created', cleanName));
        await vscode.commands.executeCommand('vscode.openWith', docUri, 'microstudio.spriteEditor');
    }

    public static async createNewMap(targetUri?: vscode.Uri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri) return;

        const name = await vscode.window.showInputBox({
            prompt: I18n.t('new_map_prompt'),
            placeHolder: 'map_name',
            validateInput: text => (!text || text.trim() === '' ? I18n.t('name_cannot_be_empty') : null)
        });

        if (!name) return;
        const cleanName = name.trim().replace(/\.json$/, '');
        const mapsFolder = path.join(projectUri.fsPath, 'maps');
        const targetFilePath = path.join(mapsFolder, `${cleanName}.json`);

        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });

        if (fs.existsSync(targetFilePath)) {
            vscode.window.showErrorMessage(I18n.t('map_already_exists', cleanName));
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
        vscode.window.showInformationMessage(I18n.t('new_map_created', cleanName));
        await vscode.commands.executeCommand('vscode.openWith', docUri, 'microstudio.mapEditor');
    }

    public static async createNewSource(targetUri?: vscode.Uri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri) return;

        const name = await vscode.window.showInputBox({
            prompt: I18n.t('new_script_prompt'),
            placeHolder: 'script_name',
            validateInput: text => (!text || text.trim() === '' ? I18n.t('name_cannot_be_empty') : null)
        });

        if (!name) return;
        const cleanName = name.trim().replace(/\.(ms|js|py|lua)$/i, '');
        const msFolder = path.join(projectUri.fsPath, 'ms');
        const targetFilePath = path.join(msFolder, `${cleanName}.ms`);

        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });

        if (fs.existsSync(targetFilePath)) {
            vscode.window.showErrorMessage(I18n.t('script_already_exists', cleanName));
            return;
        }

        const defaultCode = `// ${cleanName}.ms\n`;
        fs.writeFileSync(targetFilePath, defaultCode, 'utf8');

        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFilePath));
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(I18n.t('new_script_created', cleanName));
    }

    public static async createNewSound(targetUri?: vscode.Uri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri) return;

        const name = await vscode.window.showInputBox({
            prompt: I18n.t('new_sound_prompt'),
            placeHolder: 'sound_name',
            validateInput: text => (!text || text.trim() === '' ? I18n.t('name_cannot_be_empty') : null)
        });

        if (!name) return;
        const cleanName = name.trim();
        const soundsFolder = path.join(projectUri.fsPath, 'sounds');
        const targetFilePath = path.join(soundsFolder, `${cleanName}.json`);

        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        fs.writeFileSync(targetFilePath, JSON.stringify({ name: cleanName }, null, 2), 'utf8');

        vscode.window.showInformationMessage(I18n.t('new_sound_created', cleanName));
    }

    public static async createNewMusic(targetUri?: vscode.Uri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri) return;

        const name = await vscode.window.showInputBox({
            prompt: I18n.t('new_music_prompt'),
            placeHolder: 'music_name',
            validateInput: text => (!text || text.trim() === '' ? I18n.t('name_cannot_be_empty') : null)
        });

        if (!name) return;
        const cleanName = name.trim();
        const musicFolder = path.join(projectUri.fsPath, 'music');
        const targetFilePath = path.join(musicFolder, `${cleanName}.json`);

        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        fs.writeFileSync(targetFilePath, JSON.stringify({ name: cleanName }, null, 2), 'utf8');

        vscode.window.showInformationMessage(I18n.t('new_music_created', cleanName));
    }

    public static async importAsset(targetUri?: vscode.Uri) {
        const projectUri = await this.findProjectUri(targetUri);
        if (!projectUri) return;

        const fileUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            openLabel: 'Import'
        });

        if (!fileUris || fileUris.length === 0) return;

        const assetsFolder = path.join(projectUri.fsPath, 'assets');
        fs.mkdirSync(assetsFolder, { recursive: true });

        let count = 0;
        for (const uri of fileUris) {
            const fileName = path.basename(uri.fsPath);
            const dest = path.join(assetsFolder, fileName);
            fs.copyFileSync(uri.fsPath, dest);
            count++;
        }

        vscode.window.showInformationMessage(I18n.t('imported_assets', count));
    }

    public static async showCreateAssetQuickPick(targetUri?: vscode.Uri) {
        const items = [
            { label: '$(file-media) ' + I18n.t('type_sprite'), description: 'sprites/', action: 'sprite' },
            { label: '$(map) ' + I18n.t('type_map'), description: 'maps/', action: 'map' },
            { label: '$(file-code) ' + I18n.t('type_script'), description: 'ms/*.ms', action: 'script' },
            { label: '$(unmute) ' + I18n.t('type_sound'), description: 'sounds/', action: 'sound' },
            { label: '$(play-circle) ' + I18n.t('type_music'), description: 'music/', action: 'music' },
            { label: '$(file-add) ' + I18n.t('import_asset_option'), description: 'assets/', action: 'import' }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: I18n.t('select_asset_type_prompt')
        });

        if (!selected) return;

        switch (selected.action) {
            case 'sprite': return this.createNewSprite(targetUri);
            case 'map': return this.createNewMap(targetUri);
            case 'script': return this.createNewSource(targetUri);
            case 'sound': return this.createNewSound(targetUri);
            case 'music': return this.createNewMusic(targetUri);
            case 'import': return this.importAsset(targetUri);
        }
    }

    public static async createNewProject(): Promise<void> {
        const config = vscode.workspace.getConfiguration('microstudio');
        let workspaceRoot = config.get<string>('workspaceRoot');

        if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
            const chosen = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: I18n.t('set_workspace_root_dialog')
            });
            if (!chosen || chosen.length === 0) return;
            workspaceRoot = chosen[0].fsPath;
            await config.update('workspaceRoot', workspaceRoot, vscode.ConfigurationTarget.Global);
        }

        const title = await vscode.window.showInputBox({
            prompt: I18n.t('new_project_title_prompt'),
            placeHolder: 'My New Game',
            validateInput: text => (!text || text.trim() === '' ? I18n.t('name_cannot_be_empty') : null)
        });
        if (!title) return;

        const defaultSlug = title.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const slug = await vscode.window.showInputBox({
            prompt: I18n.t('new_project_slug_prompt'),
            value: defaultSlug || 'mygame',
            validateInput: text => (!text || text.trim() === '' ? I18n.t('name_cannot_be_empty') : null)
        });
        if (!slug) return;

        const projectDir = path.join(workspaceRoot, slug);
        if (fs.existsSync(projectDir)) {
            vscode.window.showErrorMessage(I18n.t('project_dir_already_exists', slug));
            return;
        }

        const langItems = [
            { label: 'MicroScript', value: 'microscript', description: 'Default microStudio language' },
            { label: 'JavaScript', value: 'javascript', description: 'Standard JS' },
            { label: 'Python', value: 'python', description: 'Python syntax' },
            { label: 'Lua', value: 'lua', description: 'Lua syntax' }
        ];

        const selectedLang = await vscode.window.showQuickPick(langItems, {
            placeHolder: I18n.t('select_project_language')
        });
        const language = selectedLang ? selectedLang.value : 'microscript';

        // Create structure
        fs.mkdirSync(projectDir, { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'ms'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'sprites'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'maps'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'sounds'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'music'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });

        const projectJson = {
            title: title.trim(),
            slug: slug.trim(),
            version: "1.0.0",
            language: language,
            graphics: "Standard",
            type: "game",
            orientation: "any",
            aspect: "free",
            libs: []
        };
        fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(projectJson, null, 2), 'utf8');

        let starterCode = `// ${title}\n\ninit = function()\nend\n\nupdate = function()\nend\n\ndraw = function()\n  screen.clear()\n  screen.drawText("${title}", 0, 0, 20, "#00e5ff")\nend\n`;
        if (language === 'javascript') {
            starterCode = `// ${title}\n\nfunction init() {\n}\n\nfunction update() {\n}\n\nfunction draw() {\n  screen.clear();\n  screen.drawText("${title}", 0, 0, 20, "#00e5ff");\n}\n`;
        } else if (language === 'python') {
            starterCode = `# ${title}\n\ndef init():\n    pass\n\ndef update():\n    pass\n\ndef draw():\n    screen.clear()\n    screen.drawText("${title}", 0, 0, 20, "#00e5ff")\n`;
        }

        fs.writeFileSync(path.join(projectDir, 'ms', 'main.ms'), starterCode, 'utf8');

        vscode.commands.executeCommand('microstudio.refreshProjects');
        const openAction = await vscode.window.showInformationMessage(
            I18n.t('new_project_created_success', title),
            I18n.t('open_project_current_window'),
            I18n.t('open_project_new_window')
        );

        if (openAction === I18n.t('open_project_current_window')) {
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectDir), false);
        } else if (openAction === I18n.t('open_project_new_window')) {
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectDir), true);
        }
    }
}
