import { describe, expect, it } from 'vitest'
import type { Payment } from '@shared/types'
import { availableCosts, paymentOptions, samePaymentOptions } from './cost'
import { paymentLabel } from './labels'
import { bless, freshState, smite, testCatalog } from './testing'

const catalog = testCatalog()
const state0 = freshState(catalog)
const slot = (level: number): Payment => ({ kind: 'slot', level })
/** The state with every slot of `level` spent. */
const withLevelSpent = (level: number) => ({ ...state0, slotsUsed: { [String(level)]: catalog.slotCapacity[level - 1] ?? 0 } })
const optionsFor = (state: typeof state0, spell: typeof bless, picked: Payment | null) =>
  paymentOptions(availableCosts(state, spell, catalog), picked)

describe('paymentOptions', () => {
  it('is the spell’s preferred payment when nothing was picked', () => {
    expect(optionsFor(state0, bless, null)).toEqual({ current: slot(1), lower: null, higher: slot(2) })
  })

  it('honours an available pick and offers its neighbours', () => {
    expect(optionsFor(state0, bless, slot(2))).toEqual({ current: slot(2), lower: slot(1), higher: null })
  })

  it('falls back when the pick is no longer available (its slots are spent)', () => {
    expect(optionsFor(withLevelSpent(2), bless, slot(2))).toEqual({ current: slot(1), lower: null, higher: null })
  })

  it('offers no lower option when the level below is spent', () => {
    // Level 1 spent: Bless is offered only at level 2, so there is nothing below it to step to.
    expect(optionsFor(withLevelSpent(1), bless, slot(2))).toEqual({ current: slot(2), lower: null, higher: null })
  })

  it('lets a free cast be swapped for a slot and back (Divine Smite)', () => {
    const free = availableCosts(state0, smite, catalog)[0]
    expect(free?.kind).toBe('free')
    expect(optionsFor(state0, smite, null)).toMatchObject({ current: free, lower: null, higher: slot(1) })
    expect(optionsFor(state0, smite, slot(1))).toMatchObject({ current: slot(1), lower: free, higher: slot(2) })
  })

  it('has nothing to offer when there is nothing to pay with', () => {
    expect(paymentOptions([], slot(1))).toEqual({ current: null, lower: null, higher: null })
  })
})

describe('samePaymentOptions', () => {
  it('compares by value, treating null as its own value', () => {
    const a = optionsFor(state0, bless, null)
    expect(samePaymentOptions(a, optionsFor(state0, bless, null))).toBe(true)
    expect(samePaymentOptions(a, optionsFor(state0, bless, slot(2)))).toBe(false)
    expect(samePaymentOptions(a, { ...a, lower: slot(1) })).toBe(false)
  })
})

describe('paymentLabel', () => {
  it('names each kind of payment', () => {
    expect(paymentLabel(slot(3))).toBe('level III')
    expect(paymentLabel({ kind: 'free', counterId: 'x' })).toBe('free cast')
    expect(paymentLabel({ kind: 'charge', counterId: 'x' })).toBe('item charge')
    expect(paymentLabel({ kind: 'none' })).toBe('no cost')
  })
})
