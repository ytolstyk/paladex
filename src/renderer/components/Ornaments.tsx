/**
 * Small heraldic graphics, drawn inline so they work offline under the strict CSP and take their colour from the
 * current theme (`currentColor`). All are decorative: hidden from assistive technology.
 */

interface IconProps {
  className?: string
}

const RUNE_TICK_ANGLES = Array.from({ length: 12 }, (_, i) => i * 30)

const ICON_SVG = {
  viewBox: '0 0 24 24',
  width: 18,
  height: 18,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
  'aria-hidden': true,
  focusable: false
} as const

/** A cut gem: the spell slots. */
export function GemIcon({ className }: IconProps): React.JSX.Element {
  return (
    <svg {...ICON_SVG} className={className}>
      <path d="M12 2.5 20 8v8l-8 5.5L4 16V8z" />
      <path d="M4 8l8 3.2L20 8M12 11.2v10.3M8 5.2 12 11.2l4-6" strokeWidth={1.1} />
    </svg>
  )
}

/** An hourglass: this turn. */
export function HourglassIcon({ className }: IconProps): React.JSX.Element {
  return (
    <svg {...ICON_SVG} className={className}>
      <path d="M6 3h12M6 21h12M7 3c0 5 3.2 6.2 5 9-1.8 2.8-5 4-5 9M17 3c0 5-3.2 6.2-5 9 1.8 2.8 5 4 5 9" />
      <path d="M9.5 19h5l-2.5-3z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** A heater shield: resources. */
export function ShieldIcon({ className }: IconProps): React.JSX.Element {
  return (
    <svg {...ICON_SVG} className={className}>
      <path d="M12 2.8 19.5 5v6.2c0 4.6-3.2 8-7.5 10-4.3-2-7.5-5.4-7.5-10V5z" />
      <path d="M12 6.5v11M7.6 10.5h8.8" strokeWidth={1.2} />
    </svg>
  )
}

/** A ring with a mark through it: conditions. */
export function ConditionIcon({ className }: IconProps): React.JSX.Element {
  return (
    <svg {...ICON_SVG} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5" strokeWidth={1.6} />
      <circle cx="12" cy="16.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * A ring of runes. It turns slowly (`.rune-ring` in app.css) while the paladin is concentrating: a quiet
 * "something is held" cue beside the text.
 */
export function RuneRing(): React.JSX.Element {
  return (
    <svg {...ICON_SVG} className="rune-ring" strokeWidth={1.2}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6.6" strokeDasharray="1.6 2.2" />
      {RUNE_TICK_ANGLES.map((deg) => (
        <path key={deg} d="M12 2v2.2" transform={`rotate(${deg} 12 12)`} />
      ))}
      <path d="M12 8.2 13.1 10.9 15.8 12 13.1 13.1 12 15.8 10.9 13.1 8.2 12 10.9 10.9z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** A rule with a lozenge in the middle, to close a heading or part a page. */
export function Flourish({ className }: IconProps): React.JSX.Element {
  return (
    <div className={className ? `flourish ${className}` : 'flourish'} aria-hidden="true">
      <i />
    </div>
  )
}
