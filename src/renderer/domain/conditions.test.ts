import { describe, expect, it } from 'vitest'
import { CONDITIONS } from '@shared/constants'
import { PlayStateSchema, parsePlayState } from '@shared/schema'
import { takeRest } from './actions'
import { CONDITION_INFO } from './conditions'
import { formatLog } from './log'
import { callFor, runCall } from './steps'
import { setCondition } from './tableActions'
import { bless, freshState, testCatalog } from './testing'
import { startTimer } from './timers'

const catalog = testCatalog()
const state0 = freshState(catalog)
const text = (entry: Parameters<typeof formatLog>[0]) => formatLog(entry, catalog.nameOf)

describe('the condition list', () => {
  it('describes every condition, once, with rules text and log wording', () => {
    expect(new Set(CONDITIONS).size).toBe(CONDITIONS.length)
    for (const id of CONDITIONS) {
      const info = CONDITION_INFO[id]
      expect(info.name.toLowerCase(), id).toBe(id)
      expect(info.summary.length, id).toBeGreaterThan(10)
      expect(info.effects.length, id).toBeGreaterThan(0)
      expect(info.began, id).toContain(info.name)
      expect(info.ended, id).toContain(info.name)
    }
  })

  it('flags a condition as incapacitating exactly when its own rules say it includes Incapacitated (the flag decides concentration)', () => {
    for (const id of CONDITIONS) {
      const info = CONDITION_INFO[id]
      const says = id === 'incapacitated' || info.effects.some((e) => e.includes('Incapacitated'))
      expect(info.incapacitating, id).toBe(says)
    }
  })

  it('knows which conditions include Incapacitated (2024 rules)', () => {
    const incapacitating = CONDITIONS.filter((id) => CONDITION_INFO[id].incapacitating)
    expect(incapacitating).toEqual(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'])
  })
})

describe('setCondition', () => {
  it('puts a condition on and takes it off, logging each, as an edit keyed by the condition (a mis-tap and its correction are one undo step)', () => {
    const on = setCondition(state0, catalog, 'prone', true, 1)!
    expect(on.state.conditions).toEqual(['prone'])
    expect(on.undo).toEqual({ kind: 'edit', key: 'condition:prone' })
    expect(text(on.entry)).toBe('Fell Prone')
    expect(on.state.log.at(-1)).toEqual(on.entry)
    const off = setCondition(on.state, catalog, 'prone', false, 2)!
    expect(off.state.conditions).toEqual([])
    expect(text(off.entry)).toBe('No longer Prone')
  })

  it('does nothing when the condition is already so', () => {
    expect(setCondition(state0, catalog, 'prone', false, 1)).toBeNull()
    const on = setCondition(state0, catalog, 'prone', true, 1)!.state
    expect(setCondition(on, catalog, 'prone', true, 2)).toBeNull()
  })

  it('keeps the list in the order of CONDITIONS, whichever was added first', () => {
    const a = setCondition(setCondition(state0, catalog, 'stunned', true, 1)!.state, catalog, 'blinded', true, 2)!.state
    expect(a.conditions).toEqual(['blinded', 'stunned'])
  })

  it('a condition that is not Incapacitating leaves concentration alone', () => {
    const concentrating = { ...state0, concentration: bless.id }
    const result = setCondition(concentrating, catalog, 'frightened', true, 1)!
    expect(result.state.concentration).toBe(bless.id)
    expect(result.toast).toBeUndefined()
    expect(result.entry.endedSpellId).toBeUndefined()
  })

  it.each(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'] as const)('%s ends concentration, and the log and toast say so', (id) => {
    const concentrating = { ...state0, concentration: bless.id }
    const result = setCondition(concentrating, catalog, id, true, 1)!
    expect(result.state.concentration).toBeNull()
    expect(result.entry.endedSpellId).toBe(bless.id)
    expect(text(result.entry)).toContain('concentration on Bless ends')
    expect(result.toast).toBe(`${CONDITION_INFO[id].name}: concentration on Bless ends`)
  })

  it('takes the timer of the concentration spell with it', () => {
    const timed = startTimer({ ...state0, concentration: bless.id }, bless)
    expect(timed.timers).toHaveLength(1)
    expect(setCondition(timed, catalog, 'stunned', true, 1)!.state.timers).toEqual([])
  })

  it('ending the condition does not give the concentration back, and says nothing of it', () => {
    const stunned = setCondition({ ...state0, concentration: bless.id }, catalog, 'stunned', true, 1)!.state
    const freed = setCondition(stunned, catalog, 'stunned', false, 2)!
    expect(freed.state.concentration).toBeNull()
    expect(freed.entry.endedSpellId).toBeUndefined()
  })

  it('is not undone by a rest: a rest leaves conditions alone', () => {
    const on = setCondition(state0, catalog, 'poisoned', true, 1)!.state
    expect(takeRest(on, catalog, 'long', 2).state.conditions).toEqual(['poisoned'])
    expect(takeRest(on, catalog, 'short', 2).state.conditions).toEqual(['poisoned'])
  })

  it('does not mutate the previous state', () => {
    const before = JSON.stringify(state0)
    setCondition(state0, catalog, 'prone', true, 1)
    expect(JSON.stringify(state0)).toBe(before)
  })
})

describe('as a call', () => {
  it('callFor sets the opposite of what the sheet has now, and a replay never flips it back', () => {
    const on = callFor.condition(state0, 'prone')
    expect(on).toEqual({ type: 'condition', id: 'prone', on: true })
    const sheet = runCall(state0, catalog, on, 1)!.state
    expect(callFor.condition(sheet, 'prone')).toEqual({ type: 'condition', id: 'prone', on: false })
    expect(runCall(sheet, catalog, on, 2)).toBeNull()
  })
})

describe('log wording', () => {
  it('tolerates an entry missing its condition', () => {
    expect(text({ t: 1, kind: 'condition' })).toBe('A condition changed')
    expect(text({ t: 1, kind: 'condition', condition: 'blinded' })).toBe('Became Blinded')
  })
})

describe('saved state', () => {
  it('an older save without conditions loads with none', () => {
    const older: Record<string, unknown> = { ...state0 }
    delete older['conditions']
    expect(PlayStateSchema.parse(older).conditions).toEqual([])
  })

  it('drops a name it does not know, a duplicate and junk, and keeps the rest in order, without refusing the save', () => {
    const parsed = parsePlayState({ ...state0, conditions: ['stunned', 'flying', 'prone', 'prone', 7, null, 'blinded'] })
    expect(parsed.ok && parsed.state.conditions).toEqual(['blinded', 'prone', 'stunned'])
  })

  it('round-trips through JSON, and reads a condition log entry', () => {
    const state = setCondition(state0, catalog, 'grappled', true, 1)!.state
    const parsed = parsePlayState(JSON.parse(JSON.stringify(state)))
    expect(parsed.ok && parsed.state.conditions).toEqual(['grappled'])
    expect(parsed.ok && parsed.state.log.at(-1)).toMatchObject({ kind: 'condition', condition: 'grappled', on: true })
  })

  it('refuses a log entry naming a condition it does not know (the same rule as a turn step)', () => {
    expect(parsePlayState({ ...state0, log: [{ t: 1, kind: 'condition', condition: 'sleepy', on: true }] }).ok).toBe(false)
  })
})
