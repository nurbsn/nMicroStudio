import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ResourceCreator } from './ResourceCreator';

export interface MicroStudioLib {
    id: string;
    title: string;
    description: string;
    author: string;
    category: 'physics' | 'graphics' | 'audio' | 'utility' | '3d';
}

export const BUILTIN_LIBRARIES: MicroStudioLib[] = [
    {
        id: 'm2d',
        title: 'micro2D (Physics & Engine)',
        description: 'Oficjalny silnik fizyki i zestaw narzędzi 2D dla microStudio.',
        author: 'microstudio',
        category: 'physics'
    },
    {
        id: 'matter',
        title: 'Matter.js',
        description: 'Wydajny, elastyczny silnik fizyki 2D dla platformówek, łamigłówek i symulacji.',
        author: 'liabru',
        category: 'physics'
    },
    {
        id: 'pixi',
        title: 'PixiJS',
        description: 'Superszybki silnik renderowania grafiki 2D wykorzystujący WebGL.',
        author: 'pixijs',
        category: 'graphics'
    },
    {
        id: 'cannon',
        title: 'Cannon.js',
        description: 'Silnik fizyki 3D dla gier trójwymiarowych w microStudio.',
        author: 'schteppe',
        category: '3d'
    },
    {
        id: 'babylon',
        title: 'Babylon.js',
        description: 'Pełnowymiarowy, zaawansowany silnik graficzny i fizyczny 3D.',
        author: 'babylonjs',
        category: '3d'
    },
    {
        id: 'three',
        title: 'Three.js',
        description: 'Popularna biblioteka grafiki trójwymiarowej w przeglądarce.',
        author: 'mrdoob',
        category: '3d'
    },
    {
        id: 'tween',
        title: 'Tween.js',
        description: 'Biblioteka do płynnej interpolacji wartości i animacji (tweening).',
        author: 'tweenjs',
        category: 'utility'
    },
    {
        id: 'howler',
        title: 'Howler.js',
        description: 'Zaawansowana obsługa dźwięków, muzyki przestrzennej i audio sprite.',
        author: 'goldfire',
        category: 'audio'
    },
    {
        id: 'font',
        title: 'Bitmap Font',
        description: 'Renderowanie i obsługa niestandardowych czcionek bitmapowych.',
        author: 'microstudio',
        category: 'utility'
    },
    {
        id: 'matrix',
        title: 'Matrix & Vector Math',
        description: 'Zaawansowane operacje na wektorach, macierzach i transformacjach 2D/3D.',
        author: 'microstudio',
        category: 'utility'
    },
    {
        id: 'microengine',
        title: 'MicroEngine',
        description: 'Rozszerzony zestaw helperów, stanów gry i narzędzi ułatwiających tworzenie gier.',
        author: 'microstudio',
        category: 'utility'
    }
];

export class LibraryManager {
    public static async showLibraryBrowser(targetUri?: vscode.Uri) {
        const projectUri = await ResourceCreator.findProjectUri(targetUri);
        if (!projectUri) return;

        const jsonPath = path.join(projectUri.fsPath, 'project.json');
        if (!fs.existsSync(jsonPath)) {
            vscode.window.showErrorMessage('Nie znaleziono pliku project.json w wybranym projekcie.');
            return;
        }

        let projectData: any = {};
        try {
            projectData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch (e) {
            vscode.window.showErrorMessage('Nie udało się sparsować project.json.');
            return;
        }

        const activeLibs: string[] = projectData.libs || [];

        // Build QuickPick items
        const items: vscode.QuickPickItem[] = [];

        // Custom library action
        items.push({
            label: '$(add) Dodaj inną bibliotekę po nazwie (slug)...',
            description: 'Wpisz dowolny identyfikator biblioteki microStudio',
            alwaysShow: true
        });

        items.push({
            label: '--- Oficjalne i popularne biblioteki microStudio ---',
            kind: vscode.QuickPickItemKind.Separator
        });

        for (const lib of BUILTIN_LIBRARIES) {
            const isInstalled = activeLibs.includes(lib.id);
            items.push({
                label: `${isInstalled ? '$(check) ' : '$(circle-large-outline) '}${lib.title}`,
                description: `ID: "${lib.id}" | Autor: ${lib.author} | [${lib.category.toUpperCase()}]`,
                detail: `${isInstalled ? '✅ [ZAINSTALOWANA - kliknij, aby usunąć] ' : '➕ [Kliknij, aby dodać] '} ${lib.description}`
            });
        }

        const selected = await vscode.window.showQuickPick(items, {
            title: `Zarządzanie bibliotekami: ${projectData.title || path.basename(projectUri.fsPath)}`,
            placeHolder: 'Wybierz bibliotekę, aby ją włączyć lub wyłączyć z projektu...'
        });

        if (!selected) return;

        if (selected.label.startsWith('$(add)')) {
            const customName = await vscode.window.showInputBox({
                prompt: 'Podaj identyfikator / slug biblioteki microStudio (np. matter, my_lib)',
                placeHolder: 'slug_biblioteki',
                validateInput: t => (!t || t.trim() === '' ? 'Identyfikator nie może być pusty' : null)
            });
            if (customName) {
                const clean = customName.trim();
                await this.toggleLibrary(projectUri, clean);
            }
            return;
        }

        // Find which library was clicked
        for (const lib of BUILTIN_LIBRARIES) {
            if (selected.label.includes(lib.title)) {
                await this.toggleLibrary(projectUri, lib.id);
                break;
            }
        }
    }

    public static async toggleLibrary(projectUri: vscode.Uri, libId: string) {
        const jsonPath = path.join(projectUri.fsPath, 'project.json');
        try {
            const projectData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            if (!Array.isArray(projectData.libs)) {
                projectData.libs = [];
            }

            const idx = projectData.libs.indexOf(libId);
            if (idx >= 0) {
                projectData.libs.splice(idx, 1);
                fs.writeFileSync(jsonPath, JSON.stringify(projectData, null, 2), 'utf8');
                vscode.window.showInformationMessage(`Usunięto bibliotekę "${libId}" z project.json`);
            } else {
                projectData.libs.push(libId);
                fs.writeFileSync(jsonPath, JSON.stringify(projectData, null, 2), 'utf8');
                vscode.window.showInformationMessage(`Dodano bibliotekę "${libId}" do project.json`);
            }
        } catch (e: any) {
            vscode.window.showErrorMessage(`Błąd aktualizacji bibliotek w project.json: ${e.message}`);
        }
    }
}
