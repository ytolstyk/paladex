import type { ConditionId, TurnStep } from '@shared/constants'
import type { PlayState } from '@shared/schema'
import type { Step } from './calls'

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
  /** A run of New turn presses that only tick spell timers (the turn was already clear) is one history step. */
  newTurn: 'new-turn',
  /** A mis-tap on a turn step and its undo are one history step, like a run of ± taps. */
  turnStep: (step: TurnStep): string => `turn-step:${step}`,
  /** A mis-tap on a condition chip and its correction are one history step; two different conditions never merge. */
  condition: (id: ConditionId): string => `condition:${id}`
}

export interface UndoEntry {
  /** State as it was BEFORE the action. */
  before: PlayState
  meta: UndoMeta
  /** When this entry was last extended. The coalescing window slides, so a run of taps under COALESCE_MS apart is one entry. */
  touchedAt: number
  /** What the player did, one per action (a coalesced run holds several). The history list edits these; plain Undo ignores them. */
  steps: Step[]
}

/** Thirty undo entries (a run of taps is one) is a long table session, and the snapshots share most of their memory. */
export const UNDO_LIMIT = 30
/** Two seconds: long enough to absorb a burst of ± taps, short enough not to swallow a deliberate second action. */
export const COALESCE_MS = 2000
/** A run of taps longer than this starts a new entry, which bounds what one entry holds (and what a correction replays and lists). */
export const MAX_STEPS_PER_ENTRY = 500

function canCoalesce(last: UndoEntry | undefined, meta: UndoMeta, now: number): last is UndoEntry {
  return (
    last !== undefined &&
    meta.kind === 'edit' &&
    last.meta.kind === 'edit' &&
    last.meta.key === meta.key &&
    last.steps.length < MAX_STEPS_PER_ENTRY &&
    now - last.touchedAt <= COALESCE_MS
  )
}

/**
 * Record a snapshot before applying an action. A later edit never merges into a cast, rest, toggle or new-turn.
 * The clock is injected so this stays deterministic in tests.
 */
export function pushUndo(stack: readonly UndoEntry[], before: PlayState, meta: UndoMeta, step: Step, now: number): UndoEntry[] {
  const last = stack[stack.length - 1]
  if (canCoalesce(last, meta, now)) {
    // Keep the earlier `before`; just extend the window and remember the step.
    return [...stack.slice(0, -1), { ...last, touchedAt: now, steps: [...last.steps, step] }]
  }
  return [...stack, { before, meta, touchedAt: now, steps: [step] }].slice(-UNDO_LIMIT)
}

/** Pop the latest snapshot. Returns the state to restore and the remaining stack. */
export function popUndo(stack: readonly UndoEntry[]): { restored: PlayState; stack: UndoEntry[] } | null {
  const last = stack[stack.length - 1]
  if (!last) return null
  return { restored: last.before, stack: stack.slice(0, -1) }
}
