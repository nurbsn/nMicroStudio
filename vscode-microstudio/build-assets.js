const fs = require('fs');
const path = require('path');

const webapp_js = [
    "/js/languages/microscript/random.js", "/js/languages/microscript/v2/parser.js", "/js/languages/microscript/v2/program.js", "/js/languages/microscript/v2/token.js", "/js/languages/microscript/v2/tokenizer.js", "/js/languages/microscript/microscript.js", "/js/languages/python/python.js", "/js/languages/javascript/javascript.js", "/js/languages/lua/lua.js", "/js/client/client.js", "/js/util/confirm.js", "/js/util/canvas2d.js", "/js/util/regexlib.js", "/js/util/inputvalidator.js", "/js/util/translator.js", "/js/manager.js", "/js/folderview.js", "/js/about/about.js", "/js/doc/documentation.js", "/js/doceditor/doceditor.js", "/js/editor/editor.js", "/js/editor/runwindow.js", "/js/editor/projectaccess.js", "/js/editor/rulercanvas.js", "/js/editor/valuetool.js", "/js/editor/libmanager.js", "/js/options/options.js", "/js/options/tabmanager.js", "/js/options/pluginview.js", "/js/sync/sync.js", "/js/publish/publish.js", "/js/publish/appbuild.js", "/js/explore/explore.js", "/js/explore/projectdetails.js", "/js/user/usersettings.js", "/js/user/translationapp.js", "/js/user/progress.js", "/js/spriteeditor/drawtool.js", "/js/spriteeditor/spritelist.js", "/js/spriteeditor/spriteeditor.js", "/js/spriteeditor/colorpicker.js", "/js/spriteeditor/spriteview.js", "/js/spriteeditor/animationpanel.js", "/js/spriteeditor/autopalette.js", "/js/spriteeditor/sprite.js", "/js/spriteeditor/spriteframe.js", "/js/mapeditor/mapview.js", "/js/mapeditor/mapeditor.js", "/js/mapeditor/tilepicker.js", "/js/mapeditor/map.js", "/js/assets/assetsmanager.js", "/js/assets/modelviewer.js", "/js/assets/imageviewer.js", "/js/assets/textviewer.js", "/js/assets/fontviewer.js", "/js/sound/soundeditor.js", "/js/sound/soundthumbnailer.js", "/js/music/musiceditor.js", "/js/util/undo.js", "/js/util/random.js", "/js/util/splitbar.js", "/js/util/pixelartscaler.js", "/js/runtime/microvm.js", "/js/debug/debug.js", "/js/debug/watch.js", "/js/debug/timemachine.js", "/js/terminal/terminal.js", "/js/project/project.js", "/js/project/projectfolder.js", "/js/project/projectsource.js", "/js/project/projectsprite.js", "/js/project/projectmap.js", "/js/project/projectasset.js", "/js/project/projectsound.js", "/js/project/projectmusic.js", "/js/appui/floatingwindow.js", "/js/appui/appui.js", "/js/app.js", "/js/appstate.js", "/js/tutorial/tutorials.js", "/js/tutorial/tutorial.js", "/js/tutorial/tutorialwindow.js", "/js/tutorial/highlighter.js", "/js/tutorial/tutorialspage.js"
];

const webapp_css = [
    "/css/style.css", "/css/home.css", "/css/doc.css", "/css/code.css", "/css/debug.css", "/css/assets.css", "/css/sprites.css", "/css/sounds.css", "/css/synth.css", "/css/music.css", "/css/maps.css", "/css/publish.css", "/css/explore.css", "/css/options.css", "/css/sync.css", "/css/user.css", "/css/media.css", "/css/terminal.css", "/css/tutorial.css", "/css/md.css", "/css/common.css"
];

const player_js = [
    '/js/util/canvas2d.js', 
    "/js/languages/microscript/random.js", 
    "/js/languages/microscript/v2/tokenizer.js",
    "/js/languages/microscript/v2/token.js",
    "/js/languages/microscript/v2/parser.js",
    "/js/languages/microscript/v2/program.js",
    "/js/languages/microscript/v2/routine.js",
    "/js/languages/microscript/v2/processor.js",
    "/js/languages/microscript/v2/compiler.js",
    "/js/languages/microscript/v2/transpiler.js",
    "/js/languages/microscript/v2/runner.js",
    "/js/languages/microscript/microscript.js",
    "/js/languages/javascript/javascript.js",
    "/js/languages/javascript/runner.js",
    "/js/languages/python/python.js",
    "/js/languages/python/runner.js",
    "/js/languages/lua/lua.js",
    "/js/languages/lua/runner.js",
    "/js/runtime/mpserverconnection.js", 
    "/js/runtime/microvm.js", 
    '/js/runtime/runtime.js', 
    '/js/runtime/watcher.js', 
    '/js/runtime/projectinterface.js', 
    '/js/runtime/timemachine.js', 
    '/js/runtime/screen.js', 
    '/js/runtime/assetmanager.js', 
    '/js/runtime/keyboard.js', 
    '/js/runtime/gamepad.js', 
    '/js/runtime/sprite.js', 
    '/js/runtime/msimage.js', 
    '/js/runtime/map.js', 
    "/js/runtime/audio/audio.js", 
    "/js/runtime/audio/beeper.js", 
    "/js/runtime/audio/sound.js", 
    "/js/runtime/audio/music.js", 
    '/js/play/player.js', 
    '/js/play/playerclient.js'
];

function concatFiles(list, output) {
    let out = '';
    for(let f of list) {
        let p = path.join(__dirname, 'media', f);
        if (fs.existsSync(p)) {
            out += fs.readFileSync(p, 'utf8') + '\n';
        } else {
            console.warn('Missing file: ' + p);
        }
    }
    fs.writeFileSync(path.join(__dirname, 'media', output), out);
    console.log(`Created ${output} (${out.length} bytes)`);
}

concatFiles(webapp_js, 'microstudio_all.js');
concatFiles(webapp_css, 'microstudio_all.css');
concatFiles(player_js, 'microstudio_play.js');
