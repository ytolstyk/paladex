import { describe, expect, it } from 'vitest'
import { createInitialPlayState } from '@shared/initial'
import type { PlayState } from '@shared/schema'
import type { Step } from './steps'
import { COALESCE_MS, MAX_STEPS_PER_ENTRY, popUndo, pushUndo as pushStep, UNDO_LIMIT, undoKey, type UndoEntry, type UndoMeta } from './undo'

const base = createInitialPlayState({ hpMax: 52, ac: 16, counters: [] }, 0)
const at = (n: number) => ({ ...base, vitals: { ...base.vitals, hp: n } })
const edit = (key: string): UndoMeta => ({ kind: 'edit', key })
let nextId = 1
/** The steps are not what these tests are about: each push records a plain one. */
const pushUndo = (stack: readonly UndoEntry[], before: PlayState, meta: UndoMeta, now: number): UndoEntry[] => {
  const step: Step = { id: nextId++, call: { type: 'hp', delta: -1 }, t: now, entry: { t: now, kind: 'hp', amount: -1 } }
  return pushStep(stack, before, meta, step, now)
}

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

  it('remembers every step of a coalesced run, in order', () => {
    let stack = pushUndo([], at(52), edit('hp'), 1000)
    stack = pushUndo(stack, at(51), edit('hp'), 1500)
    expect(stack).toHaveLength(1)
    expect(stack[0]?.steps.map((s) => s.t)).toEqual([1000, 1500])
  })

  it('starts a new entry when a run of taps gets very long, so one entry stays bounded', () => {
    let stack: UndoEntry[] = []
    for (let i = 0; i <= MAX_STEPS_PER_ENTRY; i++) stack = pushUndo(stack, at(50), edit('hp'), 1000 + i)
    expect(stack).toHaveLength(2)
    expect(stack[0]?.steps).toHaveLength(MAX_STEPS_PER_ENTRY)
    expect(stack[1]?.steps).toHaveLength(1)
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
