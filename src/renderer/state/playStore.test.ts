import { describe, expect, it, vi } from 'vitest'
import type { PaladexApi, LoadResult } from '@shared/ipc'
import type { PlayState } from '@shared/schema'
import { bless, freshState, smite, testCatalog } from '@/domain/testing'
import { canUndo, createPlayStore } from './playStore'

const catalog = testCatalog()

function fakePort(load: LoadResult | (() => Promise<LoadResult>)): PaladexApi & { saved: PlayState[] } {
  const saved: PlayState[] = []
  return {
    saved,
    loadState: vi.fn(async () => (typeof load === 'function' ? load() : load)),
    saveState: vi.fn(async (state: PlayState) => {
      saved.push(state)
    }),
    exportState: vi.fn(async () => null),
    resetState: vi.fn(async () => undefined),
    profileInfo: vi.fn(async () => ({ isDev: true, stateDir: '/tmp/x' }))
  }
}

async function readyStore(initial: LoadResult = { status: 'empty' }) {
  const port = fakePort(initial)
  let clock = 1000
  const store = createPlayStore({ port, catalog, now: () => (clock += 10) })
  await store.getState().init()
  return { port, store }
}

describe('init', () => {
  it('seeds a fully rested state on first launch and persists it', async () => {
    const { port, store } = await readyStore({ status: 'empty' })
    const s = store.getState()
    expect(s.status).toBe('ready')
    expect(s.isDev).toBe(true)
    expect(s.play?.vitals.hp).toBe(52)
    expect(s.play?.log[0]?.kind).toBe('seed')
    expect(port.saved).toHaveLength(1)
  })

  it('is idempotent (React StrictMode calls it twice)', async () => {
    const port = fakePort({ status: 'empty' })
    const store = createPlayStore({ port, catalog })
    await Promise.all([store.getState().init(), store.getState().init()])
    expect(port.loadState).toHaveBeenCalledTimes(1)
    expect(port.saved).toHaveLength(1)
  })

  it('surfaces an unreadable save instead of seeding over it', async () => {
    const { port, store } = await readyStore({ status: 'unreadable', reason: 'bad json' })
    expect(store.getState().status).toBe('unreadable')
    expect(store.getState().reason).toBe('bad json')
    expect(port.saved).toHaveLength(0)
  })

  it('goes to the unreadable screen (not a blank loading state) when loading throws', async () => {
    const port = fakePort(() => Promise.reject(new Error('Untrusted IPC sender')))
    const store = createPlayStore({ port, catalog })
    await store.getState().init()
    expect(store.getState().status).toBe('unreadable')
    expect(store.getState().reason).toContain('Untrusted IPC sender')
  })

  it('writes back a state it had to repair (clamped slots, backup recovery)', async () => {
    const damaged = { ...freshState(catalog), slotsUsed: { '1': 99, '7': 1 } }
    const { port, store } = await readyStore({ status: 'ok', state: damaged, recoveredFromBackup: true })
    expect(store.getState().play?.slotsUsed).toEqual({ '1': 4 })
    expect(store.getState().recoveredFromBackup).toBe(true)
    expect(port.saved).toHaveLength(1)
  })

  it('does not rewrite a healthy save', async () => {
    const { port } = await readyStore({ status: 'ok', state: freshState(catalog), recoveredFromBackup: false })
    expect(port.saved).toHaveLength(0)
  })
})

