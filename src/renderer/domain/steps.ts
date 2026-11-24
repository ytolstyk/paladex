import type { PlayState } from '@shared/schema'
import type { Payment } from '@shared/types'
import type { ConditionId, TurnStep } from '@shared/constants'
import * as actions from './actions'
import type { Call, CallOf, DropReason } from './calls'
import type { Catalog } from './catalog'
import * as table from './tableActions'
import { TURN_STEP_FLAG } from './turn'

export type { Call, DropReason, Step } from './calls'

type Runner<K extends Call['type']> = (state: PlayState, catalog: Catalog, call: CallOf<K>, t: number) => actions.ActionResult | null

/**
 * How each kind of call runs. Null when there is nothing to do (the same contract as the actions). A call with a stated payment is
 * strict: if that payment is not available any more the cast does not happen, it is never paid some other way. The toggles check the
 * value they set first, so a replay that finds the work already done does nothing instead of flipping it back.
 */
const RUNNERS: { [K in Call['type']]: Runner<K> } = {
  cast: (state, catalog, call, t) => actions.castSpell(state, catalog, call.spellId, call.requested, t),
  slot: (state, catalog, call, t) => actions.adjustSlot(state, catalog, call.level, call.direction, t),
  newTurn: (state, catalog, call, t) => actions.startNewTurn(state, catalog, t, call.turnSeconds),
  endTimer: (state, catalog, call, t) => actions.endTimer(state, catalog, call.spellId, t),
  turnStep: (state, _catalog, call, t) => (state.turn[TURN_STEP_FLAG[call.step]] === call.on ? null : actions.toggleTurnStep(state, call.step, t)),
  feature: (state, catalog, call, t) => actions.activateFeature(state, catalog, call.featureId, call.amount, t),
  prepared: (state, catalog, call, t) => (state.prepared.includes(call.spellId) === call.on ? null : actions.togglePrepared(state, catalog, call.spellId, t)),
  favorite: (state, catalog, call, t) => (state.favorites.includes(call.spellId) === call.on ? null : actions.toggleFavorite(state, catalog, call.spellId, t)),
  counter: (state, catalog, call, t) => actions.adjustCounter(state, catalog, call.counterId, call.delta, t),
  hp: (state, catalog, call, t) => actions.adjustHp(state, catalog, call.delta, t),
  rest: (state, catalog, call, t) => actions.takeRest(state, catalog, call.kind, t),
  initiative: (state, _catalog, call, t) => table.setInitiative(state, call.value, t),
  inspirationHeld: (state, _catalog, call, t) => table.setInspirationHeld(state, call.held, t),
  inspirationDie: (state, _catalog, call, t) => table.setInspirationDie(state, call.die, t),
  condition: (state, catalog, call, t) => table.setCondition(state, catalog, call.id, call.on, t),
  dropConcentration: (state, catalog, call, t) => (state.concentration === call.spellId ? actions.dropConcentration(state, catalog, t) : null)
}

export function runCall(state: PlayState, catalog: Catalog, call: Call, t: number): actions.ActionResult | null {
  // The table is keyed by kind, so the runner for `call.type` takes exactly this call; TypeScript cannot see that through the lookup.
  return (RUNNERS[call.type] as Runner<Call['type']>)(state, catalog, call, t)
}

/**
 * When a call finds nothing to do on a replay, is that a loss? Said for every kind (the compiler insists), so a new action cannot
 * quietly land in the alarming group: idempotent ones are harmless, those that spend something are not.
 */
const DROP_REASON: Record<Call['type'], DropReason> = {
  cast: 'no-longer-possible',
  slot: 'no-longer-possible',
  newTurn: 'no-longer-needed',
  endTimer: 'no-longer-needed',
  turnStep: 'no-longer-needed',
  feature: 'no-longer-possible',
  prepared: 'no-longer-needed',
  favorite: 'no-longer-needed',
  counter: 'no-longer-possible',
  hp: 'no-longer-possible',
  rest: 'no-longer-possible',
  initiative: 'no-longer-needed',
  inspirationHeld: 'no-longer-needed',
  inspirationDie: 'no-longer-needed',
  condition: 'no-longer-needed',
  dropConcentration: 'no-longer-needed'
}

export const dropReason = (call: Call): DropReason => DROP_REASON[call.type]

/**
 * The calls the store makes for the actions whose call depends on the sheet at that moment (a toggle sets the opposite of what it is
 * now), so the store stays a dispatcher and the rule about "which value" lives with the rules.
 */
export const callFor = {
  turnStep: (play: PlayState, step: TurnStep): Call => ({ type: 'turnStep', step, on: !play.turn[TURN_STEP_FLAG[step]] }),
  prepared: (play: PlayState, spellId: string): Call => ({ type: 'prepared', spellId, on: !play.prepared.includes(spellId) }),
  favorite: (play: PlayState, spellId: string): Call => ({ type: 'favorite', spellId, on: !play.favorites.includes(spellId) }),
  condition: (play: PlayState, id: ConditionId): Call => ({ type: 'condition', id, on: !play.conditions.includes(id) }),
  dropConcentration: (play: PlayState): Call | null => (play.concentration ? { type: 'dropConcentration', spellId: play.concentration } : null),
  /**
   * A cast runs with the payment the card showed (strict, so a refused cast looks like one). Only a payment the player picked is
   * remembered for a replay; a default cast is remembered as "pay the way the card would".
   */
  cast: (spellId: string, payment: Payment | undefined, picked: boolean): { live: Call; replayAs: Call } => {
    const live: Call = { type: 'cast', spellId, ...(payment ? { requested: payment } : {}) }
    return { live, replayAs: picked ? live : { type: 'cast', spellId } }
  }
}
