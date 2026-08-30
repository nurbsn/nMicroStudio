import * as vscode from 'vscode';

interface DocItem {
    label: string;
    kind: vscode.CompletionItemKind;
    detail: string;
    doc: string;
    snippet?: string;
}

export class MicroScriptCompletionProvider implements vscode.CompletionItemProvider, vscode.HoverProvider {
    private items: DocItem[] = [
        // Life cycle
        {
            label: 'init',
            kind: vscode.CompletionItemKind.Function,
            detail: 'init = function()',
            doc: 'Funkcja wywoływana jednorazowo przy starcie gry microStudio.',
            snippet: 'init = function()\n\t$0\nend'
        },
        {
            label: 'update',
            kind: vscode.CompletionItemKind.Function,
            detail: 'update = function()',
            doc: 'Główna pętla logiki gry (domyślnie 60 razy na sekundę).',
            snippet: 'update = function()\n\t$0\nend'
        },
        {
            label: 'draw',
            kind: vscode.CompletionItemKind.Function,
            detail: 'draw = function()',
            doc: 'Główna pętla renderowania grafiki na ekranie.',
            snippet: 'draw = function()\n\tscreen.clear()\n\t$0\nend'
        },
        {
            label: 'print',
            kind: vscode.CompletionItemKind.Function,
            detail: 'print(value)',
            doc: 'Wypisuje wartość w konsoli microStudio.',
            snippet: 'print($1)'
        },

        // screen
        {
            label: 'screen.clear',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.clear(color)',
            doc: 'Czyści ekran wybranym kolorem (np. "rgb(0,0,0)", "#111", "rgba(0,0,0,0.5)").',
            snippet: 'screen.clear("${1:#000}")'
        },
        {
            label: 'screen.drawSprite',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.drawSprite(name, x, y, width, height)',
            doc: 'Rysuje Sprite o podanej nazwie na podanych współrzędnych ekranu.',
            snippet: 'screen.drawSprite("${1:sprite_name}", ${2:0}, ${3:0}, ${4:32}, ${5:32})'
        },
        {
            label: 'screen.drawMap',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.drawMap(name, x, y, width, height)',
            doc: 'Rysuje Mapę kafelkową na ekranie.',
            snippet: 'screen.drawMap("${1:map_name}", ${2:0}, ${3:0}, ${4:screen.width}, ${5:screen.height})'
        },
        {
            label: 'screen.fillRect',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.fillRect(x, y, width, height, color)',
            doc: 'Rysuje wypełniony prostokąt.',
            snippet: 'screen.fillRect(${1:0}, ${2:0}, ${3:50}, ${4:50}, "${5:#fff}")'
        },
        {
            label: 'screen.drawRect',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.drawRect(x, y, width, height, color)',
            doc: 'Rysuje obrys prostokąta.',
            snippet: 'screen.drawRect(${1:0}, ${2:0}, ${3:50}, ${4:50}, "${5:#fff}")'
        },
        {
            label: 'screen.fillRound',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.fillRound(x, y, width, height, color)',
            doc: 'Rysuje wypełnione koło / elipsę.',
            snippet: 'screen.fillRound(${1:0}, ${2:0}, ${3:30}, ${4:30}, "${5:#f00}")'
        },
        {
            label: 'screen.drawRound',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.drawRound(x, y, width, height, color)',
            doc: 'Rysuje obrys koła / elipsy.',
            snippet: 'screen.drawRound(${1:0}, ${2:0}, ${3:30}, ${4:30}, "${5:#f00}")'
        },
        {
            label: 'screen.drawLine',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.drawLine(x1, y1, x2, y2, color)',
            doc: 'Rysuje linię między dwoma punktami.',
            snippet: 'screen.drawLine(${1:0}, ${2:0}, ${3:50}, ${4:50}, "${5:#fff}")'
        },
        {
            label: 'screen.drawText',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.drawText(text, x, y, size, color)',
            doc: 'Wyświetla napis na ekranie.',
            snippet: 'screen.drawText("${1:Hello}", ${2:0}, ${3:0}, ${4:20}, "${5:#fff}")'
        },
        {
            label: 'screen.textWidth',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.textWidth(text, size)',
            doc: 'Zwraca szerokość tekstu w pikselach.',
            snippet: 'screen.textWidth("${1:text}", ${2:20})'
        },
        {
            label: 'screen.setAlpha',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.setAlpha(alpha)',
            doc: 'Ustawia globalną przezroczystość rysowania (od 0 do 1).',
            snippet: 'screen.setAlpha(${1:1.0})'
        },
        {
            label: 'screen.setTranslation',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.setTranslation(x, y)',
            doc: 'Przesuwa układ współrzędnych kamery ekranu.',
            snippet: 'screen.setTranslation(${1:x}, ${2:y})'
        },
        {
            label: 'screen.setScale',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.setScale(sx, sy)',
            doc: 'Skaluje układ współrzędnych.',
            snippet: 'screen.setScale(${1:1}, ${2:1})'
        },
        {
            label: 'screen.setRotation',
            kind: vscode.CompletionItemKind.Method,
            detail: 'screen.setRotation(angle)',
            doc: 'Obraca układ współrzędnych o podany kąt w stopniach.',
            snippet: 'screen.setRotation(${1:0})'
        },
        {
            label: 'screen.width',
            kind: vscode.CompletionItemKind.Property,
            detail: 'screen.width',
            doc: 'Szerokość ekranu gry w pikselach wirtualnych.'
        },
        {
            label: 'screen.height',
            kind: vscode.CompletionItemKind.Property,
            detail: 'screen.height',
            doc: 'Wysokość ekranu gry w pikselach wirtualnych.'
        },

        // keyboard
        {
            label: 'keyboard.UP',
            kind: vscode.CompletionItemKind.Property,
            detail: 'keyboard.UP',
            doc: 'Czy strzałka w górę jest wciśnięta (1 lub 0).'
        },
        {
            label: 'keyboard.DOWN',
            kind: vscode.CompletionItemKind.Property,
            detail: 'keyboard.DOWN',
            doc: 'Czy strzałka w dół jest wciśnięta (1 lub 0).'
        },
        {
            label: 'keyboard.LEFT',
            kind: vscode.CompletionItemKind.Property,
            detail: 'keyboard.LEFT',
            doc: 'Czy strzałka w lewo jest wciśnięta (1 lub 0).'
        },
        {
            label: 'keyboard.RIGHT',
            kind: vscode.CompletionItemKind.Property,
            detail: 'keyboard.RIGHT',
            doc: 'Czy strzałka w prawo jest wciśnięta (1 lub 0).'
        },
        {
            label: 'keyboard.SPACE',
            kind: vscode.CompletionItemKind.Property,
            detail: 'keyboard.SPACE',
            doc: 'Czy spacja jest wciśnięta (1 lub 0).'
        },
        {
            label: 'keyboard.ENTER',
            kind: vscode.CompletionItemKind.Property,
            detail: 'keyboard.ENTER',
            doc: 'Czy klawisz Enter jest wciśnięty.'
        },
        {
            label: 'keyboard.A',
            kind: vscode.CompletionItemKind.Property,
            detail: 'keyboard.A',
            doc: 'Stan klawisza A.'
        },
        {
            label: 'keyboard.W',
            kind: vscode.CompletionItemKind.Property,
            detail: 'keyboard.W',
            doc: 'Stan klawisza W.'
        },
        {
            label: 'keyboard.S',
            kind: vscode.CompletionItemKind.Property,
            detail: 'keyboard.S',
            doc: 'Stan klawisza S.'
        },
        {
            label: 'keyboard.D',
            kind: vscode.CompletionItemKind.Property,
            detail: 'keyboard.D',
            doc: 'Stan klawisza D.'
        },

        // mouse & touch
        {
            label: 'mouse.x',
            kind: vscode.CompletionItemKind.Property,
            detail: 'mouse.x',
            doc: 'Współrzędna X kursora myszy na ekranie gry.'
        },
        {
            label: 'mouse.y',
            kind: vscode.CompletionItemKind.Property,
            detail: 'mouse.y',
            doc: 'Współrzędna Y kursora myszy na ekranie gry.'
        },
        {
            label: 'mouse.pressed',
            kind: vscode.CompletionItemKind.Property,
            detail: 'mouse.pressed',
            doc: 'Czy lewy przycisk myszy jest wciśnięty (1 lub 0).'
        },
        {
            label: 'mouse.right',
            kind: vscode.CompletionItemKind.Property,
            detail: 'mouse.right',
            doc: 'Czy prawy przycisk myszy jest wciśnięty.'
        },
        {
            label: 'touch.touching',
            kind: vscode.CompletionItemKind.Property,
            detail: 'touch.touching',
            doc: 'Czy ekran dotykowy jest aktualnie dotykany.'
        },
        {
            label: 'touch.touches',
            kind: vscode.CompletionItemKind.Property,
            detail: 'touch.touches',
            doc: 'Tablica aktywnych punktów dotyku [{x, y, id}, ...].'
        },

        // audio
        {
            label: 'audio.beep',
            kind: vscode.CompletionItemKind.Method,
            detail: 'audio.beep(synthString)',
            doc: 'Odtwarza dźwięk syntezatora microStudio.',
            snippet: 'audio.beep("${1:square;c4;8}")'
        },
        {
            label: 'audio.playSound',
            kind: vscode.CompletionItemKind.Method,
            detail: 'audio.playSound(name, volume, pitch, pan, loop)',
            doc: 'Odtwarza plik dźwiękowy z folderu sounds/.',
            snippet: 'audio.playSound("${1:sound_name}", ${2:1.0})'
        },
        {
            label: 'audio.playMusic',
            kind: vscode.CompletionItemKind.Method,
            detail: 'audio.playMusic(name, volume, loop)',
            doc: 'Odtwarza utwór muzyczny z folderu music/.',
            snippet: 'audio.playMusic("${1:music_name}", ${2:1.0}, ${3:true})'
        },
        {
            label: 'audio.stopMusic',
            kind: vscode.CompletionItemKind.Method,
            detail: 'audio.stopMusic()',
            doc: 'Zatrzymuje aktualnie odtwarzaną muzykę.'
        },

        // system & random
        {
            label: 'system.time',
            kind: vscode.CompletionItemKind.Method,
            detail: 'system.time()',
            doc: 'Zwraca aktualny czas w milisekundach.'
        },
        {
            label: 'system.pause',
            kind: vscode.CompletionItemKind.Method,
            detail: 'system.pause()',
            doc: 'Wstrzymuje wykonywanie gry.'
        },
        {
            label: 'random.next',
            kind: vscode.CompletionItemKind.Method,
            detail: 'random.next()',
            doc: 'Losuje liczbę zmiennoprzecinkową od 0.0 do 1.0.'
        },
        {
            label: 'random.nextInt',
            kind: vscode.CompletionItemKind.Method,
            detail: 'random.nextInt(max)',
            doc: 'Losuje liczbę całkowitą od 0 do max - 1.',
            snippet: 'random.nextInt(${1:10})'
        },

        // PIXI (PixiJS 2D Engine)
        {
            label: 'PIXI.Application',
            kind: vscode.CompletionItemKind.Class,
            detail: 'new PIXI.Application(options)',
            doc: 'Główna aplikacja PixiJS do renderowania 2D WebGL.',
            snippet: 'new PIXI.Application({ width: ${1:800}, height: ${2:600} })'
        },
        {
            label: 'PIXI.Sprite',
            kind: vscode.CompletionItemKind.Class,
            detail: 'new PIXI.Sprite(texture)',
            doc: 'Obiekt Sprite w PixiJS.',
            snippet: 'new PIXI.Sprite(${1:texture})'
        },
        {
            label: 'PIXI.Container',
            kind: vscode.CompletionItemKind.Class,
            detail: 'new PIXI.Container()',
            doc: 'Kontener na obiekty graficzne w drzewie sceny PixiJS.'
        },
        {
            label: 'PIXI.Graphics',
            kind: vscode.CompletionItemKind.Class,
            detail: 'new PIXI.Graphics()',
            doc: 'Kształty wektorowe w PixiJS.'
        },

        // BABYLON (Babylon.js 3D Engine)
        {
            label: 'BABYLON.Engine',
            kind: vscode.CompletionItemKind.Class,
            detail: 'new BABYLON.Engine(canvas, antialias)',
            doc: 'Główny silnik WebGL dla Babylon.js 3D.'
        },
        {
            label: 'BABYLON.Scene',
            kind: vscode.CompletionItemKind.Class,
            detail: 'new BABYLON.Scene(engine)',
            doc: 'Scena 3D w Babylon.js.',
            snippet: 'new BABYLON.Scene(${1:engine})'
        },
        {
            label: 'BABYLON.Vector3',
            kind: vscode.CompletionItemKind.Class,
            detail: 'new BABYLON.Vector3(x, y, z)',
            doc: 'Wektor 3D w przestrzeni (x, y, z).',
            snippet: 'new BABYLON.Vector3(${1:0}, ${2:0}, ${3:0})'
        },
        {
            label: 'BABYLON.MeshBuilder.CreateBox',
            kind: vscode.CompletionItemKind.Method,
            detail: 'BABYLON.MeshBuilder.CreateBox(name, options, scene)',
            doc: 'Tworzy sześcian 3D.',
            snippet: 'BABYLON.MeshBuilder.CreateBox("${1:box}", { size: ${2:1} }, ${3:scene})'
        },
        {
            label: 'BABYLON.MeshBuilder.CreateSphere',
            kind: vscode.CompletionItemKind.Method,
            detail: 'BABYLON.MeshBuilder.CreateSphere(name, options, scene)',
            doc: 'Tworzy kulę 3D.',
            snippet: 'BABYLON.MeshBuilder.CreateSphere("${1:sphere}", { diameter: ${2:1} }, ${3:scene})'
        },

        // M2D / M3D
        {
            label: 'M2D.Scene',
            kind: vscode.CompletionItemKind.Class,
            detail: 'new M2D.Scene()',
            doc: 'Scena 2D w silniku micro2D.'
        },
        {
            label: 'M2D.Camera',
            kind: vscode.CompletionItemKind.Class,
            detail: 'new M2D.Camera(fov, x, y)',
            doc: 'Kamera 2D w silniku micro2D.'
        },
        {
            label: 'M3D.Scene',
            kind: vscode.CompletionItemKind.Class,
            detail: 'new M3D.Scene()',
            doc: 'Scena 3D w silniku micro3D.'
        },

        // Matter.js 2D Physics
        {
            label: 'Matter.Engine.create',
            kind: vscode.CompletionItemKind.Method,
            detail: 'Matter.Engine.create()',
            doc: 'Tworzy silnik fizyki 2D Matter.js.'
        },
        {
            label: 'Matter.Bodies.rectangle',
            kind: vscode.CompletionItemKind.Method,
            detail: 'Matter.Bodies.rectangle(x, y, width, height, options)',
            doc: 'Tworzy prostokątne ciało fizyczne.',
            snippet: 'Matter.Bodies.rectangle(${1:x}, ${2:y}, ${3:width}, ${4:height}, ${5:{ isStatic: false }})'
        },
        {
            label: 'Matter.Bodies.circle',
            kind: vscode.CompletionItemKind.Method,
            detail: 'Matter.Bodies.circle(x, y, radius, options)',
            doc: 'Tworzy okrągłe ciało fizyczne.',
            snippet: 'Matter.Bodies.circle(${1:x}, ${2:y}, ${3:radius}, ${4:{}})'
        },
        {
            label: 'Matter.Composite.add',
            kind: vscode.CompletionItemKind.Method,
            detail: 'Matter.Composite.add(world, body)',
            doc: 'Dodaje ciało do świata fizyki.',
            snippet: 'Matter.Composite.add(${1:engine.world}, ${2:body})'
        }
    ];

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);

        return this.items.map(item => {
            const ci = new vscode.CompletionItem(item.label, item.kind);
            ci.detail = item.detail;
            ci.documentation = new vscode.MarkdownString(item.doc);
            if (item.snippet) {
                ci.insertText = new vscode.SnippetString(item.snippet);
            }
            return ci;
        });
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position, /[\w\.]+/);
        if (!range) return null;

        const word = document.getText(range);
        const match = this.items.find(i => i.label === word || i.label.split('.').pop() === word);
        if (match) {
            const md = new vscode.MarkdownString();
            md.appendCodeblock(match.detail, 'microscript');
            md.appendMarkdown('\n\n' + match.doc);
            return new vscode.Hover(md, range);
        }

        return null;
    }
}
