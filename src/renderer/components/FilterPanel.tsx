import { facetOptions, FACETS } from '@/domain/facets'
import { panelFilterCount } from '@/domain/filters'
import { catalog } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { Chip } from './Chip'

/** The values that exist in this character's spell list, computed once: the catalog never changes while the app runs. */
const OPTIONS = facetOptions(catalog.spells)

/**
 * The less common filters, kept off the bar so it stays readable: level, range, school, save or attack, source, ritual and
 * concentration. Open from the More filters button. Whatever is chosen here also appears as a removable chip under the bar.
 */
export function FilterPanel({ id }: { id: string }): React.JSX.Element {
  const filters = useUiStore((s) => s.filters)
  const toggleFacet = useUiStore((s) => s.toggleFacet)
  const setFlag = useUiStore((s) => s.setFlag)
  const clear = useUiStore((s) => s.clear)
  const chosen = panelFilterCount(filters)

  return (
    <div className="filter-panel" id={id} role="group" aria-label="More filters">
      {FACETS.map((facet) => {
        const values = OPTIONS[facet.id]
        // A facet with one possible value narrows nothing, so it earns no row (unless it is somehow already set).
        if (values.length < 2 && filters.facets[facet.id].length === 0) return null
        return (
          <div key={facet.id} className="filter-panel__row" role="group" aria-label={facet.label}>
            <span className="filter-panel__label">{facet.label}</span>
            <div className="chips">
              {values.map((value) => (
                <Chip key={value} pressed={filters.facets[facet.id].includes(value)} onClick={() => toggleFacet(facet.id, value)}>
                  {facet.title(value)}
                </Chip>
              ))}
            </div>
          </div>
        )
      })}
      <div className="filter-panel__row" role="group" aria-label="Also">
        <span className="filter-panel__label">Also</span>
        <div className="chips">
          <Chip pressed={filters.ritualOnly} onClick={() => setFlag('ritualOnly', !filters.ritualOnly)}>
            Ritual only
          </Chip>
          <Chip
            pressed={filters.noConcentration}
            title="Leave out spells that need concentration"
            onClick={() => setFlag('noConcentration', !filters.noConcentration)}
          >
            No concentration
          </Chip>
        </div>
      </div>
      <p className="filter-panel__foot">
        <span className="muted">Level, range, school, save, source and ritual describe spells, so class features are hidden while any of them is on.</span>
        {chosen > 0 && (
          <button type="button" className="btn btn--action" onClick={clear}>
            Clear all filters
          </button>
        )}
      </p>
    </div>
  )
}
