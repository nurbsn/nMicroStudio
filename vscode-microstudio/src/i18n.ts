import * as vscode from 'vscode';

export type SupportedLocale = 'en' | 'pl';

const translations: Record<SupportedLocale, Record<string, string>> = {
    en: {
        // General & Project Settings
        'no_active_project': 'No active microStudio project.',
        'select_project_or_open': 'Select a project file or open a folder containing project.json.',
        'project_title': 'Project Title:',
        'slug': 'Slug:',
        'version': 'Version:',
        'engine_config': 'Engine Configuration',
        'language': 'Language:',
        'graphics_engine': 'Graphics Engine:',
        'project_type': 'Type:',
        'type_game': 'Game',
        'type_app': 'App',
        'type_library': 'Library',
        'orientation': 'Orientation:',
        'orientation_landscape': 'Landscape',
        'orientation_portrait': 'Portrait',
        'orientation_any': 'Any',
        'aspect': 'Aspect Ratio:',
        'aspect_free': 'Free',
        'libraries': 'Libraries',
        'browse_libraries': 'Browse',
        'no_connected_libs': 'No connected libraries',
        'save_settings': 'Save Settings',
        'settings_saved': 'Project settings saved successfully.',
        'push_to_server': 'Push to microStudio.dev',
        'edit_json': 'JSON',

        // Resource Creator
        'new_sprite_prompt': 'Enter new Sprite name (e.g. player, enemies/boss):',
        'new_sprite_created': 'Created new Sprite: {0}',
        'sprite_already_exists': 'Sprite "{0}" already exists!',
        'new_map_prompt': 'Enter new Map name (e.g. map1, world/level1):',
        'new_map_created': 'Created new Map: {0}',
        'map_already_exists': 'Map "{0}" already exists!',
        'new_script_prompt': 'Enter new Script file name (e.g. player, ui/menu) [extension .ms]:',
        'new_script_created': 'Created new Script: {0}.ms',
        'script_already_exists': 'Script file "{0}.ms" already exists!',
        'new_sound_prompt': 'Enter new Sound file name (e.g. jump, explosion):',
        'new_sound_created': 'Created Sound file: {0}.wav',
        'new_music_prompt': 'Enter new Music file name (e.g. theme, battle):',
        'new_music_created': 'Created Music file: {0}.mp3',
        'import_assets_title': 'Select files to import to assets/',
        'imported_assets': 'Imported {0} file(s) to assets/',
        'name_cannot_be_empty': 'Name cannot be empty',
        'project_not_found': 'No active microStudio project found (missing project.json).',

        // Project Explorer & Sync
        'set_workspace_root': 'Set Projects Root Directory...',
        'set_workspace_root_dialog': 'Select Projects Root Directory',
        'workspace_root_set': 'Set projects root folder: {0}',
        'no_local_projects': 'No local microStudio projects found in directory.',
        'local_projects_error': 'Error reading projects directory.',
        'already_connected': 'Already connected to microstudio.dev',
        'login_username_prompt': 'Enter microStudio username',
        'login_password_prompt': 'Enter microStudio password',
        'login_connecting': 'Connecting to microstudio.dev...',
        'login_success': 'Logged in as {0}',
        'login_failed': 'Login error: {0}',
        'login_required_download': 'You must be logged in to download projects.',
        'login_required_upload': 'You must be logged in to microstudio.dev to upload projects.',
        'login_action': 'Log In',
        'logged_out': 'Logged out from microstudio.dev',
        'clone_project_title': 'Downloading project "{0}"...',
        'clone_project_success': 'Project "{0}" downloaded successfully.',
        'clone_project_failed': 'Download error: {0}',
        'directory_exists_overwrite': 'Directory "{0}" already exists. Do you want to overwrite it?',
        'yes': 'Yes',
        'open_project_current_window': 'Open in current window',
        'open_project_new_window': 'Open in new window',
        'project_already_open': 'Project "{0}" is already open in the current window.',
        'delete_project_confirm': 'Are you sure you want to delete local project "{0}"?',
        'delete_project_success': 'Deleted project "{0}".',
        'delete_project_failed': 'Failed to delete project: {0}',
        'select_remote_project_title': 'Select Target Project on microstudio.dev',
        'select_remote_project_prompt': 'Select the remote project on microstudio.dev to push "{0}" to:',
        'suggested_matches': 'Suggested matches on your account:',
        'all_remote_projects': 'All your remote projects:',
        'create_new_remote': 'Create new project on microstudio.dev: "{0}"',
        'upload_cancelling': 'Project upload cancelled.',
        'upload_creating_remote': 'Creating new project "{0}" on server...',
        'upload_syncing_options': 'Syncing project options...',
        'uploading_file': 'Uploading {0} ({1}/{2})...',
        'upload_finished': 'Project "{0}" successfully updated on microStudio server!',
        'upload_failed': 'Upload error: {0}',

        // HTML Export & Preview
        'export_html_title': 'Exporting game to HTML5...',
        'export_html_success': 'Successfully exported game to: {0}',
        'open_in_browser': 'Open in Browser',
        'preview_project_not_found': 'No microStudio project found to preview.'
    },
    pl: {
        // General & Project Settings
        'no_active_project': 'Brak aktywnego projektu microStudio.',
        'select_project_or_open': 'Wybierz plik projektu lub otwórz katalog z project.json.',
        'project_title': 'Tytuł projektu (Title):',
        'slug': 'Slug:',
        'version': 'Wersja:',
        'engine_config': 'Konfiguracja Silnika',
        'language': 'Język:',
        'graphics_engine': 'Silnik graficzny (Graphics):',
        'project_type': 'Typ:',
        'type_game': 'Gra (Game)',
        'type_app': 'Aplikacja (App)',
        'type_library': 'Biblioteka (Library)',
        'orientation': 'Orientacja:',
        'orientation_landscape': 'Pozioma (Landscape)',
        'orientation_portrait': 'Pionowa (Portrait)',
        'orientation_any': 'Dowolna (Any)',
        'aspect': 'Proporcje (Aspect):',
        'aspect_free': 'Swobodne (Free)',
        'libraries': 'Biblioteki (Libraries)',
        'browse_libraries': 'Biblioteki',
        'no_connected_libs': 'Brak podłączonych bibliotek',
        'save_settings': 'Zapisz ustawienia',
        'settings_saved': 'Ustawienia projektu zostały pomyślnie zapisane.',
        'push_to_server': 'Wyślij na serwer (Push)',
        'edit_json': 'JSON',

        // Resource Creator
        'new_sprite_prompt': 'Podaj nazwę nowego Sprite\'a (np. gracz, wrogowie/boss):',
        'new_sprite_created': 'Utworzono nowy Sprite: {0}',
        'sprite_already_exists': 'Sprite o nazwie "{0}" już istnieje!',
        'new_map_prompt': 'Podaj nazwę nowej Mapy (np. mapa1, swiat/poziom1):',
        'new_map_created': 'Utworzono nową Mapę: {0}',
        'map_already_exists': 'Mapa o nazwie "{0}" już istnieje!',
        'new_script_prompt': 'Podaj nazwę nowego pliku skryptu (np. gracz, ui/menu) [rozszerzenie .ms]:',
        'new_script_created': 'Utworzono skrypt: {0}.ms',
        'script_already_exists': 'Plik skryptu "{0}.ms" już istnieje!',
        'new_sound_prompt': 'Podaj nazwę pliku dźwiękowego (np. skok, wybuch):',
        'new_sound_created': 'Utworzono plik dźwiękowy: {0}.wav',
        'new_music_prompt': 'Podaj nazwę pliku muzycznego (np. tlo, bitwa):',
        'new_music_created': 'Utworzono plik muzyczny: {0}.mp3',
        'import_assets_title': 'Wybierz pliki do zaimportowania do assets/',
        'imported_assets': 'Zaimportowano {0} plik(ów) do assets/',
        'name_cannot_be_empty': 'Nazwa nie może być pusta',
        'project_not_found': 'Nie znaleziono aktywnego projektu microStudio (brak pliku project.json).',

        // Project Explorer & Sync
        'set_workspace_root': 'Ustaw katalog główny projektów...',
        'set_workspace_root_dialog': 'Wybierz katalog główny projektów',
        'workspace_root_set': 'Ustawiono katalog główny projektów: {0}',
        'no_local_projects': 'Brak lokalnych projektów w katalogu.',
        'local_projects_error': 'Błąd odczytu katalogu głównego.',
        'already_connected': 'Już połączono z microstudio.dev',
        'login_username_prompt': 'Wpisz nazwę użytkownika microStudio',
        'login_password_prompt': 'Wpisz hasło microStudio',
        'login_connecting': 'Łączenie z microstudio.dev...',
        'login_success': 'Zalogowano jako {0}',
        'login_failed': 'Błąd logowania: {0}',
        'login_required_download': 'Musisz być zalogowany, aby pobrać projekt.',
        'login_required_upload': 'Musisz być zalogowany do microstudio.dev, aby wysłać projekt.',
        'login_action': 'Zaloguj się',
        'logged_out': 'Wylogowano z microstudio.dev',
        'clone_project_title': 'Pobieranie projektu "{0}"...',
        'clone_project_success': 'Projekt "{0}" został pobrany.',
        'clone_project_failed': 'Błąd pobierania projektu: {0}',
        'directory_exists_overwrite': 'Katalog "{0}" już istnieje. Czy chcesz go nadpisać?',
        'yes': 'Tak',
        'open_project_current_window': 'Otwórz w bieżącym oknie',
        'open_project_new_window': 'Otwórz w nowym oknie',
        'project_already_open': 'Projekt "{0}" jest już otwarty w bieżącym oknie.',
        'delete_project_confirm': 'Czy na pewno chcesz usunąć lokalny projekt "{0}"?',
        'delete_project_success': 'Usunięto projekt "{0}".',
        'delete_project_failed': 'Nie udało się usunąć projektu: {0}',
        'select_remote_project_title': 'Wybór zdalnego projektu docelowego',
        'select_remote_project_prompt': 'Wybierz zdalny projekt na microstudio.dev, do którego chcesz wysłać "{0}":',
        'suggested_matches': 'Sugerowane dopasowania na Twoim koncie:',
        'all_remote_projects': 'Wszystkie Twoje projekty zdalne:',
        'create_new_remote': 'Utwórz nowy projekt na microstudio.dev: "{0}"',
        'upload_cancelling': 'Anulowano wysyłanie projektu.',
        'upload_creating_remote': 'Tworzenie nowego projektu "{0}" na serwerze...',
        'upload_syncing_options': 'Aktualizacja opcji projektu...',
        'uploading_file': 'Wysyłanie {0} ({1}/{2})...',
        'upload_finished': 'Projekt "{0}" został pomyślnie zaktualizowany na serwerze microStudio!',
        'upload_failed': 'Błąd wysyłania projektu: {0}',

        // HTML Export & Preview
        'export_html_title': 'Eksportowanie gry do HTML5...',
        'export_html_success': 'Pomyślnie wyeksportowano grę do: {0}',
        'open_in_browser': 'Otwórz w przeglądarce',
        'preview_project_not_found': 'Nie znaleziono projektu microStudio do uruchomienia podglądu.'
    }
};

export class I18n {
    public static getLocale(): SupportedLocale {
        const config = vscode.workspace.getConfiguration('microstudio');
        const langSetting = config.get<string>('language', 'auto');
        
        if (langSetting === 'pl' || langSetting === 'en') {
            return langSetting;
        }

        const vscodeLang = vscode.env.language.toLowerCase();
        if (vscodeLang.startsWith('pl')) {
            return 'pl';
        }
        return 'en';
    }

    public static t(key: string, ...args: any[]): string {
        const locale = this.getLocale();
        let template = translations[locale]?.[key] || translations['en']?.[key] || key;

        if (args && args.length > 0) {
            args.forEach((arg, index) => {
                template = template.replace(new RegExp(`\\{${index}\\}`, 'g'), String(arg));
            });
        }

        return template;
    }

    public static getAll(locale?: SupportedLocale): Record<string, string> {
        const loc = locale || this.getLocale();
        return translations[loc] || translations['en'];
    }
}
