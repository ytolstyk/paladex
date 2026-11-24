import type { TraitKind, TraitWhen } from '../../src/shared/types'

/**
 * Hand-written classification for the feats, Oath features, species traits and homebrew shown on the Feats & traits page.
 * The full text always comes from the sheet; this file owns which sheet entries are shown, when each one does anything, a
 * one-line paraphrase, and the spells and tiles each one points at. It is an allowlist: a sheet entry that is neither listed
 * here nor in `IGNORED_FEATS` / `IGNORED_RACIAL_TRAITS` makes the importer warn, so a new feat is never lost silently.
 *
 * Summaries say nothing that a level-up changes (dice, DCs, uses): the sheet text and the tiles carry the numbers.
 */
export interface TraitOverlay {
  name: string
  kind: TraitKind
  /** Where the entry is on the sheet. `action` is a custom or homebrew action; `class-option` is a Paladin option such as a Fighting Style. */
  sheet: 'subclass' | 'racial-trait' | 'feat' | 'class-option' | 'action'
  /** Read the text from this species option instead (the chosen dragon's Breath Weapon, not the generic one). */
  textFromRaceOption?: string
  /** Keep only the first N lines of the sheet's text (a rules table that adds nothing at the table is cut off). */
  keepLines?: number
  /** A line the importer adds under the sheet's text, from what the sheet chose elsewhere (see `TRAIT_EXTRAS` in normalize.ts). */
  extra?: 'chosen-masteries' | 'species-languages'
  /** Shown for a feat or homebrew entry; an Oath feature or species trait derives its origin from the sheet. */
  origin?: string
  when: TraitWhen
  summary: string
  /** Spell and feature ids this one grants or works with. The importer fails if one does not exist. */
  related?: string[]
}

const HOMEBREW = 'DM homebrew'

