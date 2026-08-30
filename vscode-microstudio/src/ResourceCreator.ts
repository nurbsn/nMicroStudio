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
}
