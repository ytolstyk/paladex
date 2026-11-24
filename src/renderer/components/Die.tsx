import type { InspirationDie } from '@shared/constants'
import { D20 } from '@/domain/dice'

/** The dice that are drawn: the Bard's die sizes, and the d20 the tray rolls for initiative. */
export type DieSides = InspirationDie | typeof D20

/** Outline and facets of each die, drawn in a 64 x 64 box. Decorative: the size is also written out in text. */
const DIE_SHAPES: Record<DieSides, { outline: string; facets: string }> = {
  6: { outline: 'M32 4 56 18v28L32 60 8 46V18z', facets: 'M8 18l24 14 24-14M32 32v28' },
  8: { outline: 'M32 3 58 32 32 61 6 32z', facets: 'M6 32h52M32 3 18 32l14 29 14-29z' },
  10: { outline: 'M32 3 57 24 32 61 7 24z', facets: 'M7 24l25 9 25-9M32 3v30M32 33v28' },
  12: {
    outline: 'M32 3 59 23 49 55H15L5 23z',
    facets: 'M32 17 46 27 41 44H23L18 27zM32 3v14M59 23 46 27M49 55 41 44M15 55l8-11M5 23l13 4'
  },
  20: {
    outline: 'M32 3 57 17.5v29L32 61 7 46.5v-29z',
    facets: 'M32 3v11M7 17.5 32 14l25 3.5M32 14 15 43.5h34zM7 17.5l8 26-8 3M57 17.5l-8 26 8 3M7 46.5l8-3 17 17.5 17-17.5 8 3'
  }
}

interface DieFaceProps {
  size: DieSides
  /** Lit, as the Bard's die is while it is held. */
  held?: boolean
  /** What the face says: "d8" by default, or the number it landed on. */
  label?: string | number
  className?: string
}

/** One die, drawn in the palette's colours. The face's text is for sight only; callers say the value in words as well. */
export function DieFace({ size, held = false, label, className }: DieFaceProps): React.JSX.Element {
  const shape = DIE_SHAPES[size]
  return (
    <svg className={className ? `die ${className}` : 'die'} data-held={held || undefined} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path className="die__body" d={shape.outline} />
      <path className="die__facets" d={shape.facets} />
      <text className="die__label" x="32" y="33" textAnchor="middle" dominantBaseline="central">
        {label ?? `d${size}`}
      </text>
    </svg>
  )
}
