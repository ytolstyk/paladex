import { describe, expect, it, vi } from 'vitest'
import type { PaladexApi, LoadResult } from '@shared/ipc'
import type { PlayState } from '@shared/schema'
import { bless, freshState, smite, testCatalog } from '@/domain/testing'
import { createPlayStore } from './playStore'

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

  it('reset re-initialises from a fresh seed', async () => {
    const { port, store } = await readyStore({ status: 'unreadable', reason: 'x' })
    ;(port.loadState as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 'empty' })
    await store.getState().resetState()
    expect(port.resetState).toHaveBeenCalledTimes(1)
    expect(store.getState().status).toBe('ready')
    expect(store.getState().play?.vitals.hp).toBe(52)
  })
})
