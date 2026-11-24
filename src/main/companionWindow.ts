import type { PlayState } from '../shared/schema'
import type { CompanionPlacement } from './companionPlacement'

/**
 * The companion (second-screen) window's lifecycle, kept free of Electron so it can be tested: the real window is made by the
 * `createWindow` factory the entry file hands in. It owns the rules that are easy to get wrong: one window at a time, a stale `closed`
 * from an older window never clears a newer one, and whoever shows the open state (the menu's check mark) is told by `onOpenChange` rather
 * than poked from three places.
 */
export interface CompanionHandle {
  isDestroyed(): boolean
  close(): void
  send(state: PlayState): void
  setFullScreen(on: boolean): void
  /** True when `frame` is this window's top frame (an IPC sender check). */
  ownsFrame(frame: unknown): boolean
}

export interface CompanionHooks {
  /** The page can be shown. */
  onReady(): void
  /** The window has closed. */
  onClosed(): void
}

export interface CompanionDeps<H extends CompanionHandle> {
  createWindow(place: CompanionPlacement, hooks: CompanionHooks): H
  place(preferWindowed: boolean): CompanionPlacement
  /** Called with true when a window opens and false when the current one closes. */
  onOpenChange(open: boolean): void
  /** A failed push is reported here, never thrown: the second screen must not be able to fail a save. */
  onError?(err: unknown): void
}

export function createCompanionController<H extends CompanionHandle>(deps: CompanionDeps<H>) {
  let current: H | null = null

  /** The open window, or null. A window being destroyed still has its variable until `closed` fires, and touching it then throws. */
  const live = (): H | null => (current !== null && !current.isDestroyed() ? current : null)

  /** Open the window, or return the one already open. `preferWindowed` keeps it off full screen (the dev screenshot hook). */
  function open({ preferWindowed = false }: { preferWindowed?: boolean } = {}): H {
    const existing = live()
    if (existing) return existing
    const place = deps.place(preferWindowed)
    const handle: H = deps.createWindow(place, {
      onReady: () => {
        if (place.fullScreen) handle.setFullScreen(true)
      },
      onClosed: () => {
        if (current !== handle) return // an older window closing after a newer one opened: the newer one owns the state now
        current = null
        deps.onOpenChange(false)
      }
    })
    current = handle
    deps.onOpenChange(true)
    return handle
  }

  return {
    open,
    /** Close it if open, open it if not. Returns whether it is open afterwards. */
    toggle(): boolean {
      const existing = live()
      if (existing) {
        existing.close()
        return false
      }
      open()
      return true
    },
    close(): void {
      live()?.close()
    },
    /** Send the sheet to the window, if there is one. */
    push(state: PlayState): void {
      try {
        live()?.send(state)
      } catch (err) {
        deps.onError?.(err)
      }
    },
    ownsFrame: (frame: unknown): boolean => live()?.ownsFrame(frame) ?? false
  }
}

export type CompanionController = ReturnType<typeof createCompanionController>
