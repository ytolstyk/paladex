import { DEFAULT_TURN_SECONDS, SECONDS_PER, TURN_SECONDS_MAX, TURN_SECONDS_MIN } from '@shared/constants'

/**
 * The turn length for spell timers: how much game time one "New turn" takes off every running timer. A view preference like the
 * theme (localStorage, never in the play state). It is only read at the moment of a tick or a display, so changing it never
 * rewrites a running timer: those are kept in seconds.
 */
export interface TimerPrefs {
  turnSeconds: number
}

/** Far more than the one number stored; anything longer is not ours. */
const MAX_STORED_CHARS = 200

export const DEFAULT_TIMER_PREFS: TimerPrefs = { turnSeconds: DEFAULT_TURN_SECONDS }

/** A whole number of seconds in range. A fraction would make "turns left" jitter, and 0 would make a timer never move. */
export function clampTurnSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TURN_SECONDS
  return Math.min(TURN_SECONDS_MAX, Math.max(TURN_SECONDS_MIN, Math.round(value)))
}

/** Reads what was stored. Anything unreadable gives the defaults rather than an error. */
export function parseTimerPrefs(raw: string | null): TimerPrefs {
  if (!raw || raw.length > MAX_STORED_CHARS) return DEFAULT_TIMER_PREFS
  try {
    const parsed: unknown = JSON.parse(raw)
    // Only `turnSeconds` is read, and it is type-checked below, so the shape claimed here is never trusted.
    const seconds = typeof parsed === 'object' && parsed !== null ? (parsed as { turnSeconds?: unknown }).turnSeconds : undefined
    return typeof seconds === 'number' ? { turnSeconds: clampTurnSeconds(seconds) } : DEFAULT_TIMER_PREFS
  } catch {
    return DEFAULT_TIMER_PREFS
  }
}

export const TURN_UNITS = [
  { id: 'seconds', label: 'seconds', seconds: 1 },
  { id: 'minutes', label: 'minutes', seconds: SECONDS_PER.minute },
  { id: 'hours', label: 'hours', seconds: SECONDS_PER.hour }
] as const
export type TurnUnitId = (typeof TURN_UNITS)[number]['id']

/** The largest unit that divides the length evenly, so 600 shows as "10 minutes" and 90 as "90 seconds". */
export function splitTurnLength(seconds: number): { amount: number; unit: TurnUnitId } {
  const unit = [...TURN_UNITS].reverse().find((u) => seconds % u.seconds === 0) ?? TURN_UNITS[0]
  return { amount: seconds / unit.seconds, unit: unit.id }
}

export function joinTurnLength(amount: number, unit: TurnUnitId): number {
  const seconds = TURN_UNITS.find((u) => u.id === unit)?.seconds ?? 1
  return clampTurnSeconds(amount * seconds)
}
