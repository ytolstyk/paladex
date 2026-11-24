import { initiativeModifier } from '@/domain/derived'
import { rollInitiative, rollInspiration, type D20Mode, type DiceRoll } from '@/domain/dice'
import { catalog, usePlayStore } from './session'
import { useUiStore } from './uiStore'

/**
 * Rolls dice for the sheet. The numbers are decided here, at the press, and written to the sheet at once through the
 * ordinary actions (an initiative roll sets the dial, an inspiration roll spends the die), so a roll is an undoable change
 * whether or not anyone watches the tray. The tray (`DiceTray`) then only plays the roll back. Lives apart from `uiStore`
 * because it reads the character and the play state, which view state must not.
 */

/** Writes the roll's outcome to the sheet. The one place that knows what each kind of roll does. */
function commitRoll(roll: DiceRoll): void {
  const play = usePlayStore.getState()
  switch (roll.kind) {
    case 'initiative':
      play.setInitiative(roll.result)
      return
    case 'inspiration':
      play.setInspirationHeld(false)
      return
    default:
      return roll satisfies never // a new kind of roll must say what it does to the sheet
  }
}

/** Writes the roll to the sheet, then shows it in the tray. */
function perform(roll: DiceRoll): void {
  commitRoll(roll)
  useUiStore.getState().showRoll(roll)
}

/** Initiative: a d20 plus the character's initiative modifier. Nothing happens until the sheet is loaded. */
export function startInitiativeRoll(mode: D20Mode = 'normal'): void {
  if (!usePlayStore.getState().play) return
  perform(rollInitiative(initiativeModifier(catalog.character), mode))
}

/** Rolls the held Bardic Inspiration die and spends it. Nothing to roll when none is held. */
export function startInspirationRoll(): void {
  const inspiration = usePlayStore.getState().play?.inspiration
  if (!inspiration?.held) return
  perform(rollInspiration(inspiration.die))
}
