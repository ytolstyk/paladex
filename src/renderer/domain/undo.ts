import type { TurnStep } from '@shared/constants'
import type { PlayState } from '@shared/schema'

/**
 * `edit` = a manual ± / tap correction of one field; consecutive edits of the same `key` coalesce.
 * Everything else is a discrete step that never merges with anything.
 */
export type UndoMeta = { kind: 'edit'; key: string } | { kind: 'cast' | 'rest' | 'toggle' | 'turn' }

export const undoKey = {
  slot: (level: number): string => `slot:${level}`,
  counter: (id: string): string => `counter:${id}`,
  hp: 'hp',
  initiative: 'initiative',
  inspirationDie: 'inspiration-die',
  /** A mis-tap on a turn step and its undo are one history step, like a run of ± taps. */
  turnStep: (step: TurnStep): string => `turn-step:${step}`
}

export interface UndoEntry {
  /** State as it was BEFORE the action. */
  before: PlayState
  meta: UndoMeta
  /** When this step was last extended. The coalescing window slides, so a run of taps under COALESCE_MS apart is one step. */
  touchedAt: number
}

/** Ten steps is plenty for a table session and keeps memory trivial. */
export const UNDO_LIMIT = 10
/** Two seconds: long enough to absorb a burst of ± taps, short enough not to swallow a deliberate second action. */
export const COALESCE_MS = 2000

function canCoalesce(last: UndoEntry | undefined, meta: UndoMeta, now: number): last is UndoEntry {
  return (
    last !== undefined &&
    meta.kind === 'edit' &&
    last.meta.kind === 'edit' &&
    last.meta.key === meta.key &&
    now - last.touchedAt <= COALESCE_MS
  )
}

/**
 * Record a snapshot before applying an action. A later edit never merges into a cast, rest, toggle or new-turn.
 * The clock is injected so this stays deterministic in tests.
 */
export function pushUndo(stack: readonly UndoEntry[], before: PlayState, meta: UndoMeta, now: number): UndoEntry[] {
  const last = stack[stack.length - 1]
  if (canCoalesce(last, meta, now)) {
    // Keep the earlier `before`; just extend the window.
    return [...stack.slice(0, -1), { ...last, touchedAt: now }]
  }
  return [...stack, { before, meta, touchedAt: now }].slice(-UNDO_LIMIT)
}

/** Pop the latest snapshot. Returns the state to restore and the remaining stack. */
export function popUndo(stack: readonly UndoEntry[]): { restored: PlayState; stack: UndoEntry[] } | null {
  const last = stack[stack.length - 1]
  if (!last) return null
  return { restored: last.before, stack: stack.slice(0, -1) }
}
