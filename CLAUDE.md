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

## Dice tray

- `domain/dice.ts` (pure, `Rand` injected, `secureRand` by default) decides every roll: `rollInitiative(modifier, mode)` (d20 + `initiativeModifier`, 1 or 2 dice, the
  result held to the dial's 1 to 25 with `wasClamped`) and `rollInspiration(sides)`. `state/rolls.ts` is the only caller: it rolls, **writes the outcome to the sheet
  at once** through the ordinary actions (`commitRoll`: `setInitiative(result)`, or `setInspirationHeld(false)`), then puts the roll in `uiStore.roll` (view state, never saved).
  A roll is therefore an undoable change and a log line whether or not anyone watches. Initiative is an `edit` that coalesces (2 s), so a quick reroll shares an undo step
  with the roll before it, and a reroll that lands on the same number changes nothing.
- `DiceTray` only plays the roll back. Its `Tray` shell (scrim, card, Esc, Tab trap, focus return) stays mounted across rerolls; only `RollBody` is keyed by roll id.
  While it is open the sheet's shortcuts are off (`useShortcuts` returns early when `uiStore.roll` is set). Esc, the scrim and Done just close it, since nothing is pending.
  `TUMBLE_MS` and `DIE_STAGGER_MS` reach the stylesheet as `--tumble-ms` / `--die-delay`, so the JS landing timer and the CSS animation share one number. With reduced motion
  the dice are down at once (animations are also `none` by the global rule, so everything shown must be visible in its base state).
- `Die.tsx` holds the die shapes (d6 to d12 for the Bard, d20 for the tray); add a size there and to `DieSides`.
- A roll does not feed the turn tracker or the weapons tab, and the log keeps only the result (not the d20 or the modifier). A general roller and damage dice are still on the roadmap.

## Weapons tab

- `uiStore.stageTab` (`'spells' | 'attacks' | 'traits'`) picks the stage's view; it is in-session view state, not in `viewPrefs`. FilterBar, SpellGrid
  and TraitMatches render only on the spells tab. The tab strip (`StageTabs`) is sticky; `.filter-bar` sticks below it by
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

## Feats and traits

- `SeedData.traits` (`Trait` in `shared/types.ts`: `kind` oath/species/feat/homebrew, `when` passive/action/bonus/reaction/triggered, `summary`, `text`, `related` ids) replaced `otherFeatures`.
  A trait is reference only: a thing with a use count is a `Feature` with a counter. `kind` and `when` lists are `TRAIT_KINDS` / `TRAIT_WHENS` in `shared/constants.ts`.
- `scripts/data/trait-overlay.ts` is an allowlist (which sheet entries, `when`, our own one-line summary, `related`); the text always comes from the sheet. `buildTraits` in
  `normalize.ts` skips an Oath feature above the character's level (a re-seed after level-up shows it), reads the chosen dragon's text (`textFromRaceOption`), appends what the sheet
  chose elsewhere (`TRAIT_EXTRAS`: languages, weapon masteries) and warns about a sheet feat or species trait that is neither listed nor in `IGNORED_FEATS` / `IGNORED_RACIAL_TRAITS`. Summaries must not
  carry numbers a level-up changes. `related` ids are checked in `createCatalog`, so a rename fails at seed time. Death Coil stays out (see memory): do not add it as homebrew.
- `catalog.ts` is loaded by the seed script (tsx, no Vite aliases), so it imports `../../shared/constants` relatively. Keep runtime `@shared` imports out of anything `normalize.ts` reaches.
- View state: `uiStore.traitFilters` (query, kinds, whens), in-session, separate from the spell `filters` and not remembered. Pure logic is `domain/traits.ts` (`filterTraits`, `groupTraits`);
  search is `traitMatches` in `search.ts`. `TraitsPage` owns the tab's search input and uses `SEARCH_INPUT_ID` (only one tab renders at a time, so `/` works on both). `TraitCard` keeps the
  `spell-card` class so `opensDetail` treats it like a spell card; its "See also" buttons are their own action. The detail drawer shows a trait through `detailEntry` (`kind: 'trait'`).

## Stats tab

- `uiStore.stageTab` also has `'stats'` ("Stats & saves"). `StatsPage` is read only and saves nothing: ability modifiers, saving throws, the passive
  scores (`PASSIVE_SKILLS`: Perception, Insight, Investigation) and the 18 skills. All of it is `domain/stats.ts` `buildStats` (pure), from `Character.abilities`,
  `proficiencyBonus` and `Character.proficiencies` (`saves` + `skills`: `proficient` / `expertise`; seed data, from DDB `proficiency` / `expertise` modifiers by `buildProficiencies` in `normalize.ts`).
  `ABILITIES` and `SKILLS` (with each skill's ability) are in `shared/constants.ts`.
- They are BASE numbers, like the attack numbers: no aura, spell or item bonus (Aura of Protection arrives at Paladin 6 and is not added), and no half proficiency. A re-seed
  after a level-up or a new skill refreshes them; a passive Perception check against the rendered sheet is in `normalize.test.ts`.

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

## Undo, and correcting the history ("Edit steps")

- Every change to the play state is a `Call` (`domain/calls.ts`, leaf types only so `undo.ts` can hold `Step`s without a cycle) run by `runCall`;
  the store's private `dispatch(call)` is the only writer (besides `undoLast` and `applyHistoryChange`), and every writer ends in `commit`.
  A new action therefore needs: a `Call` kind and a row in each table keyed by kind, `RUNNERS` and `DROP_REASON` (`steps.ts`) and `EDIT_RULES`
  (`stepEdit.ts`, `null` = remove only), which the compiler enforces, plus a name in the list in `replay.test.ts` (a test fails for an exported
  action with no kind). Toggles store the value they set (`on`), never "flip", so a replay cannot invert them; `callFor` (`steps.ts`) builds those
  calls from the sheet so the store stays a dispatcher. The action functions themselves are unchanged and still toggle.
- `UndoEntry` (30 of them; a run of taps is one, up to `MAX_STEPS_PER_ENTRY`) holds the `Step`s (`{ id, call, t, entry }`) it is made of. The ids are stable through a
  replay; the history list and the store address steps by id, never by position.
- `domain/replay.ts` runs the whole stack again from the oldest remembered state with one change: remove a step, edit one step's call, or
  `revert` (the state before a step; the newest entry's "Undo from here" is plain Undo). It rebuilds the stack through `pushUndo`, so
  coalescing is the same as live play, and it rewrites `play.log` (Recently cast and the footer follow). `isReplayable` is the guard: the
  same replay with no change must equal the sheet, or editing is off. `previewHistoryChange` (pure) adds the diff (`stateDiff.ts`: one describer per part of the sheet, a test checks that every play-state key is
  worded or ignored) and is run again inside the store's `applyHistoryChange(change, shown)`, which
  refuses when the undo list is not the one the player was shown.
- Typed amounts (`stepEdit.ts` `AMOUNT_LIMIT`, and `Number.isSafeInteger` in `adjustHp` and `adjustCounter`) must stay small and safe: the main process refuses to save a
  log entry whose amount is not a safe integer, and then every later save fails.
- Payments on replay: only a payment the player picked (the upcast stepper, `cast(id, payment, { picked: true })`) is kept in the step. A default cast
  pays the way the card would at that point, so removing a free cast lets a later one use it. A picked payment and an edited step are strict: if
  unavailable the step is dropped (listed in the preview) or the edit refused, never paid some other way. `dropConcentration` carries the
  spell and does nothing if that spell is no longer the concentration. `newTurn` carries the turn length it was pressed with.
- Undo after a correction: `historyBackup` holds the sheet and list from just before it. While it is live `undoLast` (footer, Cmd+Z, toast,
  the list's button) restores it once instead of popping a step; any new action, load or reset clears it. `canUndo` (`playStore.ts`) counts it.
- The list is session only (never saved) and `historyOpen` is `uiStore` view state, closed when settings opens. Persisting the list would
  need a schema change and rollback-only saves; it is not done.

## Conditions

- `PlayState.conditions` is `ConditionId[]` (`CONDITIONS` in `shared/constants.ts`: the 14 of the 2024 rules, exhaustion excluded because it is a level). The schema reads it entry by
  entry (`.default([])`): an unknown name, a duplicate or junk is dropped, and the list always comes out in `CONDITIONS` order. A `condition` log entry (`condition`, `on`, and
  `endedSpellId` when it broke concentration) names its condition with a strict enum like `turn-step`, so a save holding one is unreadable to a build from before it (rollback only).
- Names, one-line summaries, rules lines and log wording are `domain/conditions.ts` (`CONDITION_INFO`, a Record, so a new id will not compile until described). The rules lines are paraphrases.
- One writer: `setCondition` in `domain/tableActions.ts`, `Call` kind `condition` (`{ id, on }`, an `on` value and never a flip, so a replay cannot invert it; `callFor.condition` builds it). Undo is an `edit` keyed per condition (`undoKey.condition`), so a mis-tap and its correction are one step.
  Not editable in the history list, only removable.
- Only the conditions that include Incapacitated (`incapacitating`: incapacitated, paralyzed, petrified, stunned, unconscious) do anything beyond being a note: setting one ends concentration, automatically,
  like dropping to 0 hit points (log, toast and `settleTimers`). Taking it off does not give concentration back. Nothing is blocked, and prone, frightened and the rest change no numbers. Casting while Incapacitated is deliberately not warned about or refused (the table's ruling wins); the rule only acts when the condition is set. A rest never clears one.
- `ConditionsPanel` (rail, after the turn panel) toggles and reads; the vitals banner shows the active ones as one row of badges (whole badges drop off when it is narrow; the panel lists all).

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

## Companion window (second screen)

- A second `BrowserWindow` loading the same page with `#companion` (`main.tsx` picks `<Companion />` over `<App />`; `public/theme-boot.js` sets
  `data-view='companion'` before first paint). It is a read-only mirror: it never starts the play store (that would load, and could seed and save, the
  sheet) and calls `initAmbientPause({ followFocus: false })` (it is never the focused window, so only hidden or minimized pauses its heartbeat and rune ring).
- Data flow: the sheet's `saveState` handler in `main/index.ts` validates, then **pushes** the parsed state to the companion (`IPC.companionState`) before
  the disk write. The companion listens first and loads second (`state/companionStore.ts`): any push that lands during the load wins. `reconcile` runs
  on it in memory, never saved. `StatePort` (`shared/ipc.ts`) is what the play store needs; `PaladexApi` adds the window calls.
- The window's lifecycle (one at a time, push, a stale `closed` never clears a newer window, the menu check follows `onOpenChange`) is `main/companionWindow.ts`, a controller
  with an injected window factory so it is tested without Electron; `main/index.ts` only supplies the Electron side. Every window gets `secureWebPreferences()` and `loadPage()`.
- IPC trust is per window: `CHANNEL_ROLES` in `main/ipcPolicy.ts` (a row per channel, enforced by the compiler; a test pins that the companion may call `loadState` only),
  read by `guard(channel, fn)` in `main/index.ts`. A new channel needs a row.
- Everything shown is `domain/companion.ts` `buildCompanionView` (pure, tested), built from the same rules as the sheet (`availableCosts`, `timerView`,
  `turnOptions`-style defaults). Components in `components/companion/` only draw it. Colors are tokens only; `styles/companion.css` sizes everything in `rem`
  and `html[data-view='companion']` sets the rem from the window (`min(0.9vw, 1.6vh)`), so a laptop window and a 4K television are the same picture.
  When overriding a `.panel` rule, match its specificity (`.cp .panel`, `.cp-col > .panel`): a plain `.cp-x` loses and the layout silently breaks.
- Theme and turn length live in localStorage, which both windows share; `followViewPrefs` applies the `storage` event so a change in Settings reaches the
  companion. Window geometry is not remembered. With a second display it opens full screen there (`main/companionPlacement.ts`, pure, tested).
- Verify: `PALADEX_TARGET=companion` (with `PALADEX_SHOT`, `PALADEX_SIZE`) opens the companion and captures it; `PALADEX_EVAL` still runs in the sheet, so it
  can change the state the companion shows. Pre-write `<userdata>/state/play-state.json` to start from a given sheet. Wait 2 s in the script for a storage-event change.
- Not done on purpose: nothing on it is interactive, and exact HP is always shown.

## Window state, layout and motion

- Window geometry is a view preference: `src/main/windowState.ts` (electron-free, tested) persists it to
  `<userData>/window-state.json`, wired up in `main/index.ts`. Do not put it in the play state or the renderer.
- Never give a page or panel a fixed `max-width`; widths come from the clamp tokens in `tokens.css`.
- Animations use compositor-friendly properties (opacity, transform, `scale`) and the shared keyframes at the end of
  `app.css`. Infinite animations are limited to the candle glow, gem glint, rune ring, held-spell pulse and low-HP
  heartbeat. Anything that must be invisible without animation has `opacity: 0` as its base state, because the
  reduce-motion rule sets `animation: none`. Ornament colors come from tokens; corner studs are alpha masks in `tokens.css`.
