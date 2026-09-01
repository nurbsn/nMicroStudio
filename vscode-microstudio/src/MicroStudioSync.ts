import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { I18n } from './i18n';

export interface SavedAccount {
    username: string;
    token?: string;
    lastUsed: number;
}

export class MicroStudioSync {
    private socket: WebSocket | null = null;
    private token: string | null = null;
    private username: string | null = null;
    private pendingRequests: { [id: number]: (response: any) => void } = {};
    private requestId = 0;
    private isConnecting = false;
    
    private connectionStateEmitter = new vscode.EventEmitter<"connected" | "disconnected" | "connecting">();
    public onConnectionStateChanged = this.connectionStateEmitter.event;
    private state: "connected" | "disconnected" | "connecting" = "disconnected";

    constructor(private context: vscode.ExtensionContext) {
        // Try to connect automatically on startup using saved credentials
        this.autoConnect();
    }

    public getConnectionState() {
        return this.state;
    }

    public getUsername() {
        return this.username;
    }

    public getSavedAccounts(): SavedAccount[] {
        return this.context.globalState.get<SavedAccount[]>('microstudio.savedAccounts', []);
    }

    private async saveAccount(username: string, token?: string, password?: string) {
        let accounts = this.getSavedAccounts();
        const existingIdx = accounts.findIndex(a => a.username.toLowerCase() === username.toLowerCase());
        const entry: SavedAccount = {
            username: username,
            token: token,
            lastUsed: Date.now()
        };

        if (existingIdx >= 0) {
            accounts[existingIdx] = entry;
        } else {
            accounts.push(entry);
        }

        await this.context.globalState.update('microstudio.savedAccounts', accounts);
        await this.context.globalState.update('microstudio.username', username);
        if (token) {
            await this.context.globalState.update('microstudio.token', token);
        }
        if (password) {
            await this.context.secrets.store(`microstudio.pass.${username}`, password);
            await this.context.secrets.store('microstudio.password', password);
        }
    }

    private setState(state: "connected" | "disconnected" | "connecting") {
        this.state = state;
        this.connectionStateEmitter.fire(state);
        vscode.commands.executeCommand('setContext', 'microstudio:connected', state === 'connected');
    }

    private async autoConnect() {
        const username = this.context.globalState.get<string>('microstudio.username');
        const token = this.context.globalState.get<string>('microstudio.token');
        if (username && token) {
            try {
                await this.connectWithToken(token, username, true);
            } catch (err) {
                // If token fails, try password
                const password = await this.context.secrets.get(`microstudio.pass.${username}`) || 
                                 await this.context.secrets.get('microstudio.password');
                if (password) {
                    try {
                        await this.connectWithCredentials(username, password, true);
                    } catch (e) {
                        console.error("Auto connect with password failed", e);
                    }
                }
            }
        }
    }

