import type { PlayState } from '@shared/schema'
import type { CounterDef, Feature, Payment, Spell } from '@shared/types'
import type { Catalog } from './catalog'
import { isPrepared } from './prepared'
import { slotsRemaining } from './slots'

/** Uses left on a counter (never negative). */
export function usesLeft(def: CounterDef, used: Record<string, number>): number {
  return Math.max(0, def.max - (used[def.id] ?? 0))
}

/** The most a feature can spend right now: what is left, limited to its per-use cap (one for `uses`, `maxPerUse` for pools). */
export function featureSpendCap(feature: Feature, counter: CounterDef, used: Record<string, number>): number {
  const left = usesLeft(counter, used)
  const perUse = feature.spend.kind === 'pool' ? (feature.spend.maxPerUse ?? left) : 1
  return Math.min(left, perUse)
}

/** Uses left by counter id. Unknown counters have none. */
export function remainingUses(state: PlayState, catalog: Catalog, counterId: string): number {
  const def = catalog.counterById(counterId)
  return def ? usesLeft(def, state.counters) : 0
}

/**
 * Every way the spell can be paid for right now, in the spell's own preference order
 * (e.g. Divine Smite: its free cast first, then each slot level from lowest up).
 * The single source of truth for "castable now": the card, the upcast stepper and the filters all use it.
 */
export function availableCosts(state: PlayState, spell: Spell, catalog: Catalog): Payment[] {
  const options: Payment[] = []
  const prepared = isPrepared(state, spell)
  for (const cost of spell.costs) {
    switch (cost.kind) {
      case 'none':
        options.push({ kind: 'none' })
        break
      case 'slot':
        if (!prepared) break // an unprepared spell can't be cast from a slot (item charges still work)
        for (let level = Math.max(1, spell.level); level <= catalog.slotCapacity.length; level++) {
          if (slotsRemaining(catalog.slotCapacity, state.slotsUsed, level) > 0) options.push({ kind: 'slot', level })
        }
        break
      case 'free':
        if (!prepared) break
        if (remainingUses(state, catalog, cost.counterId) > 0) options.push({ kind: 'free', counterId: cost.counterId })
        break
      case 'charge':
        if (remainingUses(state, catalog, cost.counterId) > 0) options.push({ kind: cost.kind, counterId: cost.counterId })
        break
    }
  }
  return options
}

/** What a card's Cast button will pay with, and the options on either side of it in the stepper. */
export interface PaymentOptions {
  current: Payment | null
  /** The previous / next option in the spell's preference order (the free cast, then slot levels up). Null at either end. */
  lower: Payment | null
  higher: Payment | null
}

/**
 * `current` is the payment the player picked (an upcast level, say) if it is still available, otherwise the spell's preferred
 * one: a pick that stopped being available (the slot was spent, a rest changed things) falls back. Unlike `castSpell`, which
 * refuses an unavailable request outright, this is for showing a sensible default.
 */
export function paymentOptions(choices: Payment[], picked: Payment | null): PaymentOptions {
  const found = picked ? choices.findIndex((c) => samePayment(c, picked)) : -1
  const index = found < 0 ? 0 : found // nothing picked, or the pick is gone: the spell's preferred option
  return { current: choices[index] ?? null, lower: choices[index - 1] ?? null, higher: choices[index + 1] ?? null }
}

function samePaymentOrNull(a: Payment | null, b: Payment | null): boolean {
  return a === null || b === null ? a === b : samePayment(a, b)
}

/** Value equality, so a selector can hand back the previous result and the card skips a render. */
export function samePaymentOptions(a: PaymentOptions, b: PaymentOptions): boolean {
  return samePaymentOrNull(a.current, b.current) && samePaymentOrNull(a.lower, b.lower) && samePaymentOrNull(a.higher, b.higher)
}

export function samePayment(a: Payment, b: Payment): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'slot' && b.kind === 'slot') return a.level === b.level
  if ((a.kind === 'free' || a.kind === 'charge') && (b.kind === 'free' || b.kind === 'charge')) {
    return a.counterId === b.counterId
  }
  return true
}
