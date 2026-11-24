# Paladex roadmap

Ideas for what could go on the sheet next, ordered by how much they help at the table. Nothing here is promised; it is a
menu. "Today" notes what the app does now, so each idea starts from a real gap.

The test for every item: **does it answer a question a player asks mid-turn, faster than the book or D&D Beyond would?**

Size: **S** is an afternoon, **M** is a few days, **L** is a project. Items marked *(play state)* need a new persisted field
(it must use `.default()` in the zod schema, see `CLAUDE.md`); the rest are view-only and belong in `state/uiStore.ts`.

## 1. Find things faster (spells, features, abilities)

Today: search (full text), sort, quick chips (intent, casting time, castable now, show all) and a "More filters" panel
(level, range, school, save or attack, source, ritual, no concentration). Filters and sort are remembered across launches; the search text is not.

- [x] **Sort** the grid by level, name, range, casting time, school or role, with headings that follow the sort. *(done)*
      Still open: "most useful right now" (castable first) and a reversed order.
- [x] **More facets**: level, range, school, save or attack, source and ritual. *(done)* Duration is still open. **S**
- [x] **Search the full text** of spells, class features and the feats and traits. *(done)*
- [x] **Focus search with `/`** and clear it with Esc. *(done)*
- [ ] **Hide or collapse sections**: a "Spells / Features" toggle, and collapsible level groups, for turns when you only want one. **S**
- [x] **Remember filters** across launches (view preference, so `localStorage` like the theme, not play state). *(done)* The search text is deliberately not kept.
- [ ] **Saved filter sets**: "Combat", "Exploring", "Downtime", one click each. The "last used" default now exists (remembered filters). **M**
- [x] **Favorites / pins**: a star on each spell card pins it in a "Favorites" group above the sort. *(play state, done)* Still open: starring class features, and a "favorites only" quick filter.
- [x] **Recently cast**: a row of the last six spells and features above the filter bar, plus a History list (last 40, with breaks at each new turn and rest). *(done; read from the log, so it reaches back about one session. A chip opens the details: it does not cast.)*
- [ ] **Command palette (Cmd/Ctrl+K)**: type a spell, feature, rest or setting and jump to it or run it. **M**

## 2. Casting and the turn

Today: Cast pays with the first available option (a free cast, else the lowest slot) unless you step the card's ‹ › arrows
to another one (a higher slot level, or a slot instead of the free cast). One slotted spell and one bonus action per turn
are soft hints.

- [x] **Choose the slot level when casting (upcasting)**: a ‹ › stepper under the Cast button, using the payment list
      `availableCosts()` produces. The pick is per-card view state and resets after each cast. **M**
