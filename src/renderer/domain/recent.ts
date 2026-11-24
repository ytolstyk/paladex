import type { LogEntry } from '@shared/schema'
import { formatLog } from './log'

/**
 * "Recently cast" and the cast history, both read from the action log: there is no second list to keep in step. The log keeps
 * its newest 200 entries (`LOG_CAP`), so the history reaches back that far and no further.
 */

/** A spell cast or feature use, as a chip or a history row needs it. */
export interface UseRecord {
  /** `spell:...` or `feature:...`: the same ids the detail drawer opens. */
  id: string
  kind: 'cast' | 'feature'
  t: number
  /** The slot level a slotted cast was paid with. */
  level?: number
  via?: LogEntry['via']
  /** A pool feature's amount (Lay On Hands). */
  amount?: number
}

function asUse(entry: LogEntry): UseRecord | null {
  if (entry.kind === 'cast' && entry.spellId) {
    return {
      id: entry.spellId,
      kind: 'cast',
      t: entry.t,
      ...(entry.level === undefined ? {} : { level: entry.level }),
      ...(entry.via === undefined ? {} : { via: entry.via })
    }
  }
  if (entry.kind === 'feature' && entry.featureId) {
    return { id: entry.featureId, kind: 'feature', t: entry.t, ...(entry.amount === undefined ? {} : { amount: entry.amount }) }
  }
  return null
}

/** The last few different spells and features used, newest first. A thing used twice appears once, at its latest use. */
export function recentUses(log: readonly LogEntry[], limit: number): UseRecord[] {
  const seen = new Set<string>()
  const out: UseRecord[] = []
  for (let i = log.length - 1; i >= 0 && out.length < limit; i--) {
    const use = asUse(log[i]!)
    if (!use || seen.has(use.id)) continue
    seen.add(use.id)
    out.push(use)
  }
  return out
}

/** Where the story breaks: the start of a turn, or a rest. Shown between the casts they separate. */
export interface HistoryBreak {
  kind: 'break'
  t: number
  label: string
  /** A rest is the bigger break: when both sit between two casts, the rest is the one shown. */
  rest: boolean
}

/** One history line: a cast or feature use, or a break between turns. */
export type HistoryRow = { kind: 'use'; t: number; use: UseRecord } | HistoryBreak

const BREAK_KINDS: ReadonlySet<LogEntry['kind']> = new Set(['new-turn', 'short-rest', 'long-rest'])

/** Adds a break below the casts after it. Nothing cast since means nothing to separate, and a run of breaks keeps only the biggest. */
function addBreak(rows: HistoryRow[], next: HistoryBreak): void {
  const last = rows[rows.length - 1]
  if (!last) return
  if (last.kind !== 'break') rows.push(next)
  else if (next.rest && !last.rest) rows[rows.length - 1] = next
}

/**
 * The newest `limit` casts and feature uses, newest first, with a break row where a turn or a rest began. Breaks at the very top
 * (nothing cast since) are left out, and a run of breaks collapses to the biggest (a rest over a new turn), so pressing New turn twice reads as one line.
 */
export function castHistory(log: readonly LogEntry[], limit: number): HistoryRow[] {
  const rows: HistoryRow[] = []
  let uses = 0
  for (let i = log.length - 1; i >= 0 && uses < limit; i--) {
    const entry = log[i]!
    const use = asUse(entry)
    if (use) {
      rows.push({ kind: 'use', t: use.t, use })
      uses++
      continue
    }
    if (BREAK_KINDS.has(entry.kind)) addBreak(rows, { kind: 'break', t: entry.t, label: formatLog(entry), rest: entry.kind !== 'new-turn' })
  }
  // A break reads as "this is where the turn began", so it belongs under the casts that followed it: drop one left dangling at the end.
  while (rows.length > 0 && rows[rows.length - 1]!.kind === 'break') rows.pop()
  return rows
}
