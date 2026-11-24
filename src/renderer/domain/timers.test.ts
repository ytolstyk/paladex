import { describe, expect, it } from 'vitest'
import { seed } from '@/data/character'
import type { PlayState } from '@shared/schema'
import { adjustHp, castSpell, dropConcentration, endTimer, startNewTurn, takeRest } from './actions'
import { durationSeconds } from './duration'
import { reconcile } from './hydrate'
import { elapse, endedText, settleTimers, startTimer } from './timers'
import { bless, divineFavor, freshState, holdPerson, protection, smite, spell, testCatalog } from './testing'

const catalog = testCatalog([smite, bless, holdPerson, protection, divineFavor])
const state0 = freshState(catalog)
const castOf = (state: PlayState, id: string, now = 1): PlayState => castSpell(state, catalog, id, undefined, now)!.state
const timerFor = (state: PlayState, id: string) => state.timers.find((t) => t.spellId === id)

describe('starting a timer', () => {
  it('starts when a timed spell is cast, with the printed duration in seconds', () => {
    expect(timerFor(castOf(state0, bless.id), bless.id)).toEqual({ spellId: bless.id, remaining: 60, total: 60 })
  })

  it('does nothing for a spell with no length to count, and a cast restarts a running timer', () => {
    expect(castOf(state0, smite.id).timers).toEqual([])
    const half = { ...castOf(state0, divineFavor.id), timers: [{ spellId: divineFavor.id, remaining: 18, total: 60 }] }
    expect(timerFor(castOf(half, divineFavor.id, 5), divineFavor.id)).toMatchObject({ remaining: 60, total: 60 })
    expect(startTimer(state0, spell({ duration: 'Special' }))).toBe(state0)
  })
})

describe('concentration and timers', () => {
  it('keeps only the newest concentration spell timer, and a non-concentration one beside it', () => {
    const both = castOf(castOf(castOf(state0, divineFavor.id), bless.id, 2), holdPerson.id, 3)
    expect(both.timers.map((t) => t.spellId).sort()).toEqual([divineFavor.id, holdPerson.id].sort())
  })

  it('dropping concentration ends that spell timer, and taking the hit to 0 hit points does too', () => {
    const conc = castOf(state0, bless.id)
    expect(dropConcentration(conc, catalog, 2)!.state.timers).toEqual([])
    expect(adjustHp(conc, catalog, -999, 2)!.state.timers).toEqual([])
    expect(adjustHp(conc, catalog, -1, 2)!.state.timers).toHaveLength(1)
  })

  it('settleTimers drops a timer for a spell the catalog lost, and a duplicate', () => {
    const state = { ...state0, timers: [{ spellId: 'spell:gone', remaining: 5, total: 5 }, { spellId: divineFavor.id, remaining: 5, total: 60 }, { spellId: divineFavor.id, remaining: 9, total: 60 }] }
    expect(settleTimers(state, catalog).timers).toEqual([{ spellId: divineFavor.id, remaining: 5, total: 60 }])
  })

  it('settleTimers hands back the same object when nothing changes', () => {
    const state = castOf(state0, bless.id)
    expect(settleTimers(state, catalog)).toBe(state)
  })
})

