import { DEFAULT_INSPIRATION_DIE } from '@shared/constants'
import type { PlayState } from '@shared/schema'
import type { PaladexStore } from './playStore'

// Stable empty fallbacks: a selector must never return a fresh `{}` per call (zustand 5 would loop).
const NO_COUNTS: Readonly<Record<string, number>> = Object.freeze({})
const NOT_HELD: PlayState['inspiration'] = Object.freeze({ held: false, die: DEFAULT_INSPIRATION_DIE })

export const selectSlotsUsed = (s: PaladexStore): Readonly<Record<string, number>> => s.play?.slotsUsed ?? NO_COUNTS
export const selectCounters = (s: PaladexStore): Readonly<Record<string, number>> => s.play?.counters ?? NO_COUNTS
export const selectConcentration = (s: PaladexStore): string | null => s.play?.concentration ?? null
export const selectInitiative = (s: PaladexStore): number | null => s.play?.initiative ?? null
/** The same object until inspiration itself changes (actions spread the state, so untouched fields keep their identity). */
export const selectInspiration = (s: PaladexStore): PlayState['inspiration'] => s.play?.inspiration ?? NOT_HELD
