import { CAST_TIMES } from '@shared/constants'
import { hasActiveFilters, type Intent } from '@/domain/filters'
import { CAST_LABEL } from '@/domain/labels'
import { chosenCount, paladinPreparedLimit } from '@/domain/prepared'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'

const INTENTS: { id: Intent; label: string; hint: string }[] = [
  { id: 'enemies', label: 'Hurt enemies', hint: 'Damage and control spells' },
  { id: 'allies', label: 'Help allies', hint: 'Healing, buffs and protection' },
  { id: 'utility', label: 'Utility', hint: 'Movement, detection and everything else' }
]
// The long casting times (rituals, 10 minutes) are not a combat choice, so they get no chip.
const CAST_TIME_CHIPS = CAST_TIMES.filter((t) => t !== 'long').map((id) => ({ id, label: CAST_LABEL[id] }))

function Chip(props: { pressed: boolean; onClick: () => void; children: string; tone?: Intent; title?: string }): React.JSX.Element {
  return (
    <button
      type="button"
      className="chip"
      data-tone={props.tone}
      aria-pressed={props.pressed}
      title={props.title}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

export function FilterBar(): React.JSX.Element {
  const filters = useUiStore((s) => s.filters)
  const { toggleIntent, toggleCastTime, setFlag, setQuery, clear } = useUiStore.getState()
  const chosen = usePlayStore((s) => (s.play ? chosenCount(s.play, catalog) : 0))
  const limit = paladinPreparedLimit(catalog.character.level)

  return (
    <div className="filter-bar" role="search" aria-label="Find a spell">
      <div className="filter-bar__row">
        <div className="chips" role="group" aria-label="What do you need?">
          {INTENTS.map((i) => (
            <Chip key={i.id} tone={i.id} title={i.hint} pressed={filters.intents.includes(i.id)} onClick={() => toggleIntent(i.id)}>
              {i.label}
            </Chip>
          ))}
        </div>
        <input
          className="field"
          type="search"
          placeholder="Search spells"
          aria-label="Search spells"
          value={filters.query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="filter-bar__row">
        <div className="chips" role="group" aria-label="Casting time">
          {CAST_TIME_CHIPS.map((t) => (
            <Chip key={t.id} pressed={filters.castTimes.includes(t.id)} onClick={() => toggleCastTime(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Narrow down">
          <Chip pressed={filters.noConcentration} onClick={() => setFlag('noConcentration', !filters.noConcentration)}>
            No concentration
          </Chip>
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
          {hasActiveFilters(filters) && (
            <button type="button" className="link-button" onClick={clear}>
              Clear
            </button>
          )}
        </div>
        <span className="prepared-count" data-over={chosen > limit || undefined} title="Spells you chose to prepare today">
          Prepared {chosen} of {limit}
        </span>
      </div>
    </div>
  )
}
