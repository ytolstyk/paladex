import { describe, expect, it } from 'vitest'
import { parseRange, RANGE_BANDS } from './range'

describe('parseRange', () => {
  it('reads self and touch', () => {
    expect(parseRange('Self')).toMatchObject({ band: 'self', reach: 0, headline: 'Self', area: null })
    expect(parseRange('Touch')).toMatchObject({ band: 'touch', reach: 5, headline: 'Touch', area: null })
  })

  it('keeps the area of a self or touch range apart from the headline', () => {
    expect(parseRange('Self (30 ft)')).toMatchObject({ band: 'self', headline: 'Self', area: '30 ft' })
    expect(parseRange('Touch (15 ft)')).toMatchObject({ band: 'touch', headline: 'Touch', area: '15 ft' })
  })

  it('bands measured ranges at 30 and 60 feet', () => {
    expect(parseRange('10 ft').band).toBe('close')
    expect(parseRange('30 ft').band).toBe('close')
    expect(parseRange('31 ft').band).toBe('mid')
    expect(parseRange('60 ft').band).toBe('mid')
    expect(parseRange('90 ft').band).toBe('far')
    expect(parseRange('60 ft')).toMatchObject({ reach: 60, headline: '60 ft' })
  })

  it('understands feet written out, thousands separators and miles', () => {
    expect(parseRange('120 feet')).toMatchObject({ band: 'far', reach: 120 })
    expect(parseRange('1,000 ft').reach).toBe(1000)
    expect(parseRange('1 mile').reach).toBe(5280)
  })

  it('puts unreadable ranges last instead of guessing', () => {
    const sight = parseRange('Sight')
    expect(sight.band).toBe('far')
    expect(sight.reach).toBeGreaterThan(parseRange('1 mile').reach)
    expect(parseRange('').headline).toBe('—')
  })

  it('orders the bands nearest first', () => {
    expect(RANGE_BANDS).toEqual(['self', 'touch', 'close', 'mid', 'far'])
  })
})
