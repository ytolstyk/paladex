import { describe, expect, it } from 'vitest'
import { emptyTurn } from './constants'
import { parsePlayState } from './schema'

/** A save from before the turn tracked the action, movement and reaction: the `turn` object has only the first three fields. */
const oldSave = {
  schemaVersion: 1,
  vitals: { hp: 40, hpMax: 52, ac: 16 },
  turn: { slotSpellCast: true, bonusActionSpent: false, castsSinceNewTurn: 2 }
}

describe('play state schema', () => {
  it('loads a save that predates the action, move and reaction flags, with them off', () => {
    const parsed = parsePlayState(oldSave)
    expect(parsed.ok && parsed.state.turn).toEqual({ ...emptyTurn(), slotSpellCast: true, castsSinceNewTurn: 2 })
  })

  it('loads a save with no turn at all', () => {
    const parsed = parsePlayState({ schemaVersion: 1, vitals: oldSave.vitals })
    expect(parsed.ok && parsed.state.turn).toEqual(emptyTurn())
  })

  it('keeps the new flags through a round trip', () => {
    const turn = { ...emptyTurn(), actionSpent: true, moved: true, reactionSpent: true }
    const parsed = parsePlayState({ ...oldSave, turn })
    expect(parsed.ok && parsed.state.turn).toEqual(turn)
  })

  it('reads a turn-step log entry, and refuses a step it does not know', () => {
    const entry = { t: 1, kind: 'turn-step', step: 'reaction', on: true }
    expect(parsePlayState({ ...oldSave, log: [entry] }).ok).toBe(true)
    expect(parsePlayState({ ...oldSave, log: [{ ...entry, step: 'dance' }] }).ok).toBe(false)
  })
})
