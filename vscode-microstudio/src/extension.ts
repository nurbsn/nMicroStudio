import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SpriteEditorProvider } from './SpriteEditorProvider';
import { MapEditorProvider } from './MapEditorProvider';
import { MicroStudioSync } from './MicroStudioSync';
import { 
    LocalProjectsProvider, 
    RemoteProjectsProvider, 
    LocalProjectTreeItem, 
    RemoteProjectTreeItem 
} from './ProjectExplorer';
import { ProjectSettingsViewProvider } from './ProjectSettingsView';
import { ResourceCreator } from './ResourceCreator';
import { LibraryManager } from './LibraryManager';
import { HtmlBundler } from './HtmlBundler';
import { MicroScriptCompletionProvider } from './MicroScriptCompletionProvider';
import { I18n } from './i18n';

export function activate(context: vscode.ExtensionContext) {
    console.log('MicroStudio VS Code extension is now active!');

    // Register our custom editors
    context.subscriptions.push(SpriteEditorProvider.register(context));
    context.subscriptions.push(MapEditorProvider.register(context));

    // Register MicroScript IntelliSense / Completion & Hover Provider
    const completionProvider = new MicroScriptCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('microscript', completionProvider, '.')
    );
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('microscript', completionProvider)
    );

    // Register Preview command
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.preview', async () => {
        let projectRootPath: string | undefined;

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
                if (parent === current) break;
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

        const panel = vscode.window.createWebviewPanel(
            'microstudioPreview',
            'microStudio Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: roots
            }
        );

        const currentProjectPath = projectRootPath;
        const updatePreviewHtml = async () => {
            if (panel.visible && currentProjectPath) {
                try {
                    panel.webview.html = await HtmlBundler.bundle(currentProjectPath, context.extensionPath, true, panel.webview);
                } catch (e) {
                    console.error('Error bundling preview HTML', e);
                }
            }
        };

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message && message.command === 'reload') {
                await updatePreviewHtml();
            }
        });

        await updatePreviewHtml();
    }));

    // Register Sync command and Project Explorer panel
    const syncService = new MicroStudioSync(context);
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.connect', async () => {
        await syncService.connect();
    }));

    const localProjectsProvider = new LocalProjectsProvider();
    const remoteProjectsProvider = new RemoteProjectsProvider(syncService);

    vscode.window.registerTreeDataProvider('microstudio.localProjects', localProjectsProvider);
    vscode.window.registerTreeDataProvider('microstudio.remoteProjects', remoteProjectsProvider);

    // Register Project Settings View Provider
    const projectSettingsProvider = new ProjectSettingsViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ProjectSettingsViewProvider.viewType,
            projectSettingsProvider
        )
    );

    // Command: Select Local Project (activates it in Project Settings)
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.selectLocalProject', async (item: LocalProjectTreeItem) => {
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
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.openProject', async (item: LocalProjectTreeItem) => {
        if (item && item.fsPath) {
            const folderUri = vscode.Uri.file(item.fsPath);
            await projectSettingsProvider.setProject(folderUri);

            const isAlreadyOpened = vscode.workspace.workspaceFolders?.some(
                f => f.uri.fsPath.toLowerCase() === item.fsPath.toLowerCase()
            );

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
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.deleteLocalProject', async (item: LocalProjectTreeItem) => {
        if (item && item.fsPath) {
            const confirm = await vscode.window.showWarningMessage(
                `Czy na pewno chcesz usunąć lokalny projekt "${item.title}"?`,
                { modal: true },
                'Tak'
            );
            if (confirm === 'Tak') {
                try {
                    await vscode.workspace.fs.delete(vscode.Uri.file(item.fsPath), { recursive: true });
                    vscode.window.showInformationMessage(`Usunięto projekt "${item.title}"`);
                    localProjectsProvider.refresh();
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Nie udało się usunąć projektu: ${err.message}`);
                }
            }
        }
    }));

    // Command: Clone Remote Project
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.cloneProject', async (item: RemoteProjectTreeItem) => {
        if (!item || !item.project) return;
        
        const config = vscode.workspace.getConfiguration('microstudio');
        let workspaceRoot = config.get<string>('workspaceRoot');
        
        if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
            vscode.window.showErrorMessage('Musisz najpierw ustawić katalog główny projektów.');
            await vscode.commands.executeCommand('microstudio.setWorkspaceRoot');
            workspaceRoot = config.get<string>('workspaceRoot');
            if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return;
        }

        const project = item.project;
        const localPath = path.join(workspaceRoot, project.slug);

        if (fs.existsSync(localPath)) {
            const confirm = await vscode.window.showWarningMessage(
                `Katalog "${project.slug}" już istnieje. Czy chcesz go nadpisać?`,
                { modal: true },
                'Tak'
            );
            if (confirm !== 'Tak') return;
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
            } catch (err: any) {
                vscode.window.showErrorMessage(`Błąd pobierania projektu: ${err.message}`);
            }
        });
    }));

    // Register Unified Resource Creation & Project Wizard Commands
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.createAsset', async (uri?: vscode.Uri) => {
        await ResourceCreator.showCreateAssetQuickPick(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.createNewProject', async () => {
        await ResourceCreator.createNewProject();
    }));

    // Register Multi-Account Manager Command
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.manageAccounts', async () => {
        await syncService.manageAccounts();
    }));

    // Register Individual Resource Creation Commands
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.newSprite', async (uri?: vscode.Uri) => {
        await ResourceCreator.createNewSprite(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.newMap', async (uri?: vscode.Uri) => {
        await ResourceCreator.createNewMap(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.newSource', async (uri?: vscode.Uri) => {
        await ResourceCreator.createNewSource(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.newSound', async (uri?: vscode.Uri) => {
        await ResourceCreator.createNewSound(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.newMusic', async (uri?: vscode.Uri) => {
        await ResourceCreator.createNewMusic(uri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.importAsset', async (uri?: vscode.Uri) => {
        await ResourceCreator.importAsset(uri);
    }));

    // Register Library Manager Command
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.manageLibraries', async (uri?: vscode.Uri) => {
        await LibraryManager.showLibraryBrowser(uri);
    }));

    // Register Export HTML command
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.exportHtml', async (targetItem?: any) => {
        let projectPath: string | undefined;
        if (targetItem && targetItem.fsPath) {
            projectPath = targetItem.fsPath;
        } else {
            const uri = await ResourceCreator.findProjectUri();
            if (uri) projectPath = uri.fsPath;
        }
        if (!projectPath) return;

        const defaultExportUri = vscode.Uri.file(path.join(projectPath, 'export', 'index.html'));
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: defaultExportUri,
            filters: { 'HTML Game': ['html'] },
            saveLabel: I18n.t('export_html_title')
        });
        if (!saveUri) return;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: I18n.t('export_html_title'),
            cancellable: false
        }, async () => {
            await HtmlBundler.exportStandalone(projectPath!, saveUri.fsPath, context.extensionPath);
            const action = await vscode.window.showInformationMessage(
                I18n.t('export_html_success', saveUri.fsPath),
                I18n.t('open_in_browser')
            );
            if (action === I18n.t('open_in_browser')) {
                vscode.env.openExternal(saveUri);
            }
        });
    }));

    // Register Push to Remote command
    context.subscriptions.push(vscode.commands.registerCommand('microstudio.pushProject', async (targetItem?: any) => {
        let projectPath: string | undefined;
        if (targetItem && targetItem.fsPath) {
            projectPath = targetItem.fsPath;
        } else {
            const uri = await ResourceCreator.findProjectUri();
            if (uri) projectPath = uri.fsPath;
        }
        if (!projectPath) return;

        if (syncService.getConnectionState() !== 'connected') {
            const doLogin = await vscode.window.showWarningMessage(
                I18n.t('login_required_upload'),
                I18n.t('login_action')
            );
            if (doLogin === I18n.t('login_action')) {
                await syncService.connect();
                if (syncService.getConnectionState() !== 'connected') return;
            } else {
                return;
            }
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: I18n.t('push_to_server'),
            cancellable: false
        }, async (progress) => {
            try {
                const result = await syncService.uploadProject(projectPath!, (status, percent) => {
                    progress.report({ message: status, increment: percent });
                });
                vscode.window.showInformationMessage(I18n.t('upload_finished', result.title));
                remoteProjectsProvider.refresh();
            } catch (err: any) {
                vscode.window.showErrorMessage(I18n.t('upload_failed', err.message));
            }
        });
    }));
}

export function deactivate() {}

