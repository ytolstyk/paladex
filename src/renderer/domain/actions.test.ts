import { describe, expect, it } from 'vitest'
import { LOG_CAP } from '@shared/constants'
import { activateFeature, adjustSlot, castSpell, dropConcentration, startNewTurn, togglePrepared } from './actions'
import { formatLog } from './log'
import { bless, cure, mistyStep, cappedPool, freshState, guidance, holdPerson, layOnHands, protection, smite, testCatalog, vowOfEnmity } from './testing'

const catalog = testCatalog()
const state0 = freshState(catalog)

describe('castSpell: payment', () => {
  it('uses the free cast first, then slots (Divine Smite)', () => {
    const first = castSpell(state0, catalog, smite.id, undefined, 1)
    expect(first?.entry.via).toBe('free')
    expect(first?.state.counters['free-smite']).toBe(1)
    expect(first?.state.slotsUsed).toEqual({})

    const second = castSpell(first!.state, catalog, smite.id, undefined, 2)
    expect(second?.entry).toMatchObject({ via: 'slot', level: 1 })
    expect(second?.state.slotsUsed['1']).toBe(1)
  })

  it('honours a requested upcast level', () => {
    const result = castSpell(state0, catalog, bless.id, { kind: 'slot', level: 2 }, 1)
    expect(result?.state.slotsUsed).toEqual({ '2': 1 })
  })

  it('refuses a payment that is not available (never overspends a slot)', () => {
    const spent = { ...state0, slotsUsed: { '1': 4, '2': 2 } }
    expect(castSpell(spent, catalog, bless.id, undefined, 1)).toBeNull()
    expect(castSpell(spent, catalog, bless.id, { kind: 'slot', level: 1 }, 1)).toBeNull()
  })

  it('refuses an unknown spell', () => {
    expect(castSpell(state0, catalog, 'spell:nope', undefined, 1)).toBeNull()
  })

  it('cantrips cost nothing', () => {
    const result = castSpell(state0, catalog, guidance.id, undefined, 1)
    expect(result?.entry.via).toBe('none')
    expect(result?.state.slotsUsed).toEqual({})
  })

  it('item-granted spells spend a charge, never a slot', () => {
    const result = castSpell(state0, catalog, protection.id, undefined, 1)
    expect(result?.entry.via).toBe('charge')
    expect(result?.state.counters['ward']).toBe(1)
    expect(result?.state.slotsUsed).toEqual({})
  })

  it('an exhausted item has no payment left', () => {
    const empty = { ...state0, counters: { ...state0.counters, ward: 6 } }
    expect(castSpell(empty, catalog, protection.id, undefined, 1)).toBeNull()
  })
})

describe('castSpell: concentration and turn', () => {
  it('replacing a concentration spell reports which one ended', () => {
    const a = castSpell(state0, catalog, bless.id, undefined, 1)!
    expect(a.state.concentration).toBe(bless.id)
    expect(a.entry.endedSpellId).toBeUndefined()
    const b = castSpell(a.state, catalog, holdPerson.id, undefined, 2)!
    expect(b.state.concentration).toBe(holdPerson.id)
    expect(b.entry.endedSpellId).toBe(bless.id)
    expect(formatLog(b.entry, catalog.nameOf)).toContain('concentration on Bless ends')
  })

  it('a bonus-action spell marks the bonus action spent', () => {
    const result = castSpell(state0, catalog, smite.id, undefined, 1)!
    expect(result.state.turn.bonusActionSpent).toBe(true)
    expect(result.state.turn.castsSinceNewTurn).toBe(1)
    expect(result.undo).toEqual({ kind: 'cast' })
  })

  it('an action spell does not spend the bonus action', () => {
    const result = castSpell(state0, catalog, bless.id, undefined, 1)!
    expect(result.state.turn.bonusActionSpent).toBe(false)
    expect(result.state.turn.castsSinceNewTurn).toBe(1)
  })

  describe('2024: one spell slot per turn', () => {
    it('casting with a slot marks the turn, whatever the casting time', () => {
      expect(castSpell(state0, catalog, bless.id, undefined, 1)!.state.turn.slotSpellCast).toBe(true) // action
      const slotted = castSpell({ ...state0, counters: { 'free-smite': 1 } }, catalog, smite.id, undefined, 1)! // bonus, via slot
      expect(slotted.entry.via).toBe('slot')
      expect(slotted.state.turn.slotSpellCast).toBe(true)
    })

    it('a free cast, an item charge and a cantrip expend no slot, so they never mark the turn', () => {
      expect(castSpell(state0, catalog, smite.id, undefined, 1)!.state.turn.slotSpellCast).toBe(false) // free cast
      expect(castSpell(state0, catalog, protection.id, undefined, 1)!.state.turn.slotSpellCast).toBe(false) // charge
      expect(castSpell(state0, catalog, guidance.id, undefined, 1)!.state.turn.slotSpellCast).toBe(false) // cantrip
    })

    it('a second slotted spell is flagged but still allowed (a soft rule)', () => {
      const first = castSpell(state0, catalog, bless.id, undefined, 1)!
      expect(first.warnings).toBeUndefined()
      const second = castSpell(first.state, catalog, holdPerson.id, undefined, 2)!
      expect(second.warnings).toEqual(['second-slot-spell'])
      expect(second.state.slotsUsed).toEqual({ '1': 1, '2': 1 })
    })

    it('slotted casts after free casts and cantrips are not flagged', () => {
      const free = castSpell(state0, catalog, smite.id, undefined, 1)!
      expect(castSpell(free.state, catalog, bless.id, undefined, 2)!.warnings).toBeUndefined()
    })

    it('a new turn clears it', () => {
      const cast = castSpell(state0, catalog, bless.id, undefined, 1)!.state
      expect(startNewTurn(cast, 2)!.state.turn.slotSpellCast).toBe(false)
    })
  })

  it('never mutates its input', () => {
    const snapshot = JSON.stringify(state0)
    castSpell(state0, catalog, smite.id, undefined, 1)
    castSpell(state0, catalog, bless.id, undefined, 1)
    expect(JSON.stringify(state0)).toBe(snapshot)
  })
})

