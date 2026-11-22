import { useShallow } from 'zustand/react/shallow'
import type { Feature, Spell } from '@shared/types'
import { filterFeatures, filterSpells, hasActiveFilters } from '@/domain/filters'
import { LEVEL_TITLE } from '@/domain/labels'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { FeatureCard } from './FeatureCard'
import { SpellCard } from './SpellCard'

const NO_IDS: readonly string[] = []

export function SpellGrid(): React.JSX.Element {
  const filters = useUiStore((s) => s.filters)
  const clear = useUiStore((s) => s.clear)
  // Select ids (shallow-compared) so the grid re-renders only when the visible set actually changes.
  const spellIds = usePlayStore(useShallow((s) => (s.play ? filterSpells(s.play, catalog, filters).map((x) => x.id) : NO_IDS)))
  const featureIds = usePlayStore(useShallow((s) => (s.play ? filterFeatures(s.play, catalog, filters).map((x) => x.id) : NO_IDS)))

  const spells = spellIds.map((id) => catalog.spellById(id)).filter((s): s is Spell => s !== undefined)
  const features = featureIds.map((id) => catalog.featureById(id)).filter((f): f is Feature => f !== undefined)
  const levels = [...new Set(spells.map((s) => s.level))]

  if (spells.length === 0 && features.length === 0) {
    return (
      <div className="empty">
        <p>Nothing matches.</p>
        {hasActiveFilters(filters) ? (
          <button type="button" className="btn" onClick={clear}>
            Clear filters
          </button>
        ) : (
          <p className="muted">Nothing is prepared. Turn on “Show all spells” to choose some.</p>
        )}
      </div>
    )
  }

  return (
    <div className="spell-grid">
      {levels.map((level) => (
        <section key={level} className="spell-level" aria-label={LEVEL_TITLE[level]}>
          <h2 className="spell-level__title">{LEVEL_TITLE[level] ?? `Level ${level}`}</h2>
          <div className="spell-level__cards">
            {spells
              .filter((s) => s.level === level)
              .map((spell) => (
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
