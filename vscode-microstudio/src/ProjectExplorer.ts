import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MicroStudioSync } from './MicroStudioSync';
import { I18n } from './i18n';

export class LocalProjectTreeItem extends vscode.TreeItem {
    constructor(
        public readonly title: string,
        public readonly slug: string,
        public readonly fsPath: string
    ) {
        super(title, vscode.TreeItemCollapsibleState.None);
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

export class LocalProjectsProvider implements vscode.TreeDataProvider<LocalProjectTreeItem | vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<LocalProjectTreeItem | vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<LocalProjectTreeItem | vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<LocalProjectTreeItem | vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {
        // Refresh when configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('microstudio.workspaceRoot') || e.affectsConfiguration('microstudio.language')) {
                this.refresh();
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) {
            return [];
        }

        const config = vscode.workspace.getConfiguration('microstudio');
        const workspaceRoot = config.get<string>('workspaceRoot');

        if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
            const setupItem = new vscode.TreeItem(I18n.t('set_workspace_root'));
            setupItem.command = {
                command: 'microstudio.setWorkspaceRoot',
                title: I18n.t('set_workspace_root')
            };
            setupItem.iconPath = new vscode.ThemeIcon('settings-gear');
            return [setupItem];
        }

        try {
            const dirs = fs.readdirSync(workspaceRoot, { withFileTypes: true });
            const projects: LocalProjectTreeItem[] = [];

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
                        } catch (err) {
                            console.error(`Error reading project.json in ${projectDir}`, err);
                        }
                    }
                }
            }

            if (projects.length === 0) {
                const emptyItem = new vscode.TreeItem(I18n.t('no_local_projects'));
                emptyItem.iconPath = new vscode.ThemeIcon('info');
                return [emptyItem];
            }

            // Sort projects by title
            return projects.sort((a, b) => a.title.localeCompare(b.title));
        } catch (err) {
            console.error('Error listing workspaceRoot', err);
            const errorItem = new vscode.TreeItem(I18n.t('local_projects_error'));
            errorItem.iconPath = new vscode.ThemeIcon('error');
            return [errorItem];
        }
    }
}

export class RemoteProjectTreeItem extends vscode.TreeItem {
    constructor(
        public readonly project: any
    ) {
        super(project.title, vscode.TreeItemCollapsibleState.None);
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

export class RemoteProjectsProvider implements vscode.TreeDataProvider<RemoteProjectTreeItem | vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RemoteProjectTreeItem | vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<RemoteProjectTreeItem | vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RemoteProjectTreeItem | vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private cachedProjects: any[] | null = null;

    constructor(private syncService: MicroStudioSync) {
        // Refresh when connection status changes
        this.syncService.onConnectionStateChanged(() => {
            this.cachedProjects = null;
            this.refresh();
        });
    }

    refresh(): void {
        this.cachedProjects = null;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) {
            return [];
        }

        const state = this.syncService.getConnectionState();

        if (state === 'disconnected') {
            const accounts = this.syncService.getSavedAccounts();
            if (accounts.length > 0) {
                const manageItem = new vscode.TreeItem(`${I18n.t('manage_accounts_title')} (${accounts.length})...`);
                manageItem.command = {
                    command: 'microstudio.manageAccounts',
                    title: I18n.t('manage_accounts_title')
                };
                manageItem.iconPath = new vscode.ThemeIcon('account');
                return [manageItem];
            }

            const loginItem = new vscode.TreeItem(I18n.t('login_username_prompt') + '...');
            loginItem.command = {
                command: 'microstudio.login',
                title: I18n.t('login_action')
            };
            loginItem.iconPath = new vscode.ThemeIcon('key');
            return [loginItem];
        }

        if (state === 'connecting') {
            const connectingItem = new vscode.TreeItem(I18n.t('login_connecting'));
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
                const emptyItem = new vscode.TreeItem(I18n.t('no_local_projects'));
                emptyItem.iconPath = new vscode.ThemeIcon('info');
                return [emptyItem];
            }

            return projects
                .sort((a, b) => a.title.localeCompare(b.title))
                .map(p => new RemoteProjectTreeItem(p));
        } catch (err: any) {
            console.error('Error fetching remote projects', err);
            const errorItem = new vscode.TreeItem(`${err.message}`);
            errorItem.iconPath = new vscode.ThemeIcon('error');
            return [errorItem];
        }
    }
}
