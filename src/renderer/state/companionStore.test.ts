import { describe, expect, it, vi } from 'vitest'
import type { LoadResult } from '@shared/ipc'
import type { PlayState } from '@shared/schema'
import { freshState, testCatalog } from '@/domain/testing'
import { createCompanionStore, type CompanionPort } from './companionStore'

const catalog = testCatalog()

function fakePort(load: LoadResult | Promise<LoadResult>) {
  let listener: ((state: PlayState) => void) | null = null
  const stop = vi.fn(() => {
    listener = null
  })
  const port: CompanionPort = {
    loadState: vi.fn(() => Promise.resolve(load)),
    onCompanionState: vi.fn((fn) => {
      listener = fn
      return stop
    })
  }
  return { port, stop, push: (state: PlayState) => listener?.(state), hasListener: () => listener !== null }
}

const sheet = (hp: number): PlayState => {
  const state = freshState(catalog, 0)
  return { ...state, vitals: { ...state.vitals, hp } }
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('companion store', () => {
  it('starts waiting, with nothing to show', () => {
    const { port } = fakePort({ status: 'empty' })
    const { useCompanion } = createCompanionStore(port, catalog)
    expect(useCompanion.getState()).toMatchObject({ status: 'waiting', play: null })
  })

  it('shows the saved sheet once it is loaded', async () => {
    const { port } = fakePort({ status: 'ok', state: sheet(30), recoveredFromBackup: false })
    const { useCompanion, connect } = createCompanionStore(port, catalog)
    connect()
    await flush()
    expect(useCompanion.getState().status).toBe('ready')
    expect(useCompanion.getState().play?.vitals.hp).toBe(30)
  })

  it('follows each later save', async () => {
    const { port, push } = fakePort({ status: 'ok', state: sheet(30), recoveredFromBackup: false })
    const { useCompanion, connect } = createCompanionStore(port, catalog)
    connect()
    await flush()
    push(sheet(12))
    expect(useCompanion.getState().play?.vitals.hp).toBe(12)
  })

  it('keeps waiting when nothing has been saved yet, then shows the first push', async () => {
    const { port, push } = fakePort({ status: 'empty' })
    const { useCompanion, connect } = createCompanionStore(port, catalog)
    connect()
    await flush()
    expect(useCompanion.getState().status).toBe('waiting')
    push(sheet(52))
    expect(useCompanion.getState().status).toBe('ready')
  })

  it('does not let a slow load overwrite a newer push', async () => {
    let finish!: (r: LoadResult) => void
    const slow = new Promise<LoadResult>((resolve) => (finish = resolve))
    const { port, push } = fakePort(slow)
    const { useCompanion, connect } = createCompanionStore(port, catalog)
    connect()
    push(sheet(10)) // the sheet saved while the load was still reading the disk
    finish({ status: 'ok', state: sheet(40), recoveredFromBackup: false })
    await flush()
    expect(useCompanion.getState().play?.vitals.hp).toBe(10)
  })

  it('says so when the saved sheet cannot be read', async () => {
    const { port } = fakePort({ status: 'unreadable', reason: 'nope' })
    const { useCompanion, connect } = createCompanionStore(port, catalog)
    connect()
    await flush()
    expect(useCompanion.getState().status).toBe('unreadable')
  })

  it('says so when loading fails outright', async () => {
    const { port } = fakePort({ status: 'empty' })
    port.loadState = vi.fn(() => Promise.reject(new Error('ipc')))
    const { useCompanion, connect } = createCompanionStore(port, catalog)
    connect()
    await flush()
    expect(useCompanion.getState().status).toBe('unreadable')
  })

  it('stops listening, and ignores anything late, once disconnected', async () => {
    const { port, stop, push } = fakePort({ status: 'ok', state: sheet(30), recoveredFromBackup: false })
    const { useCompanion, connect } = createCompanionStore(port, catalog)
    const disconnect = connect()
    disconnect()
    await flush()
    expect(stop).toHaveBeenCalledOnce()
    push(sheet(5))
    expect(useCompanion.getState().play).toBeNull()
  })

  it('drops what the catalog does not know before it can reach the display', async () => {
    const stale = { ...sheet(30), prepared: ['spell:gone'], timers: [{ spellId: 'spell:gone', remaining: 6, total: 60 }] }
    const { port } = fakePort({ status: 'ok', state: stale, recoveredFromBackup: false })
    const { useCompanion, connect } = createCompanionStore(port, catalog)
    connect()
    await flush()
    expect(useCompanion.getState().play?.prepared).not.toContain('spell:gone')
    expect(useCompanion.getState().play?.timers).toEqual([])
  })
})
