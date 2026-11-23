import { CAST_TIMES, ROLES } from '@shared/constants'
import type { PlayState } from '@shared/schema'
import type { CastTime, Feature, Role, Spell } from '@shared/types'
import { effectiveRole } from './filters'
import { CAST_LABEL, LEVEL_TITLE, ROLE_LABEL } from './labels'
import { BAND_LABEL, parseRange, RANGE_BANDS, type RangeBand } from './range'

/**
 * How the spell grid is ordered and headed. Every sort except "name" also groups, because the headings are what let you
 * find your place: the grid under "Range" reads Self, Touch, Up to 30 ft, and so on.
 */
export const SORT_KEYS = ['level', 'name', 'range', 'castTime', 'school', 'role'] as const
export type SortKey = (typeof SORT_KEYS)[number]
export const DEFAULT_SORT: SortKey = 'level'

export const SORT_LABEL: Record<SortKey, string> = {
  level: 'Level',
  name: 'Name (A to Z)',
  range: 'Range (nearest first)',
  castTime: 'Casting time',
  school: 'School',
  role: 'What it does'
}

export interface SpellGroup {
  /** Stable across renders, for React keys. */
  id: string
  title: string
  spells: Spell[]
}

const byName = (a: Spell, b: Spell): number => a.name.localeCompare(b.name)
export const byLevelThenName = (a: Spell, b: Spell): number => a.level - b.level || byName(a, b)

interface Grouping {
  /** The group a spell belongs to. */
  key(spell: Spell): string
  title(key: string): string
  /** Orders two group keys. */
  compareKeys(a: string, b: string): number
  /** Orders spells inside one group. Omitted: the catalog's own order. */
  inside?(a: Spell, b: Spell): number
}

function index<T>(list: readonly T[], item: T): number {
  return list.indexOf(item)
}

function groupingFor(state: PlayState, sort: Exclude<SortKey, 'name'>): Grouping {
  switch (sort) {
    case 'level':
      return {
        key: (spell) => String(spell.level),
        title: (key) => LEVEL_TITLE[Number(key)] ?? `Level ${key}`,
        compareKeys: (a, b) => Number(a) - Number(b)
      }
    case 'range':
      return {
        key: (spell) => parseRange(spell.range).band,
        title: (key) => BAND_LABEL[key as RangeBand],
        compareKeys: (a, b) => index(RANGE_BANDS, a as RangeBand) - index(RANGE_BANDS, b as RangeBand),
        inside: (a, b) => parseRange(a.range).reach - parseRange(b.range).reach || byName(a, b)
      }
    case 'castTime':
      return {
        key: (spell) => spell.castTime,
        title: (key) => CAST_LABEL[key as CastTime],
        compareKeys: (a, b) => index(CAST_TIMES, a as CastTime) - index(CAST_TIMES, b as CastTime),
        inside: byLevelThenName
      }
    case 'school':
      return { key: (spell) => spell.school, title: (key) => key, compareKeys: (a, b) => a.localeCompare(b), inside: byLevelThenName }
    case 'role':
      return {
        key: (spell) => effectiveRole(state, spell),
        title: (key) => ROLE_LABEL[key as Role],
        compareKeys: (a, b) => index(ROLES, a as Role) - index(ROLES, b as Role),
        inside: byLevelThenName
      }
  }
}

/** The group of starred spells, which sits above whatever the sort produces. */
export const FAVORITES_GROUP_ID = 'favorites'
const FAVORITES_GROUP_TITLE = 'Favorites'

/**
 * Order `spells` for display and split them under headings. Never drops or repeats a spell. Starred spells that are in
 * `spells` are pulled out into a "Favorites" group first (level, then name), so a spell is never shown twice and the
 * sort only orders the rest.
 */
export function groupSpells(state: PlayState, spells: readonly Spell[], sort: SortKey): SpellGroup[] {
  if (state.favorites.length === 0) return groupBySort(state, spells, sort)
  const starred = new Set(state.favorites)
  const favorites = spells.filter((spell) => starred.has(spell.id)).sort(byLevelThenName)
  if (favorites.length === 0) return groupBySort(state, spells, sort)
  const rest = spells.filter((spell) => !starred.has(spell.id))
  return [{ id: FAVORITES_GROUP_ID, title: FAVORITES_GROUP_TITLE, spells: favorites }, ...groupBySort(state, rest, sort)]
}

function groupBySort(state: PlayState, spells: readonly Spell[], sort: SortKey): SpellGroup[] {
  if (spells.length === 0) return []
  if (sort === 'name') return [{ id: 'name', title: 'A to Z', spells: [...spells].sort(byName) }]

  const grouping = groupingFor(state, sort)
  const buckets = new Map<string, Spell[]>()
  for (const spell of spells) {
    const key = grouping.key(spell)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(spell)
    else buckets.set(key, [spell])
  }
  return [...buckets.keys()]
    .sort(grouping.compareKeys)
    .map((key) => {
      const inGroup = buckets.get(key) ?? []
      return { id: key, title: grouping.title(key), spells: grouping.inside ? inGroup.sort(grouping.inside) : inGroup }
    })
}

/** Features have no level, range or school, so only the sorts that mean something to them reorder them. */
export function orderFeatures(features: readonly Feature[], sort: SortKey): Feature[] {
  switch (sort) {
    case 'name':
      return [...features].sort((a, b) => a.name.localeCompare(b.name))
    case 'castTime':
      return [...features].sort((a, b) => index(CAST_TIMES, a.castTime) - index(CAST_TIMES, b.castTime))
    case 'role':
      return [...features].sort((a, b) => index(ROLES, a.role) - index(ROLES, b.role))
    default:
      return [...features]
  }
}