    public async connect() {
        if (this.state === 'connected') {
            const reLogin = await vscode.window.showInformationMessage(
                `${I18n.t('already_connected')} (${this.username}). ${I18n.t('add_account_option')}`,
                I18n.t('yes'),
                'Cancel'
            );
            if (reLogin !== I18n.t('yes')) return;
            this.disconnect();
        }

        const username = await vscode.window.showInputBox({ 
            prompt: I18n.t('login_username_prompt'),
            value: this.username || undefined
        });
        if (!username) return;

        const password = await vscode.window.showInputBox({ 
            prompt: I18n.t('login_password_prompt'), 
            password: true 
        });
        if (!password) return;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: I18n.t('login_connecting'),
            cancellable: true
        }, async (progress, cancellationToken) => {
            cancellationToken.onCancellationRequested(() => {
                this.disconnect();
            });

            try {
                await this.connectWithCredentials(username, password, false);
            } catch (err: any) {
                this.disconnect();
                vscode.window.showErrorMessage(I18n.t('login_failed', err.message || err));
            }
        });
    }

    public async manageAccounts(): Promise<void> {
        const accounts = this.getSavedAccounts();
        const items: (vscode.QuickPickItem & { action: string; username?: string })[] = [];

        // List existing accounts
        for (const acc of accounts) {
            const isActive = (this.state === 'connected' && this.username?.toLowerCase() === acc.username.toLowerCase());
            items.push({
                label: `$(account) ${acc.username} ${isActive ? I18n.t('active_account_badge') : ''}`,
                description: isActive ? 'Connected' : 'Click to switch',
                action: 'switch',
                username: acc.username
            });
        }

        items.push({
            label: `$(add) ${I18n.t('add_account_option')}`,
            description: 'Log in to another account',
            action: 'add'
        });

        if (accounts.length > 0) {
            items.push({
                label: `$(trash) ${I18n.t('remove_account_option')}`,
                description: 'Remove a saved account from this device',
                action: 'remove'
            });
        }

        if (this.state === 'connected') {
            items.push({
                label: `$(sign-out) ${I18n.t('logged_out')}`,
                description: 'Disconnect current session',
                action: 'logout'
            });
        }

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: I18n.t('manage_accounts_title')
        });

        if (!picked) return;

        if (picked.action === 'add') {
            await this.connect();
        } else if (picked.action === 'switch' && picked.username) {
            if (this.username?.toLowerCase() === picked.username.toLowerCase() && this.state === 'connected') {
                return; // Already active
            }
            await this.switchToAccount(picked.username);
        } else if (picked.action === 'remove') {
            await this.showRemoveAccountDialog();
        } else if (picked.action === 'logout') {
            await this.logout();
        }
    }

    public async switchToAccount(username: string): Promise<void> {
        const accounts = this.getSavedAccounts();
        const target = accounts.find(a => a.username.toLowerCase() === username.toLowerCase());
        if (!target) return;

        this.disconnect();

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: I18n.t('login_connecting'),
            cancellable: true
        }, async (progress, cancellationToken) => {
            cancellationToken.onCancellationRequested(() => {
                this.disconnect();
            });

            try {
                if (target.token) {
                    try {
                        await this.connectWithToken(target.token, target.username, false);
                        return;
                    } catch (e) {}
                }
                const password = await this.context.secrets.get(`microstudio.pass.${target.username}`);
                if (password) {
                    await this.connectWithCredentials(target.username, password, false);
                } else {
                    const passInput = await vscode.window.showInputBox({
                        prompt: `${I18n.t('login_password_prompt')} (${target.username}):`,
                        password: true
                    });
                    if (passInput) {
                        await this.connectWithCredentials(target.username, passInput, false);
                    }
                }
            } catch (err: any) {
                this.disconnect();
                vscode.window.showErrorMessage(I18n.t('login_failed', err.message || err));
            }
        });
    }

    private async showRemoveAccountDialog() {
        const accounts = this.getSavedAccounts();
        if (accounts.length === 0) return;

        const picked = await vscode.window.showQuickPick(
            accounts.map(a => ({ label: `$(account) ${a.username}`, username: a.username })),
            { placeHolder: I18n.t('select_account_to_remove') }
        );
        if (!picked) return;

        const remaining = accounts.filter(a => a.username.toLowerCase() !== picked.username.toLowerCase());
        await this.context.globalState.update('microstudio.savedAccounts', remaining);
        await this.context.secrets.delete(`microstudio.pass.${picked.username}`);

        if (this.username?.toLowerCase() === picked.username.toLowerCase()) {
            await this.logout();
        }

        vscode.window.showInformationMessage(I18n.t('account_removed_success', picked.username));
    }

    private connectWithCredentials(username: string, password?: string, silent = false): Promise<void> {
        this.disconnect();
        this.isConnecting = true;
        this.setState("connecting");

        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.disconnect();
                reject(new Error('Connection timeout. microStudio server did not respond in 15 seconds.'));
            }, 15000);

            try {
                this.socket = new WebSocket('wss://microstudio.dev/');

                this.socket.on('open', () => {
                    this.sendRequest({
                        name: 'login',
                        nick: username,
                        password: password
                    }, async (response: any) => {
                        clearTimeout(timeout);
                        if (response.name === 'error') {
                            this.disconnect();
                            reject(new Error(response.error || 'Invalid credentials'));
                        } else if (response.name === 'logged_in') {
                            this.token = response.token;
                            this.username = username;
                            this.isConnecting = false;
                            this.setState("connected");
                            
                            // Save credentials & multi-account entry
                            await this.saveAccount(username, response.token, password);
                            
                            if (!silent) {
                                vscode.window.showInformationMessage(I18n.t('login_success', username));
                            }
                            resolve();
                        } else {
                            this.disconnect();
                            reject(new Error('Unexpected server response'));
                        }
                    });
                });

                this.setupSocketEvents(resolve, reject, timeout);
            } catch (err) {
                clearTimeout(timeout);
                this.disconnect();
                reject(err);
            }
        });
    }

    private connectWithToken(token: string, username: string, silent = true): Promise<void> {
        this.disconnect();
        this.isConnecting = true;
        this.setState("connecting");

        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.disconnect();
                reject(new Error('Connection timeout. microStudio server did not respond in 15 seconds.'));
            }, 15000);

            try {
                this.socket = new WebSocket('wss://microstudio.dev/');

                this.socket.on('open', () => {
                    this.sendRequest({
                        name: 'token',
                        token: token
                    }, async (response: any) => {
                        clearTimeout(timeout);
                        if (response.name === 'error') {
                            this.disconnect();
                            reject(new Error(response.error || 'Token expired or invalid'));
                        } else if (response.name === 'token_valid') {
                            this.token = token;
                            this.username = username;
                            this.isConnecting = false;
                            this.setState("connected");
                            
                            await this.saveAccount(username, token);

                            if (!silent) {
                                vscode.window.showInformationMessage(I18n.t('login_success', username));
                            }
                            resolve();
                        } else {
                            this.disconnect();
                            reject(new Error('Unexpected server response'));
                        }
                    });
                });

                this.setupSocketEvents(resolve, reject, timeout);
            } catch (err) {
                clearTimeout(timeout);
                this.disconnect();
                reject(err);
            }
        });
    }

    private setupSocketEvents(resolve: () => void, reject: (err: any) => void, timeout?: NodeJS.Timeout) {
        if (!this.socket) return;

        this.socket.on('message', (data: WebSocket.Data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.request_id !== undefined && this.pendingRequests[msg.request_id]) {
                    this.pendingRequests[msg.request_id](msg);
                    delete this.pendingRequests[msg.request_id];
                } else {
                    this.handleServerMessage(msg);
                }
            } catch (err) {
                console.error("Error parsing message from server", err);
            }
        });

        this.socket.on('error', (err: any) => {
            if (timeout) clearTimeout(timeout);
            this.disconnect();
            reject(err);
        });

        this.socket.on('close', () => {
            if (timeout) clearTimeout(timeout);
            this.isConnecting = false;
            this.setState("disconnected");
        });
    }

    public async logout() {
        this.disconnect();
        this.token = null;
        this.username = null;
        await this.context.globalState.update('microstudio.username', undefined);
        await this.context.globalState.update('microstudio.token', undefined);
        vscode.window.showInformationMessage(I18n.t('logged_out'));
    }

    public disconnect() {
        this.isConnecting = false;
        this.pendingRequests = {};
        if (this.socket) {
            try {
                this.socket.close();
            } catch (e) {}
            this.socket = null;
        }
        this.setState("disconnected");
    }

    public getRemoteProjects(): Promise<any[]> {
        return new Promise((resolve, reject) => {
            if (this.state !== 'connected') {
                reject(new Error(I18n.t('login_required_download')));
                return;
            }
            this.sendRequest({ name: 'get_project_list' }, (response: any) => {
                if (response.name === 'error') {
                    reject(new Error(response.error));
                } else if (response.list) {
                    resolve(response.list);
                } else {
                    resolve([]);
                }
            });
        });
    }

    public async downloadProject(project: any, localPath: string): Promise<void> {
        if (this.state !== 'connected') {
            throw new Error(I18n.t('login_required_download'));
        }

        const projectId = project.id;
        const folders = ["ms", "sprites", "maps", "sounds", "music", "assets", "doc"];
        
        // Ensure local directory exists
        if (!fs.existsSync(localPath)) {
            fs.mkdirSync(localPath, { recursive: true });
        }

        const projectFilesMetadata: { [path: string]: { version: number, size: number, properties: any } } = {};

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
                    } else {
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
        const localProjectJson: any = {
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

    public async uploadProject(localPath: string, progressCallback?: (status: string, percent: number) => void): Promise<{ title: string, slug: string }> {
        if (this.state !== 'connected') {
            throw new Error(I18n.t('login_required_upload'));
        }

        const pjPath = path.join(localPath, 'project.json');
        if (!fs.existsSync(pjPath)) {
            throw new Error(I18n.t('project_not_found'));
        }

        let projectJson: any = {};
        try {
            projectJson = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
        } catch (e: any) {
            throw new Error(`Error reading project.json: ${e.message}`);
        }

        const slug = projectJson.slug || path.basename(localPath);
        const title = projectJson.title || slug;

        // 1. Fetch remote projects list
        progressCallback?.(I18n.t('login_connecting'), 5);
        const remoteList = await this.getRemoteProjects();

        let targetProject: any = null;

        // A. Check if project.json already has an ID
        if (projectJson.id) {
            targetProject = remoteList.find((p: any) => p.id === projectJson.id);
        }

        // B. Search by slug or title
        if (!targetProject) {
            const clean = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const exactMatches = remoteList.filter((p: any) => 
                (p.slug && p.slug.toLowerCase() === slug.toLowerCase()) ||
                (p.title && p.title.toLowerCase() === title.toLowerCase()) ||
                clean(p.slug) === clean(slug) ||
                clean(p.title) === clean(title)
            );

            if (exactMatches.length === 1) {
                targetProject = exactMatches[0];
            } else {
                // Show QuickPick to let user choose the exact remote project or create a new one
                interface ProjectQuickPickItem extends vscode.QuickPickItem {
                    project?: any;
                    createNew?: boolean;
                }

                const items: ProjectQuickPickItem[] = [];

                if (exactMatches.length > 0) {
                    items.push({
                        label: I18n.t('suggested_matches'),
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
                    label: I18n.t('all_remote_projects'),
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
                    label: `$(plus) ${I18n.t('create_new_remote', title)}`,
                    description: slug,
                    createNew: true
                });

                const picked = await vscode.window.showQuickPick(items, {
                    placeHolder: I18n.t('select_remote_project_prompt', title),
                    title: I18n.t('select_remote_project_title')
                });

                if (!picked) {
                    throw new Error(I18n.t('upload_cancelling'));
                }

                if (picked.createNew) {
                    progressCallback?.(I18n.t('upload_creating_remote', title), 10);
                    targetProject = await this.createRemoteProject({
                        title: title,
                        slug: slug,
                        type: projectJson.type || 'game',
                        graphics: projectJson.graphics || 'standard',
                        language: projectJson.language || 'microscript_v2',
                        libs: projectJson.libs || []
                    });
                } else {
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
        } catch (e) {}

        // 3. Update project options
        progressCallback?.(I18n.t('upload_syncing_options'), 20);
        const optionsToSync = ['title', 'orientation', 'aspect', 'type', 'language', 'graphics', 'libs'];
        for (const opt of optionsToSync) {
            if (projectJson[opt] !== undefined) {
                try {
                    await this.setProjectOption(projectId, opt, projectJson[opt]);
                } catch (e) {
                    console.warn(`Failed to set option ${opt}:`, e);
                }
            }
        }

        // 4. Collect all local files
        const folders = ["ms", "sprites", "maps", "sounds", "music", "assets", "doc"];
        const filesToUpload: { relativePath: string, fullPath: string }[] = [];

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

            let content: string;
            if (isText) {
                content = fs.readFileSync(item.fullPath, 'utf8');
            } else {
                content = fs.readFileSync(item.fullPath).toString('base64');
            }

            let properties: any = {};
            if (projectJson.files && projectJson.files[item.relativePath] && projectJson.files[item.relativePath].properties) {
                properties = projectJson.files[item.relativePath].properties;
            }

            try {
                await this.writeProjectFile(projectId, remoteRelativePath, content, properties);
            } catch (err) {
                console.warn(`Error uploading ${remoteRelativePath}:`, err);
            }
        }

        progressCallback?.("Zakończono synchronizację!", 100);
        return { title, slug };
    }

    private collectFilesRecursively(dir: string, baseRelative: string, result: { relativePath: string, fullPath: string }[]) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = `${baseRelative}/${entry.name}`;
            if (entry.isDirectory()) {
                this.collectFilesRecursively(fullPath, relativePath, result);
            } else if (entry.isFile()) {
                result.push({ relativePath, fullPath });
            }
        }
    }

    public createRemoteProject(data: { title: string, slug: string, type?: string, language?: string, graphics?: string, libs?: string[] }): Promise<any> {
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(async () => {
                try {
                    const list = await this.getRemoteProjects();
                    const found = list.find((p: any) => p.slug === data.slug || p.title === data.title);
                    if (found) resolve(found);
                    else reject(new Error("Timeout przy tworzeniu projektu zdalnego."));
                } catch (e) {
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
            }, async (response: any) => {
                clearTimeout(timeout);
                if (response.name === 'error') {
                    reject(new Error(response.error));
                } else if (response.id) {
                    resolve(response);
                } else if (response.name === 'project_created') {
                    const list = await this.getRemoteProjects();
                    const found = list.find((p: any) => p.slug === data.slug || p.title === data.title);
                    resolve(found || { id: response.id, slug: data.slug, title: data.title });
                } else {
                    resolve({ slug: data.slug, title: data.title });
                }
            });
        });
    }

    public writeProjectFile(projectId: number, file: string, content: string, properties: any = {}): Promise<void> {
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
            }, (response: any) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    if (response.name === 'error') {
                        reject(new Error(response.error));
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    public setProjectOption(projectId: number, option: string, value: any): Promise<void> {
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
            }, (response: any) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    if (response.name === 'error') {
                        reject(new Error(response.error));
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    private listProjectFiles(projectId: number, folder: string): Promise<any[]> {
        return new Promise((resolve) => {
            this.sendRequest({
                name: 'list_project_files',
                project: projectId,
                folder: folder
            }, (response: any) => {
                if (response.files) {
                    resolve(response.files);
                } else {
                    resolve([]);
                }
            });
        });
    }

    private readProjectFile(projectId: number, filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.sendRequest({
                name: 'read_project_file',
                project: projectId,
                file: filePath
            }, (response: any) => {
                if (response.name === 'error') {
                    reject(new Error(response.error));
                } else if (response.content !== undefined) {
                    resolve(response.content);
                } else {
                    resolve('');
                }
            });
        });
    }

    private sendRequest(msg: any, callback: (response: any) => void) {
        msg.request_id = this.requestId++;
        this.pendingRequests[msg.request_id] = callback;
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(msg));
        } else {
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

    private handleServerMessage(msg: any) {
        if (msg.name === 'project_file_update') {
            console.log('Remote file updated', msg);
        }
    }
}
