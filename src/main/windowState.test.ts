import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseWindowState, placeWindow, WindowStateStore, type Rect, type WindowDefaults, type WindowState } from './windowState'

const DEFAULTS: WindowDefaults = { width: 1280, height: 760, minWidth: 960, minHeight: 560 }
const MAIN: Rect = { x: 0, y: 25, width: 1920, height: 1055 }
const RIGHT: Rect = { x: 1920, y: 0, width: 2560, height: 1440 }

const saved = (over: Partial<WindowState> = {}): WindowState => ({
  x: 100,
  y: 80,
  width: 1500,
  height: 900,
  maximized: false,
  fullScreen: false,
  ...over
})

describe('parseWindowState', () => {
  it('accepts a complete record and rounds the numbers', () => {
    expect(parseWindowState({ x: 10.4, y: -20, width: 1200.6, height: 800, maximized: true, fullScreen: false })).toEqual({
      x: 10,
      y: -20,
      width: 1201,
      height: 800,
      maximized: true,
      fullScreen: false
    })
  })

  it('treats missing flags as false', () => {
    expect(parseWindowState({ x: 0, y: 0, width: 900, height: 700 })).toMatchObject({ maximized: false, fullScreen: false })
  })

  it.each([
    ['null', null],
    ['a string', 'x'],
    ['an array', []],
    ['missing height', { x: 0, y: 0, width: 900 }],
    ['NaN', { x: Number.NaN, y: 0, width: 900, height: 700 }],
    ['a string number', { x: '0', y: 0, width: 900, height: 700 }],
    ['zero width', { x: 0, y: 0, width: 0, height: 700 }],
    ['negative height', { x: 0, y: 0, width: 900, height: -1 }],
    ['absurd coordinate', { x: 1e9, y: 0, width: 900, height: 700 }]
  ])('rejects %s', (_label, raw) => {
    expect(parseWindowState(raw)).toBeNull()
  })
})

describe('placeWindow', () => {
  it('uses the defaults, centred (no position), when nothing is saved', () => {
    expect(placeWindow(null, [MAIN], MAIN, DEFAULTS)).toEqual({ width: 1280, height: 760 })
  })

  it('restores a frame that is fully on screen exactly', () => {
    expect(placeWindow(saved(), [MAIN], MAIN, DEFAULTS)).toEqual({ x: 100, y: 80, width: 1500, height: 900 })
  })

  it('never opens smaller than the minimum', () => {
    const placed = placeWindow(saved({ width: 300, height: 200 }), [MAIN], MAIN, DEFAULTS)
    expect(placed).toMatchObject({ width: 960, height: 560 })
  })

  it('shrinks a frame larger than the display and pulls it in', () => {
    const placed = placeWindow(saved({ x: 500, y: 300, width: 3000, height: 2000 }), [MAIN], MAIN, DEFAULTS)
    expect(placed).toEqual({ x: 0, y: 25, width: 1920, height: 1055 })
  })

  it('nudges a frame that hangs off the edge back inside the display it mostly sits on', () => {
    const placed = placeWindow(saved({ x: 1000, y: 700, width: 1500, height: 900 }), [MAIN], MAIN, DEFAULTS)
    expect(placed).toEqual({ x: 420, y: 180, width: 1500, height: 900 })
  })

  it('keeps a window on a second monitor where it was', () => {
    const placed = placeWindow(saved({ x: 2500, y: 200, width: 1600, height: 1000 }), [MAIN, RIGHT], MAIN, DEFAULTS)
    expect(placed).toEqual({ x: 2500, y: 200, width: 1600, height: 1000 })
  })

  it('opens centred on the primary display when its monitor is gone', () => {
    const placed = placeWindow(saved({ x: 2500, y: 200, width: 1600, height: 1000 }), [MAIN], MAIN, DEFAULTS)
    expect(placed).toEqual({ width: 1600, height: 1000 })
    expect(placed).not.toHaveProperty('x')
    expect(placed).not.toHaveProperty('y')
  })

  it('treats a sliver of overlap as lost', () => {
    const placed = placeWindow(saved({ x: 1900, y: 80, width: 1500, height: 900 }), [MAIN], MAIN, DEFAULTS)
    expect(placed).not.toHaveProperty('x')
  })

  it('fits the size to the primary display when the saved size cannot fit there', () => {
    const placed = placeWindow(saved({ x: 5000, y: 0, width: 2400, height: 1300 }), [MAIN], MAIN, DEFAULTS)
    expect(placed).toEqual({ width: 1920, height: 1055 })
  })
})

describe('WindowStateStore', () => {
  let dir: string
  let file: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'paladex-window-'))
    file = join(dir, 'window-state.json')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('returns null when there is no file', () => {
    expect(new WindowStateStore(file).load()).toBeNull()
  })

  it('round-trips a state', () => {
    const store = new WindowStateStore(file)
    store.save(saved({ maximized: true }))
    expect(new WindowStateStore(file).load()).toEqual(saved({ maximized: true }))
  })

  it('creates the profile folder if it is missing', () => {
    const nested = new WindowStateStore(join(dir, 'a', 'b', 'window-state.json'))
    nested.save(saved())
    expect(nested.load()).toEqual(saved())
  })

  it('replaces the previous state and leaves no temp files behind', () => {
    const store = new WindowStateStore(file)
    store.save(saved({ width: 1000 }))
    store.save(saved({ width: 1700 }))
    expect(store.load()?.width).toBe(1700)
    expect(readdirSync(dir)).toEqual(['window-state.json'])
  })

  it('ignores a corrupt file instead of throwing', () => {
    writeFileSync(file, '{ not json', 'utf8')
    expect(new WindowStateStore(file).load()).toBeNull()
  })

  it('ignores a file with the wrong shape', () => {
    writeFileSync(file, JSON.stringify({ x: 'left' }), 'utf8')
    expect(new WindowStateStore(file).load()).toBeNull()
  })

  it('ignores an oversized file', () => {
    writeFileSync(file, JSON.stringify({ ...saved(), pad: 'x'.repeat(20_000) }), 'utf8')
    expect(new WindowStateStore(file).load()).toBeNull()
  })
})
