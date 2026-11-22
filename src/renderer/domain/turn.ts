import type { TurnState } from '@shared/constants'
import type { CastTime } from '@shared/types'

/**
 * The turn-economy rules, in one place. 2024 rules: one spell slot per turn ("One Spell with a Spell Slot per Turn")
 * and one bonus action per turn. Both are soft: an action that breaks one is still allowed, and the table's ruling wins.
 * Actions, the card hints and the toast all read this module, so they cannot disagree.
 */
export type TurnWarning = 'second-slot-spell' | 'second-bonus-action'

export const TURN_WARNING_TEXT: Record<TurnWarning, string> = {
  'second-slot-spell': 'You already spent a spell slot this turn (2024: one per turn).',
  'second-bonus-action': 'You already used your bonus action this turn.'
}

/** A stable empty list, so selectors returning "no warnings" never produce a new reference. */
export const NO_WARNINGS: readonly TurnWarning[] = []

/** The warnings as one sentence for a tooltip or toast. */
export function warningText(warnings: readonly TurnWarning[]): string {
  return warnings.map((w) => TURN_WARNING_TEXT[w]).join(' ')
}

/** Nothing has been spent this turn (a "new turn" would change nothing). */
export function isTurnClear(turn: TurnState): boolean {
  return !turn.slotSpellCast && !turn.bonusActionSpent && turn.castsSinceNewTurn === 0
}

/** What a spell cast or feature use does to the turn. */
export interface TurnAction {
  castTime: CastTime
  /** The cast was paid for with a spell slot (free casts, item charges, cantrips and features expend none). */
  spendsSlot: boolean
}

export function turnWarnings(turn: TurnState, action: TurnAction): TurnWarning[] {
  const warnings: TurnWarning[] = []
  if (action.spendsSlot && turn.slotSpellCast) warnings.push('second-slot-spell')
  if (action.castTime === 'bonus' && turn.bonusActionSpent) warnings.push('second-bonus-action')
  return warnings
}

/** `isSpellCast` separates spells from features: only spells count towards "casts since new turn". */
export function applyToTurn(turn: TurnState, action: TurnAction & { isSpellCast: boolean }): TurnState {
  return {
    slotSpellCast: turn.slotSpellCast || action.spendsSlot,
    bonusActionSpent: turn.bonusActionSpent || action.castTime === 'bonus',
    castsSinceNewTurn: turn.castsSinceNewTurn + (action.isSpellCast ? 1 : 0)
  }
}
