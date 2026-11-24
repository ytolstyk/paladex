import { describe, expect, it } from 'vitest'
import { describeRoll, naturalOf, rollDie, rollInitiative, rollInspiration, secureRand, wasClamped, type Rand } from './dice'

/** A random source that returns the given numbers in turn. */
const feed = (...values: number[]): Rand => {
  let i = 0
  return () => values[i++ % values.length] ?? 0
}
/** The number in [0, 1) that makes a die of `sides` show `face`. */
const forFace = (face: number, sides: number): number => (face - 0.5) / sides

describe('rollDie', () => {
  it('maps [0, 1) onto 1..sides evenly', () => {
    expect(rollDie(20, () => 0)).toBe(1)
    expect(rollDie(20, () => 0.999999)).toBe(20)
    expect(rollDie(6, () => 0.5)).toBe(4)
  })
  it('never exceeds the die, even for a source that returns exactly 1', () => {
    expect(rollDie(8, () => 1)).toBe(8)
  })
  it('covers every face of a d20 with the real source and stays in range', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 4000; i++) {
      const face = rollDie(20, secureRand)
      expect(face).toBeGreaterThanOrEqual(1)
      expect(face).toBeLessThanOrEqual(20)
      seen.add(face)
    }
    expect(seen.size).toBe(20)
  })
})

describe('rollInitiative', () => {
  it('adds the modifier to one d20', () => {
    const roll = rollInitiative(1, 'normal', feed(forFace(14, 20)))
    expect(roll).toMatchObject({ dice: [14], kept: 14, modifier: 1, total: 15, result: 15 })
  })
  it('keeps the higher die with Advantage and the lower with Disadvantage', () => {
    const rand = () => feed(forFace(14, 20), forFace(6, 20))
    expect(rollInitiative(0, 'advantage', rand())).toMatchObject({ dice: [14, 6], kept: 14 })
    expect(rollInitiative(0, 'disadvantage', rand())).toMatchObject({ dice: [14, 6], kept: 6 })
  })
  it('holds the result to the dial and says so', () => {
    const high = rollInitiative(5, 'normal', feed(forFace(20, 20)))
    expect(high).toMatchObject({ total: 25, result: 25 })
    expect(wasClamped(high)).toBe(false)
    const over = rollInitiative(7, 'normal', feed(forFace(20, 20)))
    expect(over).toMatchObject({ total: 27, result: 25 })
    expect(wasClamped(over)).toBe(true)
    const under = rollInitiative(-3, 'normal', feed(forFace(2, 20)))
    expect(under).toMatchObject({ total: -1, result: 1 })
    expect(wasClamped(under)).toBe(true)
  })
})

describe('rollInspiration', () => {
  it('rolls the size it is given', () => {
    expect(rollInspiration(8, feed(forFace(5, 8)))).toEqual({ kind: 'inspiration', sides: 8, value: 5 })
    expect(rollInspiration(12, feed(0.9999)).value).toBe(12)
  })
})

describe('naturalOf and describeRoll', () => {
  it('marks a natural 20 and a natural 1 on the die that counts', () => {
    expect(naturalOf(rollInitiative(0, 'normal', feed(forFace(20, 20))))).toBe('twenty')
    expect(naturalOf(rollInitiative(0, 'normal', feed(forFace(1, 20))))).toBe('one')
    expect(naturalOf(rollInitiative(0, 'normal', feed(forFace(9, 20))))).toBeNull()
    // The 1 was thrown but the 18 counts.
    expect(naturalOf(rollInitiative(0, 'advantage', feed(forFace(1, 20), forFace(18, 20))))).toBeNull()
    expect(naturalOf(rollInspiration(6, feed(0.99)))).toBeNull()
  })
  it('writes the sum out', () => {
    expect(describeRoll(rollInitiative(1, 'normal', feed(forFace(14, 20))))).toBe('Initiative: 14 + 1 = 15')
    expect(describeRoll(rollInitiative(-1, 'normal', feed(forFace(14, 20))))).toBe('Initiative: 14 - 1 = 13')
    expect(describeRoll(rollInitiative(2, 'advantage', feed(forFace(14, 20), forFace(6, 20))))).toBe(
      'Initiative, Advantage (14 and 6): 14 + 2 = 16'
    )
    expect(describeRoll(rollInspiration(8, feed(forFace(5, 8))))).toBe('Bardic Inspiration d8: 5')
  })
})
