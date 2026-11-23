import { TURN_STEPS, type TurnState, type TurnStep } from '@shared/constants'
import type { CastTime, Feature, Spell } from '@shared/types'
import { TURN_STEP_LABEL } from './labels'
import type { TurnOptions } from './turnOptions'

/**
 * The turn-economy rules, in one place. 2024 rules: one spell slot per turn ("One Spell with a Spell Slot per Turn"), one
 * action, one bonus action and one reaction. All are soft: an action that breaks one is still allowed, and the table's ruling
 * wins (Action Surge, a feature that grants more). Actions, the card hints and the toast all read this module, so they cannot
 * disagree.
 */
export type TurnWarning = 'second-slot-spell' | 'second-bonus-action' | 'second-action' | 'second-reaction'

export const TURN_WARNING_TEXT: Record<TurnWarning, string> = {
  'second-slot-spell': 'You already spent a spell slot this turn (2024: one per turn).',
  'second-bonus-action': 'You already used your bonus action this turn.',
  'second-action': 'You already used your action this turn.',
  'second-reaction': 'You already used your reaction since your turn began.'
}

/** A stable empty list, so selectors returning "no warnings" never produce a new reference. */
export const NO_WARNINGS: readonly TurnWarning[] = []

/** The warnings as one sentence for a tooltip or toast. */
export function warningText(warnings: readonly TurnWarning[]): string {
  return warnings.map((w) => TURN_WARNING_TEXT[w]).join(' ')
}

/** Which flag of the turn each hand-tracked step sets. */
export const TURN_STEP_FLAG = {
  action: 'actionSpent',
  move: 'moved',
  bonus: 'bonusActionSpent',
  reaction: 'reactionSpent'
} as const satisfies Record<TurnStep, keyof TurnState>

/** Nothing has been spent or marked this turn (a "new turn" would change nothing). Derived from the steps, so a new one cannot be forgotten. */
export function isTurnClear(turn: TurnState): boolean {
  return !turn.slotSpellCast && turn.castsSinceNewTurn === 0 && TURN_STEPS.every((step) => !turn[TURN_STEP_FLAG[step]])
}

/**
 * What is still worth remembering at the end of a turn: a bonus action, only when something could use it, and the reaction. The
 * action and movement are left out on purpose: weapon attacks have no button, so the action can look unused after a real attack,
 * and speed is spent in pieces.
 */
export function stillAvailable(turn: TurnState, options: TurnOptions): string[] {
  const left: string[] = []
  if (!turn.bonusActionSpent && options.bonus.some((o) => o.ready)) left.push(TURN_STEP_LABEL.bonus.name)
  if (!turn.reactionSpent) left.push(TURN_STEP_LABEL.reaction.name)
  return left
}

/** What a spell cast or feature use does to the turn. */
export interface TurnAction {
  castTime: CastTime
  /** The cast was paid for with a spell slot (free casts, item charges, cantrips and features expend none). */
  spendsSlot: boolean
  /**
   * It is part of the Attack action (Vow of Enmity, Breath Weapon), not an action of its own: it marks the action as used but
   * never warns about it. A soft gap: such a rider after, say, a Magic-action spell goes unflagged.
   */
  isRider?: boolean
}

/**
 * What using a spell or feature does to the turn, from the thing itself: the one place a `TurnAction` is built, so the toast, the
 * card hint and the state change cannot read it differently. (A spell is never a rider today: every rider spell is a bonus action.)
 */
export function turnActionOf(thing: Pick<Spell | Feature, 'castTime'> & { attackRider?: boolean }, spendsSlot: boolean): TurnAction {
  return { castTime: thing.castTime, spendsSlot, isRider: thing.attackRider === true && thing.castTime === 'action' }
}

/** A reaction is on someone else's turn too, so a slot spent on one does not count towards, or against, your own turn's slot. */
const countsAsSlotThisTurn = (action: TurnAction): boolean => action.spendsSlot && action.castTime !== 'reaction'

export function turnWarnings(turn: TurnState, action: TurnAction): TurnWarning[] {
  const warnings: TurnWarning[] = []
  if (countsAsSlotThisTurn(action) && turn.slotSpellCast) warnings.push('second-slot-spell')
  if (action.castTime === 'bonus' && turn.bonusActionSpent) warnings.push('second-bonus-action')
  if (action.castTime === 'action' && !action.isRider && turn.actionSpent) warnings.push('second-action')
  if (action.castTime === 'reaction' && turn.reactionSpent) warnings.push('second-reaction')
  return warnings
}

/** `isSpellCast` separates spells from features: only spells count towards "casts since new turn". */
export function applyToTurn(turn: TurnState, action: TurnAction & { isSpellCast: boolean }): TurnState {
  return {
    slotSpellCast: turn.slotSpellCast || countsAsSlotThisTurn(action),
    bonusActionSpent: turn.bonusActionSpent || action.castTime === 'bonus',
    actionSpent: turn.actionSpent || action.castTime === 'action',
    moved: turn.moved,
    reactionSpent: turn.reactionSpent || action.castTime === 'reaction',
    // A reaction is not on your turn, so it is not one of this turn's casts.
    castsSinceNewTurn: turn.castsSinceNewTurn + (action.isSpellCast && action.castTime !== 'reaction' ? 1 : 0)
  }
}

/** The turn with one hand-tracked step switched on or off. */
export function withStep(turn: TurnState, step: TurnStep, on: boolean): TurnState {
  return { ...turn, [TURN_STEP_FLAG[step]]: on }
}
