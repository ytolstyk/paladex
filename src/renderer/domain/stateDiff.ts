import type { PlayState } from '@shared/schema'
import type { Catalog } from './catalog'
import { sameValue } from './equal'

/**
 * What a correction would change on the sheet, in words. One describer per part of the play state; the keys each one covers are
 * listed in `DIFF_KEYS`, which a test holds against the schema so a new field cannot be left out. Keys nobody words (`GENERIC`) are
 * still reported, as "<key> changes", so a field added later never makes a real difference look empty.
 */
type Describer = (from: PlayState, to: PlayState, catalog: Catalog) => string[]

const VITAL_LABELS = { hp: 'Hit points', tempHp: 'Temporary hit points', hpMax: 'Maximum hit points', ac: 'Armor class' } as const

const orNone = (value: unknown): string => (value === null || value === undefined ? 'none' : String(value))
const heldText = (held: boolean): string => (held ? 'held' : 'not held')
const timerText = (seconds: number | undefined): string => (seconds === undefined ? 'not running' : `${seconds} s left`)

/** Every key whose value differs between two records, in a stable order. */
function differingKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => !sameValue(a[key], b[key])).sort()
}

function describeSetChange(label: string, before: readonly string[], after: readonly string[], nameOf: (id: string) => string): string[] {
  const added = after.filter((id) => !before.includes(id)).map(nameOf)
  const removed = before.filter((id) => !after.includes(id)).map(nameOf)
  const parts: string[] = []
  if (added.length > 0) parts.push(`+ ${added.join(', ')}`)
  if (removed.length > 0) parts.push(`− ${removed.join(', ')}`)
  return parts.length > 0 ? [`${label}: ${parts.join('; ')}`] : []
}

const timersByName = (state: PlayState): Record<string, number> => Object.fromEntries(state.timers.map((t) => [t.spellId, t.remaining]))

/** Each describer with the play-state keys it owns. */
const DESCRIBERS: readonly { keys: readonly string[]; describe: Describer }[] = [
  {
    keys: ['vitals'],
    describe: (from, to) =>
      (Object.keys(VITAL_LABELS) as (keyof typeof VITAL_LABELS)[])
        .filter((key) => from.vitals[key] !== to.vitals[key])
        .map((key) => `${VITAL_LABELS[key]}: ${from.vitals[key]} → ${to.vitals[key]}`)
  },
  {
    keys: ['slotsUsed'],
    describe: (from, to) => differingKeys(from.slotsUsed, to.slotsUsed).map((level) => `Level ${level} slots used: ${from.slotsUsed[level] ?? 0} → ${to.slotsUsed[level] ?? 0}`)
  },
  {
    keys: ['counters'],
    describe: (from, to, catalog) =>
      differingKeys(from.counters, to.counters).map((id) => `${catalog.counterById(id)?.label ?? id} used: ${from.counters[id] ?? 0} → ${to.counters[id] ?? 0}`)
  },
  {
    keys: ['concentration'],
    describe: (from, to, catalog) => {
      const name = (id: string | null): string => (id ? catalog.nameOf(id) : 'none')
      return from.concentration === to.concentration ? [] : [`Concentration: ${name(from.concentration)} → ${name(to.concentration)}`]
    }
  },
  {
    keys: ['timers'],
    describe: (from, to, catalog) => {
      const before = timersByName(from)
      const after = timersByName(to)
      return differingKeys(before, after).map((id) => `${catalog.nameOf(id)} timer: ${timerText(before[id])} → ${timerText(after[id])}`)
    }
  },
  { keys: ['prepared'], describe: (from, to, catalog) => describeSetChange('Prepared', from.prepared, to.prepared, catalog.nameOf) },
  { keys: ['favorites'], describe: (from, to, catalog) => describeSetChange('Favorites', from.favorites, to.favorites, catalog.nameOf) },
  { keys: ['initiative'], describe: (from, to) => (from.initiative === to.initiative ? [] : [`Initiative: ${orNone(from.initiative)} → ${orNone(to.initiative)}`]) },
  {
    keys: ['inspiration'],
    describe: (from, to) => [
      ...(from.inspiration.held === to.inspiration.held ? [] : [`Bardic Inspiration: ${heldText(from.inspiration.held)} → ${heldText(to.inspiration.held)}`]),
      ...(from.inspiration.die === to.inspiration.die ? [] : [`Bardic Inspiration die: d${from.inspiration.die} → d${to.inspiration.die}`])
    ]
  },
  { keys: ['turn'], describe: (from, to) => (sameValue(from.turn, to.turn) ? [] : ['This turn: the marked steps change']) }
]

/** Reported only as "<key> changes", on purpose: nothing in a history step edits them today. */
const GENERIC = ['roleOverrides']
/** A replay rewrites the log, and the schema version never moves. */
const IGNORED = ['schemaVersion', 'log']

/** Every play-state key the diff words, reports generically or ignores on purpose; a test fails when the schema grows one that is none of those. */
export const DIFF_KEYS: readonly string[] = [...DESCRIBERS.flatMap((d) => d.keys), ...GENERIC, ...IGNORED]

const PLAY_RECORD = (state: PlayState): Record<string, unknown> => ({ ...state })

/** The keys that no describer words, reported as "<key> changes". */
const describeUnworded: Describer = (from, to) => {
  const worded = new Set([...DESCRIBERS.flatMap((d) => d.keys), ...IGNORED])
  return differingKeys(PLAY_RECORD(from), PLAY_RECORD(to))
    .filter((key) => !worded.has(key))
    .map((key) => `${key} changes`)
}

export function describeDifference(from: PlayState, to: PlayState, catalog: Catalog): string[] {
  return [...DESCRIBERS.flatMap((d) => d.describe(from, to, catalog)), ...describeUnworded(from, to, catalog)]
}

/** True when the two sheets differ anywhere but in the log (which a replay always rewrites). */
export function sheetDiffers(from: PlayState, to: PlayState): boolean {
  return !sameValue({ ...from, log: [] }, { ...to, log: [] })
}
