import type { Intent } from '@/domain/filters'

interface ChipProps {
  pressed: boolean
  onClick(): void
  children: string
  /** Tints the pressed state to match a spell role (Hurt enemies is red, Help allies green, Utility blue). */
  tone?: Intent
  title?: string
}

/** A toggle button in a row of filters. Pressed means the filter is on. */
export function Chip({ pressed, onClick, children, tone, title }: ChipProps): React.JSX.Element {
  return (
    <button type="button" className="chip" data-tone={tone} aria-pressed={pressed} title={title} onClick={onClick}>
      {children}
    </button>
  )
}
