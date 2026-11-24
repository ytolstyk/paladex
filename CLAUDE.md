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
- Remembered view: `domain/viewPrefs.ts` (pure) parses and serializes the filters and sort; `uiStore` reads it once at load and writes
  on change (`paladex.view`). The search text is deliberately not kept. A new filter field must be added to `parseViewPrefs`, or it
  silently resets on launch (`uiStore.test.ts` and `viewPrefs.test.ts` cover the round trip).
- Favorites are play state (`favorites: string[]` of spell ids, `.default([])`, cleaned by `reconcile`). `groupSpells` pulls starred
  spells into a leading `favorites` group before the sort groups them, so no spell appears twice. Spells only, not features.
- Initiative (1 to 25, or null) and Bardic Inspiration (`{ held, die }`) are persisted play state. Both fields use
  `.default()`, so older saves load. Rests clear held inspiration (it lasts an hour) and never touch initiative.
- The dial's geometry is in `domain/dial.ts`; the component only draws and handles input. A drag saves once, on release, so it
  is one undo step; typed or arrow-key changes coalesce through the `initiative` undo key.

## Weapons tab

- `uiStore.stageTab` (`'spells' | 'attacks'`) picks the stage's view; it is in-session view state, not in `viewPrefs`. FilterBar, SpellGrid
  and OtherFeatures render only on the spells tab. The tab strip (`StageTabs`) is sticky; `.filter-bar` sticks below it by
  `--tabs-height`, so change that token if the strip's height changes.
- Weapons are seed data (`Character.weapons`, from the sheet's inventory by `buildWeapons` in `scripts/normalize.ts`). Attack numbers are
  never stored: `domain/attacks.ts` derives them from abilities, so they are BASE numbers (no spell or magic bonus). There is no
  "equipped" flag on purpose. `Weapon.mastery.known` and `magic` are as of the last import.
- A mastery counts as known when a feat action named "<Mastery> (<kind>)" exists; kinds match regardless of word order
  ("Crossbow, Heavy" is "Heavy Crossbow"). "Graze (Greatsword)" is on the sheet with no Greatsword carried: fine.
- Which spells and features appear under "Attack options" is `scripts/data/attack-riders.ts` (sets `attackRider` on them), never string
  matching. A listed id the sheet lacks makes the importer throw. Decide each new spell there.
- `WeaponCard` keeps the `spell-card` class so `opensDetail` treats a press on it like a spell card press (the drawer switches instead of
  closing). Weapon ids (`weapon:<slug>`, repeats get `-2`) go through `detailId` like spells and features.
- DDB's reference tags (`[rules]x[/rules]`, `[wprop]Thrown[/wprop]`, `[action]A;B[/action]`) are flattened by `htmlToText`.

## The turn, and the turn chart

- `TurnState` (`shared/constants.ts`) is `slotSpellCast`, `bonusActionSpent`, `actionSpent`, `moved`, `reactionSpent`, `castsSinceNewTurn`. The three
  newest use `.default(false)` in the zod `turn` object, so older saves load. All turn rules are in `domain/turn.ts`; `turnActionOf(thing, spendsSlot)`
  is the one place a `TurnAction` is built (toast, card hint and state change all use it). Casting or using something with an `action` / `bonus` /
  `reaction` casting time marks that step. A `reaction` spell neither sets nor warns `slotSpellCast` and is not one of the turn's casts. An `attackRider`
  feature (Vow of Enmity, Breath Weapon) marks the action but never warns (a soft gap, documented in `turn.ts`).
- The four steps are marked by hand in `TurnPanel` only (`toggleTurnStep`, step names in `TURN_STEPS`): it is the one writer. Each toggle is one
  undo `edit` key per step (a mis-tap and its correction are one step) and a `turn-step` log entry. `New turn` clears everything; `isTurnClear`
  must list every flag or it silently does nothing. A save with `turn-step` log entries is unreadable to a build from before it (rollback only).
- `TurnChart` only reads. `domain/turnChart.ts` (`buildTurnChart`, pure) is a skeleton of short prompt lines, with no rules prose and no skill numbers;
  the Bonus action and Reaction leaves come from `domain/turnOptions.ts` by casting time, independent of the spell filters (like `attackRiders`).
  The End of turn line lists only the bonus action and reaction on purpose: the Attack action cannot be auto-marked, and speed is not a pool.
- Layout: `.app[data-chart]` adds a third grid column (`--chart-width` = `--drawer-width`) from 1180 px up; below that the chart is `position: fixed`
  at 300 px and the stage gets matching right padding. The detail drawer shares the chart's edge and width and simply stacks over it (the chart goes
  `inert` meanwhile). The chart does not use `useDismiss`: its own Esc runs when focus is inside it, and with a detail open the chart is `inert`, so the
  detail's Esc closes it first and the chart takes focus back for the next one. While the chart is open the `This turn` panel is `order: -1` in the rail so the writer is never scrolled away.
  `chartOpen` is in `uiStore`, in-session, and kept (not drawn) on the settings page. `T` toggles it.
