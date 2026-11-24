import { create } from 'zustand'
import { clampTurnSeconds, DEFAULT_TIMER_PREFS, parseTimerPrefs, type TimerPrefs } from '@/domain/timerPrefs'

/** localStorage key for the turn length. A view preference like the theme: never in the play state, never undone. */
export const TIMER_PREFS_STORAGE_KEY = 'paladex.timers'

export interface TimerPrefsStore extends TimerPrefs {
  setTurnSeconds(seconds: number): void
}

function readStored(): TimerPrefs {
  try {
    return parseTimerPrefs(localStorage.getItem(TIMER_PREFS_STORAGE_KEY))
  } catch {
    // Storage unavailable (blocked or corrupt profile): the defaults apply for this session.
    return DEFAULT_TIMER_PREFS
  }
}

export const useTimerPrefs = create<TimerPrefsStore>((set, get) => ({
  ...readStored(),
  setTurnSeconds: (seconds) => {
    const turnSeconds = clampTurnSeconds(seconds)
    if (turnSeconds === get().turnSeconds) return
    set({ turnSeconds }) // Apply first; persisting must never delay the visible change.
    try {
      localStorage.setItem(TIMER_PREFS_STORAGE_KEY, JSON.stringify({ turnSeconds }))
    } catch {
      // Storage unavailable: the choice still applies for this session.
    }
  }
}))
