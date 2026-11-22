import { describe, expect, it } from 'vitest'
import { emptyTurn } from '@shared/constants'
import { applyToTurn, isTurnClear, NO_WARNINGS, turnWarnings, warningText } from './turn'

const slotSpell = { castTime: 'action', spendsSlot: true } as const
const bonusSpell = { castTime: 'bonus', spendsSlot: false } as const

describe('turnWarnings', () => {
  it('nothing is flagged on a fresh turn', () => {
    expect(turnWarnings(emptyTurn(), slotSpell)).toEqual([])
    expect(turnWarnings(emptyTurn(), bonusSpell)).toEqual([])
  })

  it('a second slotted spell is flagged; free casts, charges and cantrips (no slot) are not', () => {
    const turn = { ...emptyTurn(), slotSpellCast: true }
    expect(turnWarnings(turn, slotSpell)).toEqual(['second-slot-spell'])
    expect(turnWarnings(turn, { castTime: 'action', spendsSlot: false })).toEqual([])
  })

  it('a second bonus action is flagged, whether it is a spell or a feature', () => {
    const turn = { ...emptyTurn(), bonusActionSpent: true }
    expect(turnWarnings(turn, bonusSpell)).toEqual(['second-bonus-action'])
    expect(turnWarnings(turn, { castTime: 'action', spendsSlot: false })).toEqual([])
  })

  it('both can apply to one action (a slotted bonus-action spell after both were used)', () => {
    const turn = { ...emptyTurn(), slotSpellCast: true, bonusActionSpent: true }
    expect(turnWarnings(turn, { castTime: 'bonus', spendsSlot: true })).toEqual(['second-slot-spell', 'second-bonus-action'])
  })
})

describe('applyToTurn', () => {
  it('records the slot and the bonus action, and counts only spell casts', () => {
    const afterSpell = applyToTurn(emptyTurn(), { ...slotSpell, isSpellCast: true })
    expect(afterSpell).toEqual({ slotSpellCast: true, bonusActionSpent: false, castsSinceNewTurn: 1 })
    const afterFeature = applyToTurn(afterSpell, { castTime: 'bonus', spendsSlot: false, isSpellCast: false })
    expect(afterFeature).toEqual({ slotSpellCast: true, bonusActionSpent: true, castsSinceNewTurn: 1 })
  })

  it('flags only ever turn on within a turn', () => {
    const turn = { slotSpellCast: true, bonusActionSpent: true, castsSinceNewTurn: 2 }
    expect(applyToTurn(turn, { castTime: 'action', spendsSlot: false, isSpellCast: true })).toEqual({
      slotSpellCast: true,
      bonusActionSpent: true,
      castsSinceNewTurn: 3
    })
  })
})

describe('helpers', () => {
  it('isTurnClear is true only when nothing has been spent', () => {
    expect(isTurnClear(emptyTurn())).toBe(true)
    expect(isTurnClear({ ...emptyTurn(), slotSpellCast: true })).toBe(false)
    expect(isTurnClear({ ...emptyTurn(), bonusActionSpent: true })).toBe(false)
    expect(isTurnClear({ ...emptyTurn(), castsSinceNewTurn: 1 })).toBe(false)
  })

  it('warningText joins the sentences, and is empty for none', () => {
    expect(warningText(NO_WARNINGS)).toBe('')
    expect(warningText(['second-slot-spell', 'second-bonus-action'])).toContain('spell slot')
    expect(warningText(['second-slot-spell', 'second-bonus-action'])).toContain('bonus action')
  })
})
