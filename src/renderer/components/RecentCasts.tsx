import { memo, useMemo, useState } from 'react'
import { castHistory, recentUses, type HistoryRow, type UseRecord } from '@/domain/recent'
import { paymentLabel } from '@/domain/labels'
import { catalog, usePlayStore } from '@/state/session'
import { useUiStore } from '@/state/uiStore'

const RECENT_COUNT = 6
const HISTORY_COUNT = 40

const known = (id: string): boolean => catalog.spellById(id) !== undefined || catalog.featureById(id) !== undefined
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** How a cast was paid for, in a few words: "level II", "free cast", "item charge". A feature shows the amount of a pool. */
function howText(use: UseRecord): string {
  if (use.kind === 'feature') return use.amount && use.amount > 1 ? `${use.amount} spent` : ''
  if (use.via === 'slot') return use.level ? paymentLabel({ kind: 'slot', level: use.level }) : 'slot'
  if (use.via === 'free' || use.via === 'charge') return paymentLabel({ kind: use.via, counterId: '' })
  return ''
}

const HistoryItem = memo(function HistoryItem({ row }: { row: HistoryRow }): React.JSX.Element | null {
  if (row.kind === 'break') {
    return (
      <li className="history__break" aria-label={row.label}>
        {row.label}
      </li>
    )
  }
  // A hand-edited save can hold a time no clock can show; skip that row rather than throw while drawing the page.
  const when = new Date(row.t)
  if (Number.isNaN(when.getTime())) return null
  const how = howText(row.use)
  return (
    <li className="history__use">
      <time className="muted history__time" dateTime={when.toISOString()}>
        {clock.format(when)}
      </time>
      <span className="history__name">{catalog.nameOf(row.use.id)}</span>
      {how && <span className="muted history__how">{how}</span>}
    </li>
  )
})

const rowKey = (row: HistoryRow): string => (row.kind === 'use' ? `${row.t}:${row.use.id}` : `${row.t}:${row.label}`)

/**
 * The last few different spells and features used, as chips (a press opens the details), and the longer history below them. Both
 * are read from the action log, so they follow Undo and add nothing to the save. The log keeps its newest 200 entries, so the
 * history reaches back about one session.
 */
export function RecentCasts(): React.JSX.Element | null {
  const log = usePlayStore((s) => s.play?.log)
  const openDetail = useUiStore((s) => s.openDetail)
  const recent = useMemo(() => (log ? recentUses(log, RECENT_COUNT * 2).filter((u) => known(u.id)).slice(0, RECENT_COUNT) : []), [log])
  // The list is built only while it is open: most of the time it is closed, and a cast must not pay for forty hidden rows.
  const [historyOpen, setHistoryOpen] = useState(false)
  const rows = useMemo(() => (log && historyOpen ? castHistory(log, HISTORY_COUNT) : []), [log, historyOpen])
  if (recent.length === 0) return null

  return (
    <section className="recent" aria-label="Recently cast">
      <div className="recent__row">
        <h3 className="recent__title">Recently cast</h3>
        <div className="chips">
          {recent.map((use) => (
            <button
              key={use.id}
              type="button"
              className="chip recent-chip"
              title={`Show details for ${catalog.nameOf(use.id)}`}
              onClick={() => openDetail(use.id)}
            >
              {catalog.nameOf(use.id)}
            </button>
          ))}
        </div>
      </div>
      <details className="history" onToggle={(e) => setHistoryOpen(e.currentTarget.open)}>
        <summary>History</summary>
        <ol className="history__list">
          {rows.map((row) => (
            <HistoryItem key={rowKey(row)} row={row} />
          ))}
        </ol>
      </details>
    </section>
  )
}
