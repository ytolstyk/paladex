import { describe, expect, it } from 'vitest'
import { placeCompanion, type DisplayInfo } from './companionPlacement'

const MAIN: DisplayInfo = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 25, width: 1920, height: 1055 } }
const TV: DisplayInfo = { id: 2, bounds: { x: 1920, y: 0, width: 3840, height: 2160 }, workArea: { x: 1920, y: 0, width: 3840, height: 2160 } }

describe('placeCompanion', () => {
  it('fills the other display when there is one', () => {
    expect(placeCompanion([MAIN, TV], 1)).toEqual({ x: 1920, y: 0, width: 3840, height: 2160, fullScreen: true })
  })

  it('stays a window on the other display when asked to', () => {
    expect(placeCompanion([MAIN, TV], 1, { preferWindowed: true })).toMatchObject({ x: 1920, width: 3840, fullScreen: false })
  })

  it('goes to the other display whichever one the sheet is on', () => {
    expect(placeCompanion([MAIN, TV], 2)).toMatchObject({ x: 0, y: 0, width: 1920, height: 1080, fullScreen: true })
  })

  it('opens an ordinary 16:9 window on a single display', () => {
    const placed = placeCompanion([MAIN], 1)
    expect(placed.fullScreen).toBe(false)
    expect(placed.width / placed.height).toBeCloseTo(16 / 9)
    expect(placed.x).toBeGreaterThanOrEqual(MAIN.workArea.x)
    expect(placed.y).toBeGreaterThanOrEqual(MAIN.workArea.y)
    expect(placed.x + placed.width).toBeLessThanOrEqual(MAIN.workArea.x + MAIN.workArea.width)
    expect(placed.y + placed.height).toBeLessThanOrEqual(MAIN.workArea.y + MAIN.workArea.height)
  })

  it('shrinks to fit a small screen', () => {
    const small: DisplayInfo = { id: 1, bounds: { x: 0, y: 0, width: 1024, height: 600 }, workArea: { x: 0, y: 25, width: 1024, height: 575 } }
    const placed = placeCompanion([small], 1)
    expect(placed.width).toBeLessThan(1024)
    expect(placed.height).toBeLessThan(575)
    expect(placed.y + placed.height).toBeLessThanOrEqual(600)
  })

  it('still answers with no displays at all', () => {
    expect(placeCompanion([], 1).fullScreen).toBe(false)
  })
})