export const TRAIT_OVERLAYS: TraitOverlay[] = [
  // ── Oath of Vengeance. Features above the character's level are skipped by the importer, so a level-up only needs a re-seed.
  {
    name: 'Oath of Vengeance Spells',
    kind: 'oath',
    sheet: 'subclass',
    when: 'passive',
    summary: 'Bane, Hunter’s Mark, Hold Person and Misty Step are always prepared and do not count against your limit. More follow at levels 9, 13 and 17.',
    related: ['spell:bane', 'spell:hunters-mark', 'spell:hold-person', 'spell:misty-step']
  },
  {
    name: 'Vow of Enmity',
    kind: 'oath',
    sheet: 'subclass',
    when: 'triggered',
    summary: 'With the Attack action, spend a Channel Divinity use to gain Advantage against one creature for a minute. The vow moves to a new target if the first drops.',
    related: ['feature:vow-of-enmity']
  },
  {
    name: 'Relentless Avenger',
    kind: 'oath',
    sheet: 'subclass',
    when: 'reaction',
    summary: 'When an Opportunity Attack hits, the target’s Speed becomes 0 for the turn, then you move up to half your Speed without provoking.'
  },
  {
    name: 'Soul of Vengeance',
    kind: 'oath',
    sheet: 'subclass',
    when: 'reaction',
    summary: 'When a creature under your Vow of Enmity attacks (hit or miss), use your Reaction to make a melee attack against it.',
    related: ['feature:vow-of-enmity']
  },
  {
    name: 'Avenging Angel',
    kind: 'oath',
    sheet: 'subclass',
    when: 'bonus',
    summary: 'For 10 minutes you fly and frighten enemies that start their turn in your Aura of Protection. Recharges on a long rest or a 5th-level slot.'
  },

  // ── Species. The sheet says Dragonborn with a Black Dragon ancestor, so the breath, resistance and ancestry are acid.
  {
    name: 'Draconic Ancestry',
    kind: 'species',
    sheet: 'racial-trait',
    textFromRaceOption: 'Black Dragon',
    when: 'passive',
    summary: 'Your dragon ancestor is Black, so your Breath Weapon and your damage resistance are acid.'
  },
  {
    name: 'Breath Weapon',
    kind: 'species',
    sheet: 'racial-trait',
    textFromRaceOption: 'Breath Weapon (Acid)',
    when: 'action',
    summary: 'Replace one attack with a cone or line of acid. Dexterity save for half. You can do it as many times as your proficiency bonus before a long rest.',
    related: ['feature:breath-weapon']
  },
  {
    name: 'Damage Resistance',
    kind: 'species',
    sheet: 'racial-trait',
    textFromRaceOption: 'Draconic Resistance (Acid)',
    when: 'passive',
    summary: 'You take half damage from acid.'
  },
  {
    name: 'Darkvision',
    kind: 'species',
    sheet: 'racial-trait',
    when: 'passive',
    summary: 'You see in dim light as if it were bright, and in darkness as if it were dim, out to 60 feet.'
  },
  {
    name: 'Draconic Flight',
    kind: 'species',
    sheet: 'racial-trait',
    when: 'bonus',
    summary: 'Once per long rest, spectral wings give you a Fly Speed equal to your Speed for 10 minutes.',
    related: ['feature:draconic-flight']
  },
  {
    name: 'Languages',
    kind: 'species',
    sheet: 'racial-trait',
    keepLines: 1, // the sheet appends the whole Standard Languages table
    extra: 'species-languages',
    when: 'passive',
    summary: 'You speak, read and write Common, Draconic and Orc.'
  },

  // ── Feats. Fighting Style is chosen at level 2; the other three are on the sheet's feat list.
  {
    name: 'Savage Attacker',
    kind: 'feat',
    sheet: 'feat',
    origin: 'Origin feat (Soldier background)',
    when: 'triggered',
    summary: 'Once per turn, when you hit with a weapon, roll its damage dice twice and use either result.'
  },
  {
    name: 'Blessed Warrior',
    kind: 'feat',
    sheet: 'class-option',
    origin: 'Fighting Style (Paladin level 2)',
    when: 'passive',
    summary: 'Two Cleric cantrips count as Paladin spells for you, cast with Charisma. You can swap one each time you gain a Paladin level.',
    related: ['spell:resistance', 'spell:spare-the-dying']
  },
  {
    name: 'Weapon Mastery',
    kind: 'feat',
    sheet: 'feat',
    extra: 'chosen-masteries',
    origin: 'Paladin level 1',
    when: 'passive',
    summary: 'Use the mastery property of two kinds of weapon you are proficient with. You can change the kinds after a long rest.'
  },
  {
    name: 'Dark Bargain',
    kind: 'feat',
    sheet: 'feat',
    origin: HOMEBREW,
    when: 'passive',
    summary: 'A bargain taken at the GM’s discretion; the GM decides what it does.'
  },

  // ── Table homebrew (the DM’s own rules, read-only). Death Coil is on the sheet too, but the table never used it: do not add it.
  {
    name: 'Initiate a Circle Spell',
    kind: 'homebrew',
    sheet: 'action',
    origin: HOMEBREW,
    when: 'action',
    summary: 'Start a Circle casting with secondary casters. You must keep Concentration on the spell until the casting is complete.'
  },
  {
    name: 'Circle Spell: Augment',
    kind: 'homebrew',
    sheet: 'action',
    origin: HOMEBREW,
    when: 'triggered',
    summary: 'A spell with range of at least 5 ft. reaches 1,000 ft. further for each secondary caster, up to a mile.'
  },
  {
    name: 'Circle Spell: Distribute',
    kind: 'homebrew',
    sheet: 'action',
    origin: HOMEBREW,
    when: 'triggered',
    summary: 'You and the secondary casters can all keep Concentration on one spell; it lasts while any one of you does.'
  },
  {
    name: 'Circle Spell: Expand',
    kind: 'homebrew',
    sheet: 'action',
    origin: HOMEBREW,
    when: 'triggered',
    summary: 'One dimension of an area grows by 10 ft. per secondary caster, and each of them spends a spell slot.'
  },
  {
    name: 'Circle Spell: Prolong',
    kind: 'homebrew',
    sheet: 'action',
    origin: HOMEBREW,
    when: 'triggered',
    summary: 'A spell lasting 1 minute or more runs longer for each secondary caster, and each of them spends a spell slot.'
  },
  {
    name: 'Circle Spell: Safeguard',
    kind: 'homebrew',
    sheet: 'action',
    origin: HOMEBREW,
    when: 'triggered',
    summary: 'Carve a safe zone of 3 + the number of secondary casters 5-ft. Cubes out of an area spell.'
  },
  {
    name: 'Circle Spell: Supplant',
    kind: 'homebrew',
    sheet: 'action',
    origin: HOMEBREW,
    when: 'triggered',
    summary: 'Cut the cost of a consumed Material component by 50 GP per secondary caster, who each spend a slot of the spell’s level or higher.'
  },
  {
    name: 'Undead Steed: Ghostly Stride',
    kind: 'homebrew',
    sheet: 'action',
    origin: HOMEBREW,
    when: 'bonus',
    summary: 'An Undead Find Steed moves you both through creatures and objects this turn. Recharges on a long rest.',
    related: ['spell:find-steed']
  }
]

/** Feats on the sheet that carry nothing to look up: their scores are already in the ability numbers. */
export const IGNORED_FEATS = ['Ability Score Improvement', 'Soldier Ability Score Improvements']

/** Species traits that are a number the sheet already shows (size, speed, creature type) or a one-time choice. */
export const IGNORED_RACIAL_TRAITS = ['Creature Type', 'Size', 'Speed', 'Ability Score Increases']
