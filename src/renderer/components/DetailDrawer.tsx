import { useEffect } from 'react'
import { describeComponents } from '@/domain/components'
import { describeCastTime, describeFeatureCost, describeFeatureKind, describeSpellCost, describeSpellKind } from '@/domain/describe'
import { catalog } from '@/state/session'
import { useUiStore } from '@/state/uiStore'

function Fact({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element | null {
  if (children === null || children === undefined || children === false || children === '') return null
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

/** Side panel with everything known about one spell or feature. Plain text only: nothing from the sheet is rendered as markup. */
export function DetailDrawer(): React.JSX.Element | null {
  const detailId = useUiStore((s) => s.detailId)
  const closeDetail = useUiStore((s) => s.closeDetail)

  useEffect(() => {
    if (!detailId) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailId, closeDetail])

  if (!detailId) return null
  const spell = catalog.spellById(detailId)
  const feature = catalog.featureById(detailId)
  if (!spell && !feature) return null

  const title = spell?.name ?? feature?.name ?? ''
  const kind = spell ? describeSpellKind(spell) : feature ? describeFeatureKind(feature) : ''
  const summary = spell?.summary ?? feature?.summary ?? ''
  const description = spell?.description ?? feature?.description
  const paragraphs = description ? description.split('\n').filter((line) => line.trim() !== '') : []

  return (
    <aside className="drawer" aria-label={`${title} details`}>
      <header className="drawer__head">
        <div>
          <h2 className="drawer__title">{title}</h2>
          <p className="drawer__kind">{kind}</p>
        </div>
        <button type="button" className="btn btn--quiet" onClick={closeDetail} aria-label="Close details">
          Close
        </button>
      </header>

      <dl className="facts">
        {spell && (
          <>
            <Fact label="Casting time">{describeCastTime(spell)}</Fact>
            <Fact label="Range">{spell.range}</Fact>
            <Fact label="Components">{describeComponents(spell.components)}</Fact>
            <Fact label="Duration">
              {spell.duration}
              {spell.concentration ? ', concentration' : ''}
            </Fact>
            <Fact label="Ritual">{spell.ritual ? 'Can be cast as a ritual' : null}</Fact>
            <Fact label="Save or attack">{spell.tag}</Fact>
            <Fact label="Costs">{describeSpellCost(spell, catalog)}</Fact>
          </>
        )}
        {feature && (
          <>
            <Fact label="Uses">{describeCastTime(feature)}</Fact>
            <Fact label="Save or attack">{feature.tag}</Fact>
            <Fact label="Costs">{describeFeatureCost(feature, catalog)}</Fact>
          </>
        )}
      </dl>

      {summary && <p className="drawer__summary">{summary}</p>}

      <div className="drawer__text">
        {paragraphs.length > 0 ? (
          paragraphs.map((p, i) => <p key={i}>{p}</p>)
        ) : (
          <p className="muted">Full text isn't stored for this one. Read it on D&amp;D Beyond.</p>
        )}
      </div>
    </aside>
  )
}
