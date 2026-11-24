import { describe, expect, it } from 'vitest'
import { durationSeconds, formatSpan, remainingText, turnsLeft } from './duration'

describe('durationSeconds', () => {
  it.each([
    ['1 minute', 60],
    ['10 minutes', 600],
    ['1 hour', 3600],
    ['8 hours', 28_800],
    ['24 hours', 86_400],
    ['10 days', 864_000],
    ['Up to 1 minute', 60],
    ['1 round', 6]
  ])('reads %s', (text, seconds) => expect(durationSeconds(text)).toBe(seconds))

  it.each(['Instantaneous', 'Until dispelled', 'Special', '', '0 minutes'])('has no countdown for "%s"', (text) =>
    expect(durationSeconds(text)).toBeNull()
  )
})

describe('turnsLeft', () => {
  it('rounds up, and never shows less than one for a timer that is still running', () => {
    expect(turnsLeft(60, 6)).toBe(10)
    expect(turnsLeft(7, 6)).toBe(2)
    expect(turnsLeft(1, 60)).toBe(1)
  })
})

describe('formatSpan', () => {
  it.each([
    [0, '0 seconds'],
    [1, '1 second'],
    [45, '45 seconds'],
    [60, '1 minute'],
    [61, '1 minute 1 second'],
    [90, '1 minute 30 seconds'],
    [3540, '59 minutes'],
    [3599, '59 minutes 59 seconds'],
    [3600, '1 hour'],
    [5400, '1 hour 30 minutes'],
    [7199, '1 hour 59 minutes'],
    [86_400, '1 day'],
    [90_000, '1 day 1 hour'],
    [864_000, '10 days'],
    [0.2, '1 second']
  ])('%s seconds is %s', (seconds, text) => expect(formatSpan(seconds)).toBe(text))
})

describe('remainingText', () => {
  it('counts turns while that is a small number', () => {
    expect(remainingText(60, 6)).toBe('10 turns left')
    expect(remainingText(6, 6)).toBe('1 turn left')
  })

  it('switches to the time left once the turn count stops being useful', () => {
    expect(remainingText(3600, 6)).toBe('1 hour left')
    expect(remainingText(3600, 600)).toBe('6 turns left')
  })
})
