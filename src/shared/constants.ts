// Zod-free constants shared by every process. The renderer and preload may import this file freely;
// they must NOT import `schema.ts` at runtime (that pulls zod into their bundles).

export const SCHEMA_VERSION = 1 as const

/** Newest action-log entries kept in persisted state (bounds file size and undo snapshots). */
export const LOG_CAP = 200

export const ROLES = ['offense', 'control', 'support', 'utility'] as const
/** `long` = anything slower than an action, e.g. a 10-minute or 1-hour cast (see `Spell.castingNote`). */
export const CAST_TIMES = ['action', 'bonus', 'reaction', 'long'] as const
export const PAYMENT_KINDS = ['slot', 'free', 'charge', 'none'] as const
/** Where a reference trait comes from, in the order the Feats & traits page lists them. */
export const TRAIT_KINDS = ['oath', 'species', 'feat', 'homebrew'] as const
/** When a trait does anything: always, or on the action it takes, or when something happens (a hit, a cast). */
export const TRAIT_WHENS = ['passive', 'action', 'bonus', 'reaction', 'triggered'] as const
export const LOG_KINDS = [
  'seed',
  'cast',
  'slot-spend',
  'slot-restore',
  'new-turn',
  'drop-concentration',
  'prepare',
  'unprepare',
  'favorite',
  'unfavorite',
  'short-rest',
  'long-rest',
  'counter',
  'hp',
  'feature',
  'initiative',
  'inspiration-gain',
  'inspiration-use',
  'inspiration-die',
  'turn-step',
  'timer-end',
  'condition'
] as const

/**
 * The 2024 conditions a player marks by hand, in the order they are listed. Exhaustion is not here: it is a level, not a switch, and
 * has its own place on the roadmap. The words and rules for each are in `domain/conditions.ts`.
 */
export const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious'
] as const
export type ConditionId = (typeof CONDITIONS)[number]

/** The dial covers a d20 roll plus modifiers: a 1 is the lowest anyone acts, 25 is a generous ceiling. */
export const INITIATIVE_MIN = 1
export const INITIATIVE_MAX = 25

/** Bardic Inspiration die sizes, in the order a Bard grows through them (levels 1, 5, 10 and 15). */
export const INSPIRATION_DICE = [6, 8, 10, 12] as const
export type InspirationDie = (typeof INSPIRATION_DICE)[number]
export const DEFAULT_INSPIRATION_DIE: InspirationDie = 8

/** What a player tracks by hand through a turn. `move` is "I moved", not a pool: speed is spent in pieces on both sides of the action. */
export const TURN_STEPS = ['action', 'move', 'bonus', 'reaction'] as const
export type TurnStep = (typeof TURN_STEPS)[number]

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
  /**
   * The action was used: a spell or feature with an action casting time marks it, and the player marks it by hand for anything
   * else (weapon attacks have no button, so the Attack action is never marked for them).
   */
  actionSpent: boolean
  /** The player says they moved. Only ever set by hand. */
  moved: boolean
  /** The reaction was used since the turn began (2024: it comes back at the start of your turn, which is "New turn"). */
  reactionSpent: boolean
  castsSinceNewTurn: number
}

export function emptyTurn(): TurnState {
  return { slotSpellCast: false, bonusActionSpent: false, actionSpent: false, moved: false, reactionSpent: false, castsSinceNewTurn: 0 }
}

/** The one place these are written, so a unit table elsewhere cannot disagree. */
export const SECONDS_PER = { minute: 60, hour: 3600, day: 86_400 } as const

/** What one "New turn" subtracts from every running spell timer, until the player sets their own in Settings: one round of combat. */
export const DEFAULT_TURN_SECONDS = 6
export const TURN_SECONDS_MIN = 1
/** A day. A turn longer than that is a typo, and would make every timer end on the first tick. */
export const TURN_SECONDS_MAX = SECONDS_PER.day
/** How many spells can have a running timer at once (one per spell: casting it again restarts it). */
export const MAX_TIMERS = 50

/**
 * The countdown of one timed spell. Kept in seconds, not turns, so changing the turn length in Settings never rewrites a
 * running timer: "turns left" is worked out from the length in force when it is shown. Whether the spell needs concentration is
 * not stored; `settleTimers` reads it from the catalog.
 */
export interface SpellTimer {
  spellId: string
  /** Seconds left. A timer at 0 is removed, never kept. */
  remaining: number
  /** Seconds it started with, for the progress bar. */
  total: number
}

/** The URL hash that makes the page render the companion (second-screen) view instead of the sheet. `public/theme-boot.js` repeats it as a literal: change both. */
export const COMPANION_HASH = 'companion'
