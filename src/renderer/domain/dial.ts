import { INITIATIVE_MAX, INITIATIVE_MIN } from '@shared/constants'
import { clamp } from './slots'

/**
 * Geometry of the initiative dial. Pure math so the dial component only draws: a value from 1 to 25 maps to an angle on a
 * 300 degree sweep, with the open 60 degrees at the bottom (where the maker's mark sits). Angles are in degrees, 0 at the
 * top (12 o'clock) and increasing clockwise, so the sweep runs from -150 (value 1) to +150 (value 25).
 */

export const DIAL_SWEEP = 300
const HALF_SWEEP = DIAL_SWEEP / 2
const STEPS = INITIATIVE_MAX - INITIATIVE_MIN
const DEGREES_PER_STEP = DIAL_SWEEP / STEPS

/** Stepping from an unset dial starts near the middle of the range (a d20 averages 10), not at an end. */
const UNSET_BASELINE = 10
/** Page Up and Page Down jump this far, which is also the spacing of the numbered ticks. */
const PAGE_STEP = 5
/** Digits typed this close together make one number ("1" then "7" is 17); a longer pause starts over. */
export const TYPING_WINDOW_MS = 900

export function clampInitiative(value: number): number {
  return clamp(Math.round(value), INITIATIVE_MIN, INITIATIVE_MAX)
}

export function angleFor(value: number): number {
  return -HALF_SWEEP + (clampInitiative(value) - INITIATIVE_MIN) * DEGREES_PER_STEP
}

/**
 * The value under a pointer at `angle`. Anything in the open gap snaps to the nearer end by side (left of the gap is 1,
 * right is 25), so dragging around the bottom never jumps from one end of the dial to the other.
 */
export function valueAt(angle: number): number {
  const wrapped = ((((angle + 180) % 360) + 360) % 360) - 180 // into [-180, 180)
  const onDial = clamp(wrapped, -HALF_SWEEP, HALF_SWEEP)
  return clampInitiative(INITIATIVE_MIN + (onDial + HALF_SWEEP) / DEGREES_PER_STEP)
}

/** The angle of a pointer position relative to the dial's centre. Screen y grows downward, hence `-dy`. */
export function pointerAngle(dx: number, dy: number): number {
  return (Math.atan2(dx, -dy) * 180) / Math.PI
}

/** Move by `delta` steps, staying on the dial. An unset dial steps from its baseline. */
export function stepInitiative(current: number | null, delta: number): number {
  return clampInitiative((current ?? UNSET_BASELINE) + delta)
}

/** Whether a tick is one of the numbered ones (1 and every fifth value). */
export function isMajorTick(value: number): boolean {
  return value === INITIATIVE_MIN || value % PAGE_STEP === 0
}

/**
 * What a non-digit key does to the dial: `{ value }` is the new initiative (null clears it), and null means the key is not
 * a dial key at all, so the caller leaves the event alone. Digits go through `appendDigit` instead.
 */
export function valueForKey(key: string, current: number | null): { value: number | null } | null {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return { value: stepInitiative(current, 1) }
    case 'ArrowDown':
    case 'ArrowLeft':
      return { value: stepInitiative(current, -1) }
    case 'PageUp':
      return { value: stepInitiative(current, PAGE_STEP) }
    case 'PageDown':
      return { value: stepInitiative(current, -PAGE_STEP) }
    case 'Home':
      return { value: INITIATIVE_MIN }
    case 'End':
      return { value: INITIATIVE_MAX }
    case 'Backspace':
    case 'Delete':
      return { value: null }
    default:
      return null
  }
}

/** Add a typed digit to the digits typed so far. A number past the maximum starts again from the new digit ("2", "6" is 6, not 26). */
export function appendDigit(typed: string, digit: string): string {
  const joined = typed + digit
  return Number(joined) > INITIATIVE_MAX ? digit : joined
}

export function polar(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180
  return { x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) }
}

const round = (n: number): number => Math.round(n * 100) / 100

/** An SVG arc along the circle of `radius`, clockwise from one angle to another (never more than the full sweep). */
export function arcPath(cx: number, cy: number, radius: number, from: number, to: number): string {
  const start = polar(cx, cy, radius, from)
  const end = polar(cx, cy, radius, to)
  const largeArc = to - from > 180 ? 1 : 0
  return `M ${round(start.x)} ${round(start.y)} A ${radius} ${radius} 0 ${largeArc} 1 ${round(end.x)} ${round(end.y)}`
}
