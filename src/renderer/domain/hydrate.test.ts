import { describe, expect, it } from 'vitest'
import { reconcile, seedPlayState } from './hydrate'
import { bless, cure, freshState, guidance, smite, testCatalog } from './testing'

const catalog = testCatalog()
const healthy = { ...freshState(catalog), prepared: [bless.id] }

describe('reconcile', () => {
  it('leaves a healthy state untouched and says so', () => {
    const { state, repaired } = reconcile(healthy, catalog)
    expect(repaired).toBe(false)
    expect(state).toEqual(healthy)
  })

  it('clamps slot and counter usage and drops unknown levels and counters', () => {
    const { state, repaired } = reconcile(
      { ...healthy, slotsUsed: { '1': 9, '7': 2 }, counters: { 'free-smite': 5, ghost: 3, ward: 2 } },
      catalog
    )
    expect(repaired).toBe(true)
    expect(state.slotsUsed).toEqual({ '1': 4 })
    expect(state.counters).toEqual({ 'free-smite': 1, ward: 2 })
  })

  it('drops prepared ids that are unknown, duplicated or not choosable', () => {
    const { state, repaired } = reconcile(
      { ...healthy, prepared: [bless.id, bless.id, 'spell:removed', smite.id, guidance.id, cure.id] },
      catalog
    )
    expect(repaired).toBe(true)
    expect(state.prepared).toEqual([bless.id, cure.id])
  })

  it('ends concentration on a spell that no longer exists', () => {
    const { state } = reconcile({ ...healthy, concentration: 'spell:removed' }, catalog)
    expect(state.concentration).toBeNull()
    expect(reconcile({ ...healthy, concentration: bless.id }, catalog).state.concentration).toBe(bless.id)
  })

  it('drops role overrides for unknown spells', () => {
    const { state } = reconcile({ ...healthy, roleOverrides: { [bless.id]: 'offense', 'spell:removed': 'control' } }, catalog)
    expect(state.roleOverrides).toEqual({ [bless.id]: 'offense' })
  })

  it('keeps hit points within 0 and the maximum', () => {
    expect(reconcile({ ...healthy, vitals: { ...healthy.vitals, hp: 999 } }, catalog).state.vitals.hp).toBe(52)
    expect(reconcile({ ...healthy, vitals: { ...healthy.vitals, hp: -4 } }, catalog).state.vitals.hp).toBe(0)
  })
})

describe('maximum hit points and armor class follow the seed', () => {
  it('a stale saved maximum is replaced and reported as a repair', () => {
    const stale = { ...healthy, vitals: { ...healthy.vitals, hpMax: 40, ac: 14, hp: 40 } }
    const { state, repaired } = reconcile(stale, catalog)
    expect(repaired).toBe(true)
    expect(state.vitals).toMatchObject({ hpMax: 52, ac: 16, hp: 40 })
  })
})

describe('seedPlayState', () => {
  it('starts fully rested with the seed\'s chosen spells, and is already consistent', () => {
    const seeded = seedPlayState(catalog, 7)
    expect(seeded.vitals).toMatchObject({ hp: 52, hpMax: 52 })
    expect(seeded.prepared).toEqual(catalog.preparedSeed)
    expect(seeded.log).toEqual([{ t: 7, kind: 'seed' }])
    expect(reconcile(seeded, catalog).repaired).toBe(false)
  })
})
