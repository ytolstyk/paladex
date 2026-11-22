import { hasActiveFilters } from '@/domain/filters'
import { useResults } from '@/hooks/useResults'
import { useUiStore } from '@/state/uiStore'
import { FeatureCard } from './FeatureCard'
import { SpellCard } from './SpellCard'

export function SpellGrid(): React.JSX.Element {
  const filters = useUiStore((s) => s.filters)
  const clear = useUiStore((s) => s.clear)
  const setFlag = useUiStore((s) => s.setFlag)
  const { groups, features, hiddenUnprepared } = useResults()

  if (groups.length === 0 && features.length === 0) {
    const filtered = hasActiveFilters(filters)
    return (
      <div className="empty">
        <p>{filtered ? 'Nothing matches.' : 'Nothing is prepared.'}</p>
        {hiddenUnprepared > 0 && (
          <p className="muted">
            {hiddenUnprepared} {hiddenUnprepared === 1 ? 'spell matches' : 'spells match'} among the ones you haven't prepared.
          </p>
        )}
        <div className="empty__actions">
          {filtered && (
            <button type="button" className="btn" onClick={clear}>
              Clear filters
            </button>
          )}
          {!filters.showAll && (
            <button type="button" className="btn" onClick={() => setFlag('showAll', true)}>
              Show all spells
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="spell-grid">
      {groups.map((group) => (
        <section key={group.id} className="spell-level" aria-label={group.title}>
          <h2 className="spell-level__title">{group.title}</h2>
          <div className="spell-level__cards">
            {group.spells.map((spell) => (
              <SpellCard key={spell.id} spell={spell} />
            ))}
          </div>
        </section>
      ))}
      {features.length > 0 && (
        <section className="spell-level" aria-label="Class features">
          <h2 className="spell-level__title">Class features</h2>
          <div className="spell-level__cards">
            {features.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