describe('actions through the store', () => {
  it('cast updates state, persists, offers undo, and undo restores', async () => {
    const { port, store } = await readyStore()
    store.getState().cast(bless.id)
    expect(store.getState().play?.slotsUsed).toEqual({ '1': 1 })
    expect(store.getState().toast).toMatchObject({ undoable: true })
    expect(store.getState().undo).toHaveLength(1)
    expect(port.saved.at(-1)?.slotsUsed).toEqual({ '1': 1 })

    store.getState().undoLast()
    expect(store.getState().play?.slotsUsed).toEqual({})
    expect(store.getState().toast).toMatchObject({ msg: 'Undone', undoable: false })
    expect(port.saved.at(-1)?.slotsUsed).toEqual({})
  })

  it('cast reports whether it happened, and upcasts at the level asked for', async () => {
    const { store } = await readyStore()
    expect(store.getState().cast(bless.id, { kind: 'slot', level: 2 })).toBe(true)
    expect(store.getState().play?.slotsUsed).toEqual({ '2': 1 })
    expect(store.getState().cast('spell:nope')).toBe(false)
    expect(store.getState().cast(bless.id, { kind: 'slot', level: 9 })).toBe(false)
    expect(store.getState().play?.slotsUsed).toEqual({ '2': 1 })
  })

  it('Smite spends the free cast first, then a slot', async () => {
    const { store } = await readyStore()
    store.getState().cast(smite.id)
    expect(store.getState().play?.counters['free-smite']).toBe(1)
    store.getState().cast(smite.id)
    expect(store.getState().play?.slotsUsed).toEqual({ '1': 1 })
  })

  it('a non-cast action clears a stale toast so Undo never describes the wrong action', async () => {
    const { store } = await readyStore()
    store.getState().cast(bless.id)
    expect(store.getState().toast).not.toBeNull()
    store.getState().adjustSlot(1, 'restore')
    expect(store.getState().toast).toBeNull()
  })

  it('no-op actions record nothing and do not write', async () => {
    const { port, store } = await readyStore()
    const writes = port.saved.length
    store.getState().newTurn() // turn already clear
    store.getState().dropConcentration() // not concentrating
    store.getState().adjustSlot(1, 'restore') // nothing spent
    expect(store.getState().undo).toHaveLength(0)
    expect(port.saved).toHaveLength(writes)
  })

  it('reports a failed save without losing in-memory state', async () => {
    const { port, store } = await readyStore()
    ;(port.saveState as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('disk full'))
    store.getState().cast(bless.id)
    await vi.waitFor(() => expect(store.getState().saveError).toBe('disk full'))
    expect(store.getState().play?.slotsUsed).toEqual({ '1': 1 })
  })

  it('refuses a hit-point amount too large to save (it would make every later save fail)', async () => {
    const { port, store } = await readyStore()
    const writes = port.saved.length
    store.getState().adjustHp(-(10 ** 300))
    store.getState().adjustHp(-(2 ** 53 + 2))
    expect(store.getState().undo).toHaveLength(0)
    expect(port.saved).toHaveLength(writes)
    store.getState().adjustHp(-999_999)
    expect(store.getState().play?.vitals.hp).toBe(0)
  })

  it('reset re-initialises from a fresh seed', async () => {
    const { port, store } = await readyStore({ status: 'unreadable', reason: 'x' })
    ;(port.loadState as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 'empty' })
    await store.getState().resetState()
    expect(port.resetState).toHaveBeenCalledTimes(1)
    expect(store.getState().status).toBe('ready')
    expect(store.getState().play?.vitals.hp).toBe(52)
  })
})

describe('spell timers', () => {
  it('New turn takes the current turn length off a running timer', async () => {
    const port = fakePort({ status: 'empty' })
    let seconds = 6
    const store = createPlayStore({ port, catalog, turnSeconds: () => seconds })
    await store.getState().init()
    store.getState().cast(bless.id)
    store.getState().newTurn()
    expect(store.getState().play?.timers[0]?.remaining).toBe(54)
    seconds = 30 // the setting changes: the timer keeps its seconds, and the next tick uses the new length
    store.getState().newTurn()
    expect(store.getState().play?.timers[0]?.remaining).toBe(24)
    store.getState().endTimer(bless.id)
    expect(store.getState().play?.timers).toEqual([])
  })
})

