import { TRAIT_KINDS } from '@shared/constants'
import type { Character, Trait, TraitKind, TraitWhen } from '@shared/types'
import { searchTokens, traitMatches } from './search'

/**
 * What the Feats & traits page is narrowed by. View state only: it is never saved and never undoable (like the spell filters,
 * but not remembered between launches, since a forgotten chip would greet you with a short list).
 */
export interface TraitFilters {
  query: string
  /** Chips within a group combine with OR, the two groups and the search with AND, as on the spell filters. */
  kinds: TraitKind[]
  whens: TraitWhen[]
}

export const NO_TRAIT_FILTERS: TraitFilters = { query: '', kinds: [], whens: [] }

export function hasTraitFilters(filters: TraitFilters): boolean {
  return searchTokens(filters.query).length > 0 || filters.kinds.length > 0 || filters.whens.length > 0
}

/** The traits that pass every filter, in the catalog's order. */
export function filterTraits(traits: readonly Trait[], filters: TraitFilters): Trait[] {
  const tokens = searchTokens(filters.query)
  return traits.filter(
    (trait) =>
      (filters.kinds.length === 0 || filters.kinds.includes(trait.kind)) &&
      (filters.whens.length === 0 || filters.whens.includes(trait.when)) &&
      (tokens.length === 0 || traitMatches(trait, tokens))
  )
}

export interface TraitGroup {
  kind: TraitKind
  title: string
  traits: Trait[]
}

/** The heading of each group: the character's own Oath and species by name, since those are what a player calls them. */
function groupTitle(kind: TraitKind, character: Pick<Character, 'subclass' | 'race'>): string {
  switch (kind) {
    case 'oath':
      return character.subclass || 'Oath features'
    case 'species':
      return character.race
    case 'feat':
      return 'Feats'
    case 'homebrew':
      return 'DM homebrew'
  }
}

/** The traits under their headings in `TRAIT_KINDS` order, each group keeping the catalog's order; a group with nothing in it is left out. */
export function groupTraits(traits: readonly Trait[], character: Pick<Character, 'subclass' | 'race'>): TraitGroup[] {
  return TRAIT_KINDS.flatMap((kind) => {
    const inGroup = traits.filter((trait) => trait.kind === kind)
    return inGroup.length > 0 ? [{ kind, title: groupTitle(kind, character), traits: inGroup }] : []
  })
}