describe('adjustSlot', () => {
  it('spends and restores one slot as a coalescable edit', () => {
    const spend = adjustSlot(state0, catalog, 1, 'spend', 1)!
    expect(spend.state.slotsUsed['1']).toBe(1)
    expect(spend.undo).toEqual({ kind: 'edit', key: 'slot:1' })
    const restore = adjustSlot(spend.state, catalog, 1, 'restore', 2)!
    expect(restore.state.slotsUsed['1']).toBe(0)
  })

  it('does nothing past either end or on a missing level', () => {
    expect(adjustSlot(state0, catalog, 1, 'restore', 1)).toBeNull()
    expect(adjustSlot({ ...state0, slotsUsed: { '2': 2 } }, catalog, 2, 'spend', 1)).toBeNull()
    expect(adjustSlot(state0, catalog, 5, 'spend', 1)).toBeNull()
  })

  it('restoring from an over-spent persisted value clamps to capacity', () => {
    const result = adjustSlot({ ...state0, slotsUsed: { '1': 9 } }, catalog, 1, 'restore', 1)!
    expect(result.state.slotsUsed['1']).toBe(4)
  })
})

describe('startNewTurn / dropConcentration', () => {
  it('new turn is a no-op when nothing happened this turn', () => {
    expect(startNewTurn(state0, 1)).toBeNull()
  })

  it('new turn clears the turn flags', () => {
    const cast = castSpell(state0, catalog, smite.id, undefined, 1)!.state
    const next = startNewTurn(cast, 2)!
    expect(next.state.turn).toEqual({ slotSpellCast: false, bonusActionSpent: false, castsSinceNewTurn: 0 })
    expect(next.undo).toEqual({ kind: 'turn' })
  })

  it('drops concentration only when concentrating', () => {
    expect(dropConcentration(state0, 1)).toBeNull()
    const conc = castSpell(state0, catalog, bless.id, undefined, 1)!.state
    const dropped = dropConcentration(conc, 2)!
    expect(dropped.state.concentration).toBeNull()
    expect(formatLog(dropped.entry, catalog.nameOf)).toBe('Dropped concentration on Bless')
  })
})

describe('log', () => {
  it('is capped at LOG_CAP, dropping the oldest', () => {
    let s = state0
    for (let i = 0; i < LOG_CAP + 25; i++) {
      const next = adjustSlot(s, catalog, 1, i % 2 === 0 ? 'spend' : 'restore', i)
      if (next) s = next.state
    }
    expect(s.log.length).toBeLessThanOrEqual(LOG_CAP)
  })
})