describe('New turn ticks the timers', () => {
  it('takes one turn length off each, and the turn flags are cleared as before', () => {
    const next = startNewTurn(castOf(state0, bless.id), catalog, 2, 6)!
    expect(timerFor(next.state, bless.id)!.remaining).toBe(54)
    expect(next.undo).toEqual({ kind: 'turn' })
  })

  it('uses the turn length it is given', () => {
    const next = startNewTurn(castOf(state0, divineFavor.id), catalog, 2, 30)!
    expect(timerFor(next.state, divineFavor.id)!.remaining).toBe(30)
  })

  it('still does nothing when the turn is clear and no timer is running', () => {
    expect(startNewTurn(state0, catalog, 1, 6)).toBeNull()
  })

  it('ticks on a clear turn when a timer runs, as one coalescing undo step and one log line', () => {
    let state = { ...state0, timers: [{ spellId: divineFavor.id, remaining: 60, total: 60 }] }
    const first = startNewTurn(state, catalog, 100, 6)!
    expect(first.undo).toEqual({ kind: 'edit', key: 'new-turn' })
    state = first.state
    const second = startNewTurn(state, catalog, 200, 6)!
    expect(timerFor(second.state, divineFavor.id)!.remaining).toBe(48)
    expect(second.state.log.filter((e) => e.kind === 'new-turn')).toHaveLength(1)
  })

  it('removes a timer that runs out, says so, logs it, and ends the concentration with it', () => {
    const almost = { ...castOf(state0, bless.id), timers: [{ spellId: bless.id, remaining: 6, total: 60 }] }
    const next = startNewTurn(almost, catalog, 2, 6)!
    expect(next.state.timers).toEqual([])
    expect(next.state.concentration).toBeNull()
    expect(next.toast).toBe('Bless has ended')
    expect(next.state.log.at(-1)).toMatchObject({ kind: 'timer-end', spellId: bless.id })
  })

  it('a turn longer than what is left ends it at once (a 1 minute turn against a 1 minute spell)', () => {
    expect(startNewTurn(castOf(state0, divineFavor.id), catalog, 2, 60)!.state.timers).toEqual([])
  })
})

describe('rests let time pass', () => {
  it('a short rest (an hour) ends a one minute spell and its concentration, and says so', () => {
    const result = takeRest(castOf(state0, bless.id), catalog, 'short', 5)
    expect(result.state.timers).toEqual([])
    expect(result.state.concentration).toBeNull()
    expect(result.toast).toBe('Short rest taken. Bless has ended')
  })

  it('a short rest leaves a longer timer with an hour less', () => {
    const eightHours = spell({ id: 'spell:aid', name: 'Aid', duration: '8 hours' })
    const c = testCatalog([eightHours])
    const cast = castSpell(freshState(c), c, eightHours.id, undefined, 1)!.state
    expect(takeRest(cast, c, 'short', 2).state.timers[0]).toMatchObject({ remaining: 28_800 - 3600 })
    expect(takeRest(cast, c, 'long', 2).state.timers).toEqual([]) // a long rest is 8 hours at least
  })
})

describe('ending a timer by hand', () => {
  it('removes it and, for a concentration spell, ends the concentration', () => {
    const result = endTimer(castOf(state0, bless.id), catalog, bless.id, 3)!
    expect(result.state.timers).toEqual([])
    expect(result.state.concentration).toBeNull()
    expect(result.entry.kind).toBe('timer-end')
  })

  it('does nothing for a spell with no timer', () => {
    expect(endTimer(state0, catalog, bless.id, 3)).toBeNull()
  })
})

describe('elapse', () => {
  it('reports the ended spells in running order', () => {
    const state = { ...state0, timers: [{ spellId: bless.id, remaining: 5, total: 60 }, { spellId: divineFavor.id, remaining: 5, total: 60 }] }
    expect(elapse(state, catalog, 6).ended).toEqual([bless.id, divineFavor.id])
  })
})

describe('endedText', () => {
  it('reads as a sentence', () => {
    expect(endedText([])).toBe('')
    expect(endedText(['Bless'])).toBe('Bless has ended')
    expect(endedText(['Bless', 'Bane'])).toBe('Bless and Bane have ended')
    expect(endedText(['Bless', 'Bane', 'Hold Person'])).toBe('Bless, Bane and Hold Person have ended')
  })
})

describe('loading a save', () => {
  it('reconcile drops timers for unknown spells and for a concentration spell that is no longer the one concentrated on', () => {
    const saved = { ...state0, timers: [{ spellId: 'spell:gone', remaining: 5, total: 5 }, { spellId: bless.id, remaining: 5, total: 60 }] }
    const { state, repaired } = reconcile(saved, catalog)
    expect(state.timers).toEqual([])
    expect(repaired).toBe(true)
  })
})

describe('the real spell list', () => {
  const UNTIMED = new Set(['Instantaneous', 'Until dispelled', 'Special'])
  it('has a timer length, or is on purpose untimed, for every spell (a re-import with new wording must not silently lose a timer)', () => {
    const unknown = seed.character.spells.filter((s) => durationSeconds(s.duration) === null && !UNTIMED.has(s.duration)).map((s) => `${s.name}: ${s.duration}`)
    expect(unknown).toEqual([])
  })
})
