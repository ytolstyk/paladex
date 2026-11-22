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
