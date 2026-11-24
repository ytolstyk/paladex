import { SECONDS_PER } from '@shared/constants'
import { plural } from './describe'

/**
 * Spell duration text -> seconds, and seconds -> the words a player uses at the table. Pure: no React, no DOM.
 *
 * A duration counts as timed only when it names a length ("1 minute", "Up to 1 hour"). "Instantaneous", "Until dispelled" and
 * "Special" have no countdown, so they return null and no timer starts.
 */

const SECONDS_PER_UNIT = { round: 6, ...SECONDS_PER } as const
type Unit = keyof typeof SECONDS_PER_UNIT

const DURATION_PATTERN = /(\d+)\s*(round|minute|hour|day)s?\b/i

/** How long a spell lasts in seconds, or null when it has no length to count down. */
export function durationSeconds(text: string): number | null {
  const match = DURATION_PATTERN.exec(text)
  if (!match) return null
  const amount = Number(match[1])
  const unit = match[2]!.toLowerCase() as Unit // the pattern only matches these four words
  const seconds = amount * SECONDS_PER_UNIT[unit]
  return seconds > 0 ? seconds : null
}

/** Turns a timer has left at this turn length. A timer that is not finished always has at least one. */
export function turnsLeft(remainingSeconds: number, turnSeconds: number): number {
  return Math.max(1, Math.ceil(remainingSeconds / turnSeconds))
}

const SPAN_UNITS = [
  { name: 'day', seconds: SECONDS_PER.day },
  { name: 'hour', seconds: SECONDS_PER.hour },
  { name: 'minute', seconds: SECONDS_PER.minute },
  { name: 'second', seconds: 1 }
] as const

/** "45 seconds", "1 minute 30 seconds", "1 hour 30 minutes", "10 days": the two largest units that are not zero, exactly (a part second counts as a second). */
export function formatSpan(seconds: number): string {
  let left = Math.max(0, Math.ceil(seconds))
  const parts: string[] = []
  for (const unit of SPAN_UNITS) {
    const count = Math.floor(left / unit.seconds)
    left -= count * unit.seconds
    if (count > 0 && parts.length < 2) parts.push(plural(count, unit.name, `${unit.name}s`))
  }
  return parts.length > 0 ? parts.join(' ') : plural(0, 'second', 'seconds')
}

/** Above this many turns a count of turns stops being useful ("600 turns left"), so the time left is shown instead. */
export const MAX_TURNS_SHOWN = 100

/** The one line a timer shows: turns while that is a small number, else the time that is left. */
export function remainingText(remainingSeconds: number, turnSeconds: number): string {
  const turns = turnsLeft(remainingSeconds, turnSeconds)
  return turns <= MAX_TURNS_SHOWN ? `${plural(turns, 'turn', 'turns')} left` : `${formatSpan(remainingSeconds)} left`
}

/** A timer this close to the end is drawn in the accent colour. */
const SOON_TURNS = 3

/** What a timer shows: the words ("7 turns left") and whether it is close enough to the end to be drawn in the accent colour. */
export function timerView(remainingSeconds: number, turnSeconds: number): { text: string; soon: boolean } {
  return { text: remainingText(remainingSeconds, turnSeconds), soon: turnsLeft(remainingSeconds, turnSeconds) <= SOON_TURNS }
}
