import type { PlayState } from '@shared/schema'
import type { Catalog } from './catalog'
import { plural } from './describe'
import { isReplayable, replay, type HistoryChange, type Replayed } from './replay'
import { describeDifference, sheetDiffers } from './stateDiff'
import type { UndoEntry } from './undo'

export type PreviewRefusal = 'out-of-sync' | 'step-gone' | 'target-failed' | 'empty'

export interface OkPreview {
  ok: true
  replayed: Replayed
  differences: string[]
  sheetChanges: boolean
}

export type HistoryPreview = { ok: false; reason: PreviewRefusal } | OkPreview

/**
 * What a correction would do, without doing it. The store runs this again at the moment of applying (against the undo list it was
 * shown), so what is applied is what the player saw, and a stack that has moved since is refused. Editing is refused outright when the
 * history does not replay to the sheet on screen (`isReplayable`), since a replay would then write a different sheet.
 */
export function previewHistoryChange(play: PlayState, stack: readonly UndoEntry[], catalog: Catalog, change: HistoryChange): HistoryPreview {
  if (!isReplayable(play, stack, catalog)) return { ok: false, reason: 'out-of-sync' }
  const replayed = replay(stack, catalog, change)
  if (!replayed) return { ok: false, reason: 'empty' }
  if (replayed.status !== 'ok') return { ok: false, reason: replayed.status }
  return { ok: true, replayed, differences: describeDifference(play, replayed.state, catalog), sheetChanges: sheetDiffers(play, replayed.state) }
}

/** The sentence under a preview that changes nothing visible on the sheet. */
export function describeNoVisibleChange({ sheetChanges, replayed }: OkPreview): string {
  const parts = [sheetChanges ? 'Something else on the sheet changes' : 'The sheet itself does not change']
  if (replayed.changed.length > 0) parts.push(`${replayed.changed.length} later ${replayed.changed.length === 1 ? 'step reads' : 'steps read'} differently`)
  if (replayed.dropped.length > 0) parts.push(`${replayed.dropped.length} dropped`)
  return `${parts.join('; ')}.`
}

/** What happened to the later steps, for the toast after a correction is applied. */
export function describeCorrection(replayed: Replayed): string[] {
  return [
    replayed.dropped.length > 0 ? `${plural(replayed.dropped.length, 'later step', 'later steps')} no longer applied` : '',
    replayed.trimmed > 0 ? `${plural(replayed.trimmed, 'oldest step', 'oldest steps')} left the list` : ''
  ].filter(Boolean)
}
