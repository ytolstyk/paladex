import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** A minimal localStorage, since the tests run in node. `writes` counts setItem calls. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const writes: string[] = []
  return {
    writes,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes.push(key)
      data.set(key, value)
    }
  }
}

/** The store reads storage when its module loads, so each test loads a fresh copy. */
async function loadStore(storage: ReturnType<typeof fakeStorage> | null) {
  vi.resetModules()
  if (storage) vi.stubGlobal('localStorage', storage)
  return import('./uiStore')
}

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('remembered filters', () => {
  it('starts with nothing filtered when nothing was stored, or storage is unavailable', async () => {
    const { useUiStore } = await loadStore(fakeStorage())
    expect(useUiStore.getState().filters.intents).toEqual([])
    expect(useUiStore.getState().sort).toBe('level')
    // No localStorage global at all (it throws a ReferenceError on read): must not crash.
    const bare = await loadStore(null)
    expect(bare.useUiStore.getState().sort).toBe('level')
    expect(() => bare.useUiStore.getState().setSort('name')).not.toThrow()
  })

  it('writes a changed filter or sort, and restores both on the next launch', async () => {
    const storage = fakeStorage()
    const first = await loadStore(storage)
    first.useUiStore.getState().toggleIntent('enemies')
    first.useUiStore.getState().toggleFacet('school', 'Evocation')
    first.useUiStore.getState().setFlag('showAll', true)
    first.useUiStore.getState().setSort('range')

    const second = await loadStore(storage)
    const { filters, sort } = second.useUiStore.getState()
    expect(filters.intents).toEqual(['enemies'])
    expect(filters.facets.school).toEqual(['Evocation'])
    expect(filters.showAll).toBe(true)
    expect(sort).toBe('range')
  })

  it('does not write for the search text, and does not restore it', async () => {
    const storage = fakeStorage()
    const first = await loadStore(storage)
    first.useUiStore.getState().setQuery('smite')
    first.useUiStore.getState().setQuery('smites')
    expect(storage.writes).toEqual([])

    first.useUiStore.getState().toggleIntent('allies')
    expect(storage.writes).toEqual([first.VIEW_STORAGE_KEY])
    expect((await loadStore(storage)).useUiStore.getState().filters.query).toBe('')
  })

  it('Clear filters is remembered too, and keeps the show-all choice and the sort', async () => {
    const storage = fakeStorage()
    const first = await loadStore(storage)
    const ui = first.useUiStore.getState()
    ui.toggleIntent('utility')
    ui.setFlag('showAll', true)
    ui.setSort('school')
    ui.clear()

    const { filters, sort } = (await loadStore(storage)).useUiStore.getState()
    expect(filters.intents).toEqual([])
    expect(filters.showAll).toBe(true)
    expect(sort).toBe('school')
  })

  it('a storage that throws on write does not break the choice', async () => {
    const storage = {
      ...fakeStorage(),
      setItem: () => {
        throw new Error('quota')
      }
    }
    const { useUiStore } = await loadStore(storage)
    expect(() => useUiStore.getState().toggleIntent('enemies')).not.toThrow()
    expect(useUiStore.getState().filters.intents).toEqual(['enemies'])
  })
})
