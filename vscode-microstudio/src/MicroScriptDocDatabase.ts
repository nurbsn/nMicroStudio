import * as vscode from 'vscode';

export interface ParamDoc {
    name: string;
    doc: string;
    type?: string;
    optional?: boolean;
}

export interface ApiDocItem {
    label: string;
    kind: vscode.CompletionItemKind;
    detail: string;
    doc: string;
    snippet?: string;
    parameters?: ParamDoc[];
    returns?: string;
    example?: string;
    category: 'lifecycle' | 'screen' | 'audio' | 'input' | 'storage' | 'system' | 'math' | 'library';
    libraryId?: string;
}

export const BUILTIN_API_DATABASE: ApiDocItem[] = [
    // --- LIFECYCLE & CORE ---
    {
        label: 'init',
        kind: vscode.CompletionItemKind.Function,
        detail: 'init = function()',
        doc: '🎯 **Główna funkcja inicjalizująca gry**\n\nWywoływana automatycznie jednorazowo przy uruchomieniu projektu w microStudio. Służy do konfiguracji początkowych zmiennych, ładowania zasobów i tworzenia obiektów.',
        snippet: 'init = function()\n\t$0\nend',
        category: 'lifecycle',
        example: 'init = function()\n  player_x = 0\n  player_y = 0\n  score = 0\nend'
    },
    {
        label: 'update',
        kind: vscode.CompletionItemKind.Function,
        detail: 'update = function()',
        doc: '⚙️ **Główna pętla logiki gry**\n\nWywoływana cyklicznie 60 razy na sekundę (60 FPS). Odpowiada za obliczenia fizyki, obsługę sterowania (`keyboard`, `touch`, `mouse`, `gamepad`), wykrywanie kolizji i zmianę stanu gry.',
        snippet: 'update = function()\n\t$0\nend',
        category: 'lifecycle',
        example: 'update = function()\n  if keyboard.LEFT then player_x -= 2 end\n  if keyboard.RIGHT then player_x += 2 end\nend'
    },
    {
        label: 'draw',
        kind: vscode.CompletionItemKind.Function,
        detail: 'draw = function()',
        doc: '🎨 **Główna pętla renderowania**\n\nWywoływana przy każdej klatce animacji przed odświeżeniem ekranu. Służy do rysowania tła, sprajtów, map, tekstu i interfejsu.',
        snippet: 'draw = function()\n\tscreen.clear()\n\t$0\nend',
        category: 'lifecycle',
        example: 'draw = function()\n  screen.clear("#222")\n  screen.drawSprite("player", player_x, player_y, 32, 32)\n  screen.drawText("Wynik: " + score, 0, 80, 16, "#fff")\nend'
    },
    {
        label: 'serverInit',
        kind: vscode.CompletionItemKind.Function,
        detail: 'serverInit = function()',
        doc: '🌐 **Inicjalizacja serwera gry wieloosobowej**\n\nWywoływana jednorazowo przy starcie instancji serwerowej gry sieciowej.',
        snippet: 'serverInit = function()\n\t$0\nend',
        category: 'lifecycle'
    },
    {
        label: 'serverUpdate',
        kind: vscode.CompletionItemKind.Function,
        detail: 'serverUpdate = function()',
        doc: '🌐 **Pętla aktualizacji serwera gry wieloosobowej**\n\nWywoływana w stałych odstępach czasu po stronie serwera microStudio.',
        snippet: 'serverUpdate = function()\n\t$0\nend',
        category: 'lifecycle'
    },
    {
        label: 'print',
        kind: vscode.CompletionItemKind.Function,
        detail: 'print(value)',
        doc: '🖨️ **Wypisuje wartość w konsoli**\n\nWyświetla tekst, liczbę lub zrzut obiektu/struktury w konsoli microStudio.',
        snippet: 'print($1)',
        parameters: [{ name: 'value', doc: 'Wartość lub tekst do wyświetlenia w konsoli.' }],
        category: 'system'
    },
    {
        label: 'sleep',
        kind: vscode.CompletionItemKind.Function,
        detail: 'sleep(ms)',
        doc: '⏳ **Wstrzymuje wykonanie asynchroniczne**\n\nCzeka określoną liczbę milisekund (wspierane w środowisku microStudio).',
        snippet: 'sleep(${1:1000})',
        parameters: [{ name: 'ms', doc: 'Liczba milisekund do odczekania.' }],
        category: 'system'
    },

    // --- SCREEN & GRAPHICS ---
    {
        label: 'screen.width',
        kind: vscode.CompletionItemKind.Property,
        detail: 'screen.width',
        doc: '📏 **Szerokość obszaru widocznego ekranu** w jednostkach współrzędnych microStudio (zależna od proporcji `aspect` i rozmiaru okna).',
        category: 'screen'
    },
    {
        label: 'screen.height',
        kind: vscode.CompletionItemKind.Property,
        detail: 'screen.height',
        doc: '📐 **Wysokość obszaru widocznego ekranu** w jednostkach współrzędnych microStudio (standardowo od `-screen.height/2` do `screen.height/2`).',
        category: 'screen'
    },
    {
        label: 'screen.clear',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.clear(color)',
        doc: '🧹 **Czyści ekran wybranym kolorem**\n\nZamalowuje cały bufor ekranu jednolitym kolorem. Najlepiej wywoływać na samym początku funkcji `draw()`.',
        snippet: 'screen.clear("${1:#000}")',
        parameters: [{ name: 'color', doc: 'Kolor tła jako nazwa ("black"), HEX ("#1a1a24"), RGB ("rgb(20,20,30)") lub RGBA.', type: 'string', optional: true }],
        example: 'screen.clear("#1a1a24")',
        category: 'screen'
    },
    {
        label: 'screen.setColor',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.setColor(color)',
        doc: '🎨 **Ustawia aktywny kolor rysowania**\n\nWszystkie kolejne operacje wektorowe (prostokąty, koła, linie, tekst) będą korzystać z tego koloru, o ile nie zostanie podany bezpośrednio w metodzie.',
        snippet: 'screen.setColor("${1:#ffffff}")',
        parameters: [{ name: 'color', doc: 'Kolor do ustawienia (np. "#fff", "rgb(255,0,0)").', type: 'string' }],
        category: 'screen'
    },
    {
        label: 'screen.setAlpha',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.setAlpha(alpha)',
        doc: '👻 **Ustawia globalną przezroczystość (Alfa)**\n\nWpływa na przezroczystość wszystkich kolejno rysowanych elementów.',
        snippet: 'screen.setAlpha(${1:0.5})',
        parameters: [{ name: 'alpha', doc: 'Wartość przezroczystości od 0.0 (niewidoczny) do 1.0 (pełna widoczność).', type: 'number' }],
        category: 'screen'
    },
    {
        label: 'screen.drawSprite',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.drawSprite(name, x, y, width, height, frame)',
        doc: '🖼️ **Rysuje Sprite (grafikę) na ekranie**\n\nRysuje obrazek o podanej nazwie z folderu `sprites/`.',
        snippet: 'screen.drawSprite("${1:sprite_name}", ${2:0}, ${3:0}, ${4:32}, ${5:32})',
        parameters: [
            { name: 'name', doc: 'Nazwa pliku sprite bez rozszerzenia (np. "player", "enemies/goblin").', type: 'string' },
            { name: 'x', doc: 'Współrzędna X środka sprite (lub punktu kotwicy).', type: 'number' },
            { name: 'y', doc: 'Współrzędna Y środka sprite.', type: 'number' },
            { name: 'width', doc: 'Szerokość do narysowania (opcjonalna, domyślnie oryginalny rozmiar).', type: 'number', optional: true },
            { name: 'height', doc: 'Wysokość do narysowania (opcjonalna, domyślnie oryginalny rozmiar).', type: 'number', optional: true },
            { name: 'frame', doc: 'Numer klatki animacji (opcjonalny, od 0 do N-1).', type: 'number', optional: true }
        ],
        example: 'screen.drawSprite("player", player_x, player_y, 32, 32, current_frame)',
        category: 'screen'
    },
    {
        label: 'screen.drawMap',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.drawMap(name, x, y, width, height)',
        doc: '🗺️ **Rysuje mapę kafelkową**\n\nRysuje siatkę mapy utworzoną w edytorze map (`maps/*.json`).',
        snippet: 'screen.drawMap("${1:map_name}", ${2:0}, ${3:0}, ${4:screen.width}, ${5:screen.height})',
        parameters: [
            { name: 'name', doc: 'Nazwa mapy z katalogu maps/ (np. "level1").', type: 'string' },
            { name: 'x', doc: 'Pozycja X środka lub kotwicy mapy.', type: 'number' },
            { name: 'y', doc: 'Pozycja Y mapy.', type: 'number' },
            { name: 'width', doc: 'Szerokość renderowanego obszaru.', type: 'number', optional: true },
            { name: 'height', doc: 'Wysokość renderowanego obszaru.', type: 'number', optional: true }
        ],
        category: 'screen'
    },
    {
        label: 'screen.fillRect',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.fillRect(x, y, width, height, color)',
        doc: '⬛ **Rysuje wypełniony prostokąt**',
        snippet: 'screen.fillRect(${1:0}, ${2:0}, ${3:50}, ${4:50}, "${5:#ffffff}")',
        parameters: [
            { name: 'x', doc: 'Współrzędna X środka prostokąta.', type: 'number' },
            { name: 'y', doc: 'Współrzędna Y środka prostokąta.', type: 'number' },
            { name: 'width', doc: 'Szerokość prostokąta.', type: 'number' },
            { name: 'height', doc: 'Wysokość prostokąta.', type: 'number' },
            { name: 'color', doc: 'Kolor wypełnienia (opcjonalny, np. "#ff0000").', type: 'string', optional: true }
        ],
        category: 'screen'
    },
    {
        label: 'screen.drawRect',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.drawRect(x, y, width, height, color)',
        doc: '🔲 **Rysuje obrys prostokąta**',
        snippet: 'screen.drawRect(${1:0}, ${2:0}, ${3:50}, ${4:50}, "${5:#ffffff}")',
        parameters: [
            { name: 'x', doc: 'Współrzędna X środka prostokąta.', type: 'number' },
            { name: 'y', doc: 'Współrzędna Y środka prostokąta.', type: 'number' },
            { name: 'width', doc: 'Szerokość prostokąta.', type: 'number' },
            { name: 'height', doc: 'Wysokość prostokąta.', type: 'number' },
            { name: 'color', doc: 'Kolor obrysu.', type: 'string', optional: true }
        ],
        category: 'screen'
    },
    {
        label: 'screen.fillRound',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.fillRound(x, y, width, height, color)',
        doc: '🔴 **Rysuje wypełnione koło lub elipsę**',
        snippet: 'screen.fillRound(${1:0}, ${2:0}, ${3:30}, ${4:30}, "${5:#ff0000}")',
        parameters: [
            { name: 'x', doc: 'Współrzędna X środka koła/elipsy.', type: 'number' },
            { name: 'y', doc: 'Współrzędna Y środka koła/elipsy.', type: 'number' },
            { name: 'width', doc: 'Średnica pozioma (szerokość).', type: 'number' },
            { name: 'height', doc: 'Średnica pionowa (wysokość).', type: 'number' },
            { name: 'color', doc: 'Kolor wypełnienia.', type: 'string', optional: true }
        ],
        category: 'screen'
    },
    {
        label: 'screen.drawRound',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.drawRound(x, y, width, height, color)',
        doc: '⭕ **Rysuje obrys koła lub elipsy**',
        snippet: 'screen.drawRound(${1:0}, ${2:0}, ${3:30}, ${4:30}, "${5:#ff0000}")',
        parameters: [
            { name: 'x', doc: 'Współrzędna X środka.', type: 'number' },
            { name: 'y', doc: 'Współrzędna Y środka.', type: 'number' },
            { name: 'width', doc: 'Średnica pozioma.', type: 'number' },
            { name: 'height', doc: 'Średnica pionowa.', type: 'number' },
            { name: 'color', doc: 'Kolor obrysu.', type: 'string', optional: true }
        ],
        category: 'screen'
    },
    {
        label: 'screen.drawLine',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.drawLine(x1, y1, x2, y2, color)',
        doc: '📏 **Rysuje odcinek linii między dwoma punktami**',
        snippet: 'screen.drawLine(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2}, "${5:#ffffff}")',
        parameters: [
            { name: 'x1', doc: 'Początkowa współrzędna X.', type: 'number' },
            { name: 'y1', doc: 'Początkowa współrzędna Y.', type: 'number' },
            { name: 'x2', doc: 'Końcowa współrzędna X.', type: 'number' },
            { name: 'y2', doc: 'Końcowa współrzędna Y.', type: 'number' },
            { name: 'color', doc: 'Kolor linii.', type: 'string', optional: true }
        ],
        category: 'screen'
    },
    {
        label: 'screen.drawPolygon',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.drawPolygon(x1, y1, x2, y2, x3, y3, ...)',
        doc: '📐 **Rysuje obrys wielokąta o dowolnej liczbie wierzchołków**',
        snippet: 'screen.drawPolygon(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2}, ${5:x3}, ${6:y3})',
        parameters: [
            { name: 'points', doc: 'Kolejne pary współrzędnych wierzchołków (x1, y1, x2, y2, x3, y3...).', type: 'number...' }
        ],
        category: 'screen'
    },
    {
        label: 'screen.fillPolygon',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.fillPolygon(x1, y1, x2, y2, x3, y3, ...)',
        doc: '🔺 **Rysuje wypełniony wielokąt**',
        snippet: 'screen.fillPolygon(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2}, ${5:x3}, ${6:y3})',
        parameters: [
            { name: 'points', doc: 'Kolejne pary współrzędnych wierzchołków (x1, y1, x2, y2, x3, y3...).', type: 'number...' }
        ],
        category: 'screen'
    },
    {
        label: 'screen.drawText',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.drawText(text, x, y, size, color)',
        doc: '✍️ **Wypisuje tekst na ekranie**\n\nRysuje tekst w podanym punkcie ekranu.',
        snippet: 'screen.drawText("${1:Hello World}", ${2:0}, ${3:0}, ${4:20}, "${5:#ffffff}")',
        parameters: [
            { name: 'text', doc: 'Treść tekstu do narysowania.', type: 'string' },
            { name: 'x', doc: 'Współrzędna X tekstu.', type: 'number' },
            { name: 'y', doc: 'Współrzędna Y tekstu.', type: 'number' },
            { name: 'size', doc: 'Rozmiar czcionki (domyślnie ok. 12).', type: 'number', optional: true },
            { name: 'color', doc: 'Kolor tekstu.', type: 'string', optional: true }
        ],
        example: 'screen.drawText("PUNKTY: " + score, 0, 80, 20, "#ff0")',
        category: 'screen'
    },
    {
        label: 'screen.textWidth',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.textWidth(text, size)',
        doc: '📏 **Oblicza szerokość tekstu w pikselach ekranu**\n\nPrzydatne do centrowania lub wyrównywania napisów.',
        snippet: 'screen.textWidth("${1:Tekst}", ${2:20})',
        parameters: [
            { name: 'text', doc: 'Tekst do zmierzenia.', type: 'string' },
            { name: 'size', doc: 'Rozmiar czcionki.', type: 'number', optional: true }
        ],
        returns: 'number (szerokość tekstu w jednostkach microStudio)',
        category: 'screen'
    },
    {
        label: 'screen.setFont',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.setFont(fontName)',
        doc: '🔤 **Ustawia aktywną czcionkę** dla kolejnych wywołań `screen.drawText()`.',
        snippet: 'screen.setFont("${1:BitCell}")',
        parameters: [{ name: 'fontName', doc: 'Nazwa czcionki (np. "BitCell", "sans-serif").', type: 'string' }],
        category: 'screen'
    },
    {
        label: 'screen.setDrawAnchor',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.setDrawAnchor(x, y)',
        doc: '⚓ **Ustawia punkt kotwicy (punkt odniesienia) dla rysowania**\n\n- `(0, 0)` – środek (domyślny w microStudio),\n- `(-1, -1)` – lewy dolny róg,\n- `(1, 1)` – prawy górny róg,\n- `(-1, 1)` – lewy górny róg.',
        snippet: 'screen.setDrawAnchor(${1:0}, ${2:0})',
        parameters: [
            { name: 'x', doc: 'Kotwica w osi X (od -1 lewo do 1 prawo, 0 środek).', type: 'number' },
            { name: 'y', doc: 'Kotwica w osi Y (od -1 dół do 1 góra, 0 środek).', type: 'number' }
        ],
        category: 'screen'
    },
    {
        label: 'screen.setTranslation',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.setTranslation(x, y)',
        doc: '🔄 **Przesuwa układ współrzędnych (kamera)**\n\nPozwala na łatwe stworzenie kamery śledzącej gracza.',
        snippet: 'screen.setTranslation(${1:-player_x}, ${2:-player_y})',
        parameters: [
            { name: 'x', doc: 'Przesunięcie w osi X.', type: 'number' },
            { name: 'y', doc: 'Przesunięcie w osi Y.', type: 'number' }
        ],
        example: 'screen.setTranslation(-camera_x, -camera_y)',
        category: 'screen'
    },
    {
        label: 'screen.setScale',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.setScale(scaleX, scaleY)',
        doc: '🔍 **Skaluje widok ekranu (zoom)**',
        snippet: 'screen.setScale(${1:1.5}, ${2:1.5})',
        parameters: [
            { name: 'scaleX', doc: 'Współczynnik skali X (1.0 = normalny).', type: 'number' },
            { name: 'scaleY', doc: 'Współczynnik skali Y.', type: 'number', optional: true }
        ],
        category: 'screen'
    },
    {
        label: 'screen.setRotation',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.setRotation(angle)',
        doc: '💫 **Obraca układ współrzędnych ekranu**',
        snippet: 'screen.setRotation(${1:angle})',
        parameters: [{ name: 'angle', doc: 'Kąt obrotu w stopniach (0-360).', type: 'number' }],
        category: 'screen'
    },
    {
        label: 'screen.setLinearGradient',
        kind: vscode.CompletionItemKind.Method,
        detail: 'screen.setLinearGradient(x1, y1, x2, y2, color1, color2)',
        doc: '🌈 **Ustawia gradient liniowy jako kolor rysowania**',
        snippet: 'screen.setLinearGradient(${1:0}, ${2:-50}, ${3:0}, ${4:50}, "${5:#00f}", "${6:#0ff}")',
        parameters: [
            { name: 'x1', doc: 'Początek gradientu X.', type: 'number' },
            { name: 'y1', doc: 'Początek gradientu Y.', type: 'number' },
            { name: 'x2', doc: 'Koniec gradientu X.', type: 'number' },
            { name: 'y2', doc: 'Koniec gradientu Y.', type: 'number' },
            { name: 'color1', doc: 'Kolor początkowy.', type: 'string' },
            { name: 'color2', doc: 'Kolor końcowy.', type: 'string' }
        ],
        category: 'screen'
    },

    // --- AUDIO ---
    {
        label: 'audio.playSound',
        kind: vscode.CompletionItemKind.Method,
        detail: 'audio.playSound(name, volume, pitch, pan, loop)',
        doc: '🔊 **Odtwarza efekt dźwiękowy** z folderu `sounds/`.\n\nMożna regulować głośność, wysokość tonu (pitch), panoramę stereo (pan) oraz zapętlenie.',
        snippet: 'audio.playSound("${1:sound_name}", ${2:1.0}, ${3:1.0}, ${4:0}, ${5:false})',
        parameters: [
            { name: 'name', doc: 'Nazwa dźwięku bez rozszerzenia (np. "jump", "explosion").', type: 'string' },
            { name: 'volume', doc: 'Głośność od 0.0 do 1.0 (domyślnie 1.0).', type: 'number', optional: true },
            { name: 'pitch', doc: 'Wysokość dźwięku / szybkość (1.0 = normalna).', type: 'number', optional: true },
            { name: 'pan', doc: 'Panorama stereo od -1.0 (lewy) do 1.0 (prawy).', type: 'number', optional: true },
            { name: 'loop', doc: 'Czy dźwięk ma być zapętlony (true/false).', type: 'boolean', optional: true }
        ],
        example: 'audio.playSound("laser", 0.8, 1.2)',
        category: 'audio'
    },
    {
        label: 'audio.playMusic',
        kind: vscode.CompletionItemKind.Method,
        detail: 'audio.playMusic(name, volume, loop)',
        doc: '🎵 **Odtwarza utwór muzyczny** z folderu `music/`.',
        snippet: 'audio.playMusic("${1:music_name}", ${2:0.8}, ${3:true})',
        parameters: [
            { name: 'name', doc: 'Nazwa utworu z katalogu music/ (np. "theme").', type: 'string' },
            { name: 'volume', doc: 'Głośność utworu od 0.0 do 1.0.', type: 'number', optional: true },
            { name: 'loop', doc: 'Czy muzyka ma być odtwarzana w pętli (domyślnie true).', type: 'boolean', optional: true }
        ],
        category: 'audio'
    },
    {
        label: 'audio.stopMusic',
        kind: vscode.CompletionItemKind.Method,
        detail: 'audio.stopMusic()',
        doc: '⏹️ **Zatrzymuje aktualnie odtwarzaną muzykę w tle**.',
        snippet: 'audio.stopMusic()',
        category: 'audio'
    },
    {
        label: 'audio.pauseMusic',
        kind: vscode.CompletionItemKind.Method,
        detail: 'audio.pauseMusic()',
        doc: '⏸️ **Wstrzymuje odtwarzanie muzyki w tle** (można wznowić za pomocą `audio.resumeMusic()`).',
        snippet: 'audio.pauseMusic()',
        category: 'audio'
    },
    {
        label: 'audio.resumeMusic',
        kind: vscode.CompletionItemKind.Method,
        detail: 'audio.resumeMusic()',
        doc: '▶️ **Wznawia wstrzymaną muzykę**.',
        snippet: 'audio.resumeMusic()',
        category: 'audio'
    },
    {
        label: 'audio.setSoundVolume',
        kind: vscode.CompletionItemKind.Method,
        detail: 'audio.setSoundVolume(volume)',
        doc: '🔈 **Ustawia globalną głośność efektów dźwiękowych (0.0 do 1.0)**.',
        snippet: 'audio.setSoundVolume(${1:0.8})',
        parameters: [{ name: 'volume', doc: 'Wartość głośności (0.0 - 1.0).', type: 'number' }],
        category: 'audio'
    },
    {
        label: 'audio.setMusicVolume',
        kind: vscode.CompletionItemKind.Method,
        detail: 'audio.setMusicVolume(volume)',
        doc: '🎶 **Ustawia globalną głośność muzyki w tle (0.0 do 1.0)**.',
        snippet: 'audio.setMusicVolume(${1:0.8})',
        parameters: [{ name: 'volume', doc: 'Wartość głośności (0.0 - 1.0).', type: 'number' }],
        category: 'audio'
    },

    // --- INPUTS: MOUSE, TOUCH, KEYBOARD, GAMEPAD ---
    {
        label: 'mouse.x',
        kind: vscode.CompletionItemKind.Property,
        detail: 'mouse.x',
        doc: '🖱️ **Pozycja kursora myszy w osi X** (we współrzędnych ekranu microStudio, środek to 0).',
        category: 'input'
    },
    {
        label: 'mouse.y',
        kind: vscode.CompletionItemKind.Property,
        detail: 'mouse.y',
        doc: '🖱️ **Pozycja kursora myszy w osi Y** (środek to 0, góra to wartości dodatnie).',
        category: 'input'
    },
    {
        label: 'mouse.left',
        kind: vscode.CompletionItemKind.Property,
        detail: 'mouse.left',
        doc: '🖱️ **Stan lewego przycisku myszy** (`1` lub `true` gdy wciśnięty, `0` gdy puszczony).',
        category: 'input'
    },
    {
        label: 'mouse.right',
        kind: vscode.CompletionItemKind.Property,
        detail: 'mouse.right',
        doc: '🖱️ **Stan prawego przycisku myszy** (`1` gdy wciśnięty).',
        category: 'input'
    },
    {
        label: 'mouse.wheel',
        kind: vscode.CompletionItemKind.Property,
        detail: 'mouse.wheel',
        doc: '🖱️ **Ruch kółka myszy (scroll)** (wartości ujemne lub dodatnie przy przewijaniu).',
        category: 'input'
    },
    {
        label: 'touch.touching',
        kind: vscode.CompletionItemKind.Property,
        detail: 'touch.touching',
        doc: '📱 **Czy ekran dotykowy jest aktualnie dotykany** (`1` lub `true` gdy palec dotyka ekranu).',
        category: 'input'
    },
    {
        label: 'touch.x',
        kind: vscode.CompletionItemKind.Property,
        detail: 'touch.x',
        doc: '📱 **Pozycja dotknięcia w osi X** (główny/pierwszy punkt dotykowy).',
        category: 'input'
    },
    {
        label: 'touch.y',
        kind: vscode.CompletionItemKind.Property,
        detail: 'touch.y',
        doc: '📱 **Pozycja dotknięcia w osi Y**.',
        category: 'input'
    },
    {
        label: 'touch.touches',
        kind: vscode.CompletionItemKind.Property,
        detail: 'touch.touches',
        doc: '📱 **Lista wszystkich aktywnych punktów multitouch** (tablica obiektów z polami `x`, `y`, `id`).',
        category: 'input'
    },
    {
        label: 'keyboard.UP',
        kind: vscode.CompletionItemKind.Property,
        detail: 'keyboard.UP',
        doc: '⌨️ **Strzałka w górę** (`1` gdy wciśnięta).',
        category: 'input'
    },
    {
        label: 'keyboard.DOWN',
        kind: vscode.CompletionItemKind.Property,
        detail: 'keyboard.DOWN',
        doc: '⌨️ **Strzałka w dół** (`1` gdy wciśnięta).',
        category: 'input'
    },
    {
        label: 'keyboard.LEFT',
        kind: vscode.CompletionItemKind.Property,
        detail: 'keyboard.LEFT',
        doc: '⌨️ **Strzałka w lewo** (`1` gdy wciśnięta).',
        category: 'input'
    },
    {
        label: 'keyboard.RIGHT',
        kind: vscode.CompletionItemKind.Property,
        detail: 'keyboard.RIGHT',
        doc: '⌨️ **Strzałka w prawo** (`1` gdy wciśnięta).',
        category: 'input'
    },
    {
        label: 'keyboard.SPACE',
        kind: vscode.CompletionItemKind.Property,
        detail: 'keyboard.SPACE',
        doc: '⌨️ **Klawisz Spacji** (`1` gdy wciśnięty).',
        category: 'input'
    },
    {
        label: 'keyboard.ENTER',
        kind: vscode.CompletionItemKind.Property,
        detail: 'keyboard.ENTER',
        doc: '⌨️ **Klawisz Enter** (`1` gdy wciśnięty).',
        category: 'input'
    },
    {
        label: 'keyboard.press',
        kind: vscode.CompletionItemKind.Property,
        detail: 'keyboard.press',
        doc: '⌨️ **Obiekt zdarzeń wciśnięcia klawiszy (tylko w pierwszej klatce wciśnięcia)**\n\nNp. `keyboard.press.SPACE` jest prawdziwe tylko w jednym cyklu `update()`.',
        category: 'input'
    },
    {
        label: 'keyboard.release',
        kind: vscode.CompletionItemKind.Property,
        detail: 'keyboard.release',
        doc: '⌨️ **Obiekt zdarzeń puszczenia klawiszy** (prawdziwe w klatce, w której klawisz został zwolniony).',
        category: 'input'
    },
    {
        label: 'gamepad.button',
        kind: vscode.CompletionItemKind.Property,
        detail: 'gamepad.button',
        doc: '🎮 **Przyciski kontrolera / Gamepada** (np. `gamepad.button.A`, `gamepad.button.B`, `gamepad.button.X`, `gamepad.button.Y`, `gamepad.button.UP`, itd.).',
        category: 'input'
    },
    {
        label: 'gamepad.stick',
        kind: vscode.CompletionItemKind.Property,
        detail: 'gamepad.stick',
        doc: '🕹️ **Gałki analogowe gamepada** (np. `gamepad.stick.LEFT_X`, `gamepad.stick.LEFT_Y`, `gamepad.stick.RIGHT_X`, `gamepad.stick.RIGHT_Y`).',
        category: 'input'
    },

    // --- STORAGE & SYSTEM ---
    {
        label: 'storage.set',
        kind: vscode.CompletionItemKind.Method,
        detail: 'storage.set(key, value)',
        doc: '💾 **Zapisuje dane w pamięci trwałej (LocalStorage)**\n\nPozwala zapisywać stan gry, najlepsze wyniki (HighScore) lub zapisy gracza.',
        snippet: 'storage.set("${1:high_score}", ${2:score})',
        parameters: [
            { name: 'key', doc: 'Klucz / nazwa zmiennej do zapisania.', type: 'string' },
            { name: 'value', doc: 'Wartość do zapisania (liczba, tekst, obiekt lub tablica).', type: 'any' }
        ],
        example: 'storage.set("highscore", 1250)',
        category: 'storage'
    },
    {
        label: 'storage.get',
        kind: vscode.CompletionItemKind.Method,
        detail: 'storage.get(key)',
        doc: '📥 **Odczytuje dane z pamięci trwałej**\n\nZwraca wcześniej zapisaną wartość lub `0` / `null` jeśli klucz nie istnieje.',
        snippet: 'storage.get("${1:high_score}")',
        parameters: [{ name: 'key', doc: 'Nazwa klucza do odczytu.', type: 'string' }],
        returns: 'Wcześniej zapisana wartość',
        example: 'highscore = storage.get("highscore") or 0',
        category: 'storage'
    },
    {
        label: 'system.time',
        kind: vscode.CompletionItemKind.Method,
        detail: 'system.time()',
        doc: '⏱️ **Zwraca bieżący czas w milisekundach** (od uruchomienia lub Unix timestamp).',
        snippet: 'system.time()',
        returns: 'number (milisekundy)',
        category: 'system'
    },
    {
        label: 'system.prompt',
        kind: vscode.CompletionItemKind.Method,
        detail: 'system.prompt(message, defaultValue)',
        doc: '💬 **Wyświetla okno dialogowe z polem tekstowym do wpisania przez gracza**.',
        snippet: 'system.prompt("${1:Podaj swoje imię:}", "${2:Gracz}")',
        parameters: [
            { name: 'message', doc: 'Pytanie lub komunikat dla gracza.', type: 'string' },
            { name: 'defaultValue', doc: 'Wartość domyślna w polu tekstowym.', type: 'string', optional: true }
        ],
        category: 'system'
    },
    {
        label: 'system.javascript',
        kind: vscode.CompletionItemKind.Method,
        detail: 'system.javascript(code)',
        doc: '⚡ **Wykonuje kod JavaScript wewnątrz microScript**\n\nPozwala na integrację z zewnętrznymi bibliotekami i API przeglądarki.',
        snippet: 'system.javascript("${1:console.log(\'Hello JS\');}")',
        parameters: [{ name: 'code', doc: 'Kod JavaScript do wykonania jako ciąg znaków.', type: 'string' }],
        category: 'system'
    },

    // --- MATH & UTILITY ---
    {
        label: 'sin',
        kind: vscode.CompletionItemKind.Function,
        detail: 'sin(angle)',
        doc: '📐 **Sinus kąta** (kąt w stopniach od 0 do 360).',
        snippet: 'sin(${1:angle})',
        parameters: [{ name: 'angle', doc: 'Kąt w stopniach.', type: 'number' }],
        category: 'math'
    },
    {
        label: 'cos',
        kind: vscode.CompletionItemKind.Function,
        detail: 'cos(angle)',
        doc: '📐 **Cosinus kąta** (kąt w stopniach od 0 do 360).',
        snippet: 'cos(${1:angle})',
        parameters: [{ name: 'angle', doc: 'Kąt w stopniach.', type: 'number' }],
        category: 'math'
    },
    {
        label: 'tan',
        kind: vscode.CompletionItemKind.Function,
        detail: 'tan(angle)',
        doc: '📐 **Tangens kąta** (kąt w stopniach).',
        snippet: 'tan(${1:angle})',
        parameters: [{ name: 'angle', doc: 'Kąt w stopniach.', type: 'number' }],
        category: 'math'
    },
    {
        label: 'atan2',
        kind: vscode.CompletionItemKind.Function,
        detail: 'atan2(y, x)',
        doc: '📐 **Zwraca kąt w stopniach od punktu (0,0) do (x,y)**\n\nBardzo przydatne do wyznaczania kierunku celowania lub obrotu ku myszce.',
        snippet: 'atan2(${1:dy}, ${2:dx})',
        parameters: [
            { name: 'y', doc: 'Różnica współrzędnych Y.', type: 'number' },
            { name: 'x', doc: 'Różnica współrzędnych X.', type: 'number' }
        ],
        example: 'angle = atan2(mouse.y - player_y, mouse.x - player_x)',
        category: 'math'
    },
    {
        label: 'sqrt',
        kind: vscode.CompletionItemKind.Function,
        detail: 'sqrt(value)',
        doc: '🔢 **Pierwiastek kwadratowy**',
        snippet: 'sqrt(${1:value})',
        parameters: [{ name: 'value', doc: 'Liczba do spierwiastkowania.', type: 'number' }],
        category: 'math'
    },
    {
        label: 'abs',
        kind: vscode.CompletionItemKind.Function,
        detail: 'abs(value)',
        doc: '🔢 **Wartość bezwzględna (moduł)**',
        snippet: 'abs(${1:value})',
        parameters: [{ name: 'value', doc: 'Liczba.', type: 'number' }],
        category: 'math'
    },
    {
        label: 'round',
        kind: vscode.CompletionItemKind.Function,
        detail: 'round(value)',
        doc: '🔢 **Zaokrągla liczbę do najbliższej całkowitej**',
        snippet: 'round(${1:value})',
        parameters: [{ name: 'value', doc: 'Liczba.', type: 'number' }],
        category: 'math'
    },
    {
        label: 'floor',
        kind: vscode.CompletionItemKind.Function,
        detail: 'floor(value)',
        doc: '🔢 **Zaokrągla liczbę w dół**',
        snippet: 'floor(${1:value})',
        parameters: [{ name: 'value', doc: 'Liczba.', type: 'number' }],
        category: 'math'
    },
    {
        label: 'ceil',
        kind: vscode.CompletionItemKind.Function,
        detail: 'ceil(value)',
        doc: '🔢 **Zaokrągla liczbę w górę**',
        snippet: 'ceil(${1:value})',
        parameters: [{ name: 'value', doc: 'Liczba.', type: 'number' }],
        category: 'math'
    },
    {
        label: 'min',
        kind: vscode.CompletionItemKind.Function,
        detail: 'min(a, b)',
        doc: '🔢 **Zwraca mniejszą z dwóch wartości**',
        snippet: 'min(${1:a}, ${2:b})',
        parameters: [
            { name: 'a', doc: 'Pierwsza liczba.', type: 'number' },
            { name: 'b', doc: 'Druga liczba.', type: 'number' }
        ],
        category: 'math'
    },
    {
        label: 'max',
        kind: vscode.CompletionItemKind.Function,
        detail: 'max(a, b)',
        doc: '🔢 **Zwraca większą z dwóch wartości**',
        snippet: 'max(${1:a}, ${2:b})',
        parameters: [
            { name: 'a', doc: 'Pierwsza liczba.', type: 'number' },
            { name: 'b', doc: 'Druga liczba.', type: 'number' }
        ],
        category: 'math'
    },
    {
        label: 'random.next',
        kind: vscode.CompletionItemKind.Method,
        detail: 'random.next()',
        doc: '🎲 **Losuje liczbę zmiennoprzecinkową od 0.0 do 1.0**',
        snippet: 'random.next()',
        category: 'math'
    },
    {
        label: 'random.int',
        kind: vscode.CompletionItemKind.Method,
        detail: 'random.int(max)',
        doc: '🎲 **Losuje liczbę całkowitą od 0 do max - 1**',
        snippet: 'random.int(${1:10})',
        parameters: [{ name: 'max', doc: 'Górna granica losowania (wykluczona).', type: 'number' }],
        category: 'math'
    },
    {
        label: 'PI',
        kind: vscode.CompletionItemKind.Constant,
        detail: 'PI = 3.1415926535...',
        doc: '🥧 **Stała matematyczna Pi (π)**',
        category: 'math'
    }
];

