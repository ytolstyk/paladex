import { describe, expect, it } from 'vitest'
import * as actions from './actions'
import { previewHistoryChange } from './historyPreview'
import { sameValue } from './equal'
import { isReplayable, replay, stepsOf } from './replay'
import { DIFF_KEYS, describeDifference } from './stateDiff'
import * as table from './tableActions'
import { callWith, editorFor } from './stepEdit'
import type { Call } from './steps'
import { UNDO_LIMIT } from './undo'
import { bless, freshState, holdPerson, layOnHands, runSession, smite, testCatalog } from './testing'

const catalog = testCatalog()
const T = 10_000 // far enough apart that nothing coalesces unless a test wants it
const at = (calls: Call[], gap = T) => calls.map((call, i) => ({ call, t: (i + 1) * gap }))

describe('replaying the whole history with no change', () => {
  // One step of every kind, so a new call kind that does not replay exactly shows up here.
  const everyKind: Call[] = [
    { type: 'prepared', spellId: 'spell:cure-wounds', on: false },
    { type: 'favorite', spellId: bless.id, on: true },
    { type: 'cast', spellId: bless.id },
    { type: 'cast', spellId: smite.id },
    { type: 'cast', spellId: smite.id, requested: { kind: 'slot', level: 2 } },
    { type: 'slot', level: 1, direction: 'spend' },
    { type: 'slot', level: 1, direction: 'restore' },
    { type: 'hp', delta: -20 },
    { type: 'hp', delta: 5 },
    { type: 'counter', counterId: 'ward', delta: -2 },
    { type: 'feature', featureId: layOnHands.id, amount: 4 },
    { type: 'turnStep', step: 'move', on: true },
    { type: 'initiative', value: 14 },
    { type: 'inspirationDie', die: 10 },
    { type: 'inspirationHeld', held: true },
    { type: 'newTurn', turnSeconds: 6 },
    { type: 'dropConcentration', spellId: bless.id },
    { type: 'cast', spellId: bless.id },
    { type: 'endTimer', spellId: bless.id },
    { type: 'condition', id: 'prone', on: true },
    { type: 'condition', id: 'stunned', on: true },
    { type: 'condition', id: 'prone', on: false },
    { type: 'rest', kind: 'short' },
    { type: 'rest', kind: 'long' }
  ]

  it('gives back exactly the sheet that is on screen', () => {
    const { play, stack } = runSession(catalog, at(everyKind))
    const result = replay(stack, catalog, null)
    expect(result?.dropped).toEqual([])
    expect(sameValue(result?.state, play)).toBe(true)
    expect(sameValue(result?.stack, stack)).toBe(true)
    expect(isReplayable(play, stack, catalog)).toBe(true)
  })

  it('also holds when the stack has been trimmed to its limit (its oldest state is not the seed)', () => {
    const calls = Array.from({ length: UNDO_LIMIT + 8 }, (_, i): Call => ({ type: 'hp', delta: i % 2 === 0 ? -3 : 2 }))
    const { play, stack } = runSession(catalog, at(calls))
    expect(stack).toHaveLength(UNDO_LIMIT)
    expect(isReplayable(play, stack, catalog)).toBe(true)
  })

  it('also holds for taps that coalesce into one entry', () => {
    const { play, stack } = runSession(catalog, at([{ type: 'hp', delta: -1 }, { type: 'hp', delta: -1 }, { type: 'hp', delta: -1 }], 500))
    expect(stack).toHaveLength(1)
    expect(stepsOf(stack)).toHaveLength(3)
    expect(isReplayable(play, stack, catalog)).toBe(true)
  })

  it('is not replayable when the sheet changed outside the steps', () => {
    const { play, stack } = runSession(catalog, at([{ type: 'hp', delta: -5 }]))
    const tampered = { ...play, vitals: { ...play.vitals, hp: play.vitals.hp + 1 } }
    expect(isReplayable(tampered, stack, catalog)).toBe(false)
    expect(previewHistoryChange(tampered, stack, catalog, { kind: 'remove', stepId: 1 })).toEqual({ ok: false, reason: 'out-of-sync' })
  })

  it('has nothing to do on an empty stack', () => {
    expect(replay([], catalog, null)).toBeNull()
    expect(isReplayable(freshState(catalog), [], catalog)).toBe(true)
  })
})

