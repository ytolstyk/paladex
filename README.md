# Paladex

An offline spell, slot and resource tracker for a D&D 2024-rules Paladin, built with Electron, React and TypeScript.
It tracks spell slots, prepared spells, per-turn action economy, class resources, hit points and rests, with undo.

## Getting started

```bash
npm install
npm run dev          # run the app with hot reload
npm test             # vitest
npm run typecheck    # node, web and test tsconfigs
```

| Script | What it does |
| --- | --- |
| `npm run seed` | Rebuilds `data/havel.character.json` from the raw D&D Beyond export in `data/raw/` (gitignored) |
| `npm run build:app` | Builds an unpacked macOS app into `dist/` |
| `npm run install-app` | Builds and installs to `/Applications` (flags: `--no-build`, `--dir`, `--open`, `--dry-run`) |
| `npm run icon` | Regenerates the app icon from `build/icon.svg` |

## Settings and color themes

Open settings with the gear button in the top bar, or **Cmd+,** (Ctrl+, elsewhere). **Esc** or "Back to sheet" returns.
Each theme is previewed as a miniature of the sheet, and choosing one applies instantly and is remembered.

| Theme | Character |
| --- | --- |
| Candlelit Oak | Warm dark wood and gold leaf (the default) |
| Moonlit Steel | Cool slate with a silver accent |
| Elven Glade | Deep forest green with leaf-gold trim |
| Ember Court | Burgundy and banked coals, copper accent |
| Parchment & Ink | The one light theme, for bright rooms |
| High Contrast | Black and white with a bold yellow accent |

The choice is a view preference, stored in the renderer's `localStorage` (key `paladex.theme`). It is separate from the
play state, so it is never undone, logged or exported. A tiny blocking script, `src/renderer/public/theme-boot.js`, applies
it before the first paint so there is no flash of the default theme on launch.

### Adding a theme

1. Add a `[data-theme='your-id']` block to `src/renderer/styles/themes.css`. Copy an existing block and change the
   values; every palette token must be present, as plain hex literals. Set `color-scheme: dark` or `light` in the block.
2. Add `{ id, name, blurb }` to `THEMES` in `src/renderer/domain/themes.ts`.
3. Run `npm test`. `domain/themes.test.ts` checks that the registry and CSS agree (no missing or orphaned blocks) and
   enforces WCAG AA contrast (4.5:1) on every text pair of every palette.

The settings preview needs no extra work: it wears the theme through `data-theme`, so it always matches the real UI.

## Where things live

```
src/main/       Electron main process: window, menu, IPC, atomic JSON store with backup
src/preload/    The `window.paladex` bridge
src/shared/     Types, zod schema and constants shared by every process
src/renderer/
  domain/       Pure game logic (slots, rests, turns, filters, themes) with colocated tests
  state/        zustand stores: play state (persisted), UI state (not persisted), theme (localStorage)
  components/   React components
  styles/       tokens.css (default palette, token contract, shared tokens), themes.css (other palettes), app.css
  public/       theme-boot.js, the pre-paint theme script (static, copied as-is)
scripts/        Seeding, icon and install tooling
data/           Seeded character JSON
```

Play state is saved to `~/Library/Application Support/Paladex`. Set `PALADEX_USER_DATA=<dir>` to use a throwaway
profile when testing; this matters because Electron ignores `$HOME` on macOS.