describe('togglePrepared', () => {
  it('chooses and un-chooses a spell, as an undoable toggle', () => {
    const base = { ...state0, prepared: [] as string[] }
    const on = togglePrepared(base, catalog, cure.id, 1)!
    expect(on.state.prepared).toEqual([cure.id])
    expect(on.undo).toEqual({ kind: 'toggle' })
    expect(formatLog(on.entry, catalog.nameOf)).toBe('Prepared Cure Wounds')
    const off = togglePrepared(on.state, catalog, cure.id, 2)!
    expect(off.state.prepared).toEqual([])
    expect(formatLog(off.entry, catalog.nameOf)).toBe('Unprepared Cure Wounds')
  })

  it('refuses cantrips, always-prepared spells and unknown ids', () => {
    for (const id of [guidance.id, smite.id, 'spell:nope']) {
      expect(togglePrepared(state0, catalog, id, 1)).toBeNull()
    }
  })

  it('a charge-castable spell works unprepared, and gains a slot option once prepared', () => {
    const base = { ...state0, prepared: [] as string[] }
    expect(castSpell(base, catalog, protection.id, { kind: 'slot', level: 1 }, 1)).toBeNull() // slot needs preparing
    expect(castSpell(base, catalog, protection.id, undefined, 1)?.entry.via).toBe('charge')
    const chosen = togglePrepared(base, catalog, protection.id, 2)!.state
    expect(castSpell(chosen, catalog, protection.id, { kind: 'slot', level: 1 }, 3)?.entry.via).toBe('slot')
  })

  it('an unprepared spell cannot be cast until it is chosen', () => {
    const base = { ...state0, prepared: [] as string[] }
    expect(castSpell(base, catalog, cure.id, undefined, 1)).toBeNull()
    const chosen = togglePrepared(base, catalog, cure.id, 2)!.state
    expect(castSpell(chosen, catalog, cure.id, undefined, 3)?.entry.via).toBe('slot')
  })
})

describe('one bonus action per turn (soft)', () => {
  it('a second bonus-action spell is flagged', () => {
    const first = castSpell(state0, catalog, smite.id, undefined, 1)!
    expect(first.warnings).toBeUndefined()
    expect(castSpell(first.state, catalog, mistyStep.id, undefined, 2)!.warnings).toContain('second-bonus-action')
  })

  it('a bonus-action feature after a bonus-action spell is flagged, and vice versa', () => {
    const spell = castSpell(state0, catalog, smite.id, undefined, 1)!.state
    expect(activateFeature(spell, catalog, layOnHands.id, 5, 2)!.warnings).toEqual(['second-bonus-action'])
    const feature = activateFeature(state0, catalog, layOnHands.id, 5, 1)!.state
    expect(castSpell(feature, catalog, smite.id, undefined, 2)!.warnings).toContain('second-bonus-action')
  })
})

describe('activateFeature', () => {
  it('spends an amount from a pool and marks the bonus action', () => {
    const result = activateFeature(state0, catalog, layOnHands.id, 7, 1)!
    expect(result.state.counters['lay-on-hands']).toBe(7)
    expect(result.state.turn.bonusActionSpent).toBe(true)
    expect(result.entry).toMatchObject({ kind: 'feature', featureId: layOnHands.id, amount: 7 })
    expect(formatLog(result.entry, catalog.nameOf)).toBe('Used Lay On Hands (7)')
  })

  it('clamps a pool amount to what is left', () => {
    const low = { ...state0, counters: { ...state0.counters, 'lay-on-hands': 22 } }
    expect(activateFeature(low, catalog, layOnHands.id, 99, 1)!.state.counters['lay-on-hands']).toBe(25)
    expect(activateFeature(low, catalog, layOnHands.id, 0, 1)!.state.counters['lay-on-hands']).toBe(23) // at least 1
  })

  it('respects a per-use cap on pool features', () => {
    expect(activateFeature(state0, catalog, cappedPool.id, 10, 1)).toBeNull() // not in this catalog
    const withCap = testCatalog(undefined, [cappedPool])
    const state = freshState(withCap)
    expect(activateFeature(state, withCap, cappedPool.id, 10, 1)!.state.counters['lay-on-hands']).toBe(3)
  })

  it('a uses-feature spends exactly one use and ignores the amount; it is not a bonus action when it is an action', () => {
    const result = activateFeature(state0, catalog, vowOfEnmity.id, 5, 1)!
    expect(result.state.counters['channel-divinity']).toBe(1)
    expect(result.state.turn.bonusActionSpent).toBe(false)
    expect(formatLog(result.entry, catalog.nameOf)).toBe('Used Vow of Enmity')
  })

  it('refuses when nothing is left, or for an unknown feature, or a non-finite amount', () => {
    const empty = { ...state0, counters: { ...state0.counters, 'channel-divinity': 2, 'lay-on-hands': 25 } }
    expect(activateFeature(empty, catalog, vowOfEnmity.id, 1, 1)).toBeNull()
    expect(activateFeature(empty, catalog, layOnHands.id, 5, 1)).toBeNull()
    expect(activateFeature(state0, catalog, 'feature:nope', 1, 1)).toBeNull()
    expect(activateFeature(state0, catalog, layOnHands.id, Number.NaN, 1)).toBeNull()
  })

  it('a feature does not count as a spell cast or spend a slot', () => {
    const result = activateFeature(state0, catalog, layOnHands.id, 5, 1)!
    expect(result.state.turn.slotSpellCast).toBe(false)
    expect(result.state.turn.castsSinceNewTurn).toBe(0)
    expect(result.state.slotsUsed).toEqual({})
  })
})
