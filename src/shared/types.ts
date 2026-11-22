// Domain types shared by main, preload and renderer. Type-only imports: nothing here ships at runtime.
import type { CAST_TIMES, ROLES } from './constants'

export type Role = (typeof ROLES)[number]
export type Target = 'enemy' | 'ally' | 'self'
/** A "Magic action" in 2024 wording is just an Action. */
export type CastTime = (typeof CAST_TIMES)[number]
export type SpellSource = 'class' | 'oath' | 'feature' | 'item' | 'cantrip'

/** One way a spell *may* be paid for. A spell lists its options in preference order. */
export type CostOption =
  | { kind: 'slot' }
  | { kind: 'free'; counterId: string }
  | { kind: 'charge'; counterId: string }
  | { kind: 'none' }

/** A concrete, resolved way of paying for one cast. */
export type Payment =
  | { kind: 'slot'; level: number }
  | { kind: 'free'; counterId: string }
  | { kind: 'charge'; counterId: string }
  | { kind: 'none' }

export interface Spell {
  /** Stable id, `spell:<slug>`. Keys prepared set, overlay and overrides. */
  id: string
  /** DDB definition id when the spell appears in the imported payload. */
  ddbId?: number
  name: string
  /** 0 = cantrip */
  level: number
  school: string
  castTime: CastTime
  /** The actual casting time when `castTime` is `long`, e.g. "1 hour". */
  castingNote?: string
  ritual?: boolean
  concentration: boolean
  range: string
  duration: string
  role: Role
  targets: Target[]
  /** One-line paraphrase written for this app (not copied spell text). */
  summary: string
  /** Full spell text from the DDB payload (HTML, placeholders resolved). Sanitize before rendering. */
  description?: string
  source: SpellSource
  /** Cantrips list `[{ kind: 'none' }]`. */
  costs: CostOption[]
  /** Short save/attack tag, e.g. "CHA save", "on melee hit". */
  tag?: string
  alwaysPrepared?: boolean
  /** Mechanics checked against the DDB spell page. */
  verified: boolean
}

/** How much a rest gives back: everything, a flat amount, or a fraction of max (rounded down, min 1). */
export type Restore = 'full' | { add: number } | { fraction: number }

/** `pool` = a quantity you spend N at a time (hit points, dice). `uses` = discrete charges shown as pips. */
export type CounterKind = 'pool' | 'uses'

export interface CounterDef {
  id: string
  label: string
  max: number
  kind: CounterKind
  /** Rest behaviour as data, so `rests.ts` never switches on counter ids. Omitted = never restores. */
  restore: { short?: Restore; long?: Restore }
  note?: string
}

/**
 * A class/race feature you use on a turn (Lay On Hands, Vow of Enmity, ...). Shown beside the spells so the same
 * filters answer "what can I do right now", and it is spent from a counter like a spell is spent from a slot.
 */
export interface Feature {
  /** Stable id, `feature:<slug>`. */
  id: string
  name: string
  /** Matches the DDB activation: a bonus action spends the turn's bonus action. */
  castTime: CastTime
  /** When it isn't a plain action, e.g. "with the Attack action". */
  timing?: string
  role: Role
  targets: Target[]
  /** One line, in our own words. */
  summary: string
  /** Full text from the sheet, plain text. */
  description?: string
  /** `homebrew` has no importer producer today (tile-less homebrew goes to `OtherFeature`); it stays for hand-written seed entries. */
  source: 'class' | 'race' | 'homebrew'
  /** The counter this is spent from. */
  counterId: string
  /** `uses`: one use per activation. `pool`: you choose an amount, up to `maxPerUse` (default: all that is left). The importer sets no cap today; it is set by hand in the seed. */
  spend: { kind: 'uses' } | { kind: 'pool'; maxPerUse?: number }
  tag?: string
}

export interface Character {
  name: string
  race: string
  className: string
  subclass: string
  level: number
  abilities: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>
  proficiencyBonus: number
  spellcastingAbility: 'cha'
  hpMax: number
  ac: number
  spells: Spell[]
  counters: CounterDef[]
  features: Feature[]
}

/** Everything the app needs to start from: the character plus values that seed from the sheet, not "fully rested". */
export interface SeedData {
  character: Character
  /** The chosen (non-always-prepared) spells a fresh state starts with. */
  prepared: string[]
  /** Counters whose `used` amount seeds from DDB (e.g. consumable item charges). */
  seededUsed: Record<string, number>
  /** Read-only features shown for reference (DM homebrew etc.), with placeholders already resolved. */
  otherFeatures: OtherFeature[]
}

export interface OtherFeature {
  name: string
  /** Plain text. */
  text: string
}
