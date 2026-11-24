import { describe, expect, it } from 'vitest'
import type { PlayState } from '@shared/schema'
import type { Payment } from '@shared/types'
import { buildCompanionView } from './companion'
import { runCall, type Call } from './steps'
import { bless, cure, freshState, guidance, holdPerson, mistyStep, protection, smite, testCatalog } from './testing'

const catalog = testCatalog()
const TURN = 6

const view = (play: PlayState) => buildCompanionView(play, catalog, TURN)

/** Play calls in order, like the store does, and return the sheet they leave. */
function play(...calls: Call[]): PlayState {
  let state = freshState(catalog, 0)
  calls.forEach((call, i) => {
    const result = runCall(state, catalog, call, i + 1)
    if (!result) throw new Error(`call ${i} did nothing`)
    state = result.state
  })
  return state
}

const cast = (spellId: string, payment?: Payment): Call => ({ type: 'cast', spellId, payment }) as Call

describe('buildCompanionView', () => {
  it('describes a fully rested character', () => {
    const v = view(freshState(catalog, 0))
    expect(v.health).toMatchObject({ hp: 52, hpMax: 52, tempHp: 0, percent: 100, state: 'healthy' })
    expect(v.slots).toEqual([
      { level: 1, total: 4, left: 4 },
      { level: 2, total: 2, left: 2 }
    ])
    expect(v.slotsLeft).toBe(6)
    expect(v.slotsTotal).toBe(6)
    expect(v.concentration).toBeNull()
    expect(v.conditions).toEqual([])
    expect(v.title).toBe('Human Paladin 5, Test')
    expect(v.turn.map((t) => [t.key, t.used, t.state])).toEqual([
      ['action', false, 'Ready'],
      ['move', false, 'Ready'],
      ['bonus', false, 'Ready'],
      ['reaction', false, 'Ready'],
      ['slot', false, 'Free']
    ])
  })

  it('counts a spent slot, and lists the spell as cast', () => {
    const v = view(play(cast(bless.id, { kind: 'slot', level: 1 })))
    expect(v.slots[0]).toEqual({ level: 1, total: 4, left: 3 })
    expect(v.slotsLeft).toBe(5)
    expect(v.latest?.text).toBe('Cast Bless (level 1 slot)')
    expect(v.concentration).toMatchObject({ id: bless.id, name: 'Bless' })
  })

  it('gives the concentration spell its own timer, and the other timers as effects', () => {
    const v = view(play(cast(bless.id, { kind: 'slot', level: 1 })))
    expect(v.concentration?.timer).not.toBeNull()
    expect(v.effects).toEqual([]) // Bless's timer is the concentration's, not a second line
  })

  it('shows hit points as the table would say them', () => {
    const hurt = freshState(catalog, 0)
    hurt.vitals = { ...hurt.vitals, hp: 12, tempHp: 5 }
    expect(view(hurt).health).toMatchObject({ hp: 12, tempHp: 5, state: 'critical' })
    hurt.vitals = { ...hurt.vitals, hp: 0 }
    expect(view(hurt).health.state).toBe('down')
  })

  it('lists conditions by name', () => {
    const state = freshState(catalog, 0)
    state.conditions = ['prone', 'poisoned']
    expect(view(state).conditions.map((c) => c.name)).toEqual(['Prone', 'Poisoned'])
  })

  it('marks the steps of the turn that are used, in the sheet\'s words', () => {
    const state = freshState(catalog, 0)
    state.turn = { ...state.turn, bonusActionSpent: true, moved: true, slotSpellCast: true }
    const byKey = Object.fromEntries(view(state).turn.map((t) => [t.key, t]))
    expect(byKey['bonus']).toMatchObject({ used: true, state: 'Used' })
    expect(byKey['move']).toMatchObject({ used: true, state: 'Moved' }) // as the sheet says it, not "Used"
    expect(byKey['action']).toMatchObject({ used: false, state: 'Ready' })
    expect(byKey['slot']).toMatchObject({ used: true, state: 'Spent' })
  })

  describe('what can be cast', () => {
    it('groups by level, cantrips first, and leaves out spells that are neither prepared nor item-powered', () => {
      const state = freshState(catalog, 0)
      state.prepared = state.prepared.filter((id) => id !== cure.id) // the test catalog starts with every choosable spell chosen
      const v = view(state)
      expect(v.cast.map((g) => g.level)).toEqual([0, 1, 2])
      const names = v.cast.flatMap((g) => g.items.map((i) => i.name))
      expect(names).toContain('Guidance')
      expect(names).toContain('Protection from Evil and Good') // item charge: usable unprepared
      expect(names).not.toContain('Cure Wounds')
    })

    it('names what a cast would be paid with', () => {
      const items = view(freshState(catalog, 0)).cast.flatMap((g) => g.items)
      const byName = (name: string) => items.find((i) => i.name === name)
      expect(byName('Divine Smite')?.via).toBe('free') // the free cast comes first
      expect(byName('Bless')?.via).toBe('slot')
      expect(byName('Guidance')?.via).toBe('none')
      expect(byName('Protection from Evil and Good')?.via).toBe('charge')
    })

    it('dims a spell, but keeps it listed, once nothing can pay for it', () => {
      let state = freshState(catalog, 0)
      for (let level = 1; level <= 2; level++) {
        for (let n = 0; n < (level === 1 ? 4 : 2); n++) state = runCall(state, catalog, { type: 'slot', level, direction: 'spend' }, n)!.state
      }
      const items = view(state).cast.flatMap((g) => g.items)
      expect(items.find((i) => i.name === 'Bless')).toMatchObject({ ready: false, via: null })
      expect(items.find((i) => i.name === 'Guidance')?.ready).toBe(true) // a cantrip costs nothing
      expect(items.find((i) => i.name === 'Divine Smite')?.ready).toBe(true) // the free cast is still there
    })

    it('tags what is not a plain action, and concentration', () => {
      const items = view(freshState(catalog, 0)).cast.flatMap((g) => g.items)
      expect(items.find((i) => i.id === smite.id)?.timing).toBe('Bonus')
      expect(items.find((i) => i.id === mistyStep.id)?.timing).toBe('Bonus')
      expect(items.find((i) => i.id === holdPerson.id)?.timing).toBeNull()
      expect(items.find((i) => i.id === holdPerson.id)?.concentration).toBe(true)
      expect(items.find((i) => i.id === guidance.id)?.concentration).toBe(false)
      expect(items.find((i) => i.id === protection.id)?.concentration).toBe(true)
    })
  })

  describe('resources', () => {
    it('reports what is left of each counter', () => {
      const state = freshState(catalog, 0)
      state.counters = { 'lay-on-hands': 10, 'channel-divinity': 1 }
      const byId = Object.fromEntries(view(state).resources.map((r) => [r.id, r]))
      expect(byId['lay-on-hands']).toMatchObject({ kind: 'pool', max: 25, left: 15 })
      expect(byId['channel-divinity']).toMatchObject({ kind: 'uses', max: 2, left: 1 })
    })

    it('never reports less than none left', () => {
      const state = freshState(catalog, 0)
      state.counters = { ward: 99 }
      expect(view(state).resources.find((r) => r.id === 'ward')?.left).toBe(0)
    })
  })

  describe('the latest line', () => {
    it('is null for a fresh sheet', () => {
      expect(view(freshState(catalog, 0)).latest).toBeNull()
    })

    it('skips housekeeping and uses the resource label, not its id', () => {
      const state = play({ type: 'counter', counterId: 'channel-divinity', delta: -1 }, { type: 'prepared', spellId: bless.id, on: false } as Call)
      expect(view(state).latest?.text).toBe('Spent 1 Channel Divinity')
    })

    it('reports damage', () => {
      expect(view(play({ type: 'hp', delta: -8 })).latest?.text).toBe('Took 8 damage')
    })
  })
})
