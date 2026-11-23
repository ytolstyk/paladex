import type { PlayState } from '@shared/schema'
import type { Character, Feature, Spell, Weapon } from '@shared/types'
import type { Catalog } from './catalog'
import { abilityMod, signed } from './derived'
import { isPrepared } from './prepared'

/**
 * Attack numbers, derived from the abilities so they stay right when a score changes. They are BASE numbers: they do not know
 * about a spell or effect that adds to them (Magic Weapon, Bless), or a magic weapon's own bonus (the sheet records none).
 * Like `spellSaveDc`, they take the character's own numbers, so a later source of modifiers has one place to join.
 */
export type AttackContext = Pick<Character, 'abilities' | 'proficiencyBonus'>
export type AttackAbility = 'str' | 'dex'

/** The Heavy property: Disadvantage on a Melee weapon below Strength 13, or a Ranged one below Dexterity 13 (scores, not modifiers). */
const HEAVY_MIN_SCORE = 13
/** Reach of a melee weapon, and with the Reach property. */
const REACH_FT = { base: 5, withReach: 10 } as const
/** Grapple and Shove (2024) are saved against 8 + Strength modifier + proficiency. */
const UNARMED_DC_BASE = 8

/** Level at which a Paladin's Extra Attack applies. A table, not a constant, so a later class feature has somewhere to go. */
const ATTACKS_PER_ATTACK_ACTION: readonly { level: number; attacks: number }[] = [{ level: 5, attacks: 2 }]

/** How many attacks one Attack action gives (Extra Attack for a Paladin from level 5). */
export function attacksPerAttackAction(level: number): number {
  return ATTACKS_PER_ATTACK_ACTION.reduce((attacks, row) => (level >= row.level ? row.attacks : attacks), 1)
}

export interface AttackNumbers {
  ability: AttackAbility
  toHit: number
  /** "1d8+4"; a modifier of 0 leaves the dice alone and a negative one reads "1d8-1". */
  damage: string
  /** Lowercase, as it reads in a sentence ("slashing"). */
  damageType: string
  /** Two-handed damage of a Versatile weapon. */
  versatileDamage?: string
  /** "STR +4": the modifier added to both rolls. */
  modifierText: string
  /** "STR +4, proficiency +3": what the to-hit is made of, for a tooltip. */
  breakdown: string
  /** Why the attack has Disadvantage, when the weapon's own rules impose it on this character. */
  disadvantage?: string
}

const hasProperty = (weapon: Weapon, name: string): boolean => weapon.properties.some((p) => p.name === name)

const withModifier = (dice: string, mod: number): string => (mod === 0 ? dice : `${dice}${signed(mod)}`)

/** Finesse takes the better of Strength and Dexterity; otherwise melee uses Strength and ranged Dexterity (a Thrown melee weapon stays Strength). */
function attackAbility(weapon: Weapon, abilities: Character['abilities']): AttackAbility {
  if (hasProperty(weapon, 'Finesse')) return abilities.dex > abilities.str ? 'dex' : 'str'
  return weapon.melee ? 'str' : 'dex'
}

function heavyDisadvantage(weapon: Weapon, abilities: Character['abilities']): string | undefined {
  if (!hasProperty(weapon, 'Heavy')) return undefined
  const ability: AttackAbility = weapon.melee ? 'str' : 'dex'
  const score = abilities[ability]
  return score < HEAVY_MIN_SCORE ? `Disadvantage: ${ability.toUpperCase()} ${score} is under ${HEAVY_MIN_SCORE} (Heavy)` : undefined
}

export function weaponAttack(weapon: Weapon, { abilities, proficiencyBonus }: AttackContext): AttackNumbers {
  const ability = attackAbility(weapon, abilities)
  const mod = abilityMod(abilities[ability])
  const modifierText = `${ability.toUpperCase()} ${signed(mod)}`
  const proficiencyText = weapon.proficient ? `proficiency ${signed(proficiencyBonus)}` : 'not proficient'
  const disadvantage = heavyDisadvantage(weapon, abilities)
  return {
    ability,
    toHit: mod + (weapon.proficient ? proficiencyBonus : 0),
    damage: withModifier(weapon.damage.dice, mod),
    damageType: weapon.damage.type.toLowerCase(),
    ...(weapon.damage.versatile ? { versatileDamage: withModifier(weapon.damage.versatile, mod) } : {}),
    modifierText,
    breakdown: `${modifierText}, ${proficiencyText}`,
    ...(disadvantage ? { disadvantage } : {})
  }
}

/** Reach for a melee weapon, range for a ranged or thrown one, as short strings for a card ("Reach 10 ft", "100/400 ft"). */
export function weaponRangeText(weapon: Weapon): string[] {
  const texts: string[] = []
  if (weapon.melee) texts.push(`Reach ${hasProperty(weapon, 'Reach') ? REACH_FT.withReach : REACH_FT.base} ft`)
  const thrown = weapon.melee && hasProperty(weapon, 'Thrown')
  if (!weapon.melee || thrown) {
    const { normal, long } = weapon.range
    texts.push(`${thrown ? 'thrown ' : ''}${long === undefined ? normal : `${normal}/${long}`} ft`)
  }
  return texts
}

export interface UnarmedStrike {
  toHit: number
  /** Flat damage: 1 plus the Strength modifier, never below 0. */
  flatDamage: number
  damageType: 'bludgeoning'
  grappleShoveDc: number
}

/** The Unarmed Strike every character has (2024: Bludgeoning damage equal to 1 plus Strength modifier; proficient). Not seed data. */
export function unarmedStrike({ abilities, proficiencyBonus }: AttackContext): UnarmedStrike {
  const mod = abilityMod(abilities.str)
  return {
    toHit: mod + proficiencyBonus,
    flatDamage: Math.max(0, 1 + mod),
    damageType: 'bludgeoning',
    grappleShoveDc: UNARMED_DC_BASE + mod + proficiencyBonus
  }
}

export interface AttackRiders {
  spells: Spell[]
  features: Feature[]
  /** Rider spells the character has not prepared: not listed here, so the page can say how many it left out. */
  unpreparedSpells: number
}

export const NO_RIDERS: AttackRiders = { spells: [], features: [], unpreparedSpells: 0 }

/**
 * The spells and features that go with an attack (the seed's `attackRider` flag). Independent of the spell grid's filters, so a
 * remembered chip cannot hide one. A spell is listed when prepared (or always prepared, or a cantrip); this is stricter than the
 * grid's default view, which also shows item-charge spells, but no rider is paid for by a charge.
 */
export function attackRiders(catalog: Catalog, play: Pick<PlayState, 'prepared'>): AttackRiders {
  const riders = catalog.spells.filter((s) => s.attackRider)
  const spells = riders.filter((s) => isPrepared(play, s))
  return {
    spells,
    features: catalog.features.filter((f) => f.attackRider),
    unpreparedSpells: riders.length - spells.length
  }
}
