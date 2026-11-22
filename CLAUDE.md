# Paladex: notes for Claude

Offline Electron + React + TypeScript companion for a 2024-rules D&D Paladin. Zustand for state, zod for the persisted
schema, vitest for tests. See README.md for scripts and layout.

## Verify

- `npm run typecheck` and `npm test` must both pass (three tsconfigs: node, web, test).
- For visual changes, run the real app: `npm run build` then
  `PALADEX_USER_DATA=<tmpdir> PALADEX_SHOT=<out.png> PALADEX_EVAL=<js file> npx electron .`
  The hook (unpackaged only) loads the page, runs the eval script, waits 600 ms, captures a PNG and quits. A script
  that only schedules timers returns immediately, so its later steps may not have run at capture time. For
  multi-step interactions return a Promise that resolves after the last step (it is awaited).
- Always set `PALADEX_USER_DATA`. A launch without it touches the real `~/Library/Application Support/Paladex`.
  The theme persists in that profile's localStorage, so a reused tmpdir carries the previous run's theme.

## Conventions

- `src/renderer/domain/` is pure logic with colocated `*.test.ts`. Keep React and the DOM out of it. It is also
  type-checked by `tsconfig.test.json`, so it must not import from `components/` or `state/`.
- The renderer and preload must not import `src/shared/schema.ts` at runtime (it pulls zod into the bundle). Use
  `src/shared/constants.ts` and types instead.
- View-only state goes in `state/uiStore.ts` (never saved, never undoable). Persisted play state goes through
  `playStore` and the main-process store. Do not put UI preferences in the play state.
- The page is one local document with a strict CSP (`script-src 'self'` in production): no inline scripts.
- Gameplay rules are the 2024 ones. Only one spell slot may be expended per turn; free casts, item charges and cantrips
  do not count. This is a soft hint in the UI, not a block.

## Color themes

- Every color in `app.css` comes from a CSS custom property. Do not add hex or `rgba()` literals there; use or add a
  token (the only exceptions are the neutral white/black specular and shade layers on the gem).
- Palette token names were chosen for the first theme but are roles, and several invert in the light theme (e.g.
  `--gold-bright` is the stronger accent, so it is darker than `--gold` on Parchment). The contract for every token is in
  the `tokens.css` header: read it before editing a palette. Text drawn on a filled accent uses `--on-gold` /
  `--on-vert` / `--on-gules` / `--on-azure`, never `--oak-shadow`.
- Palettes: Candlelit Oak is the default and lives in `styles/tokens.css` (`:root, [data-theme='oak']`); the others are
  `[data-theme='id']` blocks in `styles/themes.css`. `themes.css` must be imported after `tokens.css` (they tie on
  specificity). The id is set as `data-theme` on `<html>` twice: first by the blocking classic script
  `public/theme-boot.js` (before first paint; it must be an external file because of the CSP, and it duplicates the
  `paladex.theme` key from `state/themeStore.ts`, so change both together), then by `initTheme()` in `main.tsx`,
  which validates the stored value and tracks later changes.
- Derived tokens (`--rule*`, `--shadow-*`, `--gem-*`, role aliases) are declared on `:root, [data-theme]` in
  `tokens.css`. That matters: a custom property that references `var()` is resolved where it is declared, so each
  themed element, including the settings preview swatches, must re-derive its own. Do not move them to `:root` only.
- Theme ids, names and blurbs are in `domain/themes.ts`. `domain/themes.test.ts` reads the CSS and fails if a palette is
  missing a token, has an orphaned CSS block, or a text pair drops below WCAG AA (4.5:1). Candlelit Oak predates the
  check, so four of its specific pairs are allowlisted at 3:1 in `KNOWN_BELOW_AA`; do not add to that list. Palette
  values must be 3- or 6-digit hex literals (the test throws on anything else).
- Adding a theme: CSS block, `THEMES` entry, run tests. Steps are in README.md.

## Settings page

`uiStore.view` is `'sheet' | 'settings'`. `App.tsx` swaps the rail and stage for `SettingsPage` while the banner and
footer stay. The gear button in `VitalsBanner` and Cmd/Ctrl+, (in `hooks/useShortcuts.ts`) both call
`uiStore.toggleSettings()`, which also closes the detail drawer when opening. Esc closes settings (handled in
`SettingsPage`). Cmd/Ctrl+, works even while an input has focus; `N` (new turn) is disabled on the settings page.
`useShortcuts` treats only text-type inputs as typing targets, so a focused radio does not swallow shortcuts.

## Window state, layout and motion

- Window geometry is a view preference: `src/main/windowState.ts` (electron-free, tested) persists it to
  `<userData>/window-state.json`, wired up in `main/index.ts`. Do not put it in the play state or the renderer.
- Never give a page or panel a fixed `max-width`; widths come from the clamp tokens in `tokens.css`.
- Animations use compositor-friendly properties (opacity, transform, `scale`) and the shared keyframes at the end of
  `app.css`. Infinite animations are limited to the candle glow, gem glint, rune ring, held-spell pulse and low-HP
  heartbeat. Anything that must be invisible without animation has `opacity: 0` as its base state, because the
  reduce-motion rule sets `animation: none`. Ornament colors come from tokens; corner studs are alpha masks in `tokens.css`.
