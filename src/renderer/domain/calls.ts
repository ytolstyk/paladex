import type { ConditionId, InspirationDie, TurnStep } from '@shared/constants'
import type { LogEntry } from '@shared/schema'
import type { Payment } from '@shared/types'
import type { RestKind } from './rests'

// Leaf types only (no value imports), so `undo.ts` can know a `Step` without depending on the actions that make one.

/**
 * One thing the player did, as data. Every state change the store makes is one of these (the store's `dispatch` is the only action writer; undo and history corrections are the others),
 * so a history can be run again from an earlier state, with a step removed or changed. A new action needs a kind here and a row in each
 * table keyed by `Call['type']` (`RUNNERS` and `DROP_REASON` in `steps.ts`, `EDIT_RULES` in `stepEdit.ts`): the compiler insists on all three.
 *
 * Toggles carry the value they set (`on`), not "flip": a replay after an earlier step was removed must not turn "unprepare" into "prepare".
 * Amounts are what was asked for; the log entry holds what happened (a heal is capped at maximum hit points).
 */
export type Call =
  /** `requested` is set only when the player picked that payment (the upcast stepper). Left out, a replay pays the way the card would now. */
  | { type: 'cast'; spellId: string; requested?: Payment }
  | { type: 'slot'; level: number; direction: 'spend' | 'restore' }
  /** The turn length in force when it was pressed: a setting that lives outside the play state. */
  | { type: 'newTurn'; turnSeconds: number }
  | { type: 'endTimer'; spellId: string }
  | { type: 'turnStep'; step: TurnStep; on: boolean }
  | { type: 'feature'; featureId: string; amount: number }
  | { type: 'prepared'; spellId: string; on: boolean }
  | { type: 'favorite'; spellId: string; on: boolean }
  | { type: 'counter'; counterId: string; delta: number }
  | { type: 'hp'; delta: number }
  | { type: 'rest'; kind: RestKind }
  | { type: 'initiative'; value: number | null }
  | { type: 'inspirationHeld'; held: boolean }
  | { type: 'inspirationDie'; die: InspirationDie }
  | { type: 'condition'; id: ConditionId; on: boolean }
  /** The spell whose concentration was dropped: a replay where that is no longer the concentration does nothing, never ends another. */
  | { type: 'dropConcentration'; spellId: string }

export type CallOf<K extends Call['type']> = Extract<Call, { type: K }>

/** A call that happened. `id` is stable for the session (a replay keeps it), `t` is when, `entry` is the log line it produced. */
export interface Step {
  id: number
  call: Call
  t: number
  entry: LogEntry
}

/** Why a step did nothing on a replay: its work was already done or its cause is gone (harmless), or it really cannot happen now. */
export type DropReason = 'no-longer-needed' | 'no-longer-possible'