describe('removing a step', () => {
  it('lets a later default cast pay the way the card would now (a free cast that was removed is available again)', () => {
    const { play, stack } = runSession(catalog, at([{ type: 'cast', spellId: smite.id }, { type: 'cast', spellId: smite.id }]))
    expect(play.counters['free-smite']).toBe(1)
    expect(play.slotsUsed).toEqual({ '1': 1 })
    const result = replay(stack, catalog, { kind: 'remove', stepId: 1 })
    expect(result?.state.counters['free-smite']).toBe(1)
    expect(result?.state.slotsUsed).toEqual({})
    expect(result?.changed.map((s) => s.id)).toEqual([2])
    expect(result?.dropped).toEqual([])
  })

  it('drops, never substitutes, a later cast whose payment the player chose', () => {
    const { stack } = runSession(
      catalog,
      at([
        { type: 'cast', spellId: holdPerson.id },
        { type: 'cast', spellId: holdPerson.id },
        { type: 'rest', kind: 'long' },
        { type: 'cast', spellId: bless.id, requested: { kind: 'slot', level: 2 } }
      ])
    )
    // Without the long rest, both level 2 slots are still spent when Bless is asked for at level 2.
    const result = replay(stack, catalog, { kind: 'remove', stepId: 3 })
    expect(result?.dropped).toEqual([{ step: expect.objectContaining({ id: 4 }), reason: 'no-longer-possible' }])
    expect(result?.state.slotsUsed).toEqual({ '2': 2 })
  })

  it('reports how the later hit points and concentration land when a heal is taken out', () => {
    const { play, stack } = runSession(
      catalog,
      at([{ type: 'cast', spellId: bless.id }, { type: 'hp', delta: -20 }, { type: 'hp', delta: 10 }, { type: 'hp', delta: -35 }])
    )
    expect(play.vitals.hp).toBe(7)
    expect(play.concentration).toBe(bless.id)
    const result = replay(stack, catalog, { kind: 'remove', stepId: 3 })
    expect(result?.state.vitals.hp).toBe(0)
    expect(result?.state.concentration).toBeNull()
    const lines = describeDifference(play, result!.state, catalog)
    expect(lines).toContain('Hit points: 7 → 0')
    expect(lines).toContain('Concentration: Bless → none')
    expect(lines.some((l) => l.startsWith('Bless timer'))).toBe(true)
  })

  it('calls a later step "no longer needed" when its cause is gone, and does not flip a toggle', () => {
    const { stack } = runSession(
      catalog,
      at([
        { type: 'prepared', spellId: 'spell:cure-wounds', on: false },
        { type: 'prepared', spellId: 'spell:cure-wounds', on: true },
        { type: 'cast', spellId: bless.id },
        { type: 'dropConcentration', spellId: bless.id }
      ])
    )
    const first = replay(stack, catalog, { kind: 'remove', stepId: 1 })
    expect(first?.dropped).toEqual([{ step: expect.objectContaining({ id: 2 }), reason: 'no-longer-needed' }])
    expect(first?.state.prepared).toContain('spell:cure-wounds')
    // Dropping concentration only ever ends the spell it ended, so with the cast gone there is nothing to drop.
    const second = replay(stack, catalog, { kind: 'remove', stepId: 3 })
    expect(second?.dropped.map((d) => [d.step.id, d.reason])).toEqual([[4, 'no-longer-needed']])
  })

  it('keeps the concentration a removed condition would have broken, and says so', () => {
    const { play, stack } = runSession(catalog, at([{ type: 'cast', spellId: bless.id }, { type: 'condition', id: 'stunned', on: true }]))
    expect(play.concentration).toBeNull()
    const result = replay(stack, catalog, { kind: 'remove', stepId: 2 })
    expect(result?.state.concentration).toBe(bless.id)
    expect(result?.state.conditions).toEqual([])
    const lines = describeDifference(play, result!.state, catalog)
    expect(lines).toContain('Concentration: none → Bless')
    expect(lines).toContain('Conditions: − Stunned')
  })

  it('leaves an empty stack when the only step is removed, and keeps step ids through a replay', () => {
    const only = runSession(catalog, at([{ type: 'hp', delta: -4 }]))
    const removed = replay(only.stack, catalog, { kind: 'remove', stepId: 1 })
    expect(removed?.stack).toEqual([])
    expect(removed?.state).toEqual({ ...only.stack[0]?.before })

    const { stack } = runSession(catalog, at([{ type: 'hp', delta: -4 }, { type: 'hp', delta: -2 }, { type: 'hp', delta: -1 }]))
    expect(stepsOf(replay(stack, catalog, { kind: 'remove', stepId: 2 })!.stack).map((s) => s.id)).toEqual([1, 3])
  })

  it('merges and splits undo entries the way live play would', () => {
    // hp, cast, hp inside the window: three entries. Without the cast the two hp steps are one run.
    const { stack } = runSession(catalog, at([{ type: 'hp', delta: -1 }, { type: 'cast', spellId: bless.id }, { type: 'hp', delta: -1 }], 500))
    expect(stack).toHaveLength(3)
    const merged = replay(stack, catalog, { kind: 'remove', stepId: 2 })
    expect(merged?.stack).toHaveLength(1)
    expect(merged?.stack[0]?.steps.map((s) => s.id)).toEqual([1, 3])
    // A sliding window of taps 1.5 s apart: take out the middle one and the gap is too wide to merge.
    const taps = runSession(catalog, [0, 1500, 3000].map((t) => ({ call: { type: 'hp', delta: -1 } as Call, t: 10_000 + t })))
    expect(taps.stack).toHaveLength(1)
    expect(replay(taps.stack, catalog, { kind: 'remove', stepId: 2 })?.stack).toHaveLength(2)
  })
})

