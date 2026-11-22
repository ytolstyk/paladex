import { useCallback, useRef, useState } from 'react'
import { CAST_TIMES } from '@shared/constants'
import { FACETS } from '@/domain/facets'
import { hasActiveFilters, panelFilterCount, type Intent } from '@/domain/filters'
import { CAST_LABEL } from '@/domain/labels'
import { SORT_KEYS, SORT_LABEL, type SortKey } from '@/domain/order'
import { chosenCount, paladinPreparedLimit } from '@/domain/prepared'
import { useDismiss } from '@/hooks/useDismiss'
import { useResults } from '@/hooks/useResults'
import { catalog, usePlayStore } from '@/state/session'
import { SEARCH_INPUT_ID, useUiStore } from '@/state/uiStore'
import { Chip } from './Chip'
import { FilterPanel } from './FilterPanel'

const INTENTS: { id: Intent; label: string; hint: string }[] = [
  { id: 'enemies', label: 'Hurt enemies', hint: 'Damage and control spells' },
  { id: 'allies', label: 'Help allies', hint: 'Healing, buffs and protection' },
  { id: 'utility', label: 'Utility', hint: 'Movement, detection and everything else' }
]
// The long casting times (rituals, 10 minutes) are not a combat choice, so they get no chip.
const CAST_TIME_CHIPS = CAST_TIMES.filter((t) => t !== 'long').map((id) => ({ id, label: CAST_LABEL[id] }))
const PANEL_ID = 'filter-panel'

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** What the player has chosen in the panel, as chips that can each be taken off without opening it. */
function ActiveFilters(): React.JSX.Element | null {
  const filters = useUiStore((s) => s.filters)
  const toggleFacet = useUiStore((s) => s.toggleFacet)
  const setFlag = useUiStore((s) => s.setFlag)
  if (panelFilterCount(filters) === 0) return null

  const removable: { key: string; label: string; remove(): void }[] = [
    ...FACETS.flatMap((facet) =>
      filters.facets[facet.id].map((value) => ({
        key: `${facet.id}:${value}`,
        label: `${facet.label}: ${facet.title(value)}`,
        remove: () => toggleFacet(facet.id, value)
      }))
    ),
    ...(filters.ritualOnly ? [{ key: 'ritual', label: 'Ritual only', remove: () => setFlag('ritualOnly', false) }] : []),
    ...(filters.noConcentration ? [{ key: 'conc', label: 'No concentration', remove: () => setFlag('noConcentration', false) }] : [])
  ]
  return (
    <ul className="active-filters" aria-label="Filters from the panel">
      {removable.map((item) => (
        <li key={item.key}>
          <button type="button" className="tag" onClick={item.remove} aria-label={`Remove filter ${item.label}`} title="Remove this filter">
            {item.label}
            <span aria-hidden="true"> ×</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function FilterBar(): React.JSX.Element {
  const filters = useUiStore((s) => s.filters)
  const sort = useUiStore((s) => s.sort)
  const toggleIntent = useUiStore((s) => s.toggleIntent)
  const toggleCastTime = useUiStore((s) => s.toggleCastTime)
  const setFlag = useUiStore((s) => s.setFlag)
  const setQuery = useUiStore((s) => s.setQuery)
  const setSort = useUiStore((s) => s.setSort)
  const clear = useUiStore((s) => s.clear)
  const { spellCount, features, hiddenUnprepared } = useResults()
  const chosen = usePlayStore((s) => (s.play ? chosenCount(s.play, catalog) : 0))
  const limit = paladinPreparedLimit(catalog.character.level)
  const inPanel = panelFilterCount(filters)

  const [panelOpen, setPanelOpen] = useState(false)
  const panelBox = useRef<HTMLDivElement>(null)
  const closePanel = useCallback(() => setPanelOpen(false), [])
  useDismiss(panelOpen, panelBox, closePanel)

  return (
    <div className="filter-bar" role="search" aria-label="Find a spell">
      <div className="filter-bar__row">
        <input
          id={SEARCH_INPUT_ID}
          className="field field--search"
          type="search"
          placeholder="Search spells and features…  ( / )"
          aria-label="Search spells and features"
          value={filters.query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            if (filters.query !== '') setQuery('')
            else e.currentTarget.blur()
          }}
        />
        <label className="sort">
          <span className="sort__label">Sort by</span>
          {/* The options are exactly SORT_KEYS, so the cast in onChange is safe. */}
          <select className="field field--select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {SORT_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <div className="filter-bar__more" ref={panelBox}>
          <button
            type="button"
            className="btn filter-bar__toggle"
            aria-expanded={panelOpen}
            aria-controls={PANEL_ID}
            data-active={inPanel > 0 || undefined}
            onClick={() => setPanelOpen((open) => !open)}
          >
            More filters
            {inPanel > 0 && <span className="filter-bar__count">{inPanel}</span>}
          </button>
          {panelOpen && <FilterPanel id={PANEL_ID} />}
        </div>
      </div>

      <div className="filter-bar__row">
        <div className="chips" role="group" aria-label="What do you need?">
          {INTENTS.map((i) => (
            <Chip key={i.id} tone={i.id} title={i.hint} pressed={filters.intents.includes(i.id)} onClick={() => toggleIntent(i.id)}>
              {i.label}
            </Chip>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Casting time">
          {CAST_TIME_CHIPS.map((t) => (
            <Chip key={t.id} pressed={filters.castTimes.includes(t.id)} onClick={() => toggleCastTime(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Availability">
          <Chip
            pressed={filters.castableNow}
            title="Only spells you can cast right now"
            onClick={() => setFlag('castableNow', !filters.castableNow)}
          >
            Castable now
          </Chip>
          <Chip
            pressed={filters.showAll}
            title="Include spells you haven't prepared, so you can prepare them"
            onClick={() => setFlag('showAll', !filters.showAll)}
          >
            Show all spells
          </Chip>
        </div>
      </div>

      <div className="filter-bar__row filter-bar__status">
        <p className="filter-bar__summary" aria-live="polite">
          {plural(spellCount, 'spell', 'spells')}
          {features.length > 0 && ` and ${plural(features.length, 'feature', 'features')}`}
          {hiddenUnprepared > 0 && (
            <>
              {' · '}
              <button type="button" className="link-button" onClick={() => setFlag('showAll', true)}>
                {plural(hiddenUnprepared, 'more match', 'more matches')} among unprepared spells
              </button>
            </>
          )}
        </p>
        <ActiveFilters />
        {hasActiveFilters(filters) && (
          <button type="button" className="link-button" onClick={clear}>
            Clear filters
          </button>
        )}
        <span className="prepared-count" data-over={chosen > limit || undefined} title="Spells you chose to prepare today">
          Prepared {chosen} of {limit}
        </span>
      </div>
    </div>
  )
}
