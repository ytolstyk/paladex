/**
 * Spell range as data. The seed stores ranges as the sheet prints them ("Self (30 ft)", "Touch", "60 ft"); the card, the
 * range filter and the range sort all need the same reading of that text, so it is parsed in one place.
 */

export type RangeBand = 'self' | 'touch' | 'close' | 'mid' | 'far'

/** Nearest first. The order of the filter chips, the sort and the group headings. */
export const RANGE_BANDS: readonly RangeBand[] = ['self', 'touch', 'close', 'mid', 'far']

/** Edges of the ranged bands: up to 30 ft is close, up to 60 ft is mid, anything farther is far. */
export const CLOSE_FEET = 30
export const MID_FEET = 60

export const BAND_LABEL: Record<RangeBand, string> = {
  self: 'Self',
  touch: 'Touch',
  close: `Up to ${CLOSE_FEET} ft`,
  mid: `${CLOSE_FEET + 1} to ${MID_FEET} ft`,
  far: `Over ${MID_FEET} ft`
}

/** Touch is melee reach. */
const TOUCH_FEET = 5
/** Sorts anything unreadable ("Sight", "Special") after every measured range. */
const UNMEASURED_FEET = 1_000_000
const FEET_PER_MILE = 5280

export interface ParsedRange {
  band: RangeBand
  /** Distance in feet, for ordering only: self 0, touch 5, a measured range its own length. */
  reach: number
  /** What the card prints large: "Self", "Touch", "30 ft". */
  headline: string
  /** The area in parentheses, when there is one: "Self (30 ft)" is a 30 ft area around you. */
  area: string | null
}

const WITH_AREA = /^(.*?)\s*\((.*)\)\s*$/
const MEASURED = /(\d[\d,]*)\s*-?\s*(feet|foot|ft|miles?|mi)\b/i

function bandForFeet(feet: number): RangeBand {
  if (feet <= CLOSE_FEET) return 'close'
  return feet <= MID_FEET ? 'mid' : 'far'
}

// The seed has a few dozen distinct range strings and they are read on every filter, sort and card render.
const parsed = new Map<string, ParsedRange>()

export function parseRange(text: string): ParsedRange {
  const known = parsed.get(text)
  if (known) return known
  const result = parseUncached(text)
  parsed.set(text, result)
  return result
}

function parseUncached(text: string): ParsedRange {
  const trimmed = text.trim()
  const withArea = WITH_AREA.exec(trimmed)
  const headline = (withArea?.[1] ?? trimmed) || '—'
  const area = withArea?.[2]?.trim() || null
  const lower = headline.toLowerCase()

  if (lower.startsWith('self')) return { band: 'self', reach: 0, headline, area }
  if (lower.startsWith('touch')) return { band: 'touch', reach: TOUCH_FEET, headline, area }

  const measured = MEASURED.exec(headline)
  if (measured) {
    const amount = Number.parseInt((measured[1] ?? '').replace(/,/g, ''), 10)
    const feet = /^mi/i.test(measured[2] ?? '') ? amount * FEET_PER_MILE : amount
    return { band: bandForFeet(feet), reach: feet, headline, area }
  }
  return { band: 'far', reach: UNMEASURED_FEET, headline, area }
}