describe('editing a step', () => {
  it('runs the changed call and re-runs the later steps', () => {
    const { stack } = runSession(catalog, at([{ type: 'hp', delta: -5 }, { type: 'hp', delta: -5 }]))
    const result = replay(stack, catalog, { kind: 'edit', stepId: 1, call: { type: 'hp', delta: -9 } })
    expect(result?.state.vitals.hp).toBe(52 - 9 - 5)
    expect(result?.status).toBe('ok')
  })

  it('refuses an edit that would do nothing instead of removing the step', () => {
    const { stack } = runSession(catalog, at([{ type: 'hp', delta: -5 }]))
    const result = replay(stack, catalog, { kind: 'edit', stepId: 1, call: { type: 'hp', delta: 0 } })
    expect(result?.status).toBe('target-failed')
    expect(previewHistoryChange(freshState(catalog), stack, catalog, { kind: 'edit', stepId: 1, call: { type: 'hp', delta: 0 } })).toMatchObject({ ok: false })
  })

  it('never pays an edited cast some other way: a level with no slot fails', () => {
    const { stack } = runSession(catalog, at([{ type: 'cast', spellId: bless.id }]))
    expect(replay(stack, catalog, { kind: 'edit', stepId: 1, call: { type: 'cast', spellId: bless.id, requested: { kind: 'slot', level: 2 } } })?.status).toBe('ok')
    expect(replay(stack, catalog, { kind: 'edit', stepId: 1, call: { type: 'cast', spellId: bless.id, requested: { kind: 'slot', level: 4 } } })?.status).toBe('target-failed')
  })

  it('edits one step of a run of taps without touching the others', () => {
    const { stack } = runSession(catalog, at([{ type: 'hp', delta: -1 }, { type: 'hp', delta: -1 }, { type: 'hp', delta: -1 }], 500))
    const result = replay(stack, catalog, { kind: 'edit', stepId: 2, call: { type: 'hp', delta: -10 } })
    expect(result?.state.vitals.hp).toBe(52 - 1 - 10 - 1)
    expect(result?.stack).toHaveLength(1)
  })

  it('knows which steps can be edited, and turns typed text into a call', () => {
    const { steps } = runSession(catalog, at([{ type: 'hp', delta: -5 }, { type: 'rest', kind: 'short' }, { type: 'cast', spellId: bless.id }, { type: 'initiative', value: 12 }]))
    const [hp, rest, cast, initiative] = steps
    expect(editorFor(hp!, catalog)).toMatchObject({ kind: 'number', value: -5 })
    expect(editorFor(rest!, catalog)).toBeNull()
    expect(editorFor(cast!, catalog)).toMatchObject({ kind: 'choice', value: '1' })
    expect(callWith(hp!, '-8')).toEqual({ type: 'hp', delta: -8 })
    expect(callWith(hp!, '0')).toBeNull()
    expect(callWith(hp!, 'abc')).toBeNull()
    expect(callWith(cast!, '2')).toEqual({ type: 'cast', spellId: bless.id, requested: { kind: 'slot', level: 2 } })
    expect(callWith(initiative!, '')).toEqual({ type: 'initiative', value: null })
  })
})

