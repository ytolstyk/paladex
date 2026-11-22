import type { CounterDef, Restore } from '@shared/types'
import type { Catalog } from './catalog'

export type RestKind = 'short' | 'long'

/** How much of a counter a rest gives back. Rules live in the counter's data, never in a switch on its id. */
function restoreAmount(restore: Restore | undefined, max: number): number {
  if (!restore) return 0
  if (restore === 'full') return max
  if ('add' in restore) return restore.add
  return Math.max(1, Math.floor(max * restore.fraction)) // "half, rounded down, at least one"
}

export function restoredBy(def: CounterDef, rest: RestKind): number {
  return restoreAmount(def.restore[rest], def.max)
}

/** New `used` amounts after a rest. Counters that don't restore on this kind of rest are left exactly as they were. */
export function usedAfterRest(used: Record<string, number>, catalog: Catalog, rest: RestKind): Record<string, number> {
  const next = { ...used }
  for (const def of catalog.counters) {
    const back = restoredBy(def, rest)
    if (back > 0 && next[def.id] !== undefined) next[def.id] = Math.max(0, (next[def.id] ?? 0) - back)
  }
  return next
}