- [x] **Reaction and action tracking** next to the slot and bonus-action lines, with a turn chart beside the stage. *(play state, done)* Still open: a "turn N / round N" counter, and an `R` shortcut.
- [x] **Duration timers**: casting a spell with a set duration starts a countdown that New turn ticks (turn length set in Settings), with "N turns left" in the rail and on the card. *(play state, done)* Still open: timers for features (Vow of Enmity, no duration data), and upcast durations (Hunter's Mark lasts longer from a higher slot; the timer uses the printed duration).
- [ ] **Concentration target note**: "Hunter's Mark on the ogre". A one-line field on the active concentration. *(play state)* **S**
- [ ] **Concentration check helper** when taking damage: show the DC (10, or half the damage if higher) and your save bonus. **S**
- [ ] **Damage and dice helper** for Divine Smite and friends: dice by slot level, crit doubling, and a roller that logs the result. **M**
- [x] **Dice tray** for initiative (d20 + Dexterity, with Advantage or Disadvantage) and the Bardic Inspiration die: a card where the dice tumble and land, then set the dial or spend the die. *(done; damage dice for Smite and a general roller are still the open part of the item above)*
- [ ] **Undo history list**, not only the last step: show the last 10 changes and undo back to a chosen one. **M**

## 3. Preparing spells

Today: "Prepare" toggles on each card, a "Prepared 2 of 6" counter, and "Show all spells" to see the rest.

- [ ] **A dedicated prepare view** (a page like Settings): all spells by level with checkboxes, the live count against the limit,
      and always-prepared spells locked. Opened after a long rest. **M**
- [ ] **Swap suggestions after a long rest**: "you had X prepared yesterday", with one click to restore that set. *(play state)* **M**
- [ ] **Named prepared sets** ("Dungeon", "Social", "Boss fight") that you can switch between. *(play state)* **M**

## 4. Hit points and conditions

Today: damage and heal from the HP popover. Temp HP is stored and absorbs damage, but there is no way to set it.

- [ ] **Set temp HP** (and the rule that it doesn't stack) from the same popover. **S**
- [x] **Conditions**: toggle chips for Prone, Frightened, Poisoned and so on, with the rules text one click away. *(done)* The 14 conditions of the 2024 rules; exhaustion is its own item below. Anything that makes you Incapacitated ends concentration.
- [ ] **Death saves**: three success and three failure pips that appear at 0 HP and reset on healing. *(play state)* **S**
- [ ] **Short rest dialog**: spend hit dice, roll or enter the result, and apply the healing. Today a short rest only gives back
      Channel Divinity. **M**
- [ ] **Exhaustion and other long-term effects** (2024 exhaustion is a numeric level) as a vitals-bar badge. *(play state)* **S**

## 5. The rest of the character

Today: ability scores are stored but only used to compute spell save DC and attack bonus. There is no place for anything
outside spellcasting.

- [x] **Weapons and attacks** view: to-hit, damage, reach and mastery per weapon, Extra Attack, Unarmed Strike and the spells that ride an attack. *(done; base numbers only, no magic bonus or Savage Attacker yet)*
- [ ] **Abilities, saving throws and skills** panel with modifiers and proficiency markers. Needs skill data in the seed. **M**
- [ ] **Quick numbers** in the banner or a tooltip: speed, passive Perception, and an initiative *modifier* (the initiative
      dial in the rail holds the rolled result, not the bonus). **S**
- [ ] **Notes**: one free-text session scratchpad, plus an optional note per spell or feature ("Bless: Mira, Tor, me"). *(play state)* **M**
- [ ] **Inventory and attunement**: item list with charges (Protection from Evil and Good is already an item charge), weight,
      attunement slots (max 3). *(play state)* **L**
- [ ] **Currency and consumables** (potions, spell scrolls) with a count and a "use" button. *(play state)* **M**
- [x] **Feats and Oath features reference**: a *Feats & traits* tab with the feats, Oath features, species traits and DM homebrew as searchable cards, filtered by where they come from and when they apply. *(done; view-only, the filters are not remembered. Class features other than the Oath's, and a half-human heritage (the sheet has none), are not on it.)*

## 6. Keyboard, accessibility and display

Today: Cmd/Ctrl+, opens settings, Cmd/Ctrl+Z undoes, `N` starts a new turn. Buttons carry ARIA labels and motion respects the
system setting.

- [ ] **More shortcuts**: `/` search, `1`-`9` spend a slot of that level, `R` for a reaction, `?` for a cheat sheet of all keys. **S**
- [ ] **Arrow-key navigation** through the card grid, Enter to open details, a modifier to cast. **M**
- [ ] **Text size and density** (compact cards for small windows or a second monitor). View preference. **S**
- [ ] **Larger tap targets mode** for use on a touch screen or when played on a tablet-sized window. **S**
- [ ] **A "pinned" detail drawer** that stays open while you filter, so a spell can be read while you pick another. **S**

## 7. Data safety and sharing

Today: Export writes the play-state JSON. There is no way to bring it back in. State is saved atomically with one backup.

- [ ] **Import / restore** from an exported file, with the same validation the store uses and a confirmation that shows what will
      be replaced. **M**
- [ ] **Automatic dated backups** (keep the last N) with a "restore" list in settings. **M**
- [ ] **Reset with a safety net**: confirm, and take a backup first. **S**
- [ ] **Printable one-page summary** (slots, prepared spells, DC and attack) for tables that want paper. **M**
- [ ] **Session recap**: from the log, "what happened this session" as copyable text. The log keeps 200 entries but only the last
      is shown today. **M**

## 8. Bigger bets

- [ ] **Multiple characters** and a character switcher. The catalog is currently one baked-in character, so this touches the
      seed, the store and the profile layout. **L**
- [ ] **In-app editing of the character** (level-up, new spells, changed AC) instead of reseeding from a D&D Beyond export. **L**
- [ ] **Other classes**: the domain logic is Paladin-shaped (smite, Lay On Hands). Generalizing counters and costs is possible
      but is a rewrite of the seed format. **L**
- [x] **Companion view** for a second screen: HP, slots, what can be cast, concentration, conditions, the turn and resources, big and readable from across the table. *(done; read-only, follows the sheet live. Not done: a way to hide parts of it, such as exact hit points, for a table that should not see them.)*

## Small fixes worth doing along the way

- [ ] The footer log shows raw counter ids: "Spent 1 channel-divinity". Use the counter's label (`formatLog` in
      `domain/log.ts` reads `entry.counterId` directly).
- [ ] The Cast buttons show a red dashed "warn" outline on every slotted spell once a slot is spent. Correct, but it may read as
      an error; consider a quieter style plus the existing tooltip.
