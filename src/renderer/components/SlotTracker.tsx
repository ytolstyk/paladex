import type { CSSProperties } from 'react'
import { roman } from '@/domain/derived'
import { slotsRemaining } from '@/domain/slots'
import { selectSlotsUsed } from '@/state/selectors'
import { catalog, usePlayStore } from '@/state/session'
import { GemIcon } from './Ornaments'

export function SlotTracker(): React.JSX.Element {
  const slotsUsed = usePlayStore(selectSlotsUsed)
  const adjustSlot = usePlayStore((s) => s.adjustSlot)

  return (
    <section className="panel slot-rail" aria-label="Spell slots">
      <h2 className="panel__title">
        <GemIcon />
        Spell slots
      </h2>
      {catalog.slotCapacity.map((total, i) => {
        const rowStart = catalog.slotCapacity.slice(0, i).reduce((sum, n) => sum + n, 0) // running gem count, for the glint stagger
        const level = i + 1
        const remaining = slotsRemaining(catalog.slotCapacity, slotsUsed, level)
        return (
          <div className="slot-row" key={level}>
            <span className="slot-row__level" title={`Level ${level}`}>
              {roman(level)}
            </span>
            <div className="slot-row__gems" role="group" aria-label={`Level ${level} slots, ${remaining} of ${total} left`}>
              {Array.from({ length: total }, (_, gem) => {
                // Gems fill left to right, so only "full or spent" matters, not which gem was tapped.
                const full = gem < remaining
                return (
                  <button
                    key={gem}
                    type="button"
                    className="gem"
                    data-state={full ? 'full' : 'spent'}
                    style={{ '--order': rowStart + gem } as CSSProperties}
                    aria-label={`Level ${level} slot ${gem + 1}: ${full ? 'available, tap to spend' : 'spent, tap to restore'}`}
                    onClick={() => adjustSlot(level, full ? 'spend' : 'restore')}
                  >
                    <span className="gem__facet" />
                  </button>
                )
              })}
            </div>
            <span className="slot-row__count">
              {remaining}/{total}
            </span>
          </div>
        )
      })}
    </section>
  )
}
