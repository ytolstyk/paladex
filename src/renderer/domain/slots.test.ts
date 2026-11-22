import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { clampUsed, lowestAvailableSlot, paladinSlotCapacity, slotKey, slotsRemaining } from './slots'

const reference = JSON.parse(readFileSync('data/fixtures/ddb-reference.json', 'utf8'))

describe('paladinSlotCapacity', () => {
  it('matches the DDB reference for Paladin 5 (4 first, 2 second)', () => {
    const max = paladinSlotCapacity(reference.level)
    expect(max[0]).toBe(reference.derived.slots['1'])
    expect(max[1]).toBe(reference.derived.slots['2'])
    expect(max).toHaveLength(2)
  })

  it('follows the half-caster table at key levels', () => {
    expect(paladinSlotCapacity(1)).toEqual([2])
    expect(paladinSlotCapacity(9)).toEqual([4, 3, 2])
    expect(paladinSlotCapacity(20)).toEqual([4, 3, 3, 3, 2])
  })

  it('clamps out-of-range levels', () => {
    expect(paladinSlotCapacity(0)).toEqual([2])
    expect(paladinSlotCapacity(99)).toEqual([4, 3, 3, 3, 2])
  })
})

describe('slot arithmetic', () => {
  const max = [4, 2]
  it('counts remaining slots', () => {
    expect(slotsRemaining(max, { '1': 1 }, 1)).toBe(3)
    expect(slotsRemaining(max, {}, 2)).toBe(2)
    expect(slotsRemaining(max, {}, 3)).toBe(0)
  })

  it('finds the lowest castable slot level', () => {
    expect(lowestAvailableSlot(max, {}, 1)).toBe(1)
    expect(lowestAvailableSlot(max, { '1': 4 }, 1)).toBe(2)
    expect(lowestAvailableSlot(max, { '1': 4, '2': 2 }, 1)).toBeNull()
    expect(lowestAvailableSlot(max, {}, 2)).toBe(2)
  })

  it('keys slots by stringified level', () => {
    expect(slotKey(2)).toBe('2')
  })

  it('never reports negative remaining slots', () => {
    expect(slotsRemaining(max, { '1': 9 }, 1)).toBe(0)
  })

  it('clamps persisted used counts and drops orphaned levels', () => {
    expect(clampUsed(max, { '1': 9, '2': 1, '5': 3 })).toEqual({ '1': 4, '2': 1 })
  })
})
