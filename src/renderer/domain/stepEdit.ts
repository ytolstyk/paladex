import { INITIATIVE_MAX, INITIATIVE_MIN, INSPIRATION_DICE, type InspirationDie } from '@shared/constants'
import type { Catalog } from './catalog'
import type { Call, CallOf, Step } from './calls'

/**
 * Which steps can have their value corrected, and how. Everything else (rests, new turn, toggles, turn steps, dropping concentration,
 * ending a timer) can only be removed. One step at a time: a run of taps is several steps, so there is never a sum to guess at.
 */
export type StepEditor =
  /** `value` is what was asked for, which can differ from what the log says happened (a heal is capped at maximum hit points). */
  | { kind: 'number'; label: string; value: number | null; min: number; max?: number; hint?: string }
  | { kind: 'choice'; label: string; value: string; options: { value: string; label: string }[] }

/** The most an amount typed for a hit-point or resource step can be: far beyond any real blow, and safe to save. */
const AMOUNT_LIMIT = 9999
const WHOLE_NUMBER = /^-?\d+$/

/** `editor` shows the current value; `parse` turns the typed text into the call to run, or null when it is not a usable value. */
interface EditRule<K extends Call['type']> {
  editor(step: Step & { call: CallOf<K> }, catalog: Catalog): StepEditor | null
  parse(call: CallOf<K>, text: string, integer: number | null): Call | null
}

const slotLevelOptions = (catalog: Catalog, from = 1): { value: string; label: string }[] =>
  catalog.slotCapacity.flatMap((capacity, index) => (capacity > 0 && index + 1 >= from ? [{ value: String(index + 1), label: `Level ${index + 1}` }] : []))

/** A whole number within the amount limit and not zero (a zero step would do nothing). */
const amount = (integer: number | null): number | null => (integer === null || integer === 0 || Math.abs(integer) > AMOUNT_LIMIT ? null : integer)

/** Said for every kind of call (the compiler insists); null means the step can only be removed. */
const EDIT_RULES: { [K in Call['type']]: EditRule<K> | null } = {
  hp: {
    editor: (step) => ({ kind: 'number', label: 'Hit points (negative is damage)', value: step.call.delta, min: -AMOUNT_LIMIT, max: AMOUNT_LIMIT }),
    parse: (call, _text, integer) => {
      const delta = amount(integer)
      return delta === null ? null : { ...call, delta }
    }
  },
  counter: {
    editor: (step, catalog) => ({
      kind: 'number',
      label: `${catalog.counterById(step.call.counterId)?.label ?? 'Resource'} (negative is spent)`,
      value: step.call.delta,
      min: -AMOUNT_LIMIT,
      max: AMOUNT_LIMIT
    }),
    parse: (call, _text, integer) => {
      const delta = amount(integer)
      return delta === null ? null : { ...call, delta }
    }
  },
  slot: {
    editor: (step, catalog) => ({ kind: 'choice', label: 'Slot level', value: String(step.call.level), options: slotLevelOptions(catalog) }),
    parse: (call, _text, integer) => (integer === null ? null : { ...call, level: integer })
  },
  cast: {
    // Only the level of a slot cast: switching between a free cast and a slot is a remove and a new cast.
    editor: (step, catalog) => {
      const spell = catalog.spellById(step.call.spellId)
      if (!spell || step.entry.via !== 'slot' || step.entry.level === undefined) return null
      const level = step.call.requested?.kind === 'slot' ? step.call.requested.level : step.entry.level
      return { kind: 'choice', label: 'Cast at slot level', value: String(level), options: slotLevelOptions(catalog, Math.max(1, spell.level)) }
    },
    parse: (call, _text, integer) => (integer === null ? null : { type: 'cast', spellId: call.spellId, requested: { kind: 'slot', level: integer } })
  },
  feature: {
    editor: (step, catalog) =>
      catalog.featureById(step.call.featureId)?.spend.kind === 'pool' ? { kind: 'number', label: 'Amount spent', value: step.call.amount, min: 1, max: AMOUNT_LIMIT } : null,
    parse: (call, _text, integer) => (integer === null || integer < 1 || integer > AMOUNT_LIMIT ? null : { ...call, amount: integer })
  },
  initiative: {
    editor: (step) => ({ kind: 'number', label: 'Initiative', value: step.call.value, min: INITIATIVE_MIN, max: INITIATIVE_MAX, hint: 'Empty clears it' }),
    parse: (call, text, integer) => {
      if (text === '') return { ...call, value: null }
      return integer === null ? null : { ...call, value: integer }
    }
  },
  inspirationDie: {
    editor: (step) => ({ kind: 'choice', label: 'Die', value: String(step.call.die), options: INSPIRATION_DICE.map((d) => ({ value: String(d), label: `d${d}` })) }),
    parse: (call, _text, integer) => {
      const die = INSPIRATION_DICE.find((d): d is InspirationDie => d === integer)
      return die === undefined ? null : { ...call, die }
    }
  },
  newTurn: null,
  endTimer: null,
  turnStep: null,
  prepared: null,
  favorite: null,
  rest: null,
  inspirationHeld: null,
  condition: null,
  dropConcentration: null
}

// The table is keyed by kind, so the rule for `step.call.type` takes exactly this step; TypeScript cannot see that through the lookup.
const ruleOf = (call: Call): EditRule<Call['type']> | null => EDIT_RULES[call.type] as EditRule<Call['type']> | null

export const editorFor = (step: Step, catalog: Catalog): StepEditor | null => ruleOf(step.call)?.editor(step, catalog) ?? null

/** The call a typed value makes of this step, or null when the text is not a usable value. The action still has the last word (a refused edit is shown, not applied). */
export function callWith(step: Step, raw: string): Call | null {
  const text = raw.trim()
  const integer = WHOLE_NUMBER.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null
  return ruleOf(step.call)?.parse(step.call, text, integer) ?? null
}
