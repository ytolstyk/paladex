import type { Feature, Spell, Weapon, WeaponMastery } from '@shared/types'
import type { Catalog } from './catalog'
import { CAST_LABEL } from './labels'

const labelOf = (catalog: Catalog, counterId: string): string => catalog.counterById(counterId)?.label ?? counterId

/** What casting a spell can cost, in the order the app offers it: "a free cast (Free Divine Smite), then a spell slot". */
export function describeSpellCost(spell: Spell, catalog: Catalog): string {
  const parts = spell.costs.map((cost) => {
    switch (cost.kind) {
      case 'none':
        return 'nothing (a cantrip)'
      case 'slot':
        return 'a spell slot'
      case 'free':
        return `a free cast (${labelOf(catalog, cost.counterId)})`
      case 'charge':
        return `a charge (${labelOf(catalog, cost.counterId)})`
    }
  })
  return parts.join(', then ')
}

/** What using a feature spends: "1 use of Channel Divinity", or "any amount from Lay On Hands". */
export function describeFeatureCost(feature: Feature, catalog: Catalog): string {
  const counter = labelOf(catalog, feature.counterId)
  if (feature.spend.kind === 'uses') return `1 use of ${counter}`
  return feature.spend.maxPerUse
    ? `up to ${feature.spend.maxPerUse} from ${counter} at once`
    : `any amount from ${counter}`
}

const LEVEL_NAME = ['Cantrip', '1st-level', '2nd-level', '3rd-level', '4th-level', '5th-level']

/** "2nd-level Enchantment" / "Enchantment cantrip". */
export function describeSpellKind(spell: Spell): string {
  return spell.level === 0 ? `${spell.school} cantrip` : `${LEVEL_NAME[spell.level] ?? `Level ${spell.level}`} ${spell.school}`
}

const SOURCE_NAME = { class: 'Class feature', race: 'Species feature', homebrew: 'DM homebrew feature' } as const
export function describeFeatureKind(feature: Feature): string {
  return SOURCE_NAME[feature.source]
}

/** "Action", "Bonus action", "Action, with the Attack action", "10 minutes". */
export function describeCastTime(thing: Pick<Spell, 'castTime' | 'castingNote'> | Pick<Feature, 'castTime' | 'timing'>): string {
  const base = CAST_LABEL[thing.castTime]
  if ('castingNote' in thing && thing.castingNote) return thing.castingNote
  if ('timing' in thing && thing.timing) return `${base}, ${thing.timing}`
  return base
}

/** "Magic melee weapon, Halberd". */
export function describeWeaponKind(weapon: Weapon): string {
  const reach = weapon.melee ? 'melee' : 'ranged'
  const label = weapon.magic ? `Magic ${reach}` : weapon.melee ? 'Melee' : 'Ranged'
  return `${label} weapon, ${weapon.baseType}`
}

export type MasteryTone = 'mastery' | 'muted'

/** How a weapon's mastery reads: lit when the character chose it, struck through ("not mastered") when not. Never hidden. */
export function describeMastery(mastery: WeaponMastery): { tone: MasteryTone; label: string; tooltip: string } {
  return mastery.known
    ? { tone: 'mastery', label: mastery.name, tooltip: mastery.text }
    : {
        tone: 'muted',
        label: `${mastery.name}, not mastered`,
        tooltip: `You have not chosen the ${mastery.name} mastery for this kind of weapon. ${mastery.text}`
      }
}

/** The non-empty lines of a multi-line text, one paragraph each. */
export function paragraphsOf(text: string | undefined): string[] {
  return text ? text.split('\n').filter((line) => line.trim() !== '') : []
}

/** "1 spell" / "3 spells". */
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
