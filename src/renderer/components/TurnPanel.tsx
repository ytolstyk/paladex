import { selectConcentration } from '@/state/selectors'
import { catalog, usePlayStore } from '@/state/session'
import { HourglassIcon, RuneRing } from './Ornaments'

/**
 * What you have spent this turn. Rules (2024): one spell slot per turn, and one bonus action per turn.
 * Both are soft hints: nothing is hidden or blocked, because the table's ruling wins.
 */
export function TurnPanel(): React.JSX.Element {
  const concentration = usePlayStore(selectConcentration)
  const turn = usePlayStore((s) => s.play?.turn)
  const dropConcentration = usePlayStore((s) => s.dropConcentration)
  const newTurn = usePlayStore((s) => s.newTurn)
  const slotSpent = turn?.slotSpellCast ?? false
  const bonusSpent = turn?.bonusActionSpent ?? false
  const casts = turn?.castsSinceNewTurn ?? 0

  return (
    <section className="panel" aria-label="This turn">
      <h2 className="panel__title">
        <HourglassIcon />
        This turn
      </h2>
      <div className="turn-line" data-active={concentration ? true : undefined}>
        {concentration ? (
          <>
            <span className="turn-line__concentrating">
              <RuneRing />
              <span>
                Concentrating on <strong>{catalog.nameOf(concentration)}</strong>
              </span>
            </span>
            <button type="button" className="link-button" onClick={dropConcentration}>
              Drop
            </button>
          </>
        ) : (
          <span className="muted">Not concentrating</span>
        )}
      </div>
      <div className="turn-line" data-active={slotSpent ? true : undefined}>
        {slotSpent ? (
          <span>
            Spell slot spent
            <span className="muted turn-line__age">One slotted spell per turn. Cantrips and free casts are still fine.</span>
          </span>
        ) : (
          <span className="muted">Spell slot free</span>
        )}
      </div>
      <div className="turn-line" data-active={bonusSpent ? true : undefined}>
        {bonusSpent ? (
          <span>
            Bonus action spent
            <span className="muted turn-line__age">
              {casts} {casts === 1 ? 'cast' : 'casts'} since new turn
            </span>
          </span>
        ) : (
          <span className="muted">Bonus action free</span>
        )}
        <button type="button" className="link-button" onClick={newTurn} title="Start a new turn (N)">
          New turn
        </button>
      </div>
    </section>
  )
}
