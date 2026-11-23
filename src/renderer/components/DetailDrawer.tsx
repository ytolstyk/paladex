import { Fragment, useRef } from 'react'
import { describeDetail, detailEntry } from '@/domain/detail'
import { useDismiss } from '@/hooks/useDismiss'
import { catalog } from '@/state/session'
import { useUiStore } from '@/state/uiStore'
import { opensDetail } from './detailTrigger'

/** Side panel with everything known about one spell, feature or weapon. Plain text only: nothing from the sheet is rendered as markup. */
export function DetailDrawer(): React.JSX.Element | null {
  const detailId = useUiStore((s) => s.detailId)
  const closeDetail = useUiStore((s) => s.closeDetail)
  const drawer = useRef<HTMLElement>(null)

  // A press outside the drawer or Escape closes it. A press on a card's body is left to the card, which opens or switches the drawer.
  useDismiss(detailId !== null, drawer, closeDetail, opensDetail)

  const entry = detailId ? detailEntry(catalog, detailId) : null
  if (!entry) return null
  const { title, kind, summary, facts, paragraphs } = describeDetail(entry, catalog)

  return (
    <aside ref={drawer} className="drawer" aria-label={`${title} details`}>
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
        {facts.map((fact) => (
          // dt and dd stay direct children of the dl: it is a two-column grid.
          <Fragment key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.text}</dd>
          </Fragment>
        ))}
      </dl>

      {summary && <p className="drawer__summary">{summary}</p>}

      <div className="drawer__text">
        {paragraphs.length > 0 ? (
          paragraphs.map((p, i) => (
            <p key={i}>
              {p.lead && <strong>{p.lead}. </strong>}
              {p.text}
            </p>
          ))
        ) : (
          <p className="muted">Full text isn't stored for this one. Read it on D&amp;D Beyond.</p>
        )}
      </div>
    </aside>
  )
}
