import { useState } from 'react'
import type { CastTime } from '@shared/types'
import { CAST_LABEL, CAST_LETTER } from '@/domain/labels'

/** The round badge on a card: A, B, R or T for the action it takes. Bonus actions are filled so they stand out. */
export function CastRoundel({ castTime }: { castTime: CastTime }): React.JSX.Element {
  return (
    <span className="roundel" data-time={castTime} title={CAST_LABEL[castTime]} aria-label={CAST_LABEL[castTime]}>
      {CAST_LETTER[castTime]}
    </span>
  )
}

interface CastButtonProps {
  /** "Cast" or "Use". */
  verb: string
  /** The small line under the verb: what it will cost, or why it can't be used. */
  detail: string | null
  disabled: boolean
  /** Flags a turn-economy warning (a second slotted spell, a second bonus action). */
  warn: boolean
  title: string | undefined
  onActivate(): void
}

/** The gilt button on a card. Each press releases a ring of light (purely visual; it never affects the action). */
export function CastButton({ verb, detail, disabled, warn, title, onActivate }: CastButtonProps): React.JSX.Element {
  const [burst, setBurst] = useState(0)
  return (
    <button
      type="button"
      className="cast-button"
      disabled={disabled}
      data-warn={warn || undefined}
      title={title}
      onClick={() => {
        onActivate()
        setBurst((n) => n + 1)
      }}
    >
      {verb}
      {detail && <span className="cast-button__level">{detail}</span>}
      {burst > 0 && <span key={burst} className="cast-burst" aria-hidden="true" onAnimationEnd={() => setBurst(0)} />}
    </button>
  )
}
