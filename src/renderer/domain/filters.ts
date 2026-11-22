import type { PlayState } from '@shared/schema'
import type { CastTime, Feature, Role, Spell } from '@shared/types'
import type { Catalog } from './catalog'
import { availableCosts, usesLeft } from './cost'
import { emptyFacetChoices, FACETS, type FacetChoices } from './facets'
import { isInDefaultView } from './prepared'
import { featureMatches, searchTokens, spellMatches } from './search'

/** What the player is trying to do, in table language. Each intent maps to spell roles. */
export type Intent = 'enemies' | 'allies' | 'utility'

export const INTENT_ROLES: Record<Intent, readonly Role[]> = {
  enemies: ['offense', 'control'],
  allies: ['support'],
  utility: ['utility']
}

export interface Filters {
  /** Spells matching ANY chosen intent. Empty = no restriction. */
  intents: Intent[]
  /** Spells matching ANY chosen cast time. Empty = no restriction. */
  castTimes: CastTime[]
  /** Level, range, school, save or attack, source: ANY chosen value within a facet, ALL facets together. */
  facets: FacetChoices
  noConcentration: boolean
  ritualOnly: boolean
  /** Only spells with something left to pay for them right now. */
  castableNow: boolean
  /** Include unprepared spells (dimmed, not castable) so they can be chosen. */
  showAll: boolean
  /** Every word must appear somewhere in the spell's text (see `search.ts`). */
  query: string
}

export const NO_FILTERS: Readonly<Filters> = Object.freeze({
  intents: [],
  castTimes: [],
  facets: emptyFacetChoices(),
  noConcentration: false,
  ritualOnly: false,
  castableNow: false,
  showAll: false,
  query: ''
})

/** How many choices live in the filter panel (the rest sit on the bar and show their own pressed state). */
export function panelFilterCount(f: Filters): number {
  const facetChoices = FACETS.reduce((sum, facet) => sum + f.facets[facet.id].length, 0)
  return facetChoices + (f.noConcentration ? 1 : 0) + (f.ritualOnly ? 1 : 0)
}

export function hasActiveFilters(f: Filters): boolean {
  return f.intents.length > 0 || f.castTimes.length > 0 || f.castableNow || f.query.trim() !== '' || panelFilterCount(f) > 0
}

/**
 * Level, range, school, save and source (and "ritual only") describe spells, not class features. While one is set,
 * features are hidden rather than shown as if they had passed it.
 */
function onlySpellsQualify(f: Filters): boolean {
  return f.ritualOnly || FACETS.some((facet) => f.facets[facet.id].length > 0)
}

/** The role used for filtering: the player's own override, else the spell's classification. */
export function effectiveRole(state: PlayState, spell: Spell): Role {
  return state.roleOverrides[spell.id] ?? spell.role
}

/** AND across facets, OR within one. Preserves catalog order; ordering for display is `order.ts`. */
export function filterSpells(state: PlayState, catalog: Catalog, filters: Filters): Spell[] {
  const tokens = searchTokens(filters.query)
  const roles = new Set(filters.intents.flatMap((intent) => INTENT_ROLES[intent]))

  return catalog.spells.filter((spell) => {
    if (!filters.showAll && !isInDefaultView(state, spell)) return false
    if (roles.size > 0 && !roles.has(effectiveRole(state, spell))) return false
    if (filters.castTimes.length > 0 && !filters.castTimes.includes(spell.castTime)) return false
    if (filters.noConcentration && spell.concentration) return false
    if (filters.ritualOnly && !spell.ritual) return false
    for (const facet of FACETS) {
      const chosen = filters.facets[facet.id]
      if (chosen.length > 0 && !chosen.includes(facet.valueOf(spell) ?? '')) return false
    }
    if (filters.castableNow && availableCosts(state, spell, catalog).length === 0) return false
    return spellMatches(spell, tokens)
  })
}

/** Something left to spend on this feature right now. */
export function featureUsable(state: PlayState, catalog: Catalog, feature: Feature): boolean {
  const counter = catalog.counterById(feature.counterId)
  return counter !== undefined && usesLeft(counter, state.counters) > 0
}

/** Intent, cast time, castable now and search apply to features too. Features are never concentration and never "unprepared". */
export function filterFeatures(state: PlayState, catalog: Catalog, filters: Filters): Feature[] {
  if (onlySpellsQualify(filters)) return []
  const tokens = searchTokens(filters.query)
  const roles = new Set(filters.intents.flatMap((intent) => INTENT_ROLES[intent]))
  return catalog.features.filter((feature) => {
    if (roles.size > 0 && !roles.has(feature.role)) return false
    if (filters.castTimes.length > 0 && !filters.castTimes.includes(feature.castTime)) return false
    if (filters.castableNow && !featureUsable(state, catalog, feature)) return false
    return featureMatches(feature, tokens)
  })
}
