import { describe, expect, it } from 'vitest'
import { createInitialPlayState } from '@shared/initial'
import { COALESCE_MS, popUndo, pushUndo, UNDO_LIMIT, undoKey, type UndoMeta } from './undo'

const base = createInitialPlayState({ hpMax: 52, ac: 16, counters: [] }, 0)
const at = (n: number) => ({ ...base, vitals: { ...base.vitals, hp: n } })
const edit = (key: string): UndoMeta => ({ kind: 'edit', key })

describe('pushUndo', () => {
  it('coalesces consecutive edits of the same field inside the window', () => {
    let stack = pushUndo([], at(52), edit('hp'), 1000)
    stack = pushUndo(stack, at(51), edit('hp'), 1500)
    stack = pushUndo(stack, at(50), edit('hp'), 2200)
    expect(stack).toHaveLength(1)
    expect(stack[0]?.before.vitals.hp).toBe(52) // earliest state is kept
  })

  it('the window slides: taps under COALESCE_MS apart keep merging', () => {
    let stack = pushUndo([], at(10), edit('hp'), 0)
    for (let t = 1500; t <= 9000; t += 1500) stack = pushUndo(stack, at(9), edit('hp'), t)
    expect(stack).toHaveLength(1)
  })

  it('does not coalesce edits outside the window or on a different field', () => {
    let stack = pushUndo([], at(52), edit('hp'), 1000)
    stack = pushUndo(stack, at(51), edit('hp'), 1000 + COALESCE_MS + 1)
    stack = pushUndo(stack, at(50), edit(undoKey.slot(1)), 1000 + COALESCE_MS + 2)
    expect(stack).toHaveLength(3)
  })

  it('never merges a later edit into a cast (cast then immediate ±)', () => {
    let stack = pushUndo([], at(52), { kind: 'cast' }, 1000)
    stack = pushUndo(stack, at(51), edit(undoKey.slot(1)), 1100)
    expect(stack).toHaveLength(2)
    expect(popUndo(stack)?.restored.vitals.hp).toBe(51) // undo reverts only the ±, not the cast
  })

  it('never coalesces casts, rests, toggles or new-turn', () => {
    let stack = pushUndo([], at(52), { kind: 'cast' }, 1000)
    stack = pushUndo(stack, at(51), { kind: 'cast' }, 1001)
    stack = pushUndo(stack, at(50), { kind: 'rest' }, 1002)
    stack = pushUndo(stack, at(49), { kind: 'toggle' }, 1003)
    stack = pushUndo(stack, at(48), { kind: 'turn' }, 1004)
    expect(stack).toHaveLength(5)
  })

  it('keeps only the last UNDO_LIMIT snapshots', () => {
    let stack = pushUndo([], at(0), { kind: 'cast' }, 0)
    for (let i = 1; i < UNDO_LIMIT + 5; i++) stack = pushUndo(stack, at(i), { kind: 'cast' }, i)
    expect(stack).toHaveLength(UNDO_LIMIT)
    expect(stack[stack.length - 1]?.before.vitals.hp).toBe(UNDO_LIMIT + 4)
  })
})

describe('popUndo', () => {
  it('returns null on an empty stack and restores the latest snapshot otherwise', () => {
    expect(popUndo([])).toBeNull()
    const stack = pushUndo([], at(40), { kind: 'cast' }, 0)
    const popped = popUndo(stack)
    expect(popped?.restored.vitals.hp).toBe(40)
    expect(popped?.stack).toHaveLength(0)
  })
})
