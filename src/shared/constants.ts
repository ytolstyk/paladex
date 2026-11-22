// Zod-free constants shared by every process. The renderer and preload may import this file freely;
// they must NOT import `schema.ts` at runtime (that pulls zod into their bundles).

export const SCHEMA_VERSION = 1 as const

/** Newest action-log entries kept in persisted state (bounds file size and undo snapshots). */
export const LOG_CAP = 200

export const ROLES = ['offense', 'control', 'support', 'utility'] as const
/** `long` = anything slower than an action, e.g. a 10-minute or 1-hour cast (see `Spell.castingNote`). */
export const CAST_TIMES = ['action', 'bonus', 'reaction', 'long'] as const
export const PAYMENT_KINDS = ['slot', 'free', 'charge', 'none'] as const
export const LOG_KINDS = [
  'seed',
  'cast',
  'slot-spend',
  'slot-restore',
  'new-turn',
  'drop-concentration',
  'prepare',
  'unprepare',
  'short-rest',
  'long-rest',
  'counter',
  'hp',
  'feature',
  'initiative',
  'inspiration-gain',
  'inspiration-use',
  'inspiration-die'
] as const

/** The dial covers a d20 roll plus modifiers: a 1 is the lowest anyone acts, 25 is a generous ceiling. */
export const INITIATIVE_MIN = 1
export const INITIATIVE_MAX = 25

/** Bardic Inspiration die sizes, in the order a Bard grows through them (levels 1, 5, 10 and 15). */
export const INSPIRATION_DICE = [6, 8, 10, 12] as const
export type InspirationDie = (typeof INSPIRATION_DICE)[number]
export const DEFAULT_INSPIRATION_DIE: InspirationDie = 8

export interface TurnState {
  /**
   * A spell was cast this turn by expending a spell slot. The 2024 rules ("One Spell with a Spell Slot per Turn",
   * Basic Rules > Spells > Casting Time) say: "On a turn, you can expend only one spell slot to cast a spell", with the
   * example of a slotted Magic-action spell plus a slotted Bonus Action spell. It is NOT the 2014 bonus-action rule:
   * cantrips, free casts (e.g. Paladin's Smite) and item charges expend no slot, so they are unaffected.
   */
  slotSpellCast: boolean
  /** Any bonus action (a bonus-action spell or a feature like Lay On Hands) was used this turn: only one is allowed. */
  bonusActionSpent: boolean
  castsSinceNewTurn: number
}

export function emptyTurn(): TurnState {
  return { slotSpellCast: false, bonusActionSpent: false, castsSinceNewTurn: 0 }
}
