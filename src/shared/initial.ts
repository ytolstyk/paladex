import { DEFAULT_INSPIRATION_DIE, emptyTurn, SCHEMA_VERSION } from './constants'
import type { PlayState } from './schema'
import type { CounterDef } from './types'

export interface InitialStateInput {
  hpMax: number
  ac: number
  counters: CounterDef[]
  /** Counters whose "used" amount seeds from the sheet instead of starting fully rested (e.g. consumable item charges). */
  seededUsed?: Record<string, number>
  prepared?: string[]
}

/** First-launch state: fully rested, except consumable charges that seed from DDB. */
export function createInitialPlayState(input: InitialStateInput, now: number): PlayState {
  const counters: Record<string, number> = {}
  for (const def of input.counters) counters[def.id] = Math.min(def.max, input.seededUsed?.[def.id] ?? 0)
  return {
    schemaVersion: SCHEMA_VERSION,
    slotsUsed: {},
    vitals: { hp: input.hpMax, hpMax: input.hpMax, tempHp: 0, ac: input.ac },
    concentration: null,
    counters,
    prepared: input.prepared ?? [],
    roleOverrides: {},
    turn: emptyTurn(),
    initiative: null,
    inspiration: { held: false, die: DEFAULT_INSPIRATION_DIE },
    log: [{ t: now, kind: 'seed' }]
  }
}
