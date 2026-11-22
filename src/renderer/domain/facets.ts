import type { Spell, SpellSource } from '@shared/types'
import { LEVEL_CHIP, SOURCE_LABEL } from './labels'
import { BAND_LABEL, parseRange, RANGE_BANDS, type RangeBand } from './range'

/**
 * The single-choice-per-spell properties the filter panel offers (every spell has exactly one level, range band, school,
 * save or attack tag and source). Chips within one facet combine with OR, facets with each other combine with AND.
 * Defined once as data so the filter, the panel and the active-filter chips cannot drift apart.
 */
export type FacetId = 'level' | 'range' | 'school' | 'save' | 'source'

export interface FacetDef {
  id: FacetId
  /** The group label in the panel and on a removable chip. */
  label: string
  /** The spell's value for this facet, or null when it has none (a spell with no save or attack tag). */
  valueOf(spell: Spell): string | null
  /** The chip text for one value. */
  title(value: string): string
  /** Orders two values for display. */
  compare(a: string, b: string): number
}

const alphabetical = (a: string, b: string): number => a.localeCompare(b)

export const FACETS: readonly FacetDef[] = [
  {
    id: 'level',
    label: 'Level',
    valueOf: (spell) => String(spell.level),
    title: (value) => LEVEL_CHIP[Number(value)] ?? `Level ${value}`,
    compare: (a, b) => Number(a) - Number(b)
  },
  {
    id: 'range',
    label: 'Range',
    valueOf: (spell) => parseRange(spell.range).band,
    title: (value) => BAND_LABEL[value as RangeBand] ?? value,
    compare: (a, b) => RANGE_BANDS.indexOf(a as RangeBand) - RANGE_BANDS.indexOf(b as RangeBand)
  },
  { id: 'school', label: 'School', valueOf: (spell) => spell.school, title: (value) => value, compare: alphabetical },
  { id: 'save', label: 'Save or attack', valueOf: (spell) => spell.tag ?? null, title: (value) => value, compare: alphabetical },
  {
    id: 'source',
    label: 'Source',
    valueOf: (spell) => spell.source,
    title: (value) => SOURCE_LABEL[value as SpellSource] ?? value,
    compare: alphabetical
  }
]

export type FacetChoices = Record<FacetId, string[]>

export function emptyFacetChoices(): FacetChoices {
  return { level: [], range: [], school: [], save: [], source: [] }
}

/** The values that actually occur in `spells`, in display order, so the panel never offers a chip that matches nothing. */
export function facetOptions(spells: readonly Spell[]): Record<FacetId, string[]> {
  const options = emptyFacetChoices()
  for (const facet of FACETS) {
    const present = new Set<string>()
    for (const spell of spells) {
      const value = facet.valueOf(spell)
      if (value !== null) present.add(value)
    }
    options[facet.id] = [...present].sort(facet.compare)
  }
  return options
}
