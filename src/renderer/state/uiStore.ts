import { create } from 'zustand'
import type { CastTime } from '@shared/types'
import { NO_FILTERS, type Filters, type Intent } from '@/domain/filters'

export type ViewId = 'sheet' | 'settings'

/**
 * View-only state: what the player is currently looking for. Deliberately separate from PlayState so filters are
 * never saved to disk and never enter the undo history.
 */
interface UiStore {
  /** Which page fills the window. Settings replaces the rail and spell grid; the banner and footer stay. */
  view: ViewId
  closeSettings(): void
  toggleSettings(): void
  /** The spell or feature shown in the detail drawer, by id (`spell:...` / `feature:...`). */
  detailId: string | null
  openDetail(id: string): void
  closeDetail(): void
  filters: Filters
  toggleIntent(intent: Intent): void
  toggleCastTime(time: CastTime): void
  setFlag(flag: 'noConcentration' | 'castableNow' | 'showAll', on: boolean): void
  setQuery(query: string): void
  /** Clears the narrowing filters; keeps the "show all" view choice. */
  clear(): void
}

export function toggleIn<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

export const useUiStore = create<UiStore>((set) => ({
  view: 'sheet',
  closeSettings: () => set({ view: 'sheet' }),
  toggleSettings: () =>
    // Opening settings also closes the detail drawer, so it cannot linger behind the page.
    set((s) => (s.view === 'settings' ? { view: 'sheet' } : { view: 'settings', detailId: null })),
  detailId: null,
  openDetail: (id) => set({ detailId: id }),
  closeDetail: () => set({ detailId: null }),
  filters: { ...NO_FILTERS },
  toggleIntent: (intent) => set((s) => ({ filters: { ...s.filters, intents: toggleIn(s.filters.intents, intent) } })),
  toggleCastTime: (time) => set((s) => ({ filters: { ...s.filters, castTimes: toggleIn(s.filters.castTimes, time) } })),
  setFlag: (flag, on) => set((s) => ({ filters: { ...s.filters, [flag]: on } })),
  setQuery: (query) => set((s) => ({ filters: { ...s.filters, query } })),
  clear: () => set((s) => ({ filters: { ...NO_FILTERS, showAll: s.filters.showAll } }))
}))
