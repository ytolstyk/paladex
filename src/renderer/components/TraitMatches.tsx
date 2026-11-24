import { useMemo } from 'react'
import { searchTokens, traitFoundBeyondCard } from '@/domain/search'
import { filterTraits, NO_TRAIT_FILTERS } from '@/domain/traits'
import { catalog } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { TraitCard } from './TraitCard'

/**
 * Under the spell cards, while a search is running: the feats and traits it also finds (a search for "darkvision" or "advantage"
 * should not need a second trip to the Feats & traits tab). Nothing is shown with no search, so the list does not crowd the spells.
 */
export function TraitMatches(): React.JSX.Element | null {
  const query = useUiStore((s) => s.filters.query)
  const tokens = useMemo(() => searchTokens(query), [query])
  const matches = useMemo(() => (tokens.length === 0 ? [] : filterTraits(catalog.traits, { ...NO_TRAIT_FILTERS, query })), [tokens, query])
  if (matches.length === 0) return null

  return (
    <section className="spell-level" aria-label="Feats and traits that match">
      <h2 className="spell-level__title">Feats and traits that match ({matches.length})</h2>
      <div className="spell-level__cards trait-cards">
        {matches.map((trait) => (
          <TraitCard key={trait.id} trait={trait} foundInText={traitFoundBeyondCard(trait, tokens)} />
        ))}
      </div>
    </section>
  )
}
