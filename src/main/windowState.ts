import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Where the window was last left. `x`/`y`/`width`/`height` are the NORMAL (un-maximized, windowed) frame. */
export interface WindowState extends Rect {
  maximized: boolean
  fullScreen: boolean
}

export interface WindowDefaults {
  width: number
  height: number
  minWidth: number
  minHeight: number
}

/** What to hand to `new BrowserWindow`. Without `x`/`y` Electron centres the window on the primary display. */
export interface Placement {
  x?: number
  y?: number
  width: number
  height: number
}

/** The file is a few hundred bytes; anything bigger is not ours. */
const MAX_FILE_BYTES = 16 * 1024
/** A coordinate bigger than this is garbage, not a monitor arrangement. */
const MAX_COORDINATE = 100_000
/** Below this much visible overlap the window is treated as lost off-screen (unplugged monitor, changed layout). */
const MIN_VISIBLE = { width: 120, height: 60 }

const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE

/** Validate untrusted JSON from disk. Returns null for anything that is not a complete, sane record. */
export function parseWindowState(raw: unknown): WindowState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { x, y, width, height, maximized, fullScreen } = raw as Record<string, unknown>
  if (!isCoordinate(x) || !isCoordinate(y) || !isCoordinate(width) || !isCoordinate(height)) return null
  if (width <= 0 || height <= 0) return null
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    maximized: maximized === true,
    fullScreen: fullScreen === true
  }
}

function overlapArea(a: Rect, b: Rect): { width: number; height: number } {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return { width: Math.max(0, width), height: Math.max(0, height) }
}

/** When the area is smaller than the minimum (high < low), the minimum wins. */
const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), Math.max(low, high))

/**
 * Turn a remembered frame into something safe to open: the size is kept (never below the minimum, never larger than the
 * display) and the position is kept, nudged fully into the display it mostly sits on. If it overlaps no display enough to
 * be reachable (a monitor was unplugged), the position is dropped so the window opens centred on the primary display.
 *
 * `workAreas` are the usable areas of every display (menu bar and Dock excluded).
 */
export function placeWindow(
  saved: WindowState | null,
  workAreas: readonly Rect[],
  primary: Rect,
  defaults: WindowDefaults
): Placement {
  const fit = (area: Rect, width: number, height: number): { width: number; height: number } => ({
    width: clamp(width, defaults.minWidth, area.width),
    height: clamp(height, defaults.minHeight, area.height)
  })
  if (!saved) return fit(primary, defaults.width, defaults.height)

  let best: { area: Rect; score: number } | null = null
  for (const area of workAreas) {
    const { width, height } = overlapArea(saved, area)
    if (width < MIN_VISIBLE.width || height < MIN_VISIBLE.height) continue
    if (!best || width * height > best.score) best = { area, score: width * height }
  }
  if (!best) return fit(primary, saved.width, saved.height)

  const { area } = best
  const size = fit(area, saved.width, saved.height)
  return {
    ...size,
    x: clamp(saved.x, area.x, area.x + area.width - size.width),
    y: clamp(saved.y, area.y, area.y + area.height - size.height)
  }
}

/**
 * One tiny JSON file in the profile folder. Window geometry is a view preference, so it lives beside the play state, not
 * in it: it is never undone, logged or exported, and "Reset" of the play state leaves it alone.
 *
 * Reads and writes are synchronous on purpose: the record is a few hundred bytes, the read must finish before the window
 * can be created, and the final write happens while the window is closing.
 */
export class WindowStateStore {
  private tmpCounter = 0

  constructor(private readonly file: string) {}

  /** The last saved state, or null when there is none or it is unusable. Never throws. */
  load(): WindowState | null {
    try {
      if (statSync(this.file).size > MAX_FILE_BYTES) return null
      return parseWindowState(JSON.parse(readFileSync(this.file, 'utf8')))
    } catch {
      return null
    }
  }

  /** Atomic replace (tmp file then rename), so a crash mid-write never leaves a half-written record. Throws on I/O failure. */
  save(state: WindowState): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${process.pid}.${this.tmpCounter++}.tmp`
    try {
      writeFileSync(tmp, JSON.stringify(state), 'utf8')
      renameSync(tmp, this.file)
    } catch (err) {
      rmSync(tmp, { force: true }) // a failing rename must not leave an orphan on every retry
      throw err
    }
  }
}
