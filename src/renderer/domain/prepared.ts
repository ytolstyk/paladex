import type { PlayState } from '@shared/schema'
import type { Spell } from '@shared/types'
import type { Catalog } from './catalog'
import { clamp } from './slots'

/**
 * Spells a 2024 Paladin of each class level may have prepared (not counting always-prepared oath/class spells).
 * Level 5 (= 6) is confirmed against the user's sheet; the other levels come from the class table and have not been
 * checked against it. Only used for a soft warning, never to block a choice.
 */
const PALADIN_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]

export function paladinPreparedLimit(classLevel: number): number {
  return PALADIN_PREPARED[clamp(Math.floor(classLevel) || 1, 1, 20) - 1] ?? 0
}

/** Cantrips and free (always-prepared) spells can't be chosen; every other leveled spell can. */
export function isChoosable(spell: Spell): boolean {
  return spell.level > 0 && !spell.alwaysPrepared
}

/** Needs no preparing to be useful: it can be paid for with an item charge (e.g. the Arbiter's Ward). */
export function isUsableUnprepared(spell: Spell): boolean {
  return spell.costs.some((cost) => cost.kind === 'charge')
}

/** Cantrips and always-prepared spells need no preparing; everything else must be in the chosen set. */
export function isPrepared(state: Pick<PlayState, 'prepared'>, spell: Spell): boolean {
  return spell.level === 0 || spell.alwaysPrepared === true || state.prepared.includes(spell.id)
}

/** Shown in the default grid (as opposed to only under "Show all spells"). */
export function isInDefaultView(state: Pick<PlayState, 'prepared'>, spell: Spell): boolean {
  return isPrepared(state, spell) || isUsableUnprepared(spell)
}

/** How many of the chosen spells count against the limit. */
export function chosenCount(state: PlayState, catalog: Catalog): number {
  return state.prepared.filter((id) => {
    const spell = catalog.spellById(id)
    return spell !== undefined && isChoosable(spell)
  }).length
}
