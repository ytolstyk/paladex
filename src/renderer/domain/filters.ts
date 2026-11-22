import type { PlayState } from '@shared/schema'
import type { CastTime, Feature, Role, Spell } from '@shared/types'
import type { Catalog } from './catalog'
import { availableCosts, usesLeft } from './cost'
import { isInDefaultView } from './prepared'

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
  noConcentration: boolean
  /** Only spells with something left to pay for them right now. */
  castableNow: boolean
  /** Include unprepared spells (dimmed, not castable) so they can be chosen. */
  showAll: boolean
  query: string
}

export const NO_FILTERS: Readonly<Filters> = Object.freeze({
  intents: [],
  castTimes: [],
  noConcentration: false,
  castableNow: false,
  showAll: false,
  query: ''
})

export function hasActiveFilters(f: Filters): boolean {
  return f.intents.length > 0 || f.castTimes.length > 0 || f.noConcentration || f.castableNow || f.query.trim() !== ''
}

/** The role used for filtering: the player's own override, else the spell's classification. */
export function effectiveRole(state: PlayState, spell: Spell): Role {
  return state.roleOverrides[spell.id] ?? spell.role
}

/** AND across facets, OR within one. Preserves catalog order. */
export function filterSpells(state: PlayState, catalog: Catalog, filters: Filters): Spell[] {
  const query = filters.query.trim().toLowerCase()
  const roles = new Set(filters.intents.flatMap((intent) => INTENT_ROLES[intent]))

  return catalog.spells.filter((spell) => {
    if (!filters.showAll && !isInDefaultView(state, spell)) return false
    if (roles.size > 0 && !roles.has(effectiveRole(state, spell))) return false
    if (filters.castTimes.length > 0 && !filters.castTimes.includes(spell.castTime)) return false
    if (filters.noConcentration && spell.concentration) return false
    if (filters.castableNow && availableCosts(state, spell, catalog).length === 0) return false
    if (query && !`${spell.name} ${spell.summary} ${spell.school}`.toLowerCase().includes(query)) return false
    return true
  })
}

/** Something left to spend on this feature right now. */
export function featureUsable(state: PlayState, catalog: Catalog, feature: Feature): boolean {
  const counter = catalog.counterById(feature.counterId)
  return counter !== undefined && usesLeft(counter, state.counters) > 0
}

/** Same facets as spells (intent, cast time, castable now, search). Features are never concentration and never "unprepared". */
export function filterFeatures(state: PlayState, catalog: Catalog, filters: Filters): Feature[] {
  const query = filters.query.trim().toLowerCase()
  const roles = new Set(filters.intents.flatMap((intent) => INTENT_ROLES[intent]))
  return catalog.features.filter((feature) => {
    if (roles.size > 0 && !roles.has(feature.role)) return false
    if (filters.castTimes.length > 0 && !filters.castTimes.includes(feature.castTime)) return false
    if (filters.castableNow && !featureUsable(state, catalog, feature)) return false
    if (query && !`${feature.name} ${feature.summary}`.toLowerCase().includes(query)) return false
    return true
  })
}
