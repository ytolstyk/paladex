import { describe, expect, it } from 'vitest'
import { emptyTurn } from '@shared/constants'
import { applyToTurn, isTurnClear, NO_WARNINGS, turnWarnings, warningText, withStep } from './turn'

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
    expect(afterSpell).toEqual({ ...emptyTurn(), slotSpellCast: true, actionSpent: true, castsSinceNewTurn: 1 })
    const afterFeature = applyToTurn(afterSpell, { castTime: 'bonus', spendsSlot: false, isSpellCast: false })
    expect(afterFeature).toEqual({ ...emptyTurn(), slotSpellCast: true, actionSpent: true, bonusActionSpent: true, castsSinceNewTurn: 1 })
  })

  it('flags only ever turn on within a turn', () => {
    const turn = { ...emptyTurn(), slotSpellCast: true, bonusActionSpent: true, moved: true, castsSinceNewTurn: 2 }
    expect(applyToTurn(turn, { castTime: 'action', spendsSlot: false, isSpellCast: true })).toEqual({
      ...turn,
      actionSpent: true,
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
    // Each hand-tracked step counts too, or New turn would do nothing after marking only a move or a reaction.
    expect(isTurnClear({ ...emptyTurn(), actionSpent: true })).toBe(false)
    expect(isTurnClear({ ...emptyTurn(), moved: true })).toBe(false)
    expect(isTurnClear({ ...emptyTurn(), reactionSpent: true })).toBe(false)
  })

  it('warningText joins the sentences, and is empty for none', () => {
    expect(warningText(NO_WARNINGS)).toBe('')
    expect(warningText(['second-slot-spell', 'second-bonus-action'])).toContain('spell slot')
    expect(warningText(['second-slot-spell', 'second-bonus-action'])).toContain('bonus action')
  })
})

describe('the action and the reaction (2024: one of each)', () => {
  const magic = { castTime: 'action', spendsSlot: false } as const
  const rider = { castTime: 'action', spendsSlot: false, isRider: true } as const
  const reaction = { castTime: 'reaction', spendsSlot: true } as const

  it('a second action is flagged, a bonus action does not use it up', () => {
    expect(turnWarnings({ ...emptyTurn(), actionSpent: true }, magic)).toEqual(['second-action'])
    expect(turnWarnings({ ...emptyTurn(), actionSpent: true }, bonusSpell)).toEqual([])
    expect(turnWarnings(emptyTurn(), magic)).toEqual([])
  })

  it('a rider belongs to the Attack action already taken, so it is never flagged; it still marks the action', () => {
    expect(turnWarnings({ ...emptyTurn(), actionSpent: true }, rider)).toEqual([])
    expect(applyToTurn(emptyTurn(), { ...rider, isSpellCast: false }).actionSpent).toBe(true)
  })

  it('a second reaction is flagged', () => {
    expect(turnWarnings({ ...emptyTurn(), reactionSpent: true }, reaction)).toEqual(['second-reaction'])
    expect(turnWarnings(emptyTurn(), reaction)).toEqual([])
  })

  it('a reaction is on another turn: its slot is not this turn\'s slot, and it is not one of this turn\'s casts', () => {
    const afterReaction = applyToTurn(emptyTurn(), { ...reaction, isSpellCast: true })
    expect(afterReaction).toEqual({ ...emptyTurn(), reactionSpent: true })
    expect(turnWarnings({ ...emptyTurn(), slotSpellCast: true }, reaction)).toEqual([])
    expect(turnWarnings(afterReaction, slotSpell)).toEqual([])
  })

  it('withStep switches one flag and leaves the rest', () => {
    const marked = withStep(emptyTurn(), 'move', true)
    expect(marked).toEqual({ ...emptyTurn(), moved: true })
    expect(withStep(marked, 'move', false)).toEqual(emptyTurn())
  })
})
