import { describe, expect, it } from 'vitest'
import { healthState, hpPercent } from './vitals'

describe('hpPercent', () => {
  it('is the share of the maximum', () => {
    expect(hpPercent(26, 52)).toBe(50)
  })
  it('holds a bar to its ends', () => {
    expect(hpPercent(-4, 52)).toBe(0)
    expect(hpPercent(80, 52)).toBe(100)
  })
  it('does not divide by a zero maximum', () => {
    expect(hpPercent(5, 0)).toBe(0)
  })
})

describe('healthState', () => {
  it('names each band, on the boundaries too', () => {
    expect(healthState(52, 52)).toBe('healthy')
    expect(healthState(27, 52)).toBe('healthy')
    expect(healthState(26, 52)).toBe('bloodied') // exactly half
    expect(healthState(14, 52)).toBe('bloodied')
    expect(healthState(13, 52)).toBe('critical') // exactly a quarter
    expect(healthState(1, 52)).toBe('critical')
    expect(healthState(0, 52)).toBe('down')
    expect(healthState(-3, 52)).toBe('down')
  })
})
