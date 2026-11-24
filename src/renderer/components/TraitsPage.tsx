import { useMemo } from 'react'
import { TRAIT_KINDS, TRAIT_WHENS } from '@shared/constants'
import { plural } from '@/domain/describe'
import { TRAIT_KIND_CHIP, TRAIT_WHEN_LABEL } from '@/domain/labels'
import { searchTokens, traitFoundBeyondCard } from '@/domain/search'
import { filterTraits, groupTraits, hasTraitFilters } from '@/domain/traits'
import { catalog } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { Chip } from './Chip'
import { SearchField } from './SearchField'
import { TraitCard } from './TraitCard'

// The chips offered are the kinds and timings this character has, so no chip ever matches nothing. The catalog never changes in a session.
const KINDS = TRAIT_KINDS.filter((kind) => catalog.traits.some((trait) => trait.kind === kind))
const WHENS = TRAIT_WHENS.filter((when) => catalog.traits.some((trait) => trait.when === when))

/**
 * The "Feats & traits" view: the feats, Oath features, species traits and DM homebrew with no tile of their own, as cards under
 * a heading each, searchable and filterable by where they come from and when they apply. Reference only: nothing here is saved.
 */
export function TraitsPage(): React.JSX.Element {
  const filters = useUiStore((s) => s.traitFilters)
  const setQuery = useUiStore((s) => s.setTraitQuery)
  const toggleKind = useUiStore((s) => s.toggleTraitKind)
  const toggleWhen = useUiStore((s) => s.toggleTraitWhen)
  const clear = useUiStore((s) => s.clearTraitFilters)

  const visible = useMemo(() => filterTraits(catalog.traits, filters), [filters])
  const groups = useMemo(() => groupTraits(visible, catalog.character), [visible])
  const tokens = useMemo(() => searchTokens(filters.query), [filters.query])

  return (
    <>
      <div className="filter-bar" role="search" aria-label="Find a feat or trait">
        <div className="filter-bar__row">
          <SearchField value={filters.query} onChange={setQuery} placeholder="Search feats and traits…  ( / )" label="Search feats and traits" />
        </div>
        <div className="filter-bar__row">
          <div className="chips" role="group" aria-label="Where it comes from">
            {KINDS.map((kind) => (
              <Chip key={kind} pressed={filters.kinds.includes(kind)} onClick={() => toggleKind(kind)}>
                {TRAIT_KIND_CHIP[kind]}
              </Chip>
            ))}
          </div>
          <div className="chips" role="group" aria-label="When it applies">
            {WHENS.map((when) => (
              <Chip key={when} pressed={filters.whens.includes(when)} onClick={() => toggleWhen(when)}>
                {TRAIT_WHEN_LABEL[when]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="filter-bar__row filter-bar__status">
          <p className="filter-bar__summary" aria-live="polite">
            {visible.length === catalog.traits.length
              ? plural(visible.length, 'feat or trait', 'feats and traits')
              : `${visible.length} of ${plural(catalog.traits.length, 'feat or trait', 'feats and traits')}`}
          </p>
          {hasTraitFilters(filters) && (
            <button type="button" className="btn btn--action" onClick={clear}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 && <p className="muted">Nothing matches. Clear the filters to see them all.</p>}
      {groups.map((group) => (
        <section key={group.kind} className="spell-level" aria-label={group.title}>
          <h2 className="spell-level__title">{group.title}</h2>
          <div className="spell-level__cards trait-cards">
            {group.traits.map((trait) => (
              <TraitCard key={trait.id} trait={trait} foundInText={traitFoundBeyondCard(trait, tokens)} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
