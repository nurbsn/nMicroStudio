# Stan Projektu: microStudio dla VS Code (`vscode-microstudio`)

**Data zapisu**: 2026-08-30
**Status**: Wdrożono wielojęzyczność (i18n) dla rozszerzenia z obsługą języka polskiego i angielskiego oraz możliwością łatwego dodawania kolejnych języków.

---

## 1. Podsumowanie ostatnich zmian

### A. System Wielojęzyczności (i18n)
- **Moduł `src/i18n.ts`**:
  - Obsługa języków `pl` (polski) i `en` (angielski).
  - Automatyczne wykrywanie języka z `vscode.env.language` oraz opcja wymuszenia w ustawieniach (`microstudio.language`).
  - Podstawianie parametrów w komunikatach `{0}`, `{1}`.
- **Pliki NLS**: `package.nls.json` (angielski) oraz `package.nls.pl.json` (polski).
- **Integracja**:
  - `ProjectSettingsView`: formularz, selektory silnika, typów i proporcji.
  - `ResourceCreator`: tworzenie sprite'ów, map, skryptów, dźwięków, muzyki.
  - `MicroStudioSync`: logowanie, pobieranie, wysyłanie projektów.
  - `ProjectExplorer`: drzewa projektów lokalnych i zdalnych.
  - `extension.ts`: eksport HTML5, podgląd.

---

## 2. Aktualny stan projektu

- **Kompilacja**: Pakiety Webpack (`npm run compile`) skompilowane bez błędów.
