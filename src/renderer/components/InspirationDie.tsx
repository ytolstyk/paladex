import { INSPIRATION_DICE, type InspirationDie as DieSize } from '@shared/constants'
import { selectInspiration } from '@/state/selectors'
import { usePlayStore } from '@/state/session'

/** Outline and facets of each die, drawn in a 64 x 64 box. Decorative: the size is also written out in text. */
const DIE_SHAPES: Record<DieSize, { outline: string; facets: string }> = {
  6: { outline: 'M32 4 56 18v28L32 60 8 46V18z', facets: 'M8 18l24 14 24-14M32 32v28' },
  8: { outline: 'M32 3 58 32 32 61 6 32z', facets: 'M6 32h52M32 3 18 32l14 29 14-29z' },
  10: { outline: 'M32 3 57 24 32 61 7 24z', facets: 'M7 24l25 9 25-9M32 3v30M32 33v28' },
  12: {
    outline: 'M32 3 59 23 49 55H15L5 23z',
    facets: 'M32 17 46 27 41 44H23L18 27zM32 3v14M59 23 46 27M49 55 41 44M15 55l8-11M5 23l13 4'
  }
}

function DieFace({ size, held }: { size: DieSize; held: boolean }): React.JSX.Element {
  const shape = DIE_SHAPES[size]
  return (
    <svg className="die" data-held={held || undefined} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path className="die__body" d={shape.outline} />
      <path className="die__facets" d={shape.facets} />
      <text className="die__label" x="32" y="33" textAnchor="middle" dominantBaseline="central">
        d{size}
      </text>
    </svg>
  )
}

/**
 * Bardic Inspiration a Bard has given this character: a die to add to one d20 roll. It sits at the top of the rail so it is
 * hard to forget. Receive it, pick the size of the die the Bard gave, and spend it when you roll. A rest ends it.
 */
export function InspirationDie(): React.JSX.Element {
  const { held, die } = usePlayStore(selectInspiration)
  const setHeld = usePlayStore((s) => s.setInspirationHeld)
  const setDie = usePlayStore((s) => s.setInspirationDie)

  return (
    <div className="inspiration" data-held={held || undefined} role="group" aria-label="Bardic Inspiration">
      <DieFace size={die} held={held} />
      <h3 className="inspiration__title">Bardic Inspiration</h3>
      <p className="inspiration__status" aria-live="polite">
        {held ? `Add a d${die} to one d20 roll` : 'Not held'}
      </p>
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
      <button type="button" className="btn inspiration__button" onClick={() => setHeld(!held)}>
        {held ? 'Use it' : 'Receive'}
      </button>
    </div>
  )
}
