import { createInitialPlayState } from '@shared/initial'
import type { PlayState } from '@shared/schema'
import type { Catalog } from './catalog'
import { isChoosable } from './prepared'
import { clamp, clampUsed } from './slots'
import { settleTimers } from './timers'

export interface Reconciled {
  state: PlayState
  /** True when anything had to be repaired, so the caller can write the fixed state back to disk. */
  repaired: boolean
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Make a saved state agree with the current catalog. A save outlives the seed it was made against
 * (a re-import, a level-up, a removed spell), so every reference is checked rather than trusted:
 * slot/counter usage is clamped, unknown ids (prepared, favorites, roles, timers) are dropped, and maximum hit points and armor class follow the seed
 * (nothing edits them yet; when editing arrives they become overrides on top of it).
 */
export function reconcile(saved: PlayState, catalog: Catalog): Reconciled {
  const { hpMax, ac } = catalog.character
  const slotsUsed = clampUsed(catalog.slotCapacity, saved.slotsUsed)

  const counters: Record<string, number> = {}
  for (const def of catalog.counters) {
    const used = saved.counters[def.id]
    if (used !== undefined) counters[def.id] = Math.min(used, def.max)
  }

  const prepared = saved.prepared.filter((id, i, all) => {
    const spell = catalog.spellById(id)
    return spell !== undefined && isChoosable(spell) && all.indexOf(id) === i
  })

  const favorites = saved.favorites.filter((id, i, all) => catalog.spellById(id) !== undefined && all.indexOf(id) === i)

  const concentration = saved.concentration && catalog.spellById(saved.concentration) ? saved.concentration : null
  const roleOverrides = Object.fromEntries(Object.entries(saved.roleOverrides).filter(([id]) => catalog.spellById(id)))

  const vitals = {
    ...saved.vitals,
    hpMax,
    ac,
    hp: clamp(saved.vitals.hp, 0, hpMax),
    tempHp: Math.max(0, saved.vitals.tempHp)
  }

  // Timers for a spell that is gone, a second one for the same spell, or a concentration spell no longer concentrated on, are dropped.
  const state = settleTimers({ ...saved, slotsUsed, counters, prepared, favorites, concentration, roleOverrides, vitals }, catalog)
  return { state, repaired: !sameJson(state, saved) }
}

/** First-launch state for a catalog: fully rested except seeded counters, then through the same checks as a loaded save. */
export function seedPlayState(catalog: Catalog, now: number): PlayState {
  const fresh = createInitialPlayState(
    {
      hpMax: catalog.character.hpMax,
      ac: catalog.character.ac,
      counters: catalog.counters,
      seededUsed: catalog.seededUsed,
      prepared: catalog.preparedSeed
    },
    now
  )
  return reconcile(fresh, catalog).state
}
