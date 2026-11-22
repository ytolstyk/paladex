import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInitialPlayState } from '../shared/initial'
import { StateStore } from './store'

const stores: StateStore[] = []
async function freshStore(): Promise<{ store: StateStore; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'paladex-test-'))
  const store = new StateStore(dir)
  stores.push(store)
  return { store, dir }
}
afterEach(async () => {
  await Promise.all(stores.splice(0).map((s) => s.destroy()))
})

const stateWithHp = (hp: number) => {
  const s = createInitialPlayState({ hpMax: 52, ac: 16, counters: [] }, 0)
  return { ...s, vitals: { ...s.vitals, hp } }
}

describe('StateStore', () => {
  it('reports empty when nothing has been saved', async () => {
    const { store } = await freshStore()
    expect(await store.load()).toEqual({ status: 'empty' })
  })

  it('round-trips state', async () => {
    const { store } = await freshStore()
    await store.save(stateWithHp(30))
    const loaded = await store.load()
    expect(loaded.status).toBe('ok')
    if (loaded.status === 'ok') {
      expect(loaded.state.vitals.hp).toBe(30)
      expect(loaded.recoveredFromBackup).toBe(false)
    }
  })

  it('applies rapid concurrent saves in call order (last write wins)', async () => {
    const { store } = await freshStore()
    const writes = Array.from({ length: 25 }, (_, i) => store.save(stateWithHp(i + 1)))
    await Promise.all(writes)
    const loaded = await store.load()
    expect(loaded.status === 'ok' && loaded.state.vitals.hp).toBe(25)
  })

  it('leaves no tmp files behind after saves', async () => {
    const { store, dir } = await freshStore()
    await Promise.all([store.save(stateWithHp(1)), store.save(stateWithHp(2)), store.save(stateWithHp(3))])
    const names = await readdir(dir)
    expect(names.filter((n) => n.endsWith('.tmp'))).toEqual([])
  })

  it('recovers from .bak when the primary file is corrupt', async () => {
    const { store, dir } = await freshStore()
    await store.save(stateWithHp(10))
    await store.save(stateWithHp(20)) // .bak now holds hp 10
    await writeFile(join(dir, 'play-state.json'), '{ torn write', 'utf8')
    const loaded = await store.load()
    expect(loaded.status).toBe('ok')
    if (loaded.status === 'ok') {
      expect(loaded.recoveredFromBackup).toBe(true)
      expect(loaded.state.vitals.hp).toBe(10)
    }
  })

  it('reports unreadable (never silently reseeds) when both files are bad', async () => {
    const { store, dir } = await freshStore()
    await writeFile(join(dir, 'play-state.json'), 'garbage', 'utf8')
    await writeFile(join(dir, 'play-state.json.bak'), '{"schemaVersion":1}', 'utf8')
    const loaded = await store.load()
    expect(loaded.status).toBe('unreadable')
  })

  it('rejects state that fails schema validation on load', async () => {
    const { store, dir } = await freshStore()
    await writeFile(join(dir, 'play-state.json'), JSON.stringify({ schemaVersion: 99 }), 'utf8')
    expect((await store.load()).status).toBe('unreadable')
  })

  it('reset moves files aside instead of deleting them', async () => {
    const { store, dir } = await freshStore()
    await store.save(stateWithHp(7))
    await store.reset()
    expect((await store.load()).status).toBe('empty')
    const names = await readdir(dir)
    const moved = names.find((n) => n.startsWith('play-state.json.reset-'))
    expect(moved).toBeDefined()
    expect(JSON.parse(await readFile(join(dir, moved as string), 'utf8')).vitals.hp).toBe(7)
  })

  it('does not treat an unreadable (non-ENOENT) primary as "no state"', async () => {
    const { store, dir } = await freshStore()
    await mkdir(join(dir, 'play-state.json')) // reading a directory fails with EISDIR, not ENOENT
    const loaded = await store.load()
    expect(loaded.status).toBe('unreadable')
    if (loaded.status === 'unreadable') expect(loaded.reason).toContain('cannot read file')
  })

  it('refuses an absurdly large state file', async () => {
    const { store, dir } = await freshStore()
    await writeFile(join(dir, 'play-state.json'), 'x'.repeat(5 * 1024 * 1024 + 1), 'utf8')
    const loaded = await store.load()
    expect(loaded.status).toBe('unreadable')
    if (loaded.status === 'unreadable') expect(loaded.reason).toContain('unexpectedly large')
  })

  it('a corrupt primary never overwrites a good backup on the next save', async () => {
    const { dir } = await freshStore()
    const first = new StateStore(dir)
    await first.save(stateWithHp(10))
    await first.save(stateWithHp(20)) // .bak = hp 10, primary = hp 20
    await writeFile(join(dir, 'play-state.json'), 'corrupt', 'utf8')

    const second = new StateStore(dir) // fresh process: has not verified the primary yet
    await second.save(stateWithHp(30))
    expect(JSON.parse(await readFile(join(dir, 'play-state.json.bak'), 'utf8')).vitals.hp).toBe(10)
    const loaded = await second.load()
    expect(loaded.status === 'ok' && loaded.state.vitals.hp).toBe(30)
  })

  it('never substitutes the backup for a primary it could not read', async () => {
    const { store, dir } = await freshStore()
    await store.save(stateWithHp(10))
    await store.save(stateWithHp(20)) // primary hp 20, backup hp 10
    await rm(join(dir, 'play-state.json'))
    await mkdir(join(dir, 'play-state.json')) // now unreadable (EISDIR), not missing and not corrupt
    const loaded = await store.load()
    expect(loaded.status).toBe('unreadable')
  })

  it('refuses to overwrite a state file that cannot be read', async () => {
    const { dir } = await freshStore()
    await mkdir(join(dir, 'play-state.json'))
    const fresh = new StateStore(dir)
    await expect(fresh.save(stateWithHp(5))).rejects.toThrow(/cannot be read/)
  })

  it('sets a corrupt primary aside instead of destroying it on the first overwrite', async () => {
    const { dir } = await freshStore()
    await writeFile(join(dir, 'play-state.json'), 'corrupt-but-readable', 'utf8')
    const fresh = new StateStore(dir)
    await fresh.save(stateWithHp(8))
    const kept = (await readdir(dir)).find((n) => n.startsWith('play-state.json.corrupt-'))
    expect(kept).toBeDefined()
    expect(await readFile(join(dir, kept as string), 'utf8')).toBe('corrupt-but-readable')
    expect((await fresh.load()).status).toBe('ok')
  })

  it('every save promise in a burst resolves, and the newest snapshot wins', async () => {
    const { store } = await freshStore()
    const results = await Promise.allSettled(Array.from({ length: 50 }, (_, i) => store.save(stateWithHp(i + 1))))
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    const loaded = await store.load()
    expect(loaded.status === 'ok' && loaded.state.vitals.hp).toBe(50)
  })

  it('readRaw returns null when there is no file', async () => {
    const { store } = await freshStore()
    expect(await store.readRaw()).toBeNull()
  })

  it('flush resolves only after queued writes complete', async () => {
    const { store, dir } = await freshStore()
    void store.save(stateWithHp(5))
    await store.flush()
    expect(JSON.parse(await readFile(join(dir, 'play-state.json'), 'utf8')).vitals.hp).toBe(5)
  })
})
