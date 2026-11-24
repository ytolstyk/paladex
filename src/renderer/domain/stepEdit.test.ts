import { describe, expect, it } from 'vitest'
import { bless, layOnHands, runSession, testCatalog } from './testing'
import { callWith, editorFor } from './stepEdit'
import type { Call } from './steps'

const catalog = testCatalog()
const at = (calls: Call[]) => calls.map((call, i) => ({ call, t: (i + 1) * 10_000 }))

describe('which steps can be edited', () => {
  const { steps } = runSession(
    catalog,
    at([
      { type: 'hp', delta: -5 },
      { type: 'rest', kind: 'short' },
      { type: 'cast', spellId: bless.id },
      { type: 'initiative', value: 12 },
      { type: 'feature', featureId: layOnHands.id, amount: 4 },
      { type: 'counter', counterId: 'ward', delta: -1 }
    ])
  )
  const [hp, rest, cast, initiative, feature, counter] = steps

  it('offers the value that was asked for, or nothing for a step that can only be removed', () => {
    expect(editorFor(hp!, catalog)).toMatchObject({ kind: 'number', value: -5 })
    expect(editorFor(rest!, catalog)).toBeNull()
    expect(editorFor(cast!, catalog)).toMatchObject({ kind: 'choice', value: '1' })
    expect(editorFor(initiative!, catalog)).toMatchObject({ kind: 'number', value: 12 })
    expect(editorFor(feature!, catalog)).toMatchObject({ kind: 'number', value: 4 })
    expect(editorFor(counter!, catalog)).toMatchObject({ kind: 'number', value: -1 })
  })

  it('turns typed text into a call', () => {
    expect(callWith(hp!, '-8')).toEqual({ type: 'hp', delta: -8 })
    expect(callWith(cast!, '2')).toEqual({ type: 'cast', spellId: bless.id, requested: { kind: 'slot', level: 2 } })
    expect(callWith(initiative!, '')).toEqual({ type: 'initiative', value: null })
    expect(callWith(feature!, '6')).toEqual({ type: 'feature', featureId: layOnHands.id, amount: 6 })
    expect(callWith(rest!, '1')).toBeNull()
  })

  it('refuses text that is not a usable value', () => {
    for (const text of ['', 'abc', '1.5', '0', '-0', '1e3']) expect(callWith(hp!, text), text).toBeNull()
    expect(callWith(feature!, '0')).toBeNull()
  })

  it('refuses an amount too large to be real, or too large to save (a 17-digit or 300-digit number)', () => {
    expect(callWith(hp!, '10000')).toBeNull()
    expect(callWith(hp!, '9007199254740993')).toBeNull()
    expect(callWith(hp!, '1' + '0'.repeat(300))).toBeNull()
    expect(callWith(counter!, '-10000')).toBeNull()
    expect(callWith(hp!, '9999')).toEqual({ type: 'hp', delta: 9999 })
  })
})
