import type { Character } from '@shared/types'

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

/** Proficiency bonus by character level (+2 at 1-4, +3 at 5-8, ...). */
export function proficiencyForLevel(level: number): number {
  return Math.ceil(level / 4) + 1
}

/** Initiative is a Dexterity check, so its modifier is Dexterity's. A later flat bonus (the Alert feat, say) joins here. */
export function initiativeModifier(c: Pick<Character, 'abilities'>): number {
  return abilityMod(c.abilities.dex)
}

export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

/** 8 + proficiency + casting ability modifier. */
export function spellSaveDc(c: Pick<Character, 'abilities' | 'proficiencyBonus' | 'spellcastingAbility'>): number {
  return 8 + c.proficiencyBonus + abilityMod(c.abilities[c.spellcastingAbility])
}

export function spellAttackBonus(c: Pick<Character, 'abilities' | 'proficiencyBonus' | 'spellcastingAbility'>): number {
  return c.proficiencyBonus + abilityMod(c.abilities[c.spellcastingAbility])
}

/** Concentration save DC after taking damage: max(10, floor(damage / 2)). */
export function concentrationDc(damage: number): number {
  return Math.max(10, Math.floor(damage / 2))
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
/** Spell level as a Roman numeral (0 -> "Cantrips" is handled by callers). */
export function roman(level: number): string {
  return ROMAN[level] ?? String(level)
}
