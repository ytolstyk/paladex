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
  'feature'
] as const

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
