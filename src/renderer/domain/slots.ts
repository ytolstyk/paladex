/**
 * Slot model. Conventions live here and nowhere else:
 *  - `capacity[i]` is the number of (i + 1)th-level slots
 *  - `used` is keyed by `slotKey(level)`
 *  - gems fill left to right: the first `remaining` gems are full, the rest are spent
 */
const MIN_LEVEL = 1
const MAX_LEVEL = 20

/** 2024 Paladin (half caster) slots by class level. Derived from the class table, not DDB (whose `spellSlots.available` is unreliable). */
const PALADIN_SLOTS: Record<number, number[]> = {
  1: [2],
  2: [2],
  3: [3],
  4: [3],
  5: [4, 2],
  6: [4, 2],
  7: [4, 3],
  8: [4, 3],
  9: [4, 3, 2],
  10: [4, 3, 2],
  11: [4, 3, 3],
  12: [4, 3, 3],
  13: [4, 3, 3, 1],
  14: [4, 3, 3, 1],
  15: [4, 3, 3, 2],
  16: [4, 3, 3, 2],
  17: [4, 3, 3, 3, 1],
  18: [4, 3, 3, 3, 1],
  19: [4, 3, 3, 3, 2],
  20: [4, 3, 3, 3, 2]
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Slot capacity per spell level for a Paladin of the given class level. */
export function paladinSlotCapacity(classLevel: number): number[] {
  const level = clamp(Math.floor(classLevel) || MIN_LEVEL, MIN_LEVEL, MAX_LEVEL)
  return [...(PALADIN_SLOTS[level] ?? [])]
}

export function slotKey(level: number): string {
  return String(level)
}

export function slotCapacityAt(capacity: number[], level: number): number {
  return capacity[level - 1] ?? 0
}

export function slotsUsedAt(used: Record<string, number>, level: number): number {
  return used[slotKey(level)] ?? 0
}

/** Slots still available at `level`, never negative even if persisted `used` exceeds capacity. */
export function slotsRemaining(capacity: number[], used: Record<string, number>, level: number): number {
  return Math.max(0, slotCapacityAt(capacity, level) - slotsUsedAt(used, level))
}

/** Lowest slot level >= minLevel that still has a slot, or null. */
export function lowestAvailableSlot(capacity: number[], used: Record<string, number>, minLevel: number): number | null {
  for (let level = Math.max(MIN_LEVEL, minLevel); level <= capacity.length; level++) {
    if (slotsRemaining(capacity, used, level) > 0) return level
  }
  return null
}

/** Clamp persisted `used` counts to current capacity (e.g. after a level change); drops orphaned levels. */
export function clampUsed(capacity: number[], used: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(used)) {
    const cap = capacity[Number(key) - 1]
    if (cap === undefined) continue
    out[key] = Math.min(value, cap)
  }
  return out
}
