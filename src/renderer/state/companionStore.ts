import { create } from 'zustand'
import type { PaladexApi } from '@shared/ipc'
import type { PlayState } from '@shared/schema'
import type { Catalog } from '@/domain/catalog'
import { reconcile } from '@/domain/hydrate'
import { parseTheme } from '@/domain/themes'
import { parseTimerPrefs } from '@/domain/timerPrefs'
import { THEME_STORAGE_KEY, useThemeStore } from './themeStore'
import { TIMER_PREFS_STORAGE_KEY, useTimerPrefs } from './timerPrefsStore'

export type CompanionStatus = 'waiting' | 'ready' | 'unreadable'

export interface CompanionStore {
  status: CompanionStatus
  /** The sheet as the main window last saved it. Never written from here: this window has no way to save. */
  play: PlayState | null
}

/** What the companion needs from the outside: to read the saved sheet once, and to hear each later save. */
export type CompanionPort = Pick<PaladexApi, 'loadState' | 'onCompanionState'>

/**
 * The second screen's copy of the sheet. It is a mirror, not a second player: it only ever receives state, and `reconcile` runs on it
 * in memory (never saved) so a stale entry cannot reach the display.
 *
 * `connect` listens first and loads second. A push that lands while the load is still in flight is newer than what the load read, so
 * once any push has arrived the load result is ignored.
 */
export function createCompanionStore(port: CompanionPort, catalog: Catalog) {
  const useCompanion = create<CompanionStore>(() => ({ status: 'waiting', play: null }))

  function connect(): () => void {
    let live = true
    let pushed = false
    const show = (state: PlayState): void => useCompanion.setState({ status: 'ready', play: reconcile(state, catalog).state })

    const stop = port.onCompanionState((state) => {
      if (!live) return
      pushed = true
      show(state)
    })

    port.loadState().then(
      (result) => {
        if (!live || pushed) return
        if (result.status === 'ok') show(result.state)
        else if (result.status === 'unreadable') useCompanion.setState({ status: 'unreadable', play: null })
        // 'empty': nothing saved yet. The sheet saves a fresh state as soon as it opens, and that arrives as a push.
      },
      () => {
        if (live && !pushed) useCompanion.setState({ status: 'unreadable', play: null })
      }
    )

    return () => {
      live = false
      stop()
    }
  }

  return { useCompanion, connect }
}

/**
 * The theme and the turn length are view preferences kept in localStorage, which both windows share, but each window reads them once at
 * start. A change made in the sheet reaches the companion as a `storage` event: follow it, so picking a theme in Settings recolours the
 * second screen too. Returns the function that stops listening.
 */
export function followViewPrefs(): () => void {
  const onStorage = (event: StorageEvent): void => {
    // A null key means the whole store was cleared: read both again.
    if (event.key === null || event.key === THEME_STORAGE_KEY) {
      useThemeStore.setState({ theme: parseTheme(event.key === null ? null : event.newValue) })
    }
    if (event.key === null || event.key === TIMER_PREFS_STORAGE_KEY) {
      useTimerPrefs.setState(parseTimerPrefs(event.key === null ? null : event.newValue))
    }
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