- `PALADEX_SIZE=960x640` (with `PALADEX_SHOT`) sizes the window for a screenshot, so the 1180 px breakpoint and a short window can be checked.

## Recently cast, history and duration timers

- "Recently cast" and the History list (`RecentCasts`, `domain/recent.ts`) are read from `play.log` (cast and feature entries), so they follow Undo and add
  nothing to the save. The log keeps 200 entries shared with everything else, so history reaches back about one session. A chip opens the detail
  drawer (`opensDetail` knows `.recent-chip`); it does not cast.
- `PlayState.timers` (`{ spellId, remaining, total }`, **seconds**, `.default([])`, each entry validated alone so one bad timer cannot make a save unreadable)
  starts in `castSpell` when `durationSeconds(spell.duration)` (`domain/duration.ts`) is finite; a recast restarts it. Rules are in `domain/timers.ts`:
  `elapse` (a timer at 0 is removed, and takes the concentration with it) and `settleTimers`, the one place that drops a timer for an unknown spell, a duplicate,
  or a concentration spell that is no longer `state.concentration` (read from the catalog, not a stored flag). Every action that can change concentration calls it
  (`castSpell`, `dropConcentration`, `adjustHp`, `endTimer`, `elapse`), and so does `reconcile`.
- **New turn is the tick**: `startNewTurn(state, catalog, now, turnSeconds)`. It is still a no-op when the turn is clear and no timer runs; when it only ticks, a run
  of presses is one undo step (`undoKey.newTurn`) and one log line. Rests let time pass too (`REST_SECONDS`: short 1 hour, long 8: the least a rest takes).
  Each expiry also logs a `timer-end` entry (a save with one is unreadable to a build from before it: rollback only). A test (`timers.test.ts`) fails if a re-import
  brings a duration the parser cannot read and that is not on its short untimed list.
- The turn length is a view preference (`state/timerPrefsStore.ts`, `paladex.timers`, `domain/timerPrefs.ts`), wired into the play store as the `turnSeconds` dependency
  in `state/session.ts`. Timers stay in seconds, so changing it never rewrites a running timer; "turns left" is `ceil(remaining / turnSeconds)`.
- Timers use the printed (base) duration. Upcast durations are not modelled, and features have no duration data.

## Spell components

- `Spell.components` is `{ verbal, somatic, material, materialText? }`, data not play state. `scripts/components.ts` is the only place
  one is built (DDB codes 1/2/3, or the compact `'VSM'` codes in `scripts/data/authored-spells.ts`) and it throws on item text
  without a material component. A missing DDB list is an import error, never "none". `createCatalog` also checks the field at
  startup, since the renderer cannot use zod.
- `materialText` is absent when the spell has no M, and also for the few spells whose D&D Beyond page could not be read
  (`normalize.test.ts` lists them as a deliberate tripwire: when you fill one in, remove it there). The UI says "item not recorded".
- The card's V S M marks (`ComponentMarks`) are always all three: lit = needed, dashed and struck = not needed (no `opacity`, so
  theme contrast stays token-based). Search matches "verbal", "somatic", "material" as shown words and the item text as hidden text.
  It is not a `FACETS` entry: facets are one value per spell and components combine. A "no verbal" style filter needs its own shape.

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