// --- OFICJALNE BIBLIOTEKI MICROSTUDIO ---
export const LIBRARIES_API_DATABASE: ApiDocItem[] = [
    // --- micro2D (m2d) ---
    {
        label: 'M2D.createWorld',
        kind: vscode.CompletionItemKind.Method,
        detail: 'M2D.createWorld(gravityX, gravityY)',
        doc: '🪐 **Tworzy świat fizyki 2D (micro2D)**\n\nInicjalizuje symulację fizyczną z podanym wektorem grawitacji.',
        snippet: 'world = M2D.createWorld(${1:0}, ${2:-200})',
        parameters: [
            { name: 'gravityX', doc: 'Grawitacja w osi X (zazwyczaj 0).', type: 'number', optional: true },
            { name: 'gravityY', doc: 'Grawitacja w osi Y (np. -200 dla opadania w dół).', type: 'number', optional: true }
        ],
        category: 'library',
        libraryId: 'm2d'
    },
    {
        label: 'world.createBox',
        kind: vscode.CompletionItemKind.Method,
        detail: 'world.createBox(x, y, width, height, dynamic)',
        doc: '📦 **Tworzy prostokątne ciało fizyczne (Box)** w świecie micro2D.',
        snippet: 'world.createBox(${1:x}, ${2:y}, ${3:width}, ${4:height}, ${5:true})',
        parameters: [
            { name: 'x', doc: 'Początkowa pozycja X.', type: 'number' },
            { name: 'y', doc: 'Początkowa pozycja Y.', type: 'number' },
            { name: 'width', doc: 'Szerokość prostokąta.', type: 'number' },
            { name: 'height', doc: 'Wysokość prostokąta.', type: 'number' },
            { name: 'dynamic', doc: 'Czy obiekt podlega grawitacji i ruchom (true = dynamiczny, false = statyczna ściana).', type: 'boolean', optional: true }
        ],
        category: 'library',
        libraryId: 'm2d'
    },
    {
        label: 'world.createCircle',
        kind: vscode.CompletionItemKind.Method,
        detail: 'world.createCircle(x, y, radius, dynamic)',
        doc: '⚪ **Tworzy okrągłe ciało fizyczne (Circle)** w świecie micro2D.',
        snippet: 'world.createCircle(${1:x}, ${2:y}, ${3:radius}, ${4:true})',
        parameters: [
            { name: 'x', doc: 'Pozycja X.', type: 'number' },
            { name: 'y', doc: 'Pozycja Y.', type: 'number' },
            { name: 'radius', doc: 'Promień koła.', type: 'number' },
            { name: 'dynamic', doc: 'Czy ciało ma być dynamiczne (true) czy statyczne (false).', type: 'boolean', optional: true }
        ],
        category: 'library',
        libraryId: 'm2d'
    },
    {
        label: 'world.update',
        kind: vscode.CompletionItemKind.Method,
        detail: 'world.update(deltaTime)',
        doc: '⏩ **Aktualizuje symulację fizyczną micro2D** (wywołaj w `update()`).',
        snippet: 'world.update()',
        parameters: [{ name: 'deltaTime', doc: 'Krok czasowy (opcjonalny).', type: 'number', optional: true }],
        category: 'library',
        libraryId: 'm2d'
    },

    // --- Matter.js (matter) ---
    {
        label: 'Matter.Engine.create',
        kind: vscode.CompletionItemKind.Method,
        detail: 'Matter.Engine.create()',
        doc: '⚙️ **Inicjalizuje silnik fizyki Matter.js**.',
        snippet: 'engine = Matter.Engine.create()',
        category: 'library',
        libraryId: 'matter'
    },
    {
        label: 'Matter.Bodies.rectangle',
        kind: vscode.CompletionItemKind.Method,
        detail: 'Matter.Bodies.rectangle(x, y, width, height, options)',
        doc: '📦 **Tworzy prostokątne ciało fizyczne Matter.js**.',
        snippet: 'Matter.Bodies.rectangle(${1:x}, ${2:y}, ${3:width}, ${4:height}, ${5:{ isStatic: false }})',
        parameters: [
            { name: 'x', doc: 'Współrzędna X.', type: 'number' },
            { name: 'y', doc: 'Współrzędna Y.', type: 'number' },
            { name: 'width', doc: 'Szerokość.', type: 'number' },
            { name: 'height', doc: 'Wysokość.', type: 'number' },
            { name: 'options', doc: 'Opcje fizyczne obiektu ({ isStatic, restitution, friction... }).', type: 'object', optional: true }
        ],
        category: 'library',
        libraryId: 'matter'
    },
    {
        label: 'Matter.Bodies.circle',
        kind: vscode.CompletionItemKind.Method,
        detail: 'Matter.Bodies.circle(x, y, radius, options)',
        doc: '🔴 **Tworzy okrągłe ciało fizyczne Matter.js**.',
        snippet: 'Matter.Bodies.circle(${1:x}, ${2:y}, ${3:radius}, ${4:{ restitution: 0.8 }})',
        parameters: [
            { name: 'x', doc: 'Współrzędna X.', type: 'number' },
            { name: 'y', doc: 'Współrzędna Y.', type: 'number' },
            { name: 'radius', doc: 'Promień koła.', type: 'number' },
            { name: 'options', doc: 'Opcje fizyczne.', type: 'object', optional: true }
        ],
        category: 'library',
        libraryId: 'matter'
    },
    {
        label: 'Matter.Composite.add',
        kind: vscode.CompletionItemKind.Method,
        detail: 'Matter.Composite.add(world, body)',
        doc: '➕ **Dodaje ciało fizyczne do świata Matter.js**.',
        snippet: 'Matter.Composite.add(engine.world, ${1:body})',
        parameters: [
            { name: 'world', doc: 'Świat fizyczny (`engine.world`).', type: 'any' },
            { name: 'body', doc: 'Obiekt lub tablica obiektów do dodania.', type: 'any' }
        ],
        category: 'library',
        libraryId: 'matter'
    },

    // --- Tween.js (tween) ---
    {
        label: 'TWEEN.Tween',
        kind: vscode.CompletionItemKind.Class,
        detail: 'new TWEEN.Tween(object)',
        doc: '🎬 **Tworzy animację płynnej interpolacji wartości (Tween)**.',
        snippet: 'new TWEEN.Tween(${1:object})\n\t.to({ ${2:x: 100} }, ${3:1000})\n\t.easing(TWEEN.Easing.Quadratic.Out)\n\t.start()',
        parameters: [{ name: 'object', doc: 'Obiekt, którego właściwości będą animowane.', type: 'object' }],
        category: 'library',
        libraryId: 'tween'
    },
    {
        label: 'TWEEN.update',
        kind: vscode.CompletionItemKind.Method,
        detail: 'TWEEN.update()',
        doc: '⏱️ **Aktualizuje wszystkie aktywne animacje Tween** (wywołaj w `update()`).',
        snippet: 'TWEEN.update()',
        category: 'library',
        libraryId: 'tween'
    },

    // --- Howler.js (howler) ---
    {
        label: 'Howl',
        kind: vscode.CompletionItemKind.Class,
        detail: 'new Howl(options)',
        doc: '🎧 **Zaawansowany obiekt audio w Howler.js**.',
        snippet: 'sound = new Howl({\n\tsrc: ["${1:sounds/music.mp3}"],\n\tautoplay: ${2:true},\n\tloop: ${3:true},\n\tvolume: ${4:0.8}\n})',
        parameters: [{ name: 'options', doc: 'Obiekt konfiguracji z parametrami `src`, `volume`, `loop`, `html5` itp.', type: 'object' }],
        category: 'library',
        libraryId: 'howler'
    },

    // --- PixiJS (pixi) ---
    {
        label: 'PIXI.Application',
        kind: vscode.CompletionItemKind.Class,
        detail: 'new PIXI.Application(options)',
        doc: '✨ **Główna aplikacja renderera PixiJS WebGL 2D**.',
        snippet: 'app = new PIXI.Application({ width: ${1:640}, height: ${2:360} })',
        category: 'library',
        libraryId: 'pixi'
    },
    {
        label: 'PIXI.Sprite',
        kind: vscode.CompletionItemKind.Class,
        detail: 'new PIXI.Sprite(texture)',
        doc: '🖼️ **Obiekt sprajtu graficznego w PixiJS**.',
        snippet: 'sprite = new PIXI.Sprite(${1:texture})',
        category: 'library',
        libraryId: 'pixi'
    },

    // --- Three.js (three) ---
    {
        label: 'THREE.Scene',
        kind: vscode.CompletionItemKind.Class,
        detail: 'new THREE.Scene()',
        doc: '🌌 **Główna scena trójwymiarowa w Three.js**.',
        snippet: 'scene = new THREE.Scene()',
        category: 'library',
        libraryId: 'three'
    },
    {
        label: 'THREE.PerspectiveCamera',
        kind: vscode.CompletionItemKind.Class,
        detail: 'new THREE.PerspectiveCamera(fov, aspect, near, far)',
        doc: '📷 **Kamera perspektywiczna 3D w Three.js**.',
        snippet: 'camera = new THREE.PerspectiveCamera(${1:75}, ${2:screen.width/screen.height}, ${3:0.1}, ${4:1000})',
        category: 'library',
        libraryId: 'three'
    },
    {
        label: 'THREE.Mesh',
        kind: vscode.CompletionItemKind.Class,
        detail: 'new THREE.Mesh(geometry, material)',
        doc: '🧊 **Obiekt siatki trójwymiarowej (Siatka + Materiał) w Three.js**.',
        snippet: 'mesh = new THREE.Mesh(${1:geometry}, ${2:material})',
        category: 'library',
        libraryId: 'three'
    },

    // --- Vector & Matrix Math (matrix) ---
    {
        label: 'Vector2',
        kind: vscode.CompletionItemKind.Class,
        detail: 'new Vector2(x, y)',
        doc: '📐 **Wektor dwuwymiarowy (2D Vector)**.',
        snippet: 'new Vector2(${1:0}, ${2:0})',
        parameters: [
            { name: 'x', doc: 'Współrzędna X.', type: 'number' },
            { name: 'y', doc: 'Współrzędna Y.', type: 'number' }
        ],
        category: 'library',
        libraryId: 'matrix'
    },
    {
        label: 'Vector3',
        kind: vscode.CompletionItemKind.Class,
        detail: 'new Vector3(x, y, z)',
        doc: '📐 **Wektor trójwymiarowy (3D Vector)**.',
        snippet: 'new Vector3(${1:0}, ${2:0}, ${3:0})',
        parameters: [
            { name: 'x', doc: 'Współrzędna X.', type: 'number' },
            { name: 'y', doc: 'Współrzędna Y.', type: 'number' },
            { name: 'z', doc: 'Współrzędna Z.', type: 'number' }
        ],
        category: 'library',
        libraryId: 'matrix'
    }
];
