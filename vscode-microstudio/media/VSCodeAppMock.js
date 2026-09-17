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

        // Setup save buttons manually
        const saveSpriteBtn = document.getElementById("save-sprite-btn");
        if (saveSpriteBtn) {
            saveSpriteBtn.addEventListener("click", () => {
                if (this.spriteEditor) {
                    this.spriteEditor.checkSave(true);
                }
                this.vscode.postMessage({ type: 'save_command' });
                const dot = document.getElementById("save-dot");
                if (dot) dot.style.display = "none";
            });
        }

        const saveMapBtn = document.getElementById("save-map-btn");
        if (saveMapBtn) {
            saveMapBtn.addEventListener("click", () => {
                if (this.mapEditor) {
                    this.mapEditor.checkSave(true);
                }
                this.vscode.postMessage({ type: 'save_command' });
                const dot = document.getElementById("save-dot");
                if (dot) dot.style.display = "none";
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

                    let content = msg.content;
                    if (typeof content === 'string') {
                        try {
                            content = JSON.stringify(JSON.parse(content), null, 2);
                        } catch(e) {}
                    } else if (typeof content === 'object') {
                        content = JSON.stringify(content, null, 2);
                    }
                    this.lastSentData = content;

                    // Tell VS Code to mark as changed
                    this.vscode.postMessage({
                        type: 'change',
                        data: content,
                        properties: msg.properties
                    });
                    
                    if (callback) {
                        callback({ size: (typeof content === 'string' ? content.length : 0) });
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
                const dot = document.getElementById("save-dot");
                if (dot) dot.style.display = "block";

                // Determine if item is sprite or map and send to vscode
                if (item && item.frames && item.frames.length > 0) {
                    // It's a sprite
                    const canvas = item.frames[0];
                    const dataUrl = canvas.toDataURL("image/png");
                    const base64 = dataUrl.split(',')[1];
                    this.vscode.postMessage({
                        type: 'change',
                        data: base64
                    });
                } else if (item && item.mapview && item.mapview.map) {
                    // It's MapEditor
                    let data = item.mapview.map.save();
                    if (typeof data === 'string') {
                        try {
                            data = JSON.stringify(JSON.parse(data), null, 2);
                        } catch(e) {}
                    } else if (typeof data === 'object') {
                        data = JSON.stringify(data, null, 2);
                    }
                    this.lastSentData = data;
                    this.vscode.postMessage({
                        type: 'change',
                        data: data
                    });
                } else if (item && item.save) {
                    // It's ProjectMap / MicroMap
                    let data = item.save();
                    if (typeof data === 'string') {
                        try {
                            data = JSON.stringify(JSON.parse(data), null, 2);
                        } catch(e) {}
                    } else if (typeof data === 'object') {
                        data = JSON.stringify(data, null, 2);
                    }
                    this.lastSentData = data;
                    this.vscode.postMessage({
                        type: 'change',
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

            const names = Object.keys(spritesData);
            const total = names.length;
            let loaded = 0;

            const checkDone = () => {
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

            for (let name of names) {
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
                    checkDone();
                };
                img.onerror = () => {
                    console.warn("Failed to load sprite:", name);
                    checkDone();
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
        }
        
        try {
            // Check if map is already loaded and mapData matches what we just sent
            if (this.lastSentData && typeof mapData === 'string' && (mapData.trim() === this.lastSentData.trim())) {
                return;
            }

            const pm = new ProjectMap(this.project, "current");
            if (typeof mapData === 'string') {
                try {
                    let parsed = JSON.parse(mapData);
                    if (typeof parsed === 'string') {
                        parsed = JSON.parse(parsed);
                    }
                    mapData = JSON.stringify(parsed);
                } catch(e) {}
            } else if (typeof mapData === 'object') {
                mapData = JSON.stringify(mapData);
            }
            if (!mapData || !mapData.trim() || mapData === '{}') {
                mapData = JSON.stringify({ width: 16, height: 10, block_width: 16, block_height: 16, sprites: [0], data: [] });
            }
            pm.load(mapData);
            pm.update();
            pm.updateCanvases();
            
            // Clear existing map list to avoid duplicates
            this.project.map_list = [pm];
            this.project.map_table = { "current": pm };
            
            this.mapEditor.setSelectedMap("current");
            this.mapEditor.rebuildSpriteList();
            this.mapEditor.currentMapUpdated();

            if (this.mapEditor.mapeditor_splitbar) {
                this.mapEditor.mapeditor_splitbar.setPosition(75, false);
            }

            const refreshView = () => {
                if (this.mapEditor && this.mapEditor.mapview) {
                    if (this.mapEditor.mapeditor_splitbar) {
                        this.mapEditor.mapeditor_splitbar.update();
                    }
                    this.mapEditor.mapview.windowResized();
                    this.mapEditor.mapview.update();
                }
            };

            refreshView();
            setTimeout(refreshView, 50);
            setTimeout(refreshView, 200);
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
