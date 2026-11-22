import type { SpellComponents } from '../src/shared/types'

/**
 * The one place a `SpellComponents` is built, from either source (DDB's numeric codes, or the compact codes in
 * `data/authored-spells.ts`). It throws on an inconsistent input instead of quietly dropping data: item text with no
 * material component means a typo in the source, and silently losing it would show the player a wrong card.
 */
export function buildComponents(flags: { verbal: boolean; somatic: boolean; material: boolean }, materialText?: string): SpellComponents {
  const text = materialText?.trim()
  if (text && !flags.material) throw new Error(`Material text "${text}" given for a spell with no material component`)
  return { ...flags, ...(text ? { materialText: text } : {}) }
}

/** DDB numbers the components 1 = verbal, 2 = somatic, 3 = material. */
const DDB_COMPONENT = { verbal: 1, somatic: 2, material: 3 } as const

/** `null` when the payload has no component list at all, which is not the same as a list that says "none". */
export function componentsFromDdb(codes: unknown, materialDescription: unknown): SpellComponents | null {
  if (!Array.isArray(codes)) return null
  return buildComponents(
    {
      verbal: codes.includes(DDB_COMPONENT.verbal),
      somatic: codes.includes(DDB_COMPONENT.somatic),
      material: codes.includes(DDB_COMPONENT.material)
    },
    typeof materialDescription === 'string' && codes.includes(DDB_COMPONENT.material) ? materialDescription : undefined
  )
}

/** Compact authored form: each letter present means that component is needed, e.g. 'VS' or 'VSM'. */
export type ComponentCode = 'V' | 'S' | 'M' | 'VS' | 'VM' | 'SM' | 'VSM'

export function componentsFromCode(code: ComponentCode, materialText?: string): SpellComponents {
  return buildComponents({ verbal: code.includes('V'), somatic: code.includes('S'), material: code.includes('M') }, materialText)
}