describe('undoing from a step', () => {
  it('gives the state before that step, and leaves nothing of it or later steps', () => {
    const { stack, steps } = runSession(catalog, at([{ type: 'hp', delta: -5 }, { type: 'cast', spellId: bless.id }, { type: 'hp', delta: -2 }]))
    const result = replay(stack, catalog, { kind: 'revert', stepId: 2 })
    expect(result?.state.vitals.hp).toBe(47)
    expect(result?.state.concentration).toBeNull()
    expect(stepsOf(result!.stack).map((s) => s.id)).toEqual([steps[0]!.id])
  })

  it('works on a step in the middle of a coalesced run, and the newest entry equals plain Undo', () => {
    const { play, stack } = runSession(catalog, at([{ type: 'hp', delta: -1 }, { type: 'hp', delta: -1 }, { type: 'hp', delta: -1 }], 500))
    const middle = replay(stack, catalog, { kind: 'revert', stepId: 2 })
    expect(middle?.state.vitals.hp).toBe(51)
    expect(middle?.stack).toHaveLength(1)
    expect(middle?.stack[0]?.steps).toHaveLength(1)
    const sole = runSession(catalog, at([{ type: 'cast', spellId: bless.id }]))
    expect(replay(sole.stack, catalog, { kind: 'revert', stepId: 1 })?.state).toEqual(sole.stack[0]?.before)
    expect(play.vitals.hp).toBe(49)
  })

  it('reports a step that is no longer in the list', () => {
    const { play, stack } = runSession(catalog, at([{ type: 'hp', delta: -5 }]))
    expect(previewHistoryChange(play, stack, catalog, { kind: 'remove', stepId: 99 })).toEqual({ ok: false, reason: 'step-gone' })
  })
})

describe('the preview', () => {
  it('says plainly when the sheet itself does not change', () => {
    const { play, stack } = runSession(catalog, at([{ type: 'favorite', spellId: bless.id, on: true }, { type: 'favorite', spellId: bless.id, on: false }]))
    const preview = previewHistoryChange(play, stack, catalog, { kind: 'remove', stepId: 1 })
    expect(preview).toMatchObject({ ok: true })
    // Without the star, "unstar" has nothing to do; the end state is the same sheet.
    if (preview.ok) {
      expect(preview.sheetChanges).toBe(false)
      expect(preview.differences).toEqual([])
      expect(preview.replayed.dropped).toHaveLength(1)
    }
  })

  it('counts the steps that fall off the end of a full list when a correction splits an entry', () => {
    // UNDO_LIMIT entries, the newest a run of three taps 1.5 s apart. Taking out the middle tap splits the run in two: one entry too many.
    const spaced = Array.from({ length: UNDO_LIMIT - 1 }, (_, i) => ({ call: { type: 'counter', counterId: 'ward', delta: i % 2 === 0 ? -1 : 1 } as Call, t: (i + 1) * T }))
    const run = [0, 1500, 3000].map((t) => ({ call: { type: 'hp', delta: -1 } as Call, t: 1_000_000 + t }))
    const { play, stack, steps } = runSession(catalog, [...spaced, ...run])
    expect(stack).toHaveLength(UNDO_LIMIT)
    const preview = previewHistoryChange(play, stack, catalog, { kind: 'remove', stepId: steps.at(-2)!.id })
    expect(preview.ok && preview.replayed.trimmed).toBe(1)
  })
})

describe('what the code must keep in step with', () => {
  it('words, reports or ignores every key of the play state', () => {
    for (const key of Object.keys(freshState(catalog))) expect(DIFF_KEYS, key).toContain(key)
  })

  it('has a call kind for every action that changes the sheet', () => {
    // A new action in actions.ts or tableActions.ts must be added here AND get a `Call` kind (see steps.ts), or editing the history would skip it.
    const callOf = {
      castSpell: 'cast',
      adjustSlot: 'slot',
      startNewTurn: 'newTurn',
      endTimer: 'endTimer',
      toggleTurnStep: 'turnStep',
      togglePrepared: 'prepared',
      toggleFavorite: 'favorite',
      dropConcentration: 'dropConcentration',
      adjustCounter: 'counter',
      adjustHp: 'hp',
      takeRest: 'rest',
      activateFeature: 'feature',
      setInitiative: 'initiative',
      setInspirationHeld: 'inspirationHeld',
      setInspirationDie: 'inspirationDie',
      setCondition: 'condition'
    } as const satisfies Record<string, Call['type']>
    const helpers = ['appendLog', 'appendCoalescedLog']
    const exported = [...Object.keys(actions), ...Object.keys(table)].filter((k) => typeof (({ ...actions, ...table }) as Record<string, unknown>)[k] === 'function')
    for (const name of exported) expect(name in callOf || helpers.includes(name), `${name} has no Call kind`).toBe(true)
    const kinds = new Set<string>(Object.values(callOf))
    const allKinds: Record<Call['type'], true> = {
      cast: true, slot: true, newTurn: true, endTimer: true, turnStep: true, feature: true, prepared: true, favorite: true,
      counter: true, hp: true, rest: true, initiative: true, inspirationHeld: true, inspirationDie: true, condition: true, dropConcentration: true
    }
    expect([...kinds].sort()).toEqual(Object.keys(allKinds).sort())
  })

  it('treats a missing key and an undefined one as the same', () => {
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(sameValue({ a: [1, 2] }, { a: [1, 3] })).toBe(false)
  })
})
