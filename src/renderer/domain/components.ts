import type { SpellComponents } from '@shared/types'

interface ComponentKind {
  key: Exclude<keyof SpellComponents, 'materialText'>
  letter: 'V' | 'S' | 'M'
  /** The rules name. */
  name: string
  /** What it asks of you, in plain words (the thing a player is actually checking: "can I cast this gagged?"). */
  demand: string
}

/** In the order the rules print them. */
export const COMPONENT_KINDS: readonly ComponentKind[] = [
  { key: 'verbal', letter: 'V', name: 'Verbal', demand: 'you must speak' },
  { key: 'somatic', letter: 'S', name: 'Somatic', demand: 'you need a free hand to gesture' },
  { key: 'material', letter: 'M', name: 'Material', demand: 'you need an item' }
]

const presentKinds = (components: SpellComponents): ComponentKind[] => COMPONENT_KINDS.filter((k) => components[k.key])

/** The names of the components a spell has: "Verbal, Somatic". Also what a search for "verbal" or "somatic" matches. */
export function componentWords(components: SpellComponents): string[] {
  return presentKinds(components).map((k) => k.name)
}

/**
 * "Verbal, Somatic, Material (a drop of blood)", or "None" for a spell that needs nothing. A material component whose
 * item we have no text for says so, rather than looking like a plain "Material".
 */
export function describeComponents(components: SpellComponents): string {
  const parts = presentKinds(components).map((k) =>
    k.key === 'material' ? `${k.name} (${components.materialText ?? 'item not recorded, see the spell'})` : k.name
  )
  return parts.length > 0 ? parts.join(', ') : 'None'
}

/** A tooltip: names, then what each asks of you, then the item. "Verbal, Material (you must speak; you need an item): a drop of blood". */
export function componentsTitle(components: SpellComponents): string {
  const present = presentKinds(components)
  if (present.length === 0) return 'No components: no words, gestures or items'
  const demands = present.map((k) => k.demand).join('; ')
  const item = components.material && components.materialText ? `: ${components.materialText}` : ''
  return `${componentWords(components).join(', ')} (${demands})${item}`
}
