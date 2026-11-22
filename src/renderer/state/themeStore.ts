import { create } from 'zustand'
import { DEFAULT_THEME, parseTheme, type ThemeId } from '@/domain/themes'

/**
 * localStorage key for the chosen theme. `public/theme-boot.js` reads the same key before first paint:
 * keep the two in step.
 */
export const THEME_STORAGE_KEY = 'paladex.theme'

/**
 * The chosen color theme. A view preference, so it lives in the renderer's localStorage rather than in the play state:
 * it is never undone, never logged and never exported. Storage failures degrade to "default theme", never to a crash.
 */
interface ThemeStore {
  theme: ThemeId
  setTheme(theme: ThemeId): void
}

function readStoredTheme(): ThemeId {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    // Storage unavailable (blocked or corrupt profile): fall back to the default theme.
    return DEFAULT_THEME
  }
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    if (theme === get().theme) return
    set({ theme }) // Apply first; persisting must never delay the visible change.
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Storage unavailable: the theme still applies for this session.
    }
  }
}))

function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset['theme'] = theme
}

let started = false

/**
 * Applies the stored theme and keeps <html> in sync afterwards. `public/theme-boot.js` has already set the attribute
 * before first paint; this makes the store authoritative (it also validates the value) and handles later changes.
 * Idempotent, so a hot reload cannot stack subscribers.
 */
export function initTheme(): void {
  if (started) return
  started = true
  applyTheme(useThemeStore.getState().theme)
  useThemeStore.subscribe((state, prev) => {
    if (state.theme !== prev.theme) applyTheme(state.theme)
  })
}
