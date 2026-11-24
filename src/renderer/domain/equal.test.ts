import { describe, expect, it } from 'vitest'
import { sameValue } from './equal'

describe('sameValue', () => {
  it('compares plain data by value, whatever the key order', () => {
    expect(sameValue({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true)
    expect(sameValue({ a: [1, 2] }, { a: [1, 3] })).toBe(false)
    expect(sameValue([1, 2], [1, 2, 3])).toBe(false)
    expect(sameValue([], {})).toBe(false)
    expect(sameValue(null, {})).toBe(false)
  })

  it('treats a missing key and an undefined one as the same, on either side', () => {
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(sameValue({ a: 1 }, { a: 1, b: undefined })).toBe(true)
    expect(sameValue({ a: 1 }, { a: 1, b: 0 })).toBe(false)
  })
})
