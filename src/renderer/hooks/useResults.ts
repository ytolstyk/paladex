import { useMemo } from 'react'
import type { PlayState } from '@shared/schema'
import type { Feature } from '@shared/types'
import { filterFeatures, filterSpells, hasActiveFilters, type Filters } from '@/domain/filters'
import { groupSpells, orderFeatures, type SortKey, type SpellGroup } from '@/domain/order'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'

/** What the stage shows for the current filters and sort. */
export interface Results {
  /** The spells that pass, headed and ordered for the chosen sort. */
  groups: SpellGroup[]
  features: Feature[]
  spellCount: number
  /** Spells that would also pass if "show all spells" were on: matches the player has not prepared. 0 when nothing is filtered. */
  hiddenUnprepared: number
}

const NONE: Results = { groups: [], features: [], spellCount: 0, hiddenUnprepared: 0 }

function compute(play: PlayState, filters: Filters, sort: SortKey): Results {
  const spells = filterSpells(play, catalog, filters)
  const withUnprepared = !filters.showAll && hasActiveFilters(filters) ? filterSpells(play, catalog, { ...filters, showAll: true }) : spells
  return {
    groups: groupSpells(play, spells, sort),
    features: orderFeatures(filterFeatures(play, catalog, filters), sort),
    spellCount: spells.length,
    hiddenUnprepared: withUnprepared.length - spells.length
  }
}

/**
 * The one-entry cache that lets every `useResults` caller (the grid and the filter bar) share a single computation per
 * distinct (play state, filters, sort). Each is replaced, never mutated, so identity is a sound key.
 */
let last: { play: PlayState; filters: Filters; sort: SortKey; results: Results } | null = null

function resultsFor(play: PlayState, filters: Filters, sort: SortKey): Results {
  if (last && last.play === play && last.filters === filters && last.sort === sort) return last.results
  const results = compute(play, filters, sort)
  last = { play, filters, sort, results }
  return results
}

/** A string that changes exactly when what is on screen changes. Strings compare by value, which a fresh results object cannot. */
function signature(results: Results): string {
  const groups = results.groups.map((g) => `${g.id}=${g.spells.map((s) => s.id).join(',')}`).join('|')
  return `${groups}#${results.features.map((f) => f.id).join(',')}#${results.hiddenUnprepared}`
}

/**
 * The filtered, sorted spells and features. The store selector returns only the signature, so a change that does not alter
 * the visible list (a hit point tick, a pip) never re-renders the stage. When the signature moves, the memo below picks up
 * the same `Results` the selector just built (via `resultsFor`), so nothing is computed twice.
 *
 * The signature must cover everything in `Results` that depends on play state. `Results` holds only the catalog's own
 * (immutable) spells and features, so ids are enough; a field that carried play state (a "dimmed" flag) would need adding.
 */
export function useResults(): Results {
  const filters = useUiStore((s) => s.filters)
  const sort = useUiStore((s) => s.sort)
  const sig = usePlayStore((s) => (s.play ? signature(resultsFor(s.play, filters, sort)) : ''))
  // `sig` is a trigger, not an input: it is what tells us the play state changed in a way that matters.
  return useMemo(() => {
    const play = usePlayStore.getState().play
    return play ? resultsFor(play, filters, sort) : NONE
  }, [sig, filters, sort])
}
