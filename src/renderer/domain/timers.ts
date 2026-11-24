import { MAX_TIMERS, SECONDS_PER, type SpellTimer } from '@shared/constants'
import type { PlayState } from '@shared/schema'
import type { Spell } from '@shared/types'
import type { Catalog } from './catalog'
import { durationSeconds } from './duration'

/**
 * Duration timers: pure functions over the play state. A timer starts when a timed spell is cast and counts down in seconds;
 * "New turn" subtracts one turn length from each, and a rest subtracts the least time it takes. They are reminders from the
 * spell's printed (base) duration: a longer duration from a higher slot is not modelled, so End a timer by hand if the table
 * says otherwise.
 */

/** The least time a rest takes (2024: a Short Rest is at least 1 hour, a Long Rest at least 8). A longer rest is ended by hand. */
export const REST_SECONDS = { short: SECONDS_PER.hour, long: 8 * SECONDS_PER.hour } as const

/** Casting `spell` starts its timer, or restarts it when it is already running. Spells with no length to count do nothing. */
export function startTimer(state: PlayState, spell: Spell): PlayState {
  const seconds = durationSeconds(spell.duration)
  if (seconds === null) return state
  const others = state.timers.filter((t) => t.spellId !== spell.id)
  return { ...state, timers: [...others, { spellId: spell.id, remaining: seconds, total: seconds }].slice(-MAX_TIMERS) }
}

/**
 * The rule that keeps timers honest, applied once at the end of every action that can change them: a timer lives only while its
 * spell is in the catalog and, for a concentration spell, only while it is the one being concentrated on. Read from the catalog,
 * not from a flag on the timer, so it cannot go stale.
 */
export function settleTimers(state: PlayState, catalog: Catalog): PlayState {
  const seen = new Set<string>()
  const kept: SpellTimer[] = []
  for (const timer of state.timers) {
    const spell = catalog.spellById(timer.spellId)
    if (!spell || seen.has(timer.spellId)) continue
    if (spell.concentration && state.concentration !== timer.spellId) continue
    seen.add(timer.spellId)
    kept.push(timer.remaining > timer.total ? { ...timer, remaining: timer.total } : timer)
  }
  const unchanged = kept.length === state.timers.length && kept.every((t, i) => t === state.timers[i])
  return unchanged ? state : { ...state, timers: kept }
}

export interface Elapsed {
  state: PlayState
  /** Spell ids whose timers ran out, in the order they were running. */
  ended: string[]
}

/**
 * Let `seconds` pass. A timer that runs out is removed; when it was the spell being concentrated on, that concentration ends with
 * it (the spell is over, so "Concentrating on Bless" must not linger).
 */
export function elapse(state: PlayState, catalog: Catalog, seconds: number): Elapsed {
  const ended: string[] = []
  const timers: SpellTimer[] = []
  for (const timer of state.timers) {
    const remaining = timer.remaining - seconds
    if (remaining <= 0) ended.push(timer.spellId)
    else timers.push({ ...timer, remaining })
  }
  const concentration = state.concentration && ended.includes(state.concentration) ? null : state.concentration
  return { state: settleTimers({ ...state, timers, concentration }, catalog), ended }
}

/** "Bless has ended", "Bless and Bane have ended", "Bless, Bane and Hold Person have ended". */
export function endedText(names: readonly string[]): string {
  if (names.length === 0) return ''
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${list} ${names.length === 1 ? 'has' : 'have'} ended`
}
