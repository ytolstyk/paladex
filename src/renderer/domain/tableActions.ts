import { CONDITIONS, INITIATIVE_MAX, INITIATIVE_MIN, INSPIRATION_DICE, type ConditionId, type InspirationDie } from '@shared/constants'
import type { LogEntry, PlayState } from '@shared/schema'
import { appendCoalescedLog, appendLog, type ActionResult } from './actions'
import type { Catalog } from './catalog'
import { CONDITION_INFO } from './conditions'
import { formatLog } from './log'
import { settleTimers } from './timers'
import { undoKey } from './undo'

/**
 * What a player carries from the table into their own turn: initiative, Bardic Inspiration and conditions. Same contract as `actions.ts`
 * (pure, null when there is nothing to do). Manual edits that come in runs (the dial, the die size) coalesce in the log as
 * well as in undo, and a rest ends held inspiration (see `takeRest`).
 */

/**
 * Set this combat's initiative on the dial, or clear it with null. Anything off the dial (not a whole number from 1 to 25)
 * is refused. A rest does not touch it: it is the table's, not the character's, and the player clears or resets it.
 */
export function setInitiative(state: PlayState, value: number | null, now: number): ActionResult | null {
  if (value !== null && (!Number.isInteger(value) || value < INITIATIVE_MIN || value > INITIATIVE_MAX)) return null
  if (value === state.initiative) return null
  const entry: LogEntry = { t: now, kind: 'initiative', ...(value === null ? {} : { amount: value }) }
  return {
    state: appendCoalescedLog({ ...state, initiative: value }, entry),
    undo: { kind: 'edit', key: undoKey.initiative },
    entry
  }
}

/** Receive Bardic Inspiration (`held` true) or spend it. Has its own toast, since spending one by mistake is easy to do. */
export function setInspirationHeld(state: PlayState, held: boolean, now: number): ActionResult | null {
  if (state.inspiration.held === held) return null
  const entry: LogEntry = { t: now, kind: held ? 'inspiration-gain' : 'inspiration-use', die: state.inspiration.die }
  return {
    state: appendLog({ ...state, inspiration: { ...state.inspiration, held } }, entry),
    undo: { kind: 'toggle' },
    entry,
    toast: formatLog(entry)
  }
}

/** Change the size of the inspiration die (a Bard's die grows as they level). Holding it or not is unaffected. */
export function setInspirationDie(state: PlayState, die: number, now: number): ActionResult | null {
  const size = INSPIRATION_DICE.find((d): d is InspirationDie => d === die)
  if (size === undefined || size === state.inspiration.die) return null
  const entry: LogEntry = { t: now, kind: 'inspiration-die', die: size }
  return {
    state: appendCoalescedLog({ ...state, inspiration: { ...state.inspiration, die: size } }, entry),
    undo: { kind: 'edit', key: undoKey.inspirationDie },
    entry
  }
}

/**
 * Put a condition on the character (`on` true) or take it off. Null when it is already so. Only the conditions that include Incapacitated
 * act on anything else: Incapacitated breaks concentration, so it ends (the same automatic rule as dropping to 0 hit points, and the
 * log and toast say so). The rest are notes: nothing is blocked or changed by Frightened or Prone, and a rest never clears one.
 */
export function setCondition(state: PlayState, catalog: Catalog, id: ConditionId, on: boolean, now: number): ActionResult | null {
  if (state.conditions.includes(id) === on) return null
  const info = CONDITION_INFO[id]
  // Filtering the full list (not pushing) keeps the saved list in CONDITIONS order.
  const conditions = CONDITIONS.filter((c) => (c === id ? on : state.conditions.includes(c)))
  const endedSpellId = on && info.incapacitating ? state.concentration : null
  const entry: LogEntry = { t: now, kind: 'condition', condition: id, on, ...(endedSpellId ? { endedSpellId } : {}) }
  return {
    state: appendLog(settleTimers({ ...state, conditions, concentration: endedSpellId ? null : state.concentration }, catalog), entry),
    undo: { kind: 'edit', key: undoKey.condition(id) },
    entry,
    ...(endedSpellId ? { toast: `${info.name}: concentration on ${catalog.nameOf(endedSpellId)} ends` } : {})
  }
}
