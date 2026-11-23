import type { Feature, Spell } from '@shared/types'
import type { Catalog } from './catalog'
import { availableCosts, canUseFeature, type CostState } from './cost'
import { isInDefaultView } from './prepared'

/** One thing the character can do with a bonus action or a reaction. */
export interface TurnOption {
  /** The spell or feature id (it opens the detail drawer). */
  id: string
  name: string
  /** Can be used right now: a way to pay for it is left. Shown dimmed otherwise, never hidden. */
  ready: boolean
}

export interface TurnOptions {
  bonus: TurnOption[]
  reaction: TurnOption[]
}

export const NO_TURN_OPTIONS: TurnOptions = { bonus: [], reaction: [] }

const spellOption = (spell: Spell, state: CostState, catalog: Catalog): TurnOption => ({
  id: spell.id,
  name: spell.name,
  ready: availableCosts(state, spell, catalog).length > 0
})

const featureOption = (feature: Feature, state: CostState, catalog: Catalog): TurnOption => ({
  id: feature.id,
  name: feature.name,
  ready: canUseFeature(feature, catalog, state.counters)
})

/**
 * What the character can do with a bonus action and with a reaction: their spells that are in the spell grid's default view
 * (prepared, always prepared, or paid for by an item charge) and their features, by casting time. Independent of the grid's
 * filters, like `attackRiders`, so a remembered chip cannot hide an option from the reminder.
 */
export function turnOptions(catalog: Catalog, state: CostState): TurnOptions {
  const pick = (castTime: 'bonus' | 'reaction'): TurnOption[] => [
    ...catalog.spells.filter((s) => s.castTime === castTime && isInDefaultView(state, s)).map((s) => spellOption(s, state, catalog)),
    ...catalog.features.filter((f) => f.castTime === castTime).map((f) => featureOption(f, state, catalog))
  ]
  return { bonus: pick('bonus'), reaction: pick('reaction') }
}
