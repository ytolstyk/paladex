import type { InspirationDie } from '@shared/constants'
import { clampInitiative } from './dial'

/**
 * Dice for the two rolls the app makes for you: initiative (a d20 plus Dexterity, with Advantage or Disadvantage) and the
 * Bardic Inspiration die. Pure: the random source is a parameter, so tests can feed it numbers. The rolls are decided here,
 * up front; the tray only animates them.
 */

/** A source of numbers in [0, 1), like `Math.random`. */
export type Rand = () => number

/** Not guessable from earlier rolls, unlike `Math.random`, and off by about one part in 4 billion per face (2^32 is not a multiple of 6 or 20): fair for a table roller. */
export const secureRand: Rand = () => (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) / 2 ** 32

export function rollDie(sides: number, rand: Rand = secureRand): number {
  return Math.min(sides, 1 + Math.floor(rand() * sides))
}

export const D20 = 20

export type D20Mode = 'normal' | 'advantage' | 'disadvantage'
export const D20_MODES: readonly D20Mode[] = ['normal', 'advantage', 'disadvantage']
export const D20_MODE_LABEL: Record<D20Mode, string> = { normal: 'Normal', advantage: 'Advantage', disadvantage: 'Disadvantage' }

/** Which of the dice thrown counts, by mode. */
const KEEP: Record<D20Mode, (dice: readonly number[]) => number> = {
  normal: (dice) => dice[0] ?? 0,
  advantage: (dice) => Math.max(...dice),
  disadvantage: (dice) => Math.min(...dice)
}

export interface InitiativeRoll {
  kind: 'initiative'
  mode: D20Mode
  /** Every d20 thrown: one, or two with Advantage or Disadvantage. */
  dice: readonly number[]
  /** The d20 that counts. */
  kept: number
  modifier: number
  total: number
  /** What goes on the dial: the total, held to the dial's range. */
  result: number
}

export interface InspirationRoll {
  kind: 'inspiration'
  sides: InspirationDie
  value: number
}

export type DiceRoll = InitiativeRoll | InspirationRoll

export function rollInitiative(modifier: number, mode: D20Mode, rand: Rand = secureRand): InitiativeRoll {
  const dice = mode === 'normal' ? [rollDie(D20, rand)] : [rollDie(D20, rand), rollDie(D20, rand)]
  const kept = KEEP[mode](dice)
  const total = kept + modifier
  return { kind: 'initiative', mode, dice, kept, modifier, total, result: clampInitiative(total) }
}

export function rollInspiration(sides: InspirationDie, rand: Rand = secureRand): InspirationRoll {
  return { kind: 'inspiration', sides, value: rollDie(sides, rand) }
}

/** A natural 20 or 1 on the d20 that counts. They do not change initiative; the tray just marks them. */
export function naturalOf(roll: DiceRoll): 'twenty' | 'one' | null {
  if (roll.kind !== 'initiative') return null
  if (roll.kept === D20) return 'twenty'
  return roll.kept === 1 ? 'one' : null
}

/** Whether the dial had to hold the total to its range (a total below 1 or above 25). */
export function wasClamped(roll: InitiativeRoll): boolean {
  return roll.result !== roll.total
}

/** The roll in a sentence, for a screen reader and the tray's caption: "14 + 1 = 15", or "Advantage, 14 and 6: 14 + 1 = 15". */
export function describeRoll(roll: DiceRoll): string {
  if (roll.kind === 'inspiration') return `Bardic Inspiration d${roll.sides}: ${roll.value}`
  const sum = `${roll.kept} ${roll.modifier < 0 ? '-' : '+'} ${Math.abs(roll.modifier)} = ${roll.total}`
  if (roll.mode === 'normal') return `Initiative: ${sum}`
  return `Initiative, ${D20_MODE_LABEL[roll.mode]} (${roll.dice.join(' and ')}): ${sum}`
}
