import { CAST_TIMES } from '@shared/constants'
import { emptyFacetChoices, FACETS, type FacetChoices } from './facets'
import { INTENT_ROLES, NO_FILTERS, type Filters, type Intent } from './filters'
import { DEFAULT_SORT, SORT_KEYS, type SortKey } from './order'

/**
 * How the player last had the spell list set up, kept between launches. Pure: `state/uiStore.ts` does the reading and writing.
 *
 * What is NOT kept is the search text. A word typed an hour ago and forgotten would greet the next launch with an empty
 * stage and no obvious reason; the filters and sort are visible as chips and in the sort menu, so they are safe to restore.
 */
export interface ViewPrefs {
  filters: Filters
  sort: SortKey
}

export const DEFAULT_VIEW_PREFS: Readonly<ViewPrefs> = Object.freeze({ filters: NO_FILTERS, sort: DEFAULT_SORT })

/** Far more than any real set of choices needs; a larger stored value is corrupt, so it is not even parsed. */
const MAX_STORED_CHARS = 16_000
const MAX_VALUES_PER_LIST = 64

const INTENTS = Object.keys(INTENT_ROLES) as Intent[]

/** The part of the view worth keeping, as the string that goes into storage. Equal views give equal strings. */
export function serializeViewPrefs(filters: Filters, sort: SortKey): string {
  const { query: _searchTextIsNotKept, ...kept } = filters // every other field is saved; `parseViewPrefs` must restore each
  return JSON.stringify({ ...kept, sort })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The items of `raw` that `keep` accepts, each once. Not an array, or too long to be real: nothing. */
function pick<T>(raw: unknown, keep: (item: unknown) => item is T): T[] {
  if (!Array.isArray(raw) || raw.length > MAX_VALUES_PER_LIST) return []
  return raw.filter((item, i): item is T => keep(item) && raw.indexOf(item) === i)
}

const isString = (item: unknown): item is string => typeof item === 'string' && item.length > 0 && item.length <= 100
const isIntent = (item: unknown): item is Intent => INTENTS.some((intent) => intent === item)
const isCastTime = (item: unknown): item is Filters['castTimes'][number] => CAST_TIMES.some((time) => time === item)
const isSort = (item: unknown): item is SortKey => SORT_KEYS.some((key) => key === item)

function pickFacets(raw: unknown): FacetChoices {
  const facets = emptyFacetChoices()
  if (!isRecord(raw)) return facets
  for (const facet of FACETS) facets[facet.id] = pick(raw[facet.id], isString)
  return facets
}

/**
 * Reads a stored value. Anything unreadable falls back to the defaults, and a single bad field (a sort that no longer
 * exists, an intent from a later version) loses only itself.
 */
export function parseViewPrefs(raw: string | null): ViewPrefs {
  if (!raw || raw.length > MAX_STORED_CHARS) return DEFAULT_VIEW_PREFS
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return DEFAULT_VIEW_PREFS
  }
  if (!isRecord(data)) return DEFAULT_VIEW_PREFS
  return {
    // Every `Filters` field is listed on purpose, with no `...NO_FILTERS` spread: a field added to `Filters` that is saved by
    // `serializeViewPrefs` but not restored here would then fail to compile instead of silently resetting on launch.
    filters: {
      intents: pick(data.intents, isIntent),
      castTimes: pick(data.castTimes, isCastTime),
      facets: pickFacets(data.facets),
      noConcentration: data.noConcentration === true,
      ritualOnly: data.ritualOnly === true,
      castableNow: data.castableNow === true,
      showAll: data.showAll === true,
      query: '' // never kept, see the header
    },
    sort: isSort(data.sort) ? data.sort : DEFAULT_SORT
  }
}
