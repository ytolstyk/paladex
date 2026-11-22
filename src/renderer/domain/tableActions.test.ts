import { describe, expect, it } from 'vitest'
import { DEFAULT_INSPIRATION_DIE, INSPIRATION_DICE } from '@shared/constants'
import { PlayStateSchema, parsePlayState } from '@shared/schema'
import { takeRest } from './actions'
import { setInitiative, setInspirationDie, setInspirationHeld } from './tableActions'
import { formatLog } from './log'
import { freshState, testCatalog } from './testing'

const catalog = testCatalog()
const state0 = freshState(catalog)
const text = (entry: Parameters<typeof formatLog>[0]) => formatLog(entry, catalog.nameOf)

describe('setInitiative', () => {
  it('sets the value, logs it, and coalesces as an edit of the same field', () => {
    const result = setInitiative(state0, 17, 1)!
    expect(result.state.initiative).toBe(17)
    expect(result.undo).toEqual({ kind: 'edit', key: 'initiative' })
    expect(text(result.entry)).toBe('Initiative set to 17')
    expect(result.state.log.at(-1)).toEqual(result.entry)
  })

  it('accepts both ends of the dial and clears with null', () => {
    expect(setInitiative(state0, 1, 1)?.state.initiative).toBe(1)
    expect(setInitiative(state0, 25, 1)?.state.initiative).toBe(25)
    const cleared = setInitiative(setInitiative(state0, 9, 1)!.state, null, 2)!
    expect(cleared.state.initiative).toBeNull()
    expect(text(cleared.entry)).toBe('Initiative cleared')
  })

  it('refuses anything off the dial, and a no-op change', () => {
    for (const bad of [0, 26, -3, 7.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(setInitiative(state0, bad, 1)).toBeNull()
    expect(setInitiative(state0, null, 1)).toBeNull() // already clear
    const set = setInitiative(state0, 12, 1)!.state
    expect(setInitiative(set, 12, 2)).toBeNull()
  })

  it('does not mutate the previous state', () => {
    const before = JSON.stringify(state0)
    setInitiative(state0, 14, 1)
    expect(JSON.stringify(state0)).toBe(before)
  })
})

describe('Bardic Inspiration', () => {
  it('starts not held, with a d8', () => {
    expect(state0.inspiration).toEqual({ held: false, die: 8 })
  })

  it('is received and spent as discrete undoable steps, each with its own toast', () => {
    const got = setInspirationHeld(state0, true, 1)!
    expect(got.state.inspiration).toEqual({ held: true, die: 8 })
    expect(got.undo).toEqual({ kind: 'toggle' })
    expect(got.toast).toBe('Received Bardic Inspiration (d8)')

    const used = setInspirationHeld(got.state, false, 2)!
    expect(used.state.inspiration.held).toBe(false)
    expect(used.toast).toBe('Used Bardic Inspiration (d8)')
  })

  it('does nothing when the state would not change', () => {
    expect(setInspirationHeld(state0, false, 1)).toBeNull()
    expect(setInspirationHeld(setInspirationHeld(state0, true, 1)!.state, true, 2)).toBeNull()
  })

  it('changes the die without changing whether it is held, and only to a real die size', () => {
    const held = setInspirationHeld(state0, true, 1)!.state
    const bigger = setInspirationDie(held, 10, 2)!
    expect(bigger.state.inspiration).toEqual({ held: true, die: 10 })
    expect(bigger.undo).toEqual({ kind: 'edit', key: 'inspiration-die' })
    expect(text(bigger.entry)).toBe('Bardic Inspiration die set to d10')

    for (const bad of [0, 4, 7, 20, 8.5, Number.NaN]) expect(setInspirationDie(state0, bad, 1)).toBeNull()
    expect(setInspirationDie(state0, 8, 1)).toBeNull() // already a d8
  })

  it('keeps the die when it is spent, so the next one is the same size', () => {
    const d12 = setInspirationDie(state0, 12, 1)!.state
    const cycle = setInspirationHeld(setInspirationHeld(d12, true, 2)!.state, false, 3)!.state
    expect(cycle.inspiration).toEqual({ held: false, die: 12 })
  })

  it('runs out on any rest (an hour is as long as it lasts), and says so', () => {
    const held = setInspirationHeld(state0, true, 1)!.state
    for (const kind of ['short', 'long'] as const) {
      const rested = takeRest(held, catalog, kind, 2)
      expect(rested.state.inspiration).toEqual({ held: false, die: 8 })
      expect(rested.toast).toContain('Bardic Inspiration has run out')
    }
  })

  it('a rest says nothing about inspiration when none was held', () => {
    expect(takeRest(state0, catalog, 'long', 1).toast).not.toContain('Inspiration')
  })

  it('a rest leaves initiative alone', () => {
    const set = setInitiative(state0, 18, 1)!.state
    expect(takeRest(set, catalog, 'long', 2).state.initiative).toBe(18)
  })
})

describe('log wording for entries missing their die', () => {
  it('tolerates a hand-edited entry', () => {
    expect(text({ t: 1, kind: 'inspiration-use' })).toBe('Used Bardic Inspiration (a die)')
  })
})

describe('saved state', () => {
  it('an older save without the new fields loads with defaults', () => {
    const older: Record<string, unknown> = { ...state0 }
    delete older['initiative']
    delete older['inspiration']
    const parsed = PlayStateSchema.parse(older)
    expect(parsed.initiative).toBeNull()
    expect(parsed.inspiration).toEqual({ held: false, die: 8 })
  })

  it('a partial inspiration object fills in the rest', () => {
    expect(PlayStateSchema.parse({ ...state0, inspiration: { held: true } }).inspiration).toEqual({ held: true, die: 8 })
  })

  it('round-trips a set initiative and a held d12', () => {
    const state = setInspirationHeld(setInspirationDie(setInitiative(state0, 21, 1)!.state, 12, 2)!.state, true, 3)!.state
    const result = parsePlayState(JSON.parse(JSON.stringify(state)))
    expect(result.ok && result.state.initiative).toBe(21)
    expect(result.ok && result.state.inspiration).toEqual({ held: true, die: 12 })
  })

  it('heals an initiative or die the app could never have written, instead of rejecting the whole save', () => {
    for (const bad of [0, 26, -1, 7.5, 'x']) {
      const result = parsePlayState({ ...state0, initiative: bad })
      expect(result.ok && result.state.initiative).toBeNull()
    }
    const result = parsePlayState({ ...state0, inspiration: { held: true, die: 7 } })
    expect(result.ok && result.state.inspiration).toEqual({ held: true, die: 8 })
  })

  it('accepts exactly the dice the app offers (the schema and INSPIRATION_DICE agree)', () => {
    for (const die of INSPIRATION_DICE) {
      const result = parsePlayState({ ...state0, inspiration: { held: false, die } })
      expect(result.ok && result.state.inspiration.die).toBe(die)
    }
    for (const bad of [1, 4, 20, 100]) {
      const result = parsePlayState({ ...state0, inspiration: { held: false, die: bad } })
      expect(result.ok && result.state.inspiration.die).toBe(DEFAULT_INSPIRATION_DIE) // healed to the default, never kept
    }
  })
})

describe('the log, for runs of manual edits', () => {
  const kinds = (log: readonly { kind: string }[]) => log.map((e) => e.kind)

  it('turning the dial step by step leaves one entry, with the final value', () => {
    let state = state0
    for (const [i, value] of [3, 4, 5, 17].entries()) state = setInitiative(state, value, 1000 + i * 100)!.state
    expect(kinds(state.log)).toEqual(['seed', 'initiative'])
    expect(text(state.log.at(-1)!)).toBe('Initiative set to 17')
  })

  it('starts a new entry after a pause, and never replaces a different kind of entry', () => {
    const first = setInitiative(state0, 9, 1000)!.state
    expect(kinds(setInitiative(first, 10, 1000 + 5000)!.state.log)).toEqual(['seed', 'initiative', 'initiative'])
    const rested = takeRest(first, catalog, 'short', 1100).state
    expect(kinds(setInitiative(rested, 12, 1200)!.state.log)).toEqual(['seed', 'initiative', 'short-rest', 'initiative'])
  })

  it('changing the die size coalesces the same way, and does not merge with initiative', () => {
    let state = setInitiative(state0, 14, 1000)!.state
    state = setInspirationDie(state, 10, 1100)!.state
    state = setInspirationDie(state, 12, 1200)!.state
    expect(kinds(state.log)).toEqual(['seed', 'initiative', 'inspiration-die'])
    expect(state.log.at(-1)).toMatchObject({ die: 12 })
  })

  it('receiving and spending inspiration are never merged', () => {
    let state = setInspirationHeld(state0, true, 1000)!.state
    state = setInspirationHeld(state, false, 1100)!.state
    expect(kinds(state.log)).toEqual(['seed', 'inspiration-gain', 'inspiration-use'])
  })
})
