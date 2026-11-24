import { describe, expect, it, vi } from 'vitest'
import type { PlayState } from '../shared/schema'
import { createCompanionController, type CompanionHandle, type CompanionHooks } from './companionWindow'
import type { CompanionPlacement } from './companionPlacement'

const FULL: CompanionPlacement = { x: 1920, y: 0, width: 1920, height: 1080, fullScreen: true }
const WINDOWED: CompanionPlacement = { x: 10, y: 10, width: 1280, height: 720, fullScreen: false }

class FakeWindow implements CompanionHandle {
  destroyed = false
  fullScreen = false
  sent: PlayState[] = []
  constructor(readonly hooks: CompanionHooks, readonly frame: object = {}) {}
  isDestroyed = () => this.destroyed
  close = () => {
    this.destroyed = true
    this.hooks.onClosed()
  }
  send = (state: PlayState) => {
    if (this.destroyed) throw new Error('Object has been destroyed')
    this.sent.push(state)
  }
  setFullScreen = (on: boolean) => {
    this.fullScreen = on
  }
  ownsFrame = (frame: unknown) => frame === this.frame
}

function setup(place: CompanionPlacement = FULL) {
  const windows: FakeWindow[] = []
  const onOpenChange = vi.fn()
  const onError = vi.fn()
  const controller = createCompanionController<FakeWindow>({
    createWindow: (_place, hooks) => {
      const win = new FakeWindow(hooks)
      windows.push(win)
      return win
    },
    place: vi.fn((preferWindowed: boolean) => (preferWindowed ? { ...place, fullScreen: false } : place)),
    onOpenChange,
    onError
  })
  return { controller, windows, onOpenChange, onError }
}

const state = {} as PlayState

describe('companion controller', () => {
  it('opens one window and says so', () => {
    const { controller, windows, onOpenChange } = setup()
    expect(controller.toggle()).toBe(true)
    expect(windows).toHaveLength(1)
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
  })

  it('closes the window on the second toggle, and says so', () => {
    const { controller, windows, onOpenChange } = setup()
    controller.toggle()
    expect(controller.toggle()).toBe(false)
    expect(windows[0]?.destroyed).toBe(true)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('never opens a second window while one is open', () => {
    const { controller, windows } = setup()
    const first = controller.open()
    expect(controller.open()).toBe(first)
    expect(windows).toHaveLength(1)
  })

  it('goes full screen once the page is ready, when the placement says so', () => {
    const { controller, windows } = setup(FULL)
    controller.open()
    expect(windows[0]?.fullScreen).toBe(false) // not before it is shown
    windows[0]?.hooks.onReady()
    expect(windows[0]?.fullScreen).toBe(true)
  })

  it('stays windowed on a single screen, and when asked to', () => {
    const single = setup(WINDOWED)
    single.controller.open()
    single.windows[0]?.hooks.onReady()
    expect(single.windows[0]?.fullScreen).toBe(false)

    const asked = setup(FULL)
    asked.controller.open({ preferWindowed: true })
    asked.windows[0]?.hooks.onReady()
    expect(asked.windows[0]?.fullScreen).toBe(false)
  })

  it('does not let an older window closing clear a newer one', () => {
    const { controller, windows, onOpenChange } = setup()
    const first = controller.open()
    first.destroyed = true // closing has begun: it is already unusable, but its `closed` has not fired yet
    const second = controller.open()
    expect(second).not.toBe(first)
    onOpenChange.mockClear()
    first.hooks.onClosed() // the old one's late `closed`
    expect(onOpenChange).not.toHaveBeenCalled()
    controller.push(state)
    expect(windows[1]?.sent).toHaveLength(1)
  })

  describe('push', () => {
    it('sends the state to the open window', () => {
      const { controller, windows } = setup()
      controller.open()
      controller.push(state)
      expect(windows[0]?.sent).toEqual([state])
    })

    it('does nothing with no window, or a destroyed one', () => {
      const { controller, windows, onError } = setup()
      controller.push(state)
      controller.open()
      windows[0]!.destroyed = true
      controller.push(state)
      expect(windows[0]?.sent).toEqual([])
      expect(onError).not.toHaveBeenCalled()
    })

    it('reports a failed send instead of throwing', () => {
      const { controller, windows, onError } = setup()
      controller.open()
      windows[0]!.send = () => {
        throw new Error('boom')
      }
      expect(() => controller.push(state)).not.toThrow()
      expect(onError).toHaveBeenCalledOnce()
    })
  })

  describe('ownsFrame', () => {
    it('recognises only the open window\'s own frame', () => {
      const { controller, windows } = setup()
      expect(controller.ownsFrame({})).toBe(false)
      controller.open()
      expect(controller.ownsFrame(windows[0]?.frame)).toBe(true)
      expect(controller.ownsFrame({})).toBe(false)
    })

    it('says no once the window is destroyed, without touching it', () => {
      const { controller, windows } = setup()
      controller.open()
      const frame = windows[0]?.frame
      windows[0]!.destroyed = true
      expect(controller.ownsFrame(frame)).toBe(false)
    })
  })
})
