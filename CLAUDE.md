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

## Finding spells, and the table panel

- Search, sort and filters are view state (`uiStore`), applied by pure functions in `domain/`: `filters.ts` (what passes),
  `order.ts` (sort and headings), `search.ts` (full-text haystack), `range.ts` (range text to band and distance) and
  `facets.ts`. A new filter group is one entry in `FACETS`; the panel, the removable chips and the filter pick it up.
  `hooks/useResults.ts` is the one place the stage and the filter bar read the filtered list from.
- Spell-only filters (level, range, school, save, source, ritual) hide class features on purpose, see `onlySpellsQualify`.
- Initiative (1 to 25, or null) and Bardic Inspiration (`{ held, die }`) are persisted play state. Both fields use
  `.default()`, so older saves load. Rests clear held inspiration (it lasts an hour) and never touch initiative.
- The dial's geometry is in `domain/dial.ts`; the component only draws and handles input. A drag saves once, on release, so it
  is one undo step; typed or arrow-key changes coalesce through the `initiative` undo key.

## Color themes

- Every color in `app.css` comes from a CSS custom property. Do not add hex or `rgba()` literals there; use or add a
  token (the only exceptions are the neutral white/black specular and shade layers on the gem).
- Palette token names were chosen for the first theme but are roles, and several invert in the light theme (e.g.
  `--gold-bright` is the stronger accent, so it is darker than `--gold` on Parchment). The contract for every token is in
  the `tokens.css` header: read it before editing a palette. Text drawn on a filled accent uses `--on-gold` /
  `--on-vert` / `--on-gules` / `--on-azure` / `--on-second` / `--on-third`, never `--oak-shadow`.
- Three accent families: gold (primary: brand, cast button, gems), `--second` (structure: panel titles, section labels,
  selected chips, the dial's lit arc, range badge) and `--third` (action and state: `.btn--action`, concentration, counts,
  tags, held inspiration). Each has `-lit` for text. They must have their own hues (a test enforces a 40 degree gap from
  gold), not be tints of the background or of gold. A reset or clear control is `className="btn btn--action"`, not `.link-button`.
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
- Adding a theme: palette CSS block, `THEMES` entry, backdrop rules in `backdrop.css` (or `display: none`), run tests. Steps are in README.md.

## Backdrop texture

- `components/Backdrop.tsx` is a static, `aria-hidden` layer behind the content, painted by `styles/backdrop.css`. It only shows
  through the gaps between panels (the stage, gutters, the rail's margins), so keep it quiet. The `color-mix()` percentages are
  before each mask's own alpha, so judge by screenshot (rough ceilings: grain 45%, marks 85%, edges 65%).
- Each layer is an SVG alpha **mask** over a `color-mix()` of palette tokens, so the artwork has no colors of its own. Masks
  must be `data:` URIs (a `file:` URL fails Chromium's CORS check for `mask-image`). No hex or `rgba()` literals in that file
  (a test enforces it).
- A theme picks which `--tx-*` masks to stack on `.backdrop__tex` / `__marks` / `__edge` (each with `::before` and `::after`,
  so up to six tints, each of which may stack several masks). Marks are placed where cards usually are not; check them in a screenshot. Everything is static: do not
  animate these layers. A new theme needs a block here, or an explicit `display: none` like High Contrast (test enforces it).

## Settings page

`uiStore.view` is `'sheet' | 'settings'`. `App.tsx` swaps the rail and stage for `SettingsPage` while the banner and
footer stay. The gear button in `VitalsBanner` and Cmd/Ctrl+, (in `hooks/useShortcuts.ts`) both call
`uiStore.toggleSettings()`, which also closes the detail drawer when opening. Esc closes settings (handled in
`SettingsPage`). Cmd/Ctrl+, works even while an input has focus; `N` (new turn) is disabled on the settings page.
`useShortcuts` treats only text-type inputs as typing targets, so a focused radio does not swallow shortcuts.

## Spell cast effects

- Casting a spell plays a short show from behind its card. Which effect: the player's per-spell override, else the curated
  match in `MATCHED_EFFECTS` (`domain/effects.ts`, only where the effect clearly fits the spell), else the player's default.
  Both choices are a view preference like the theme: `state/effectsStore.ts`, in localStorage (`paladex.effects`), never in
  the play state.
- `domain/particles.ts` is pure and seeded: it decides where every piece goes and hands numbers to the stylesheet as custom
  properties (`CastEffect.tsx`); the `.fx-*` CSS only decides how pieces look and move. Pieces start on the card's edge so the
  opaque card hides their start.
- `FxHost` (`CastEffect.tsx`) owns the stacking, the show's state and its lifetime. Wrap one opaque box in it and call
  `ref.play(effect)`; do not hand-roll the wrapper. A spell card's host also carries the card's entrance animation
  (`.fx-host--card`).
- Adding an effect: an `EFFECTS` entry, a builder in `BUILDERS` (it will not compile without one), a
  `.fx-layer[data-effect='id'] .fx-piece` block and keyframes in `app.css` (a test fails if the CSS is missing), and
  optionally `MATCHED_EFFECTS` entries. The CSS aura and halo must stay within `BACKDROP_MS`.
- Features (Lay On Hands and the like) keep only the ring on the button: effects are for spells.

## Window state, layout and motion

- Window geometry is a view preference: `src/main/windowState.ts` (electron-free, tested) persists it to
  `<userData>/window-state.json`, wired up in `main/index.ts`. Do not put it in the play state or the renderer.
- Never give a page or panel a fixed `max-width`; widths come from the clamp tokens in `tokens.css`.
- Animations use compositor-friendly properties (opacity, transform, `scale`) and the shared keyframes at the end of
  `app.css`. Infinite animations are limited to the candle glow, gem glint, rune ring, held-spell pulse and low-HP
  heartbeat. Anything that must be invisible without animation has `opacity: 0` as its base state, because the
  reduce-motion rule sets `animation: none`. Ornament colors come from tokens; corner studs are alpha masks in `tokens.css`.
