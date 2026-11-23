import { describe, expect, it } from 'vitest'
import { tabIndexForKey } from './tabs'

describe('tabIndexForKey', () => {
  it('steps with the arrows and wraps at both ends', () => {
    expect(tabIndexForKey('ArrowRight', 0, 2)).toBe(1)
    expect(tabIndexForKey('ArrowRight', 1, 2)).toBe(0)
    expect(tabIndexForKey('ArrowLeft', 0, 2)).toBe(1)
    expect(tabIndexForKey('ArrowLeft', 2, 3)).toBe(1)
  })

  it('Home and End jump to the ends', () => {
    expect(tabIndexForKey('Home', 2, 3)).toBe(0)
    expect(tabIndexForKey('End', 0, 3)).toBe(2)
  })

  it('leaves every other key alone', () => {
    expect(tabIndexForKey('Enter', 0, 2)).toBeNull()
    expect(tabIndexForKey('a', 0, 2)).toBeNull()
  })
})
