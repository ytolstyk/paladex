import { describe, expect, it } from 'vitest'
import { INITIATIVE_MAX, INITIATIVE_MIN } from '@shared/constants'
import { angleFor, appendDigit, arcPath, clampInitiative, isMajorTick, pointerAngle, polar, stepInitiative, valueAt, valueForKey } from './dial'

describe('angle and value', () => {
  it('puts 1 and 25 at the ends of a 300 degree sweep and 13 straight up', () => {
    expect(angleFor(1)).toBe(-150)
    expect(angleFor(25)).toBe(150)
    expect(angleFor(13)).toBe(0)
  })

  it('round-trips every value on the dial', () => {
    for (let v = INITIATIVE_MIN; v <= INITIATIVE_MAX; v++) expect(valueAt(angleFor(v))).toBe(v)
  })

  it('snaps a pointer between two ticks to the nearer one', () => {
    expect(valueAt(angleFor(10) + 5)).toBe(10) // 12.5 degrees per step, so 5 is under half a step
    expect(valueAt(angleFor(10) + 7)).toBe(11)
  })

  it('snaps the open gap at the bottom to the end on the same side', () => {
    expect(valueAt(-170)).toBe(INITIATIVE_MIN)
    expect(valueAt(170)).toBe(INITIATIVE_MAX)
    expect(valueAt(180)).toBe(INITIATIVE_MIN) // dead centre of the gap: any answer is fine as long as it is on the dial
    expect(valueAt(-179.9)).toBe(INITIATIVE_MIN)
  })

  it('treats angles outside one turn the same as their equivalent', () => {
    expect(valueAt(360)).toBe(13)
    expect(valueAt(-360 + 30)).toBe(valueAt(30))
  })

  it('clamps and rounds values', () => {
    expect(clampInitiative(0)).toBe(1)
    expect(clampInitiative(99)).toBe(25)
    expect(clampInitiative(7.6)).toBe(8)
  })
})

describe('pointerAngle', () => {
  it('is 0 straight up and grows clockwise', () => {
    expect(pointerAngle(0, -10)).toBeCloseTo(0)
    expect(pointerAngle(10, 0)).toBeCloseTo(90)
    expect(pointerAngle(0, 10)).toBeCloseTo(180)
    expect(pointerAngle(-10, 0)).toBeCloseTo(-90)
  })
})

describe('stepInitiative', () => {
  it('steps and stays on the dial', () => {
    expect(stepInitiative(10, 1)).toBe(11)
    expect(stepInitiative(25, 1)).toBe(25)
    expect(stepInitiative(1, -5)).toBe(1)
    expect(stepInitiative(22, 5)).toBe(25)
  })

  it('steps an unset dial from the middle', () => {
    expect(stepInitiative(null, 1)).toBe(11)
    expect(stepInitiative(null, -1)).toBe(9)
  })
})

describe('ticks and arcs', () => {
  it('numbers 1 and every fifth value', () => {
    expect([1, 2, 5, 10, 13, 20, 25].filter(isMajorTick)).toEqual([1, 5, 10, 20, 25])
  })

  it('places points clockwise from the top', () => {
    const top = polar(100, 100, 50, 0)
    expect(top.x).toBeCloseTo(100)
    expect(top.y).toBeCloseTo(50)
    const right = polar(100, 100, 50, 90)
    expect(right.x).toBeCloseTo(150)
    expect(right.y).toBeCloseTo(100)
  })

  it('draws an arc that only goes the long way round past a half turn', () => {
    expect(arcPath(100, 100, 50, -150, 0)).toContain(' 0 0 1 ') // 150 degrees: short arc
    expect(arcPath(100, 100, 50, -150, 150)).toContain(' 0 1 1 ') // 300 degrees: long arc
  })
})

describe('valueForKey', () => {
  it('steps with the arrows and by five with the page keys', () => {
    expect(valueForKey('ArrowUp', 10)).toEqual({ value: 11 })
    expect(valueForKey('ArrowRight', 10)).toEqual({ value: 11 })
    expect(valueForKey('ArrowDown', 10)).toEqual({ value: 9 })
    expect(valueForKey('ArrowLeft', 10)).toEqual({ value: 9 })
    expect(valueForKey('PageUp', 10)).toEqual({ value: 15 })
    expect(valueForKey('PageDown', 10)).toEqual({ value: 5 })
  })

  it('stays on the dial at the ends', () => {
    expect(valueForKey('ArrowUp', INITIATIVE_MAX)).toEqual({ value: INITIATIVE_MAX })
    expect(valueForKey('PageDown', 3)).toEqual({ value: INITIATIVE_MIN })
  })

  it('jumps to the ends with Home and End, and clears with Backspace or Delete', () => {
    expect(valueForKey('Home', 12)).toEqual({ value: INITIATIVE_MIN })
    expect(valueForKey('End', 12)).toEqual({ value: INITIATIVE_MAX })
    expect(valueForKey('Backspace', 12)).toEqual({ value: null })
    expect(valueForKey('Delete', null)).toEqual({ value: null })
  })

  it('steps an unset dial from the middle', () => {
    expect(valueForKey('ArrowUp', null)).toEqual({ value: 11 })
  })

  it('ignores every other key, digits included', () => {
    for (const key of ['a', 'Tab', 'Enter', 'Escape', ' ', '7']) expect(valueForKey(key, 10)).toBeNull()
  })
})

describe('appendDigit', () => {
  it('joins digits into one number', () => {
    expect(appendDigit('', '1')).toBe('1')
    expect(appendDigit('1', '7')).toBe('17')
    expect(appendDigit('2', '5')).toBe('25')
  })

  it('starts again when the number would pass the maximum', () => {
    expect(appendDigit('2', '6')).toBe('6')
    expect(appendDigit('25', '1')).toBe('1')
    expect(appendDigit('9', '9')).toBe('9')
  })

  it('lets a leading zero through, so 07 reads as 7', () => {
    expect(Number(appendDigit('0', '7'))).toBe(7)
  })
})
