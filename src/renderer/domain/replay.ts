import type { PlayState } from '@shared/schema'
import type { Catalog } from './catalog'
import { sameValue } from './equal'
import { dropReason, runCall, type Call, type DropReason, type Step } from './steps'
import { pushUndo, type UndoEntry } from './undo'

/**
 * Correcting the history. The undo stack remembers what the player did (`Step`s), so a correction runs the steps again from the
 * oldest remembered state with one of them taken out, changed, or everything from it on left off. Steps are named by id: a replay keeps
 * them, and a position in the list would move under an open preview.
 */
export type HistoryChange =
  /** Take this step out; the later ones are run again without it. */
  | { kind: 'remove'; stepId: number }
  /** Run this step with another call (a different amount or level). It must still work. */
  | { kind: 'edit'; stepId: number; call: Call }
  /** The state before this step: it and everything after it are undone. */
  | { kind: 'revert'; stepId: number }

export interface DroppedStep {
  step: Step
  reason: DropReason
}

/**
 * `step-gone`: the target is not in the stack (undone or trimmed since the preview). `target-failed`: the edited step itself could not run;
 * the change is refused, never turned into something else.
 */
export type ReplayStatus = 'ok' | 'step-gone' | 'target-failed'

export interface Replayed {
  status: ReplayStatus
  state: PlayState
  stack: UndoEntry[]
  /** Steps that did nothing this time. */
  dropped: DroppedStep[]
  /** Steps that happened differently (their log line reads differently now). */
  changed: Step[]
  /** Steps that no longer fit in the undo list (its size is capped). */
  trimmed: number
}

export const stepsOf = (stack: readonly UndoEntry[]): Step[] => stack.flatMap((entry) => entry.steps)

interface PlannedStep {
  original: Step
  call: Call
  isTarget: boolean
}

/** The steps to run, in order: the stack's own, with the change applied. */
function plan(all: readonly Step[], change: HistoryChange | null): PlannedStep[] {
  const planned: PlannedStep[] = []
  for (const original of all) {
    const isTarget = change !== null && change.stepId === original.id
    if (isTarget && change.kind === 'revert') break
    if (isTarget && change.kind === 'remove') continue
    planned.push({ original, call: isTarget && change.kind === 'edit' ? change.call : original.call, isTarget })
  }
  return planned
}

/**
 * Run the remembered steps again from the oldest state in the stack, with `change` applied (or none). Pure: the same stack and
 * catalog give the same result, since every step carries its own time and turn length. Returns null on an empty stack.
 * The stack is rebuilt through `pushUndo`, so runs of taps coalesce exactly as they do in live play.
 */
export function replay(stack: readonly UndoEntry[], catalog: Catalog, change: HistoryChange | null): Replayed | null {
  const first = stack[0]
  if (!first) return null
  const all = stepsOf(stack)

  let state = first.before
  let rebuilt: UndoEntry[] = []
  const dropped: DroppedStep[] = []
  const changed: Step[] = []
  let ran = 0
  let status: ReplayStatus = change !== null && !all.some((s) => s.id === change.stepId) ? 'step-gone' : 'ok'

  for (const { original, call, isTarget } of plan(all, change)) {
    const result = runCall(state, catalog, call, original.t)
    if (!result) {
      if (isTarget) {
        status = 'target-failed'
        break
      }
      dropped.push({ step: original, reason: dropReason(original.call) })
      continue
    }
    const step: Step = { id: original.id, call, t: original.t, entry: result.entry }
    if (!isTarget && !sameValue(step.entry, original.entry)) changed.push(step)
    rebuilt = pushUndo(rebuilt, state, result.undo, step, original.t)
    state = result.state
    ran += 1
  }

  return { status, state, stack: rebuilt, dropped, changed, trimmed: ran - stepsOf(rebuilt).length }
}

/** `isReplayable` is asked often (the panel, every preview, every apply) for the same stack and sheet. */
const guardCache = new WeakMap<readonly UndoEntry[], { play: PlayState; ok: boolean }>()

/**
 * The guard for editing: running the whole history again with no change must give back exactly the state on screen. If it does not
 * (a change that bypassed the steps, or a rule that is not repeatable), editing is off, since a replay would write a different sheet.
 */
export function isReplayable(play: PlayState, stack: readonly UndoEntry[], catalog: Catalog): boolean {
  const cached = guardCache.get(stack)
  if (cached && cached.play === play) return cached.ok
  const result = replay(stack, catalog, null)
  const ok = result === null || (result.dropped.length === 0 && sameValue(result.state, play))
  guardCache.set(stack, { play, ok })
  return ok
}
