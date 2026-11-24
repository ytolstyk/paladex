import { describe, expect, it } from 'vitest'
import { clampTurnSeconds, DEFAULT_TIMER_PREFS, joinTurnLength, parseTimerPrefs, splitTurnLength } from './timerPrefs'

describe('parseTimerPrefs', () => {
  it('reads a stored length', () => {
    expect(parseTimerPrefs('{"turnSeconds":60}')).toEqual({ turnSeconds: 60 })
  })

  it.each([null, '', 'nope', '[]', '{}', '{"turnSeconds":"6"}', '{"turnSeconds":null}'])('falls back to the default for %s', (raw) => {
    expect(parseTimerPrefs(raw)).toEqual(DEFAULT_TIMER_PREFS)
  })

  it('keeps a stored length in range and whole', () => {
    expect(parseTimerPrefs('{"turnSeconds":0}').turnSeconds).toBe(1)
    expect(parseTimerPrefs('{"turnSeconds":99999999}').turnSeconds).toBe(86_400)
    expect(parseTimerPrefs('{"turnSeconds":7.4}').turnSeconds).toBe(7)
  })
})

describe('clampTurnSeconds', () => {
  it('turns a non-number into the default', () => {
    expect(clampTurnSeconds(Number.NaN)).toBe(6)
    expect(clampTurnSeconds(Number.POSITIVE_INFINITY)).toBe(6)
  })
})

describe('split and join', () => {
  it.each([
    [6, 6, 'seconds'],
    [60, 1, 'minutes'],
    [600, 10, 'minutes'],
    [90, 90, 'seconds'],
    [3600, 1, 'hours']
  ] as const)('%i seconds is %i %s', (seconds, amount, unit) => {
    expect(splitTurnLength(seconds)).toEqual({ amount, unit })
    expect(joinTurnLength(amount, unit)).toBe(seconds)
  })
})
