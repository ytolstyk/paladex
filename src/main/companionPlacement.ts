import type { Rect } from './windowState'

export interface DisplayInfo {
  id: number
  bounds: Rect
  workArea: Rect
}

export interface CompanionPlacement extends Rect {
  /** True when there is another screen: the companion fills it, as a wall display or projector would. */
  fullScreen: boolean
}

/** The size of the companion when it opens in a window on the same screen as the sheet (16:9, so the layout meets no letterbox). */
const WINDOWED = { width: 1280, height: 720 }
/** Stay this far inside the work area so the window's title bar is never off screen. */
const MARGIN = 40
/** The smallest the companion window may be dragged to (16:9). */
export const COMPANION_MIN = { width: 480, height: 270 }

/**
 * Where the companion window opens. With a second display it goes there, full screen: the whole point is to be read from across the
 * table. With only one it is an ordinary window beside the sheet that the player can drag, resize or send full screen by hand.
 * `mainDisplayId` is the display the sheet is on; with several others the first one that is not it wins.
 */
export function placeCompanion(displays: readonly DisplayInfo[], mainDisplayId: number, { preferWindowed = false } = {}): CompanionPlacement {
  const other = displays.find((d) => d.id !== mainDisplayId)
  if (other) return { ...other.bounds, fullScreen: !preferWindowed }

  const area = (displays.find((d) => d.id === mainDisplayId) ?? displays[0])?.workArea ?? { x: 0, y: 0, ...WINDOWED }
  const width = Math.min(WINDOWED.width, Math.max(1, area.width - MARGIN))
  const height = Math.min(WINDOWED.height, Math.max(1, area.height - MARGIN))
  return {
    x: Math.round(area.x + (area.width - width) / 2) + MARGIN / 2,
    y: Math.round(area.y + (area.height - height) / 2) + MARGIN / 2,
    width,
    height,
    fullScreen: false
  }
}
