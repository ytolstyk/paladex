import { INSPIRATION_DICE } from '@shared/constants'
import { selectInspiration } from '@/state/selectors'
import { startInspirationRoll } from '@/state/rolls'
import { usePlayStore } from '@/state/session'
import { DieFace } from './Die'

/**
 * Bardic Inspiration a Bard has given this character: a die to add to one d20 roll. It sits at the top of the rail so it is
 * hard to forget. Receive it, pick the size of the die the Bard gave, and spend it when you roll: "Roll it" throws the die in the
 * dice tray and spends it, "Use it" spends it when the die was rolled at the table. A rest ends it.
 */
export function InspirationDie(): React.JSX.Element {
  const { held, die } = usePlayStore(selectInspiration)
  const setHeld = usePlayStore((s) => s.setInspirationHeld)
  const setDie = usePlayStore((s) => s.setInspirationDie)

  return (
    <div className="inspiration" data-held={held || undefined} role="group" aria-label="Bardic Inspiration">
      <DieFace size={die} held={held} />
      <h3 className="inspiration__title">Bardic Inspiration</h3>
      <div className="inspiration__sizes" role="group" aria-label="Die size">
        {INSPIRATION_DICE.map((size) => (
          <button
            key={size}
            type="button"
            className="step"
            aria-pressed={size === die}
            aria-label={`d${size}`}
            title={`The Bard's die is a d${size}`}
            onClick={() => setDie(size)}
          >
            {size}
          </button>
        ))}
      </div>
      <div className="inspiration__actions">
        {held && (
          <button type="button" className="btn inspiration__button inspiration__button--roll" onClick={startInspirationRoll} title={`Roll the d${die} and spend it`}>
            Roll it
          </button>
        )}
        <button type="button" className="btn inspiration__button" onClick={() => setHeld(!held)}>
          {held ? 'Use it' : 'Receive'}
        </button>
      </div>
    </div>
  )
}
