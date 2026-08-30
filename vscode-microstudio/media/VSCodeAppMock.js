class VSCodeAppMock {
    constructor() {
        this.vscode = acquireVsCodeApi();
        
        // Mock translator
        this.translator = {
            get: (text) => text
        };

        // Mock App UI
        this.appui = {
            showNotification: (msg) => console.log('Notification:', msg),
            setAction: (id, callback) => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener("click", (event) => {
                        event.preventDefault();
                        callback(event);
                    });
                }
            },
            createFriendColor: () => '#000'
        };

        // Setup save button manually
        const saveBtn = document.getElementById("save-sprite-btn");
        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                this.vscode.postMessage({ type: 'save_command' });
                document.getElementById("save-dot").style.display = "none";
            });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'saved') {
                const dot = document.getElementById("save-dot");
                if (dot) dot.style.display = "none";
            }
        });

        // Mock RunWindow
        this.runwindow = {
            updateSprite: () => {},
            updateMap: () => {}
        };

        // Mock Client for saves
        this.client = {
            sendRequest: (msg, callback) => {
                if (msg.name === "write_project_file") {
                    console.log("Intercepted save request:", msg);
                    // Show the dot since file was changed
                    const dot = document.getElementById("save-dot");
                    if (dot) dot.style.display = "block";

                    // Tell VS Code to mark as changed
                    this.vscode.postMessage({
                        type: 'change',
                        data: msg.content, // Could be base64 or JSON
                        properties: msg.properties
                    });
                    
                    if (callback) {
                        callback({ size: msg.content.length });
                    }
                }
            }
        };

        // Mock Project
        this.project = {
            id: 'vscode-project',
            isLocked: () => false,
            lockFile: () => {},
            addPendingChange: (item) => {
                // Determine if item is sprite or map and send to vscode
                if (item && item.frames && item.frames.length > 0) {
                    // It's a sprite
                    const canvas = item.frames[0];
                    const dataUrl = canvas.toDataURL("image/png");
                    const base64 = dataUrl.split(',')[1];
                    this.vscode.postMessage({
                        type: 'save',
                        data: base64
                    });
                } else if (item && item.save) {
                    // It's a map
                    const data = JSON.stringify(item.save());
                    this.vscode.postMessage({
                        type: 'save',
                        data: data
                    });
                }
            },
            removePendingChange: () => {},
            sprite_table: {},
            sprite_list: [],
            map_list: [],
            getSprite: (name) => {
                if (!name) return null;
                return this.project.sprite_table[name] ||
                       this.project.sprite_table[name.replace(/\//g, '-')] ||
                       this.project.sprite_table[name.replace(/-/g, '/')] ||
                       this.project.sprite_list.find(s => s.name === name || s.shortname === name);
            },
            getMap: (name) => this.project.map_list.find(m => m.name === name),
            addListener: () => {},
            notifyListeners: () => {},
            getFullURL: () => "",
            updateSpriteList: () => {
                if (this.mapEditor) this.mapEditor.rebuildSpriteList();
            },
            updateMapList: () => {}
        };
        this.project.app = this;

        console.log("VSCodeAppMock initialized");
    }

    startSpriteEditor(spriteData) {
        if (typeof SpriteEditor === 'undefined') {
            console.error("SpriteEditor not found!");
            return;
        }

        if (!this.spriteEditor) {
            this.spriteEditor = new SpriteEditor(this);
            window.dispatchEvent(new Event('resize'));
        }
        
        const img = new Image();
        img.onload = () => {
            const ps = new ProjectSprite(this.project, "current.png", img.width, img.height);
            let props = spriteData.properties;
            if (!props && img.height > img.width && img.height % img.width === 0) {
                props = { frames: img.height / img.width, fps: 5 };
            }
            ps.load(img, props);
            ps.ready = true;
            if (ps.updateThumbnail) ps.updateThumbnail();
            if (ps.loaded) ps.loaded();
            this.project.sprite_table["current"] = ps;
            this.project.sprite_list.push(ps);
            
            this.spriteEditor.setSelectedItem("current");
        };
        img.src = spriteData.data;
    }

    loadSprites(spritesData) {
        return new Promise((resolve) => {
            this.project.sprite_table = {};
            this.project.sprite_list = [];

            if (!spritesData || Object.keys(spritesData).length === 0) {
                if (this.mapEditor) {
                    this.mapEditor.rebuildSpriteList();
                }
                return resolve();
            }

            const total = Object.keys(spritesData).length;
            let loaded = 0;

            for (let name in spritesData) {
                const img = new Image();
                img.onload = () => {
                    const ps = new ProjectSprite(this.project, name + ".png", img.width, img.height);
                    let props = spritesData[name].properties;
                    if (!props && img.height > img.width && img.height % img.width === 0) {
                        props = { frames: img.height / img.width, fps: 5 };
                    }
                    ps.load(img, props);
                    ps.ready = true;
                    if (ps.updateThumbnail) ps.updateThumbnail();
                    if (ps.loaded) ps.loaded();
                    
                    this.project.sprite_table[name] = ps;
                    if (name.indexOf('/') >= 0) {
                        this.project.sprite_table[name.replace(/\//g, '-')] = ps;
                    }
                    this.project.sprite_list.push(ps);

                    loaded++;
                    if (loaded === total) {
                        if (this.mapEditor) {
                            this.mapEditor.rebuildSpriteList();
                            if (this.mapEditor.mapview) {
                                this.mapEditor.mapview.update();
                            }
                        }
                        resolve();
                    }
                };
                img.src = 'data:image/png;base64,' + spritesData[name].data;
            }
        });
    }

    startMapEditor(mapData) {
        if (typeof MapEditor === 'undefined') {
            console.error("MapEditor not found!");
            return;
        }

        if (!this.mapEditor) {
            this.mapEditor = new MapEditor(this);
            window.dispatchEvent(new Event('resize'));
        }
        
        try {
            const pm = new ProjectMap(this.project, "current");
            pm.load(mapData);
            pm.update();
            pm.updateCanvases();
            
            // Clear existing map list to avoid duplicates
            this.project.map_list = [pm];
            this.project.map_table = { "current": pm };
            
            this.mapEditor.setSelectedMap("current");
            this.mapEditor.rebuildSpriteList();
            this.mapEditor.currentMapUpdated();
        } catch(e) {
            console.error("Failed to parse map JSON", e);
        }
    }
}

// Global initialization
window.mockApp = new VSCodeAppMock();

window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'load') {
        window.mockApp.startSpriteEditor(message);
    } else if (message.type === 'load_sprites') {
        window.mockApp.spritesPromise = window.mockApp.loadSprites(message.sprites);
    } else if (message.type === 'update') {
        if (window.mockApp.spritesPromise) {
            window.mockApp.spritesPromise.then(() => {
                window.mockApp.startMapEditor(message.text);
            });
        } else {
            window.mockApp.startMapEditor(message.text);
        }
    } else if (message.type === 'saved') {
        const dot = document.getElementById("save-dot");
        if (dot) dot.style.display = "none";
    }
});
