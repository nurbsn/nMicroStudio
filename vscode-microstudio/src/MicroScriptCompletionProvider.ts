import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiDocItem, BUILTIN_API_DATABASE, LIBRARIES_API_DATABASE } from './MicroScriptDocDatabase';

export class MicroScriptCompletionProvider implements 
    vscode.CompletionItemProvider, 
    vscode.HoverProvider, 
    vscode.SignatureHelpProvider 
{
    private static cachedProjectSymbols: Map<string, { time: number; symbols: ApiDocItem[] }> = new Map();

    /**
     * Finds the root of the microStudio project for a given document URI
     */
    private findProjectRoot(uri: vscode.Uri): string | null {
        let current = path.dirname(uri.fsPath);
        for (let i = 0; i < 6; i++) {
            const pj = path.join(current, 'project.json');
            if (fs.existsSync(pj)) {
                return current;
            }
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }
        return null;
    }

    /**
     * Reads active libraries list from project.json
     */
    private getProjectActiveLibraries(projectRoot: string | null): string[] {
        if (!projectRoot) return [];
        const pjPath = path.join(projectRoot, 'project.json');
        if (fs.existsSync(pjPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
                if (Array.isArray(data.libs)) {
                    return data.libs;
                }
            } catch (e) {}
        }
        return [];
    }

    /**
     * Scans project files (.ms, .js, .py) and doc/*.md to extract custom and library functions/classes/docstrings
     */
    private scanProjectSymbols(projectRoot: string | null): ApiDocItem[] {
        if (!projectRoot) return [];

        const cached = MicroScriptCompletionProvider.cachedProjectSymbols.get(projectRoot);
        const now = Date.now();
        // Cache for 3 seconds to ensure high performance while editing
        if (cached && (now - cached.time < 3000)) {
            return cached.symbols;
        }

        const symbols: ApiDocItem[] = [];
        const scanDirs = [
            path.join(projectRoot, 'ms'),
            path.join(projectRoot, 'libs'),
            path.join(projectRoot, 'lib')
        ];

        for (const dir of scanDirs) {
            if (!fs.existsSync(dir)) continue;
            const files = this.scanDirectoryFiles(dir, dir);
            for (const file of files) {
                if (file.endsWith('.ms') || file.endsWith('.js')) {
                    const fullPath = path.join(dir, file);
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        this.extractSymbolsFromCode(content, file, symbols);
                    } catch (e) {}
                }
            }
        }

        // Also scan doc/*.md files for library documentation
        const docDir = path.join(projectRoot, 'doc');
        if (fs.existsSync(docDir)) {
            const docFiles = this.scanDirectoryFiles(docDir, docDir);
            for (const docFile of docFiles) {
                if (docFile.endsWith('.md')) {
                    const fullDocPath = path.join(docDir, docFile);
                    try {
                        const docContent = fs.readFileSync(fullDocPath, 'utf8');
                        const docTitle = path.basename(docFile, '.md');
                        symbols.push({
                            label: `doc:${docTitle}`,
                            kind: vscode.CompletionItemKind.Reference,
                            detail: `Dokumentacja: doc/${docFile}`,
                            doc: `📖 **Dokumentacja projektu / biblioteki**: \`${docTitle}\`\n\n${docContent.slice(0, 1000)}${docContent.length > 1000 ? '\n\n*(skrócono...)*' : ''}`,
                            category: 'library'
                        });
                    } catch (e) {}
                }
            }
        }

        MicroScriptCompletionProvider.cachedProjectSymbols.set(projectRoot, { time: now, symbols });
        return symbols;
    }

    /**
     * Parses source code lines and extracts functions, classes, arguments, and doc comments
     */
    private extractSymbolsFromCode(content: string, filePath: string, outSymbols: ApiDocItem[]) {
        const lines = content.split('\n');
        let pendingComment: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Comment lines
            if (line.startsWith('#') || line.startsWith('//') || line.startsWith('--')) {
                const clean = line.replace(/^(#|\/\/|--)\s*/, '');
                pendingComment.push(clean);
                continue;
            }

            if (line === '') {
                // Keep comments across single empty lines, reset on double
                if (pendingComment.length > 0 && i + 1 < lines.length && lines[i + 1].trim() === '') {
                    pendingComment = [];
                }
                continue;
            }

            // Pattern 1: name = function(arg1, arg2, arg3)
            const fnAssignMatch = line.match(/^([a-zA-Z0-9_.]+)\s*=\s*function\s*\(([^)]*)\)/);
            if (fnAssignMatch) {
                const name = fnAssignMatch[1];
                const rawArgs = fnAssignMatch[2].trim();
                const argsList = rawArgs ? rawArgs.split(',').map(a => a.trim().split('=')[0].trim()) : [];
                
                const commentText = pendingComment.join('\n');
                const docText = commentText 
                    ? `📘 **Funkcja z pliku \`${filePath}\`**\n\n${commentText}`
                    : `📘 **Funkcja zdefiniowana w \`${filePath}\`**`;

                outSymbols.push({
                    label: name,
                    kind: vscode.CompletionItemKind.Function,
                    detail: `${name}(${rawArgs})`,
                    doc: docText,
                    parameters: argsList.map(a => ({ name: a, doc: `Parametr \`${a}\`` })),
                    snippet: `${name}(${argsList.map((a, idx) => `\${${idx + 1}:${a}}`).join(', ')})`,
                    category: 'library'
                });

                pendingComment = [];
                continue;
            }

            // Pattern 2: function name(arg1, arg2)
            const fnDefMatch = line.match(/^function\s+([a-zA-Z0-9_.]+)\s*\(([^)]*)\)/);
            if (fnDefMatch) {
                const name = fnDefMatch[1];
                const rawArgs = fnDefMatch[2].trim();
                const argsList = rawArgs ? rawArgs.split(',').map(a => a.trim().split('=')[0].trim()) : [];
                
                const commentText = pendingComment.join('\n');
                const docText = commentText 
                    ? `📘 **Funkcja z pliku \`${filePath}\`**\n\n${commentText}`
                    : `📘 **Funkcja zdefiniowana w \`${filePath}\`**`;

                outSymbols.push({
                    label: name,
                    kind: vscode.CompletionItemKind.Function,
                    detail: `${name}(${rawArgs})`,
                    doc: docText,
                    parameters: argsList.map(a => ({ name: a, doc: `Parametr \`${a}\`` })),
                    snippet: `${name}(${argsList.map((a, idx) => `\${${idx + 1}:${a}}`).join(', ')})`,
                    category: 'library'
                });

                pendingComment = [];
                continue;
            }

            // Pattern 3: Class declaration: Name = class or class Name
            const classMatch = line.match(/^([a-zA-Z0-9_]+)\s*=\s*class\b/) || line.match(/^class\s+([a-zA-Z0-9_]+)\b/);
            if (classMatch) {
                const className = classMatch[1];
                const commentText = pendingComment.join('\n');
                const docText = commentText 
                    ? `🏛️ **Klasa z pliku \`${filePath}\`**\n\n${commentText}`
                    : `🏛️ **Klasa zdefiniowana w \`${filePath}\`**`;

                outSymbols.push({
                    label: className,
                    kind: vscode.CompletionItemKind.Class,
                    detail: `class ${className}`,
                    doc: docText,
                    category: 'library'
                });

                pendingComment = [];
                continue;
            }

            // Reset comments if line was code but not a declaration
            pendingComment = [];
        }
    }

    private scanDirectoryFiles(dir: string, baseDir: string): string[] {
        let results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        try {
            const list = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of list) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    results = results.concat(this.scanDirectoryFiles(fullPath, baseDir));
                } else {
                    const rel = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                    results.push(rel);
                }
            }
        } catch (e) {}
        return results;
    }

    /**
     * Returns all active API items (Built-in, Active Libraries, and Workspace Project Symbols)
     */
    private getAllActiveApiItems(projectRoot: string | null): ApiDocItem[] {
        const activeLibIds = this.getProjectActiveLibraries(projectRoot);
        const projectSymbols = this.scanProjectSymbols(projectRoot);

        // Filter standard libraries: show all if no project.json or if included in libs
        const libraryItems = LIBRARIES_API_DATABASE.filter(item => {
            if (!item.libraryId) return true;
            return activeLibIds.length === 0 || activeLibIds.includes(item.libraryId);
        });

        return [...BUILTIN_API_DATABASE, ...libraryItems, ...projectSymbols];
    }

    /**
     * Parses the current line and surrounding context to find function calls and active parameter index
     */
    private parseEnclosingFunctionCall(lineText: string, charOffset: number): { functionName: string; activeParameterIndex: number; callStart: number } | null {
        const textBefore = lineText.substring(0, charOffset);
        
        let parenDepth = 0;
        let openParenIndex = -1;
        let inString: string | null = null;
        let commaCount = 0;

        // Traverse backwards from charOffset to find the matching open paren
        for (let i = textBefore.length - 1; i >= 0; i--) {
            const char = textBefore[i];
            
            // Check quotes (ignoring escaped ones)
            if ((char === '"' || char === "'") && (i === 0 || textBefore[i - 1] !== '\\')) {
                if (inString === char) {
                    inString = null;
                } else if (!inString) {
                    inString = char;
                }
            }

            if (inString) continue;

            if (char === ')') {
                parenDepth++;
            } else if (char === '(') {
                if (parenDepth > 0) {
                    parenDepth--;
                } else {
                    openParenIndex = i;
                    break;
                }
            }
        }

        if (openParenIndex === -1) return null;

        // Extract function name preceding '('
        const beforeParen = textBefore.substring(0, openParenIndex).trim();
        const fnMatch = beforeParen.match(/([a-zA-Z0-9_.]+)$/);
        if (!fnMatch) return null;

        const functionName = fnMatch[1];
        const callStart = openParenIndex - fnMatch[1].length;

        // Count commas between openParenIndex and charOffset at depth 0
        inString = null;
        let depth = 0;
        for (let i = openParenIndex + 1; i < charOffset; i++) {
            const char = lineText[i];
            if ((char === '"' || char === "'") && (i === 0 || lineText[i - 1] !== '\\')) {
                if (inString === char) {
                    inString = null;
                } else if (!inString) {
                    inString = char;
                }
            }
            if (inString) continue;

            if (char === '(' || char === '{' || char === '[') {
                depth++;
            } else if (char === ')' || char === '}' || char === ']') {
                if (depth > 0) depth--;
            } else if (char === ',' && depth === 0) {
                commaCount++;
            }
        }

        return {
            functionName,
            activeParameterIndex: commaCount,
            callStart
        };
    }

    /**
     * 1. COMPLETION ITEM PROVIDER (IntelliSense Auto-Complete)
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const projectRoot = this.findProjectRoot(document.uri);
        const allItems = this.getAllActiveApiItems(projectRoot);
        const completions: vscode.CompletionItem[] = [];

        // 1. API & Library & Function Completions
        for (const item of allItems) {
            const ci = new vscode.CompletionItem(item.label, item.kind);
            ci.detail = item.detail;
            
            const md = new vscode.MarkdownString(item.doc);
            if (item.parameters && item.parameters.length > 0) {
                md.appendMarkdown('\n\n**Parametry:**\n');
                for (const param of item.parameters) {
                    md.appendMarkdown(`- \`${param.name}\`${param.type ? ` *(${param.type})*` : ''}: ${param.doc}\n`);
                }
            }
            if (item.example) {
                md.appendMarkdown(`\n\n**Przykład:**\n\`\`\`microscript\n${item.example}\n\`\`\``);
            }
            ci.documentation = md;

            if (item.snippet) {
                ci.insertText = new vscode.SnippetString(item.snippet);
            }
            completions.push(ci);
        }

        // 2. Dynamic Project Asset Completions (Sprites, Maps, Sounds, Music, Assets)
        if (projectRoot) {
            // Sprites
            const spritesDir = path.join(projectRoot, 'sprites');
            const spriteFiles = this.scanDirectoryFiles(spritesDir, spritesDir);
            for (const file of spriteFiles) {
                if (file.endsWith('.png')) {
                    const name = file.slice(0, -4);
                    const ci = new vscode.CompletionItem(`"${name}"`, vscode.CompletionItemKind.Color);
                    ci.detail = `Sprite: sprites/${file}`;
                    ci.documentation = new vscode.MarkdownString(`🖼️ **microStudio Sprite**: \`"${name}"\`\n\n- Ścieżka: \`sprites/${file}\``);
                    ci.insertText = `"${name}"`;
                    ci.sortText = `0_sprite_${name}`;
                    completions.push(ci);
                }
            }

            // Maps
            const mapsDir = path.join(projectRoot, 'maps');
            const mapFiles = this.scanDirectoryFiles(mapsDir, mapsDir);
            for (const file of mapFiles) {
                if (file.endsWith('.json')) {
                    const name = file.slice(0, -5);
                    const ci = new vscode.CompletionItem(`"${name}"`, vscode.CompletionItemKind.File);
                    ci.detail = `Map: maps/${file}`;
                    ci.documentation = new vscode.MarkdownString(`🗺️ **microStudio Map**: \`"${name}"\`\n\n- Ścieżka: \`maps/${file}\``);
                    ci.insertText = `"${name}"`;
                    ci.sortText = `0_map_${name}`;
                    completions.push(ci);
                }
            }

            // Sounds
            const soundsDir = path.join(projectRoot, 'sounds');
            const soundFiles = this.scanDirectoryFiles(soundsDir, soundsDir);
            for (const file of soundFiles) {
                const name = file.replace(/\.[^/.]+$/, '');
                const ci = new vscode.CompletionItem(`"${name}"`, vscode.CompletionItemKind.Value);
                ci.detail = `Sound: sounds/${file}`;
                ci.documentation = new vscode.MarkdownString(`🔊 **microStudio Sound**: \`"${name}"\`\n\n- Ścieżka: \`sounds/${file}\``);
                ci.insertText = `"${name}"`;
                ci.sortText = `0_sound_${name}`;
                completions.push(ci);
            }

            // Music
            const musicDir = path.join(projectRoot, 'music');
            const musicFiles = this.scanDirectoryFiles(musicDir, musicDir);
            for (const file of musicFiles) {
                const name = file.replace(/\.[^/.]+$/, '');
                const ci = new vscode.CompletionItem(`"${name}"`, vscode.CompletionItemKind.Value);
                ci.detail = `Music: music/${file}`;
                ci.documentation = new vscode.MarkdownString(`🎵 **microStudio Music**: \`"${name}"\`\n\n- Ścieżka: \`music/${file}\``);
                ci.insertText = `"${name}"`;
                ci.sortText = `0_music_${name}`;
                completions.push(ci);
            }

            // Assets
            const assetsDir = path.join(projectRoot, 'assets');
            const assetFiles = this.scanDirectoryFiles(assetsDir, assetsDir);
            for (const file of assetFiles) {
                const ci = new vscode.CompletionItem(`"${file}"`, vscode.CompletionItemKind.File);
                ci.detail = `Asset: assets/${file}`;
                ci.documentation = new vscode.MarkdownString(`📁 **microStudio Asset**: \`"${file}"\`\n\n- Ścieżka: \`assets/${file}\``);
                ci.insertText = `"${file}"`;
                ci.sortText = `0_asset_${file}`;
                completions.push(ci);
            }
        }

        return completions;
    }

    /**
     * 2. HOVER PROVIDER (Tooltips on hover)
     */
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const lineText = document.lineAt(position.line).text;
        const projectRoot = this.findProjectRoot(document.uri);
        const allItems = this.getAllActiveApiItems(projectRoot);

        // 1. Check for quoted string (Sprite/Map/Sound hover)
        const stringRange = document.getWordRangeAtPosition(position, /["'][^"']*["']/);
        if (stringRange) {
            const raw = document.getText(stringRange);
            const assetName = raw.slice(1, -1);
            if (projectRoot && assetName) {
                const spritePath = path.join(projectRoot, 'sprites', `${assetName}.png`);
                if (fs.existsSync(spritePath)) {
                    const md = new vscode.MarkdownString(`🖼️ **microStudio Sprite**: \`${assetName}\`\n\n- Plik: [sprites/${assetName}.png](${vscode.Uri.file(spritePath)})\n- Format: PNG`);
                    return new vscode.Hover(md, stringRange);
                }

                const mapPath = path.join(projectRoot, 'maps', `${assetName}.json`);
                if (fs.existsSync(mapPath)) {
                    const md = new vscode.MarkdownString(`🗺️ **microStudio Map**: \`${assetName}\`\n\n- Plik: [maps/${assetName}.json](${vscode.Uri.file(mapPath)})\n- Format: JSON Grid Map`);
                    return new vscode.Hover(md, stringRange);
                }

                const soundPath = path.join(projectRoot, 'sounds', `${assetName}.wav`);
                if (fs.existsSync(soundPath) || fs.existsSync(path.join(projectRoot, 'sounds', `${assetName}.json`))) {
                    const md = new vscode.MarkdownString(`🔊 **microStudio Sound**: \`${assetName}\``);
                    return new vscode.Hover(md, stringRange);
                }

                const musicPath = path.join(projectRoot, 'music', `${assetName}.mp3`);
                if (fs.existsSync(musicPath) || fs.existsSync(path.join(projectRoot, 'music', `${assetName}.json`))) {
                    const md = new vscode.MarkdownString(`🎵 **microStudio Music**: \`${assetName}\``);
                    return new vscode.Hover(md, stringRange);
                }
            }
        }

        // 2. Check for direct word / method identifier under cursor (e.g. screen.drawSprite, screen, drawSprite)
        const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
        if (wordRange) {
            const word = document.getText(wordRange);
            const match = allItems.find(i => i.label === word || i.label.split('.').pop() === word || i.label.startsWith(word + '.'));
            if (match) {
                return this.buildHoverForMatch(match, wordRange);
            }
        }

        // 3. Check if cursor/hover is anywhere inside an enclosing function call (e.g. inside screen.drawSprite("", m5x, m5y...))
        const callInfo = this.parseEnclosingFunctionCall(lineText, position.character);
        if (callInfo) {
            const fnMatch = allItems.find(i => i.label === callInfo.functionName || i.label.split('.').pop() === callInfo.functionName);
            if (fnMatch) {
                const md = new vscode.MarkdownString();
                md.appendCodeblock(fnMatch.detail, 'microscript');
                md.appendMarkdown('\n\n' + fnMatch.doc);

                if (fnMatch.parameters && fnMatch.parameters.length > 0) {
                    const activeParam = fnMatch.parameters[callInfo.activeParameterIndex];
                    if (activeParam) {
                        md.appendMarkdown(`\n\n👉 **Aktywny parametr:** \`${activeParam.name}\`${activeParam.type ? ` *(${activeParam.type})*` : ''}: ${activeParam.doc}\n`);
                    }

                    md.appendMarkdown('\n\n**Wszystkie parametry:**\n');
                    fnMatch.parameters.forEach((param, idx) => {
                        const isCurrent = idx === callInfo.activeParameterIndex;
                        const prefix = isCurrent ? '👉 **' : '- `';
                        const suffix = isCurrent ? '** 👈' : '`';
                        md.appendMarkdown(`${prefix}${param.name}${param.type ? ` (${param.type})` : ''}: ${param.doc}${suffix}\n`);
                    });
                }

                if (fnMatch.example) {
                    md.appendMarkdown(`\n\n**Przykład:**\n\`\`\`microscript\n${fnMatch.example}\n\`\`\``);
                }

                return new vscode.Hover(md);
            }
        }

        return null;
    }

    private buildHoverForMatch(match: ApiDocItem, range: vscode.Range): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.appendCodeblock(match.detail, 'microscript');
        md.appendMarkdown('\n\n' + match.doc);

        if (match.parameters && match.parameters.length > 0) {
            md.appendMarkdown('\n\n**Parametry:**\n');
            for (const param of match.parameters) {
                md.appendMarkdown(`- \`${param.name}\`${param.type ? ` *(${param.type})*` : ''}: ${param.doc}\n`);
            }
        }
        if (match.returns) {
            md.appendMarkdown(`\n\n**Zwraca:** ${match.returns}`);
        }
        if (match.example) {
            md.appendMarkdown(`\n\n**Przykład:**\n\`\`\`microscript\n${match.example}\n\`\`\``);
        }
        return new vscode.Hover(md, range);
    }

    /**
     * 3. SIGNATURE HELP PROVIDER (Parameter Hints in Parentheses)
     */
    provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.SignatureHelpContext
    ): vscode.ProviderResult<vscode.SignatureHelp> {
        const lineText = document.lineAt(position.line).text;
        const callInfo = this.parseEnclosingFunctionCall(lineText, position.character);
        if (!callInfo) return null;

        const projectRoot = this.findProjectRoot(document.uri);
        const allItems = this.getAllActiveApiItems(projectRoot);

        const match = allItems.find(i => i.label === callInfo.functionName || i.label.split('.').pop() === callInfo.functionName);
        if (!match || !match.parameters || match.parameters.length === 0) return null;

        const sigHelp = new vscode.SignatureHelp();
        const sigInfo = new vscode.SignatureInformation(match.detail, new vscode.MarkdownString(match.doc));

        sigInfo.parameters = match.parameters.map(p => {
            return new vscode.ParameterInformation(
                p.name,
                new vscode.MarkdownString(`**\`${p.name}\`**${p.type ? ` *(${p.type})*` : ''}: ${p.doc}`)
            );
        });

        sigHelp.signatures = [sigInfo];
        sigHelp.activeSignature = 0;
        sigHelp.activeParameter = Math.min(callInfo.activeParameterIndex, match.parameters.length - 1);

        return sigHelp;
    }
}
