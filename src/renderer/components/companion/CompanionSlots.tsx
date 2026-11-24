import type { CSSProperties } from 'react'
import { roman } from '@/domain/derived'
import type { CompanionView } from '@/domain/companion'

/** The spell slots as cut gems, one row per level. The gems shrink as levels are added, so five rows fit where two do. */
export function SlotsPanel({ slots, slotsLeft, slotsTotal }: Pick<CompanionView, 'slots' | 'slotsLeft' | 'slotsTotal'>): React.JSX.Element {
  return (
    <section className="panel cp-slots" data-empty={slotsLeft === 0 || undefined} style={{ '--rows': Math.max(1, slots.length) } as CSSProperties} aria-label="Spell slots">
      <div className="cp-head-row">
        <h2 className="cp-title">Spell slots</h2>
        <span className="cp-count">
          {slotsLeft} of {slotsTotal} left
        </span>
      </div>
      <div className="cp-slot-rows">
        {slots.map((row) => (
          <div key={row.level} className="cp-slot-row" role="group" aria-label={`Level ${row.level}: ${row.left} of ${row.total} left`}>
            <span className="cp-slot-row__level">{roman(row.level)}</span>
            <div className="cp-slot-row__gems" aria-hidden="true">
              {Array.from({ length: row.total }, (_, gem) => (
                // Gems fill left to right, like the sheet's: only "full or spent" matters, not which gem was tapped.
                <span key={gem} className="cp-gem" data-state={gem < row.left ? 'full' : 'spent'}>
                  <i />
                </span>
              ))}
            </div>
            <span className="cp-slot-row__count" aria-hidden="true">
              {row.left}
              <small>/{row.total}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
