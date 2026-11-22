import { parseRange, RANGE_BANDS, type RangeBand } from '@/domain/range'

/** Bars lit for each band, like a signal meter: the farther the reach, the more bars. Self has no reach to measure. */
const BARS = RANGE_BANDS.length - 1
const bars = (band: RangeBand): number => RANGE_BANDS.indexOf(band)

/** The icon for how the spell reaches its target: on yourself, by touch, or across a distance. */
function RangeIcon({ band }: { band: RangeBand }): React.JSX.Element {
  return (
    <svg
      className="range__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {band === 'self' && (
        <>
          <circle cx="12" cy="7.5" r="3.4" />
          <path d="M5.2 20.5c.7-4.4 3.3-6.6 6.8-6.6s6.1 2.2 6.8 6.6" />
        </>
      )}
      {band === 'touch' && (
        <>
          {/* An open hand: four fingers and a thumb */}
          <path d="M7.5 12V6.6a1.4 1.4 0 0 1 2.8 0V11M10.3 11V4.9a1.4 1.4 0 0 1 2.8 0V11M13.1 11V5.7a1.4 1.4 0 0 1 2.8 0V12M15.9 12V8.6a1.4 1.4 0 0 1 2.8 0v5.9c0 3.6-2.4 6.5-6 6.5-2.3 0-3.7-.9-5-2.4l-3-3.4a1.5 1.5 0 0 1 2.2-1.9l1.3 1.3" />
        </>
      )}
      {(band === 'close' || band === 'mid' || band === 'far') && (
        <>
          <circle cx="5.5" cy="12" r="2.2" />
          <path d="M9.5 12h10M16 8l4 4-4 4" />
        </>
      )}
    </svg>
  )
}

/**
 * How far a spell reaches, written large: an icon, the distance in the display face, any area beside it ("30 ft area"),
 * and a meter that fills with distance so near and far read without reading the number.
 */
export function RangeBadge({ range }: { range: string }): React.JSX.Element {
  const { band, headline, area } = parseRange(range)
  const lit = bars(band)
  return (
    <span className="range" data-band={band}>
      <RangeIcon band={band} />
      <span className="sr-only">Range </span>
      <span className="range__text">
        <span className="range__head">{headline}</span>
        {area && <span className="range__area">{area} area</span>}
      </span>
      {band !== 'self' && (
        <span className="range__bars" aria-hidden="true">
          {Array.from({ length: BARS }, (_, i) => (
            <i key={i} data-lit={i < lit || undefined} />
          ))}
        </span>
      )}
    </span>
  )
}
