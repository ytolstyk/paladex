import { create } from 'zustand'
import type { CastTime } from '@shared/types'
import type { FacetId } from '@/domain/facets'
import { NO_FILTERS, type Filters, type Intent } from '@/domain/filters'
import type { SortKey } from '@/domain/order'
import type { RestKind } from '@/domain/rests'
import { DEFAULT_VIEW_PREFS, parseViewPrefs, serializeViewPrefs, type ViewPrefs } from '@/domain/viewPrefs'

/** localStorage key for the remembered filters and sort. A view preference like the theme: never in the play state. */
export const VIEW_STORAGE_KEY = 'paladex.view'

export type ViewId = 'sheet' | 'settings'

/** The id of the search field, so a keyboard shortcut (`/`) can focus it without reaching into a component. */
export const SEARCH_INPUT_ID = 'spell-search'

/** The yes/no filters; each is one toggle on the bar or in the filter panel. */
export type FilterFlag = 'noConcentration' | 'ritualOnly' | 'castableNow' | 'showAll'

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
  /** The rest whose light is currently washing over the page (a visual flourish only). `n` restarts it on a repeat. */
  restGlow: { kind: RestKind; n: number } | null
  glowRest(kind: RestKind): void
  clearRestGlow(): void
  filters: Filters
  /** How the spell grid is ordered and headed. Kept by `clear`: it is a way of reading the list, not a filter. */
  sort: SortKey
  setSort(sort: SortKey): void
  toggleIntent(intent: Intent): void
  toggleCastTime(time: CastTime): void
  toggleFacet(facet: FacetId, value: string): void
  setFlag(flag: FilterFlag, on: boolean): void
  setQuery(query: string): void
  /** Clears the narrowing filters; keeps the "show all" view choice. */
  clear(): void
}

function readStoredView(): ViewPrefs {
  try {
    return parseViewPrefs(localStorage.getItem(VIEW_STORAGE_KEY))
  } catch {
    // Storage unavailable (blocked or corrupt profile): start with nothing filtered.
    return DEFAULT_VIEW_PREFS
  }
}

export function toggleIn<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

const initialView = readStoredView()

export const useUiStore = create<UiStore>((set) => ({
  view: 'sheet',
  closeSettings: () => set({ view: 'sheet' }),
  toggleSettings: () =>
    // Opening settings also closes the detail drawer, so it cannot linger behind the page.
    set((s) => (s.view === 'settings' ? { view: 'sheet' } : { view: 'settings', detailId: null })),
  detailId: null,
  openDetail: (id) => set({ detailId: id }),
  closeDetail: () => set({ detailId: null }),
  restGlow: null,
  glowRest: (kind) => set((s) => ({ restGlow: { kind, n: (s.restGlow?.n ?? 0) + 1 } })),
  clearRestGlow: () => set({ restGlow: null }),
  filters: { ...initialView.filters },
  sort: initialView.sort,
  setSort: (sort) => set({ sort }),
  toggleIntent: (intent) => set((s) => ({ filters: { ...s.filters, intents: toggleIn(s.filters.intents, intent) } })),
  toggleCastTime: (time) => set((s) => ({ filters: { ...s.filters, castTimes: toggleIn(s.filters.castTimes, time) } })),
  toggleFacet: (facet, value) =>
    set((s) => ({
      filters: { ...s.filters, facets: { ...s.filters.facets, [facet]: toggleIn(s.filters.facets[facet], value) } }
    })),
  setFlag: (flag, on) => set((s) => ({ filters: { ...s.filters, [flag]: on } })),
  setQuery: (query) => set((s) => ({ filters: { ...s.filters, query } })),
  clear: () => set((s) => ({ filters: { ...NO_FILTERS, showAll: s.filters.showAll } }))
}))

// Remember the filters and sort. Keystrokes in the search box replace `filters` too, but the search text is not kept, so
// comparing the serialized form skips those and writes only when a remembered choice changed.
let remembered = serializeViewPrefs(useUiStore.getState().filters, useUiStore.getState().sort)
useUiStore.subscribe((s) => {
  const next = serializeViewPrefs(s.filters, s.sort)
  if (next === remembered) return
  remembered = next
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, next)
  } catch {
    // Storage unavailable: the choices still apply for this session.
  }
})
