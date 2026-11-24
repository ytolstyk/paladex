/**
 * Equal by value, for plain data (objects, arrays, numbers, strings). Key order does not matter, and a missing key equals an
 * `undefined` one (several log entries are built with conditional spreads).
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => sameValue(item, b[i]))
  // Both are non-null, non-array objects here (checked above), so reading keys from them is safe.
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  for (const key of Object.keys(left)) if (!sameValue(left[key], right[key])) return false
  for (const key of Object.keys(right)) if (!(key in left) && right[key] !== undefined) return false
  return true
}
