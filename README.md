# Paladex

An offline spell, slot and resource tracker for a D&D 2024-rules Paladin, built with Electron, React and TypeScript.
It tracks spell slots, prepared spells, per-turn action economy, class resources, hit points, initiative, Bardic
Inspiration and rests, with undo.

![Paladex showing spell slots, the current turn, class resources and a grid of spell cards, mid-combat](docs/screenshot.png)

*Mid-turn: initiative is set to 17 on the dial, Bardic Inspiration (a d8) is held, Bless is being concentrated on and a
level I slot is spent. Each spell card shows its range large, with a meter that fills with distance. Ideas for what comes
next are in [ROADMAP.md](ROADMAP.md).*

## Finding spells

The bar above the spell cards has three rows: search, sort and a filter panel; quick filters; and a line saying what is
showing ("11 spells and 6 features").

- **Search** (press `/` to jump to it, Esc clears it). Every word must appear somewhere in the spell, in any order: its name,
  summary, full description, school, range, duration, role, casting time, level and source. Apostrophes and case do not
  matter ("hunters mark" finds Hunter's Mark). A card that matched only through text it doesn't show says "Found in the
  full text". Search also reaches class features, and shows the feats and traits that match below the spells.
- **Sort by** Level (the default), Name, Range (nearest first), Casting time, School or What it does. The headings follow the
  sort, so under Range the cards sit under Self, Touch, Up to 30 ft, 31 to 60 ft and Over 60 ft.
- **Quick filters**: Hurt enemies / Help allies / Utility, Action / Bonus action / Reaction, Castable now, and Show all
  spells (to prepare spells you haven't chosen).
- **More filters**: Level, Range, School, Save or attack, Source, Ritual only and No concentration. Within a group any chosen
  value matches; across groups all must. What you pick shows as removable chips under the bar, and the button carries a
  count. These describe spells, so class features are hidden while any is on.
- When filters hide spells you haven't prepared, the status line offers them ("2 more matches among unprepared spells").

Every spell card also shows its **components** as V S M: a lit letter is something the spell needs (words, a free hand for
gestures, an item) and a faded one is not. Hover for what each asks of you; the detail drawer names the item ("Material (a
drop of blood)", including any cost or "which the spell consumes"). Searching "verbal", "somatic", "material" or an item
name ("blood") finds spells by what they need. A few spells list a material component without its item text, because their
D&D Beyond pages could not be read; check those spells' pages.

Every spell card shows its **range** large, with an icon (you, a hand, an arrow), the distance, any area ("Self, 30 ft
area") and a meter that fills with distance. Filters, search and sort are view settings: they are never undoable and are not
part of the saved character.

- **Favorites.** The star on a spell card pins it: starred spells sit in a "Favorites" group above the rest, whatever the sort
  (level, then name inside it), and filters still apply to them. Any spell can be starred, prepared or not. Stars belong to the
  character, so they are saved with it, exported, logged ("Starred Bless") and undoable.
- **Remembered filters.** The filters (chips, the filter panel, Castable now, Show all spells) and the sort come back as you
  left them on the next launch. The search text does not: a forgotten word would greet you with an empty list. Clear filters
  clears what is remembered too. They live in the renderer's `localStorage` (key `paladex.view`), like the theme.

## At the table

The top of the left rail holds two things you carry from the table into your own turn. Both are saved with the character.

- **Initiative dial.** Turn the brass knob to a number from 1 to 25: drag it, click the scale, use the arrow keys (Page
  Up/Down step by five, Home/End jump to the ends), press −1/+1, or just type the number. Backspace or "clear" resets it. A
  rest does not clear it. **Roll** throws a d20 plus your Dexterity modifier in the dice tray and sets the dial to the total;
  the tray also rolls again with Advantage or Disadvantage.
- **Bardic Inspiration.** A die (d6, d8, d10 or d12; a d8 to begin with) that glows while you hold it. Press Receive when a
  Bard gives it to you, pick the size they gave, and press Use it when you spend it, or Roll it to throw the die in the dice tray and spend it in one go. Any rest ends it, since it only lasts
  an hour. The die size is remembered, and every step is logged and undoable.

- **Conditions.** Fourteen chips (Blinded to Unconscious, the 2024 rules; exhaustion is separate) in the rail. Press one to put it on or take it off; the active ones show as badges in the
  banner and, under the chips, with what they do one click open. "All conditions" lists every rule. A condition that makes you Incapacitated (Incapacitated, Paralyzed, Petrified, Stunned, Unconscious)
  ends your concentration, as the rules say, and says so. Nothing else is enforced, a rest does not clear them, and every change is logged and undoable.

## Recently cast, history and spell timers

- **Recently cast.** Above the filters, a row of the last six different spells and features you used. Press one to open its
  details. **History** under it lists the last 40 casts with the time, how each was paid for, and a line wherever a new turn or
  a rest began. It is read from the action log, so Undo takes a cast out of it, and it reaches back about one session.
- **Spell timers.** Casting a spell with a set duration (Bless, Hunter's Mark, Shield of Faith...) starts a countdown: the
  **Spell timers** panel in the left rail and the spell's card both say "7 turns left", in the accent colour for the last three.
  **New turn** (the button, or `N`) counts every timer down by one turn; a short rest takes off an hour and a long rest eight.
  Casting the spell again restarts it, **End** stops it by hand, and a concentration spell's timer goes when the concentration does
  (and when its timer runs out, so does the concentration). Long timers show the time left instead ("55 minutes left").
- **How long is a turn?** In Settings, under Spell timers: 6 seconds (a round of combat) to begin with, with buttons for 1 minute
  and 10 minutes for exploring, or type your own. A running timer keeps its time when you change it. The countdown uses each
  spell's printed duration: a longer duration from a higher slot is not worked out, so End or recast it if your table says so.

## Weapons and attacks

The strip above the stage has three tabs: **Spells & features**, **Weapons & attacks** and **Feats & traits**. The spell search bar, sort and
filters belong to the spells tab only, and the tab you are on is not remembered between launches. `/` jumps to the search of whichever tab has one.

- **Weapons.** Every weapon on the D&D Beyond sheet, magic first, each with its to-hit, damage, reach or range, properties and
  weapon mastery. Click one for the rules text of each property. The numbers come from your ability scores and proficiency (hover
  one for what it is made of) and are **base numbers**: add Magic Weapon, Bless or a magic bonus yourself. A Heavy weapon you
  are too weak or clumsy for (Strength 13 for melee, Dexterity 13 for ranged) is flagged "Disadvantage". Reach counts the Reach
  property (a Halberd reaches 10 ft).
- **Mastery.** The mastery property is lit when the sheet says you chose it for that kind of weapon ("Cleave (Halberd)" covers the
  Halberd and a magic Halberd), and struck through ("Push, not mastered") when you did not. Masteries and a magic weapon's state can
  change, and the app only knows them as of the last import (`npm run seed`).
- **Attack action and Unarmed Strike.** How many attacks one Attack action gives (Extra Attack), and your Unarmed Strike's to-hit,
  damage and Grapple or Shove DC.
- **Attack options.** The spells and features that go with an attack, as ordinary cards you can cast or use right there: Smites,
  Hunter's Mark, Divine Favor, Magic Weapon, Vow of Enmity and Breath Weapon (the list is `scripts/data/attack-riders.ts`).
  Spells you have not prepared are left out and counted in a line under the cards. These cards ignore the spell filters.

## Feats and traits

The **Feats & traits** tab is the reference for everything that has no tile of its own, as cards under a heading each: the Oath of Vengeance
features you have reached (the Oath spells, Vow of Enmity), your Dragonborn traits (Draconic Ancestry, Breath Weapon, Damage Resistance,
Darkvision, Draconic Flight, Languages), your feats (Savage Attacker, the Blessed Warrior Fighting Style, Weapon Mastery, Dark Bargain) and the DM's
homebrew (the Circle spell options, Undead Steed). Nothing here is spent or saved.

- Each card has a round badge for when it applies (**P** always on, **A** action, **B** bonus action, **R** reaction, **If** when something
  triggers it), a one-line summary and "See also" buttons that open the spells and tiles it grants (the Oath spells, Breath Weapon). Press the card for its full text.
- **Search** (`/`) reads the name, summary and full text, and the chips narrow by where it comes from (Oath, Species, Feats, Homebrew) and when it applies.
  The chips offered are the ones you have. The search and chips are not remembered between launches.
- While you search on the spells tab, the feats and traits that match appear under the spell cards.
- Re-seeding after a level-up brings in the Oath features you have reached (Relentless Avenger at 7, Soul of Vengeance at 15, Avenging Angel at 20).
  What is listed, and each summary, is `scripts/data/trait-overlay.ts`; a feat or species trait the sheet has that is not there makes `npm run seed` warn.

## The turn and the turn chart

The **This turn** panel (top of the left rail) tracks what you have used this turn. Four buttons, **Action**, **Move**, **Bonus
action** and **Reaction**, show *Ready* or *Used* (a used one is also struck through, so it never relies on color); press one to
mark it or clear it again. Casting a spell or using a feature marks its own step for you (an Action spell marks Action, a
Bonus action spell Bonus action, a Reaction spell Reaction). **Move** and the Attack action are only ever marked by hand,
because speed is spent in pieces and a weapon attack has no button. **New turn** (`N`) is for the moment your turn begins: it
clears all four, the spell slot and the cast count, which is also when your reaction comes back. Everything is saved with the
character, undoable, and logged ("Reaction used"). Rules are soft hints: a second action, bonus action, reaction or slotted spell
in one turn is flagged but never blocked. A reaction spell counts against the reaction, not your turn's slot.

**Turn chart** (button under the panel, or `T`) docks a chart of the turn beside the spell grid and stays open while you play:

- Your turn begins, Move, Action (Attack with its count and a button to the Weapons & attacks tab, Cast a spell with the slot
  state, Skill check, Something else), Bonus action, Free, Reaction, and End of turn.
- Steps you track show their state in words. The **Bonus action** and **Reaction** lists are your own prepared spells and features
  that take them (dimmed when nothing is left to pay for them); press one for its details.
- **End of turn** says what is still available: the bonus action when something could use it, and the reaction. It never nags about
  the Action or Move.
- A detail opened from the chart covers it (same edge, same width) until you close it. `Esc` closes the detail first, then the chart.
  In a window narrower than 1180 px the chart floats over the right edge instead of taking a column, with the spell list kept clear of it.
- Whether the chart is open is not remembered between launches.

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
3. Give it a window texture in `src/renderer/styles/backdrop.css`: copy the closest theme's rules (the `.backdrop__tex`,
   `__marks` and `__edge` blocks), pick masks and token tints, and check it in a screenshot. Or set `display: none` on
   `.backdrop` for a plain theme, as High Contrast does.
4. Run `npm test`. `domain/themes.test.ts` checks that the registry and CSS agree (no missing or orphaned blocks) and
   enforces WCAG AA contrast (4.5:1) on every text pair of every palette. Each palette needs a secondary (`--second`) and
   tertiary (`--third`) accent with hues at least 40 degrees from the gold and from each other; the test fails otherwise.

The settings preview needs no extra work: it wears the theme through `data-theme`, so it always matches the real UI.

## Window and layout

The window reopens where you left it: size, position, maximized and full-screen state are saved to `window-state.json` in the
profile folder (next to the `state/` folder, but never part of the play state, so a reset leaves it alone). If the saved monitor is
gone the window opens centred on the main display, and a frame larger than the screen is fitted to it. Minimum size is 960x560.

Every page fills the window. The rail, detail drawer and card columns grow with the width (`--rail-width`, `--drawer-width`,
`--card-min` in `tokens.css`), so a wide window shows more cards per row and the settings page uses the full width.

## Motion and ornament

Candle-flicker light and vignette behind the page, gilt corner studs on panels, heading lozenges, gems that kindle and glint,
a pulsing frame and turning rune ring while concentrating, a ring of light on Cast, a heartbeat on the HP bar at 25% or less,
and a wash of light on short and long rests. It is all CSS and inline SVG (no assets, no JS animation), tinted by the active
theme, and switched off entirely by the system's "reduce motion" setting.

## Where things live

```
src/main/       Electron main process: window, menu, IPC, atomic JSON store with backup
src/preload/    The `window.paladex` bridge
src/shared/     Types, zod schema and constants shared by every process
src/renderer/
  domain/       Pure game logic (slots, rests, turns, filters, themes) with colocated tests
  state/        zustand stores: play state (persisted), UI state (filters and sort remembered in localStorage), theme (localStorage)
  components/   React components
  styles/       tokens.css (default palette, token contract, shared tokens), themes.css (other palettes), backdrop.css (window texture), app.css
  public/       theme-boot.js, the pre-paint theme script (static, copied as-is)
scripts/        Seeding, icon and install tooling
data/           Seeded character JSON
```

Play state is saved to `~/Library/Application Support/Paladex`. Set `PALADEX_USER_DATA=<dir>` to use a throwaway
profile when testing; this matters because Electron ignores `$HOME` on macOS.
