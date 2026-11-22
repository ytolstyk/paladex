import { describe, expect, it } from 'vitest'
import { chosenCount, isChoosable, isInDefaultView, isPrepared, isUsableUnprepared, paladinPreparedLimit } from './prepared'
import { bless, cure, freshState, guidance, protection, smite, testCatalog } from './testing'

describe('prepared limit', () => {
  it('Paladin 5 may choose 6 (confirmed against the sheet)', () => {
    expect(paladinPreparedLimit(5)).toBe(6)
  })
  it('clamps out-of-range levels', () => {
    expect(paladinPreparedLimit(0)).toBe(2)
    expect(paladinPreparedLimit(99)).toBe(15)
  })
})

describe('choosable spells', () => {
  it('leveled spells that are not always prepared (including charge-castable ones)', () => {
    expect([bless, cure, protection].every(isChoosable)).toBe(true)
    expect([guidance, smite].some(isChoosable)).toBe(false)
  })

  it('charge-castable spells are usable unprepared and appear in the default view', () => {
    const catalog = testCatalog()
    const state = { ...freshState(catalog), prepared: [] as string[] }
    expect(isUsableUnprepared(protection)).toBe(true)
    expect(isUsableUnprepared(bless)).toBe(false)
    expect(isPrepared(state, protection)).toBe(false)
    expect(isInDefaultView(state, protection)).toBe(true)
    expect(isInDefaultView(state, bless)).toBe(false)
    expect(isInDefaultView(state, guidance)).toBe(true) // cantrips are always there
  })

  it('counts only chosen spells that exist and are choosable', () => {
    const catalog = testCatalog()
    const state = { ...freshState(catalog), prepared: [bless.id, cure.id, smite.id, 'spell:gone'] }
    expect(chosenCount(state, catalog)).toBe(2)
  })
})