describe('correcting the history', () => {
  it('a default cast pays afresh after an earlier cast is removed; a picked payment stays fixed', async () => {
    const { port, store } = await readyStore()
    store.getState().cast(smite.id) // free cast
    store.getState().cast(smite.id) // slot, as the default
    const [first] = store.getState().undo.flatMap((e) => e.steps)
    expect(store.getState().applyHistoryChange({ kind: 'remove', stepId: first!.id }, store.getState().undo)).toBe(true)
    expect(store.getState().play?.counters['free-smite']).toBe(1)
    expect(store.getState().play?.slotsUsed).toEqual({})
    expect(port.saved.at(-1)?.counters['free-smite']).toBe(1)
    expect(store.getState().toast?.msg).toContain('History changed')

    // The same two casts, but the second was picked at level 2: removing the first leaves it a level 2 cast.
    const picked = await readyStore()
    picked.store.getState().cast(smite.id)
    picked.store.getState().cast(smite.id, { kind: 'slot', level: 2 }, { picked: true })
    const steps = picked.store.getState().undo.flatMap((e) => e.steps)
    picked.store.getState().applyHistoryChange({ kind: 'remove', stepId: steps[0]!.id }, picked.store.getState().undo)
    expect(picked.store.getState().play?.slotsUsed).toEqual({ '2': 1 })
    expect(picked.store.getState().play?.counters['free-smite'] ?? 0).toBe(0)
  })

  it('refuses a change made against an undo list that has since moved', async () => {
    const { store } = await readyStore()
    store.getState().adjustHp(-5)
    const shown = store.getState().undo
    store.getState().cast(bless.id) // the list moves under an open preview
    const id = shown.flatMap((e) => e.steps)[0]!.id
    expect(store.getState().applyHistoryChange({ kind: 'remove', stepId: id }, shown)).toBe(false)
    expect(store.getState().play?.vitals.hp).toBe(47)
  })

  it('Undo takes the change back (even when it left no steps), once, and any new action ends that', async () => {
    const { port, store } = await readyStore()
    store.getState().adjustHp(-5)
    const id = store.getState().undo[0]!.steps[0]!.id
    store.getState().applyHistoryChange({ kind: 'remove', stepId: id }, store.getState().undo)
    expect(store.getState().play?.vitals.hp).toBe(52)
    expect(store.getState().undo).toHaveLength(0)
    expect(canUndo(store.getState())).toBe(true) // the stack is empty but the change can be taken back

    store.getState().undoLast()
    expect(store.getState().play?.vitals.hp).toBe(47)
    expect(store.getState().undo).toHaveLength(1)
    expect(store.getState().toast).toMatchObject({ msg: 'History change reverted', undoable: false })
    expect(port.saved.at(-1)?.vitals.hp).toBe(47)
    expect(store.getState().historyBackup).toBeNull()

    // After a new action the backup is gone, and Undo is the plain one again.
    store.getState().applyHistoryChange({ kind: 'remove', stepId: store.getState().undo[0]!.steps[0]!.id }, store.getState().undo)
    store.getState().adjustHp(-1)
    expect(store.getState().historyBackup).toBeNull()
    store.getState().undoLast()
    expect(store.getState().play?.vitals.hp).toBe(52)
  })

  it('"Undo from here" and an edit go through the same path, and the guard refuses when the sheet is out of step', async () => {
    const { store } = await readyStore()
    store.getState().adjustHp(-5)
    store.getState().adjustHp(-3) // within 2 s of the first? the test clock moves 10 ms per call, so this is one run
    const steps = store.getState().undo.flatMap((e) => e.steps)
    expect(steps).toHaveLength(2)
    expect(store.getState().applyHistoryChange({ kind: 'edit', stepId: steps[0]!.id, call: { type: 'hp', delta: -9 } }, store.getState().undo)).toBe(true)
    expect(store.getState().play?.vitals.hp).toBe(52 - 9 - 3)
    expect(store.getState().applyHistoryChange({ kind: 'edit', stepId: steps[0]!.id, call: { type: 'hp', delta: 0 } }, store.getState().undo)).toBe(false)

    const again = store.getState().undo.flatMap((e) => e.steps)
    expect(store.getState().applyHistoryChange({ kind: 'revert', stepId: again[1]!.id }, store.getState().undo)).toBe(true)
    expect(store.getState().play?.vitals.hp).toBe(52 - 9)
  })

  it('reset and a failed save leave nothing of the backup behind', async () => {
    const { port, store } = await readyStore()
    store.getState().adjustHp(-5)
    store.getState().applyHistoryChange({ kind: 'remove', stepId: store.getState().undo[0]!.steps[0]!.id }, store.getState().undo)
    expect(store.getState().historyBackup).not.toBeNull()
    ;(port.loadState as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 'empty' })
    await store.getState().resetState()
    expect(store.getState().historyBackup).toBeNull()
  })
})
