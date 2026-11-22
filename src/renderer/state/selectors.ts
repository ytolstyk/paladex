import type { PaladexStore } from './playStore'

// Stable empty fallbacks: a selector must never return a fresh `{}` per call (zustand 5 would loop).
const NO_COUNTS: Readonly<Record<string, number>> = Object.freeze({})

export const selectSlotsUsed = (s: PaladexStore): Readonly<Record<string, number>> => s.play?.slotsUsed ?? NO_COUNTS
export const selectCounters = (s: PaladexStore): Readonly<Record<string, number>> => s.play?.counters ?? NO_COUNTS
export const selectConcentration = (s: PaladexStore): string | null => s.play?.concentration ?? null
