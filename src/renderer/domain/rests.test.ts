import { describe, expect, it } from 'vitest'
import { seed } from '@/data/character'
import { createCatalog } from './catalog'
import { restoredBy, usedAfterRest } from './rests'
import { adjustCounter, adjustHp, takeRest } from './actions'
import { bless, freshState, testCatalog } from './testing'
import { castSpell } from './actions'

const real = createCatalog(seed)
const def = (id: string) => real.counterById(id)!

describe('restore policies on the real seed', () => {
  it('Channel Divinity: +1 on a short rest, everything on a long rest', () => {
    expect(restoredBy(def('channel-divinity'), 'short')).toBe(1)
    expect(restoredBy(def('channel-divinity'), 'long')).toBe(2)
  })

  it('Hit Dice: half (rounded down) on a long rest, nothing on a short rest', () => {
    expect(restoredBy(def('hit-dice'), 'long')).toBe(2)
    expect(restoredBy(def('hit-dice'), 'short')).toBe(0)
  })

  it("The Arbiter's Ward never comes back with a rest (it is consumable)", () => {
    expect(restoredBy(def('arbiters-ward'), 'short')).toBe(0)
    expect(restoredBy(def('arbiters-ward'), 'long')).toBe(0)
  })

  it('Lay On Hands and the free casts need a long rest', () => {
    for (const id of ['lay-on-hands', 'free-smite', 'free-find-steed', 'breath-weapon', 'draconic-flight']) {
      expect(restoredBy(def(id), 'short'), id).toBe(0)
      expect(restoredBy(def(id), 'long'), id).toBe(def(id).max)
    }
  })

  it('a fraction restore gives at least one', () => {
    expect(restoredBy({ id: 'x', label: 'x', max: 1, kind: 'pool', restore: { long: { fraction: 0.5 } } }, 'long')).toBe(1)
  })
})

describe('usedAfterRest', () => {
  const spent = { 'channel-divinity': 2, 'hit-dice': 5, 'arbiters-ward': 5, 'lay-on-hands': 20 }

  it('short rest changes only what its policy says', () => {
    expect(usedAfterRest(spent, real, 'short')).toEqual({ ...spent, 'channel-divinity': 1 })
  })

  it('long rest restores everything except the consumable Ward', () => {
    expect(usedAfterRest(spent, real, 'long')).toEqual({
      'channel-divinity': 0,
      'hit-dice': 3,
      'arbiters-ward': 5,
      'lay-on-hands': 0
    })
  })
})

describe('takeRest', () => {
  const catalog = testCatalog()
  const tired = (() => {
    const cast = castSpell(freshState(catalog), catalog, bless.id, undefined, 1)!.state
    return { ...cast, slotsUsed: { '1': 3, '2': 1 }, vitals: { ...cast.vitals, hp: 7, tempHp: 4 }, counters: { 'free-smite': 1, ward: 5 } }
  })()

  it('long rest restores slots, hit points and clears concentration, temp HP and the turn', () => {
    const { state, undo, toast } = takeRest(tired, catalog, 'long', 9)
    expect(state.slotsUsed).toEqual({})
    expect(state.vitals).toMatchObject({ hp: 52, tempHp: 0 })
    expect(state.concentration).toBeNull()
    expect(state.turn.castsSinceNewTurn).toBe(0)
    expect(state.counters).toEqual({ 'free-smite': 0, ward: 5 }) // the Ward is consumable
    expect(undo).toEqual({ kind: 'rest' })
    expect(toast).toContain('Long rest')
  })

  it('short rest leaves slots, hit points and concentration alone', () => {
    const { state } = takeRest(tired, catalog, 'short', 9)
    expect(state.slotsUsed).toEqual(tired.slotsUsed)
    expect(state.vitals).toEqual(tired.vitals)
    expect(state.concentration).toBe(tired.concentration)
    expect(state.counters['free-smite']).toBe(1)
  })
})

describe('adjustCounter', () => {
  const catalog = testCatalog()
  const state0 = freshState(catalog)

  it('spends and restores within bounds, as a coalescable edit', () => {
    const spend = adjustCounter(state0, catalog, 'ward', -2, 1)!
    expect(spend.state.counters['ward']).toBe(2)
    expect(spend.undo).toEqual({ kind: 'edit', key: 'counter:ward' })
    expect(adjustCounter(spend.state, catalog, 'ward', 1, 2)!.state.counters['ward']).toBe(1)
  })

  it('clamps at both ends and records only what actually changed', () => {
    const over = adjustCounter(state0, catalog, 'free-smite', -5, 1)!
    expect(over.state.counters['free-smite']).toBe(1)
    expect(over.entry.amount).toBe(-1)
    expect(adjustCounter(over.state, catalog, 'free-smite', -1, 2)).toBeNull()
    expect(adjustCounter(state0, catalog, 'free-smite', 3, 1)).toBeNull()
  })

  it('refuses unknown counters and zero', () => {
    expect(adjustCounter(state0, catalog, 'nope', -1, 1)).toBeNull()
    expect(adjustCounter(state0, catalog, 'ward', 0, 1)).toBeNull()
  })
})

describe('adjustHp', () => {
  const catalog = testCatalog()
  const fresh = freshState(catalog) // Bless is prepared, so it can be cast to start concentrating

  it('heals up to the maximum and no further', () => {
    const hurt = { ...fresh, vitals: { ...fresh.vitals, hp: 40 } }
    expect(adjustHp(hurt, catalog, 5, 1)!.state.vitals.hp).toBe(45)
    expect(adjustHp(hurt, catalog, 99, 1)!.state.vitals.hp).toBe(52)
    expect(adjustHp(fresh, catalog, 5, 1)).toBeNull() // already full
  })

  it('temporary hit points absorb damage first', () => {
    const shielded = { ...fresh, vitals: { ...fresh.vitals, tempHp: 5 } }
    const result = adjustHp(shielded, catalog, -8, 1)!
    expect(result.state.vitals).toMatchObject({ hp: 49, tempHp: 0 })
    expect(adjustHp(shielded, catalog, -3, 1)!.state.vitals).toMatchObject({ hp: 52, tempHp: 2 })
  })

  it('never drops below 0', () => {
    expect(adjustHp(fresh, catalog, -999, 1)!.state.vitals.hp).toBe(0)
  })

  it('reports the concentration save DC when damaged while concentrating', () => {
    const concentrating = castSpell(fresh, catalog, bless.id, undefined, 1)!.state
    const hit = adjustHp(concentrating, catalog, -30, 2)!
    expect(hit.toast).toContain('DC 15') // max(10, 30 / 2)
    expect(hit.toast).toContain('Bless')
    expect(hit.state.concentration).toBe(bless.id)
    expect(adjustHp(concentrating, catalog, -4, 2)!.toast).toContain('DC 10') // floor of 10
  })

  it('dropping to 0 hit points ends concentration', () => {
    const concentrating = { ...castSpell(fresh, catalog, bless.id, undefined, 1)!.state }
    const down = adjustHp({ ...concentrating, vitals: { ...concentrating.vitals, hp: 3 } }, catalog, -10, 2)!
    expect(down.state.concentration).toBeNull()
    expect(down.toast).toContain('concentration on Bless ends')
  })

  it('no toast when not concentrating, and HP changes coalesce as one edit', () => {
    const hit = adjustHp(fresh, catalog, -4, 1)!
    expect(hit.toast).toBeUndefined()
    expect(hit.undo).toEqual({ kind: 'edit', key: 'hp' })
  })
})
