import type { Character, CounterDef, Feature, OtherFeature, SeedData, Spell, SpellComponents, Weapon } from '@shared/types'
import { isChoosable } from './prepared'
import { paladinSlotCapacity } from './slots'

/**
 * The read-only game content the app runs on. Created once from seed data and handed to the store;
 * components read through it and never import the seed module directly.
 */
export interface Catalog {
  character: Character
  /** Slot capacity per spell level, index 0 = 1st level. */
  slotCapacity: number[]
  counters: CounterDef[]
  seededUsed: Record<string, number>
  /** Chosen prepared spells a fresh state starts with. */
  preparedSeed: string[]
  spells: Spell[]
  features: Feature[]
  /** Carried weapons, magic first. Informational: attack numbers are derived from the abilities in `domain/attacks.ts`. */
  weapons: Weapon[]
  /** Read-only reference features (DM homebrew etc.). */
  otherFeatures: OtherFeature[]
  spellById(id: string): Spell | undefined
  featureById(id: string): Feature | undefined
  weaponById(id: string): Weapon | undefined
  /** Display name of a spell, feature or weapon, falling back to the id. */
  nameOf(id: string): string
  counterById(id: string): CounterDef | undefined
}

const DICE = /^\d+d\d+$/

/** The seed is a JSON file cast to `SeedData`, and the renderer cannot run zod over it, so check the fields a weapon card reads without a guard. */
function assertWeaponShape(weapon: Weapon): void {
  const ok =
    Array.isArray(weapon.properties) &&
    typeof weapon.damage?.dice === 'string' &&
    DICE.test(weapon.damage.dice) &&
    Number.isInteger(weapon.range?.normal)
  if (!ok) throw new Error(`Weapon "${weapon.name}" is malformed; regenerate the seed (npm run seed)`)
}

function assertUniqueIds(kind: string, items: readonly { id: string }[]): void {
  const seen = new Set<string>()
  for (const { id } of items) {
    if (seen.has(id)) throw new Error(`Seed data has duplicate ${kind} id: ${id}`)
    seen.add(id)
  }
}

/** Seed data is hand-authored, so a typo must fail loudly at startup instead of making a spell silently uncastable. */
function assertCatalogInvariants(seed: SeedData): void {
  const { character, seededUsed } = seed
  const counterIds = new Set(character.counters.map((c) => c.id))
  if (counterIds.size !== character.counters.length) throw new Error('Seed data has duplicate counter ids')

  assertUniqueIds('spell', character.spells)
  for (const spell of character.spells) {
    for (const cost of spell.costs) {
      if ((cost.kind === 'free' || cost.kind === 'charge') && !counterIds.has(cost.counterId)) {
        throw new Error(`Spell "${spell.name}" costs unknown counter "${cost.counterId}"`)
      }
    }
    // The renderer cannot use zod, so check the one field every card and search reads without a guard.
    const parts = spell.components as Partial<SpellComponents> | undefined
    if (typeof parts?.verbal !== 'boolean' || typeof parts.somatic !== 'boolean' || typeof parts.material !== 'boolean') {
      throw new Error(`Spell "${spell.name}" has no components; regenerate the seed (npm run seed)`)
    }
    if (spell.level === 0 && !spell.costs.some((c) => c.kind === 'none')) {
      throw new Error(`Cantrip "${spell.name}" must list a { kind: 'none' } cost`)
    }
  }
  assertUniqueIds('feature', character.features)
  for (const feature of character.features) {
    const counter = character.counters.find((c) => c.id === feature.counterId)
    if (!counter) throw new Error(`Feature "${feature.name}" spends unknown counter "${feature.counterId}"`)
    const expected = feature.spend.kind === 'pool' ? 'pool' : 'uses'
    if (counter.kind !== expected) {
      throw new Error(`Feature "${feature.name}" spends ${feature.spend.kind} but counter "${counter.id}" is a ${counter.kind}`)
    }
  }
  assertUniqueIds('weapon', character.weapons)
  character.weapons.forEach(assertWeaponShape)
  for (const id of seed.prepared) {
    const spell = character.spells.find((s) => s.id === id)
    if (!spell) throw new Error(`Seed prepared list references unknown spell "${id}"`)
    if (!isChoosable(spell)) throw new Error(`Seed prepared list includes "${spell.name}", which can't be chosen`)
  }
  for (const [id, used] of Object.entries(seededUsed)) {
    const counter = character.counters.find((c) => c.id === id)
    if (!counter) throw new Error(`seededUsed references unknown counter "${id}"`)
    if (used > counter.max) throw new Error(`seededUsed for "${id}" (${used}) exceeds its maximum (${counter.max})`)
  }
}

export function createCatalog(seed: SeedData): Catalog {
  assertCatalogInvariants(seed)
  const { character } = seed
  const spellMap = new Map(character.spells.map((s) => [s.id, s]))
  const featureMap = new Map(character.features.map((f) => [f.id, f]))
  const weaponMap = new Map(character.weapons.map((w) => [w.id, w]))
  const counterMap = new Map(character.counters.map((c) => [c.id, c]))

  return {
    character,
    slotCapacity: paladinSlotCapacity(character.level),
    counters: character.counters,
    seededUsed: seed.seededUsed,
    preparedSeed: seed.prepared,
    spells: character.spells,
    features: character.features,
    weapons: character.weapons,
    otherFeatures: seed.otherFeatures,
    spellById: (id) => spellMap.get(id),
    featureById: (id) => featureMap.get(id),
    weaponById: (id) => weaponMap.get(id),
    nameOf: (id) => spellMap.get(id)?.name ?? featureMap.get(id)?.name ?? weaponMap.get(id)?.name ?? id,
    counterById: (id) => counterMap.get(id)
  }
}
