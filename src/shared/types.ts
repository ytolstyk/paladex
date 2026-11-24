// Domain types shared by main, preload and renderer. Type-only imports: nothing here ships at runtime.
import type { CAST_TIMES, ROLES, TRAIT_KINDS, TRAIT_WHENS } from './constants'

export type Role = (typeof ROLES)[number]
export type Target = 'enemy' | 'ally' | 'self'
/** A "Magic action" in 2024 wording is just an Action. */
export type CastTime = (typeof CAST_TIMES)[number]
export type SpellSource = 'class' | 'oath' | 'feature' | 'item' | 'cantrip'
export type TraitKind = (typeof TRAIT_KINDS)[number]
export type TraitWhen = (typeof TRAIT_WHENS)[number]

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

/**
 * What casting a spell demands of the body and the pouch: words (verbal), gestures (somatic), an item (material).
 * `materialText` is what the spell page says the item is ("a drop of blood", "a flask of Holy Water worth 25+ GP, which
 * the spell consumes"). It is absent when the spell has no material component, and also for a few spells whose page we
 * could not read: `material: true` with no text means "needs something; check the spell".
 */
export interface SpellComponents {
  verbal: boolean
  somatic: boolean
  material: boolean
  materialText?: string
}

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
  components: SpellComponents
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
  /** Works with a weapon attack (a Smite, Hunter's Mark): the Weapons & attacks tab lists it. Set from `scripts/data/attack-riders.ts`. */
  attackRider?: boolean
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
  /** `homebrew` has no importer producer today (homebrew with no counter is a read-only `Trait`); it stays for hand-written seed entries. A thing spent from a counter is a `Feature`; reference text only is a `Trait`. */
  source: 'class' | 'race' | 'homebrew'
  /** The counter this is spent from. */
  counterId: string
  /** `uses`: one use per activation. `pool`: you choose an amount, up to `maxPerUse` (default: all that is left). The importer sets no cap today; it is set by hand in the seed. */
  spend: { kind: 'uses' } | { kind: 'pool'; maxPerUse?: number }
  tag?: string
  /** Works with an attack (Vow of Enmity, Breath Weapon): the Weapons & attacks tab lists it. Set from `scripts/data/attack-riders.ts`. */
  attackRider?: boolean
}

/** A weapon property (Heavy, Reach, Versatile...) with the sheet's rules text, plain text. */
export interface WeaponProperty {
  name: string
  text: string
}

/** The 2024 weapon masteries. A character can use one only for the weapon kinds they chose (`known`). */
export interface WeaponMastery {
  name: string
  /** Rules text from the sheet. */
  text: string
  /** The sheet lists a chosen mastery for this weapon's base type. As of the last import: masteries can change on a long rest. */
  known: boolean
}

/**
 * A weapon carried, from the sheet's inventory. Attack numbers are not stored: `domain/attacks.ts` derives them from the
 * abilities, so they stay right if a score changes. There is deliberately no "equipped" flag: nothing in the app can change it
 * and several weapons are marked equipped at once.
 */
export interface Weapon {
  /** Stable id, `weapon:<slug>`; a repeated name gets `-2`, `-3` in inventory order. */
  id: string
  name: string
  /** The base weapon kind ("Halberd"); a homebrew or magic weapon shares its base's. Masteries are chosen per base type. */
  baseType: string
  /** Melee (`attackType` 1 on the sheet) or ranged (2). A Thrown melee weapon stays melee. */
  melee: boolean
  proficient: boolean
  /** As of the last import: a weapon that stops being magical when its charges run out will not update. */
  magic: boolean
  /** Present only when the item requires attunement. */
  attunement?: 'attuned' | 'not-attuned'
  damage: { dice: string; type: string; /** Two-handed dice of a Versatile weapon. */ versatile?: string }
  /** Feet, as printed on the sheet (a melee weapon says 5/5). Reach is derived from the Reach property, not from this. */
  range: { normal: number; long?: number }
  /** Everything but the mastery, in the sheet's order. */
  properties: WeaponProperty[]
  mastery?: WeaponMastery
  /** The item's own description, plain text, only for magic or homebrew items. */
  description?: string
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
  weapons: Weapon[]
}

/** Everything the app needs to start from: the character plus values that seed from the sheet, not "fully rested". */
export interface SeedData {
  character: Character
  /** The chosen (non-always-prepared) spells a fresh state starts with. */
  prepared: string[]
  /** Counters whose `used` amount seeds from DDB (e.g. consumable item charges). */
  seededUsed: Record<string, number>
  /** Feats, Oath features, species traits and DM homebrew shown for reference, with placeholders already resolved. */
  traits: Trait[]
}

/**
 * A feat, Oath feature, species trait or piece of DM homebrew with no tile of its own: read-only reference on the Feats & traits
 * page. Nothing is spent from a counter (a thing with a use count is a `Feature`); `related` points at the spells and tiles it
 * gives or works with, so the card can open them.
 */
export interface Trait {
  /** Stable id, `trait:<slug>`. */
  id: string
  name: string
  kind: TraitKind
  /** Where it comes from, as a player says it: "Oath of Vengeance, level 3", "Dragonborn", "Origin feat (Soldier)". */
  origin: string
  when: TraitWhen
  /** One line, in our own words. */
  summary: string
  /** Full text from the sheet, plain text, with placeholders resolved. */
  text: string
  /** Ids of spells and features it grants or works with (`spell:...` / `feature:...`). Each must exist in the catalog. */
  related?: string[]
}
