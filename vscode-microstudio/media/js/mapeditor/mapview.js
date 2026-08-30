this.MapView = (function() {
  function MapView(editor) {
    var _this = this;
    this.editor = editor;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 400;
    this.canvas.height = 400;
    this.map = new MicroMap(24, 16, 16, 16, {});
    
    // Zoom & Pan state
    this.zoom = 1.0;
    this.pan_x = 0;
    this.pan_y = 0;
    this.base_width = 400;
    this.base_height = 400;
    this.space_pressed = false;
    this.is_panning = false;
    this.pan_start_x = 0;
    this.pan_start_y = 0;
    this.minimap_visible = true;

    // Create minimap element
    this.minimap_container = document.createElement("div");
    this.minimap_container.id = "map-minimap-container";
    this.minimap_canvas = document.createElement("canvas");
    this.minimap_canvas.id = "map-minimap";
    this.minimap_canvas.width = 160;
    this.minimap_canvas.height = 100;
    this.minimap_container.appendChild(this.minimap_canvas);

    // Append to wrapper or body when ready
    setTimeout(function() {
      var wrapper = document.getElementById("mapeditor-wrapper") || document.getElementById("mapeditor");
      if (wrapper && !document.getElementById("map-minimap-container")) {
        wrapper.appendChild(_this.minimap_container);
      }
    }, 100);

    // Minimap interaction (click & drag to pan viewport)
    this.minimap_dragging = false;
    this.minimap_canvas.addEventListener("mousedown", function(e) {
      _this.minimap_dragging = true;
      _this.panFromMinimap(e);
      e.stopPropagation();
      e.preventDefault();
    });
    window.addEventListener("mousemove", function(e) {
      if (_this.minimap_dragging) {
        _this.panFromMinimap(e);
        e.stopPropagation();
        e.preventDefault();
      }
    });
    window.addEventListener("mouseup", function(e) {
      _this.minimap_dragging = false;
    });

    // Spacebar for panning
    window.addEventListener("keydown", function(e) {
      if (e.code === "Space" && document.activeElement && document.activeElement.tagName !== "INPUT") {
        _this.space_pressed = true;
        _this.canvas.style.cursor = "grab";
      }
    });
    window.addEventListener("keyup", function(e) {
      if (e.code === "Space") {
        _this.space_pressed = false;
        _this.canvas.style.cursor = "crosshair";
      }
    });

    // Touch events
    this.canvas.addEventListener("touchstart", function(event) {
      if (event.touches != null && event.touches[0] != null) {
        event.preventDefault();
        event.touches[0].stopPropagation = function() { return event.stopPropagation(); };
        return _this.mouseDown(event.touches[0]);
      }
    });
    document.addEventListener("touchmove", function(event) {
      if (event.touches != null && event.touches[0] != null) {
        return _this.mouseMove(event.touches[0]);
      }
    });
    document.addEventListener("touchend", function() { return _this.mouseUp(); });
    this.canvas.addEventListener("touchcancel", function() { return _this.mouseOut(); });

    // Mouse events on main canvas
    this.canvas.addEventListener("mousedown", function(event) {
      return _this.mouseDown(event);
    });
    this.canvas.addEventListener("mousemove", function(event) {
      return _this.mouseMove(event);
    });
    this.canvas.addEventListener("mouseout", function(event) {
      return _this.mouseOut(event);
    });
    document.addEventListener("mouseup", function(event) {
      return _this.mouseUp(event);
    });
    this.canvas.addEventListener("contextmenu", function(event) {
      return event.preventDefault();
    });

    // Mouse Wheel Zoom
    var handleWheel = function(e) {
      e.preventDefault();
      var zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      _this.setZoom(_this.zoom * zoomFactor, e.clientX, e.clientY);
    };
    this.canvas.addEventListener("wheel", handleWheel, { passive: false });

    window.addEventListener("resize", function() {
      return _this.windowResized();
    });

    this.editable = false;
    this.sprite = "icon";
    this.cells_drawn = 0;
    this.updateLoop();
  }

  MapView.prototype.setSprite = function(sprite) {
    this.sprite = sprite;
  };

  MapView.prototype.setZoom = function(newZoom, mouseX, mouseY) {
    var oldZoom = this.zoom;
    this.zoom = Math.max(0.15, Math.min(10.0, newZoom));
    
    var c = this.canvas.parentElement;
    if (c && mouseX != null && mouseY != null) {
      var rect = c.getBoundingClientRect();
      var mx = mouseX - rect.left - c.clientWidth / 2;
      var my = mouseY - rect.top - c.clientHeight / 2;
      var scaleChange = this.zoom / oldZoom;
      this.pan_x = mx - (mx - this.pan_x) * scaleChange;
      this.pan_y = my - (my - this.pan_y) * scaleChange;
    }
    
    this.windowResized();
    this.updateZoomLabel();
    this.update();
  };

  MapView.prototype.zoomIn = function() {
    this.setZoom(this.zoom * 1.25);
  };

  MapView.prototype.zoomOut = function() {
    this.setZoom(this.zoom / 1.25);
  };

  MapView.prototype.zoomReset = function() {
    this.zoom = 1.0;
    this.pan_x = 0;
    this.pan_y = 0;
    this.windowResized();
    this.updateZoomLabel();
    this.update();
  };

  MapView.prototype.zoomFit = function() {
    this.zoom = 1.0;
    this.pan_x = 0;
    this.pan_y = 0;
    this.windowResized();
    this.updateZoomLabel();
    this.update();
  };

  MapView.prototype.toggleMinimap = function() {
    this.minimap_visible = !this.minimap_visible;
    if (this.minimap_container) {
      this.minimap_container.style.display = this.minimap_visible ? "block" : "none";
    }
    this.update();
  };

  MapView.prototype.updateZoomLabel = function() {
    var label = document.getElementById("map-zoom-label");
    if (label) {
      label.textContent = Math.round(this.zoom * 100) + "%";
    }
  };

  MapView.prototype.panFromMinimap = function(e) {
    if (!this.minimap_canvas || !this.map) return;
    var rect = this.minimap_canvas.getBoundingClientRect();
    var clickX = e.clientX - rect.left;
    var clickY = e.clientY - rect.top;
    
    var normX = clickX / this.minimap_canvas.width;
    var normY = clickY / this.minimap_canvas.height;
    
    var c = this.canvas.parentElement;
    if (!c) return;

    // Center main map view on clicked tile
    this.pan_x = (0.5 - normX) * this.canvas.width;
    this.pan_y = (0.5 - normY) * this.canvas.height;
    
    this.updateCanvasPosition();
    this.update();
  };

  MapView.prototype.updateCanvasPosition = function() {
    var c = this.canvas.parentElement;
    if (!c) return;
    var left = Math.round((c.clientWidth - this.canvas.width) / 2 + this.pan_x);
    var top = Math.round((c.clientHeight - this.canvas.height) / 2 + this.pan_y);
    this.canvas.style.position = "absolute";
    this.canvas.style.left = left + "px";
    this.canvas.style.top = top + "px";
    this.canvas.style.margin = "0px";
  };

  MapView.prototype.windowResized = function() {
    var c = this.canvas.parentElement;
    if (c == null || c.clientWidth <= 0) return;

    var w = c.clientWidth - 40;
    var h = c.clientHeight - 40;
    var mapPixelW = this.map.width * this.map.block_width;
    var mapPixelH = this.map.height * this.map.block_height;
    var ratio = Math.min(w / mapPixelW, h / mapPixelH);
    
    this.base_width = Math.floor(ratio * mapPixelW);
    this.base_height = Math.floor(ratio * mapPixelH);
    
    var scaledW = Math.max(16, Math.floor(this.base_width * this.zoom));
    var scaledH = Math.max(16, Math.floor(this.base_height * this.zoom));
    
    if (scaledW !== this.canvas.width || scaledH !== this.canvas.height) {
      this.canvas.width = scaledW;
      this.canvas.height = scaledH;
    }
    
    this.updateCanvasPosition();
    this.update();
  };

  MapView.prototype.updateLoop = function() {
    var _this = this;
    requestAnimationFrame(function() {
      return _this.updateLoop();
    });
    if (this.needs_update) {
      this.needs_update = false;
      return this.update();
    }
  };

  MapView.prototype.update = function() {
    var c, context, hblock, i, k, l, m, n, ref, ref1, ref2, ref3, th, tw, underlay, wblock;
    context = this.canvas.getContext("2d");
    if (this.editor.background_color_picker != null) {
      c = this.editor.background_color_picker.color;
      context.fillStyle = c;
    } else {
      context.fillStyle = "#000";
    }
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    context.imageSmoothingEnabled = false;

    if (this.editor.map_underlay != null) {
      underlay = this.editor.app.project.getMap(this.editor.map_underlay);
      if (underlay != null) {
        underlay.update();
        context.globalAlpha = 0.3;
        underlay.draw(context, 0, 0, this.canvas.width, this.canvas.height);
        context.globalAlpha = 1;
      }
    }

    wblock = this.canvas.width / this.map.width;
    hblock = this.canvas.height / this.map.height;

    // Grid lines
    context.lineWidth = 1;
    context.strokeStyle = "rgba(0,0,0,.15)";
    for (i = k = 0, ref = this.map.width; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
      context.beginPath();
      context.moveTo(i * wblock + 0.25, 0);
      context.lineTo(i * wblock + 0.5, this.canvas.height);
      context.stroke();
    }
    for (i = l = 0, ref1 = this.map.height; 0 <= ref1 ? l <= ref1 : l >= ref1; i = 0 <= ref1 ? ++l : --l) {
      context.beginPath();
      context.moveTo(0, i * hblock + 0.25);
      context.lineTo(this.canvas.width, i * hblock + 0.5);
      context.stroke();
    }
    context.strokeStyle = "rgba(255,255,255,.15)";
    for (i = m = 0, ref2 = this.map.width; 0 <= ref2 ? m <= ref2 : m >= ref2; i = 0 <= ref2 ? ++m : --m) {
      context.beginPath();
      context.moveTo(i * wblock - 0.25, 0);
      context.lineTo(i * wblock - 0.25, this.canvas.height);
      context.stroke();
    }
    for (i = n = 0, ref3 = this.map.height; 0 <= ref3 ? n <= ref3 : n >= ref3; i = 0 <= ref3 ? ++n : --n) {
      context.beginPath();
      context.moveTo(0, i * hblock - 0.25);
      context.lineTo(this.canvas.width, i * hblock - 0.25);
      context.stroke();
    }

    // Draw Map content
    this.map.update();
    this.map.draw(context, 0, 0, this.canvas.width, this.canvas.height);
    if (this.map.animated != null && this.map.animated.length > 0) {
      this.needs_update = true;
    }

    // Hover box / cursor
    if (this.mouse_over && !this.is_panning) {
      tw = 1;
      th = 1;
      if (this.editor.tilepicker.selection != null) {
        tw = this.editor.tilepicker.selection.w;
        th = this.editor.tilepicker.selection.h;
      }
      context.strokeStyle = "#000";
      context.lineWidth = 4;
      context.beginPath();
      context.rect(this.mouse_x * wblock, this.mouse_y * hblock, wblock * tw, hblock * th);
      context.stroke();
      context.strokeStyle = "#FFF";
      context.lineWidth = 2;
      context.stroke();
    }

    // Render Minimap
    this.updateMinimap();
  };

  MapView.prototype.updateMinimap = function() {
    if (!this.minimap_canvas || !this.minimap_visible || !this.map) return;
    var mCtx = this.minimap_canvas.getContext("2d");
    var mw = this.minimap_canvas.width;
    var mh = this.minimap_canvas.height;
    
    mCtx.fillStyle = "#111";
    mCtx.fillRect(0, 0, mw, mh);
    
    // Draw map tiles scaled on minimap
    this.map.draw(mCtx, 0, 0, mw, mh);

    // Calculate viewport rectangle
    var c = this.canvas.parentElement;
    if (c && c.clientWidth > 0 && this.canvas.width > 0) {
      var viewLeft = -this.pan_x + (this.canvas.width - c.clientWidth) / 2;
      var viewTop = -this.pan_y + (this.canvas.height - c.clientHeight) / 2;
      var viewW = c.clientWidth;
      var viewH = c.clientHeight;

      var rx = (viewLeft / this.canvas.width) * mw;
      var ry = (viewTop / this.canvas.height) * mh;
      var rw = (viewW / this.canvas.width) * mw;
      var rh = (viewH / this.canvas.height) * mh;

      mCtx.fillStyle = "rgba(0, 200, 255, 0.2)";
      mCtx.fillRect(rx, ry, rw, rh);
      mCtx.strokeStyle = "#00d2ff";
      mCtx.lineWidth = 2;
      mCtx.strokeRect(rx, ry, rw, rh);
    }
  };

  MapView.prototype.mouseDown = function(event) {
    if (event.button === 1 || (event.button === 0 && this.space_pressed)) {
      this.is_panning = true;
      this.pan_start_x = event.clientX - this.pan_x;
      this.pan_start_y = event.clientY - this.pan_y;
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (!this.editable) {
      return;
    }
    this.mousepressed = true;
    this.mode = event.button === 2 ? "erase" : "draw";
    if (this.map.undo == null) {
      this.map.undo = new Undo();
    }
    if (this.map.undo.empty()) {
      this.map.undo.pushState(this.map.clone());
    }
    return this.mouseMove(event, true);
  };

  MapView.prototype.mouseMove = function(event, force) {
    var b, clickedSprite, i, j, k, l, min, ref, ref1, s, sel, x, y;
    if (force == null) {
      force = false;
    }

    if (this.is_panning) {
      this.pan_x = event.clientX - this.pan_start_x;
      this.pan_y = event.clientY - this.pan_start_y;
      this.updateCanvasPosition();
      this.update();
      return false;
    }

    if (!this.editable) {
      return;
    }

    b = this.canvas.getBoundingClientRect();
    x = event.clientX - b.left;
    y = event.clientY - b.top;
    x = Math.floor(x / this.canvas.width * this.map.width);
    y = Math.floor(y / this.canvas.height * this.map.height);
    this.mouse_over = true;

    if (x !== this.mouse_x || y !== this.mouse_y) {
      this.mouse_x = x;
      this.mouse_y = y;
      this.update();
      this.editor.setCoordinates(x, this.map.height - 1 - y);
    } else if (!force) {
      return false;
    }

    if (this.mousepressed) {
      this.cells_drawn += 1;
      clickedSprite = this.map.get(x, this.map.height - 1 - y);
      if (this.editor.tilepicker.selection != null && this.mode === "draw") {
        sel = this.editor.tilepicker.selection;
        if (event.shiftKey) {
          this.flood_x = x;
          this.flood_y = y;
          this.floodFillMap(clickedSprite, this.sprite, x, y);
        } else {
          for (i = k = 0, ref = sel.w - 1; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
            for (j = l = 0, ref1 = sel.h - 1; 0 <= ref1 ? l <= ref1 : l >= ref1; j = 0 <= ref1 ? ++l : --l) {
              s = this.sprite + ":" + (sel.x + i) + "," + (sel.y + j);
              this.map.set(x + i, this.map.height - 1 - y - j, s);
            }
          }
        }
      } else {
        s = this.mode === "draw" ? this.sprite : null;
        if (event.shiftKey) {
          this.flood_x = x;
          this.flood_y = y;
          this.floodFillMap(clickedSprite, s, x, y);
        } else {
          this.map.set(x, this.map.height - 1 - y, s);
        }
      }
      this.update();
      this.editor.mapChanged();
    }
    return false;
  };

  MapView.prototype.mouseUp = function(event) {
    if (this.is_panning) {
      this.is_panning = false;
      this.canvas.style.cursor = this.space_pressed ? "grab" : "crosshair";
    }
    if (this.mousepressed) {
      this.map.undo.pushState(this.map.clone());
    }
    return this.mousepressed = false;
  };

  MapView.prototype.mouseOut = function(event) {
    if (this.is_panning) {
      this.is_panning = false;
    }
    this.mouse_over = false;
    this.update();
    return this.editor.setCoordinates(-1, -1);
  };

  MapView.prototype.floodFillMap = function(clickedSprite, fillSprite, xs, ys) {
    var clickSprite, s, sel, x, y;
    clickSprite = this.map.get(xs, this.map.height - 1 - ys);
    if (clickSprite !== clickedSprite) {
      return;
    }
    if (typeof clickSprite === "string") {
      clickSprite = clickSprite.split(":")[0];
    }
    if (clickSprite === fillSprite) {
      return;
    }
    if (xs < 0 || xs > this.map.width - 1 || ys < 0 || ys > this.map.height - 1) {
      return;
    }
    sel = this.editor.tilepicker.selection;
    if (sel == null || !fillSprite) {
      this.map.set(xs, this.map.height - 1 - ys, fillSprite);
    } else {
      x = sel.x + (xs - this.flood_x + this.map.width) % sel.w;
      y = sel.y + (ys - this.flood_y + this.map.height) % sel.h;
      s = fillSprite + ":" + x + "," + y;
      this.map.set(xs, this.map.height - 1 - ys, s);
    }
    this.floodFillMap(clickedSprite, fillSprite, xs - 1, ys);
    this.floodFillMap(clickedSprite, fillSprite, xs, ys - 1);
    this.floodFillMap(clickedSprite, fillSprite, xs, ys + 1);
    return this.floodFillMap(clickedSprite, fillSprite, xs + 1, ys);
  };

  MapView.prototype.setMap = function(map) {
    this.map = map;
    this.windowResized();
    return this.update();
  };

  return MapView;
})();
