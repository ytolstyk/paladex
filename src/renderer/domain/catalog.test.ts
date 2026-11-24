import { describe, expect, it } from 'vitest'
import type { SeedData } from '@shared/types'
import { seed } from '@/data/character'
import { createCatalog } from './catalog'
import { bless, guidance, layOnHands, protection, spell, testCounters, trait, weapon } from './testing'

function seedWith(spells: SeedData['character']['spells'], seededUsed: Record<string, number> = {}): SeedData {
  const base = createCatalog({ ...seed }).character
  return { character: { ...base, spells, counters: testCounters, features: [] }, prepared: [], seededUsed, traits: [] }
}

describe('createCatalog', () => {
  it('accepts the real seed data', () => {
    const catalog = createCatalog(seed)
    expect(catalog.slotCapacity).toEqual([4, 2])
    expect(catalog.nameOf('spell:bless')).toBe('Bless')
    expect(catalog.nameOf('spell:unknown')).toBe('spell:unknown')
    expect(catalog.preparedSeed.sort()).toEqual(['spell:bless', 'spell:lesser-restoration'])
  })

  it('every cost in the real seed points at a real counter (a typo would make a spell uncastable)', () => {
    expect(() => createCatalog(seed)).not.toThrow()
  })

  it('rejects duplicate spell ids', () => {
    expect(() => createCatalog(seedWith([bless, bless]))).toThrow(/duplicate spell id/)
  })

  it('rejects a cost naming a counter that does not exist', () => {
    const bad = spell({ id: 'spell:bad', name: 'Bad', costs: [{ kind: 'charge', counterId: 'nope' }] })
    expect(() => createCatalog(seedWith([bad]))).toThrow(/unknown counter "nope"/)
  })

  it('rejects a cantrip without a none cost', () => {
    const bad = spell({ id: 'spell:c', name: 'C', level: 0, costs: [{ kind: 'slot' }] })
    expect(() => createCatalog(seedWith([bad]))).toThrow(/Cantrip "C"/)
  })

  it('rejects a feature that spends an unknown counter, or the wrong kind of counter', () => {
    const withFeatures = (features: SeedData['character']['features']): SeedData => {
      const base = seedWith([bless])
      return { ...base, character: { ...base.character, features } }
    }
    expect(() => createCatalog(withFeatures([{ ...layOnHands, counterId: 'ghost' }]))).toThrow(/unknown counter "ghost"/)
    expect(() => createCatalog(withFeatures([{ ...layOnHands, spend: { kind: 'uses' } }]))).toThrow(/is a pool/)
    expect(() => createCatalog(withFeatures([layOnHands, layOnHands]))).toThrow(/duplicate feature id/)
    expect(() => createCatalog(withFeatures([layOnHands]))).not.toThrow()
  })

  it('resolves display names for spells and features alike', () => {
    const base = seedWith([bless])
    const catalog = createCatalog({ ...base, character: { ...base.character, features: [layOnHands] } })
    expect(catalog.nameOf(layOnHands.id)).toBe('Lay On Hands')
    expect(catalog.nameOf(bless.id)).toBe('Bless')
    expect(catalog.featureById(layOnHands.id)?.name).toBe('Lay On Hands')
  })

  it('rejects a prepared id that is not a spell', () => {
    expect(() => createCatalog({ ...seedWith([bless]), prepared: ['spell:ghost'] })).toThrow(/prepared list/)
  })

  it('rejects a chosen spell that can never be chosen (cantrips, free spells)', () => {
    expect(() => createCatalog({ ...seedWith([bless, guidance]), prepared: [guidance.id] })).toThrow(/can't be chosen/)
  })

  it('rejects seededUsed beyond a counter maximum', () => {
    expect(() => createCatalog(seedWith([bless], { ward: 99 }))).toThrow(/exceeds its maximum/)
  })

  it('rejects seededUsed for an unknown counter', () => {
    expect(() => createCatalog(seedWith([guidance, protection], { ghost: 1 }))).toThrow(/seededUsed/)
  })
})

describe('weapons', () => {
  const withWeapons = (weapons: SeedData['character']['weapons']): SeedData => {
    const base = seedWith([bless])
    return { ...base, character: { ...base.character, weapons } }
  }

  it('looks a weapon up by id, and names it', () => {
    const halberd = weapon({ id: 'weapon:halberd', name: 'Halberd' })
    const catalog = createCatalog(withWeapons([halberd]))
    expect(catalog.weaponById('weapon:halberd')).toBe(halberd)
    expect(catalog.weaponById('weapon:nope')).toBeUndefined()
    expect(catalog.nameOf('weapon:halberd')).toBe('Halberd')
    expect(catalog.weapons).toEqual([halberd])
  })

  it('rejects duplicate weapon ids', () => {
    expect(() => createCatalog(withWeapons([weapon(), weapon()]))).toThrow(/duplicate weapon id/)
  })

  it('rejects a weapon whose data is malformed, so a stale seed fails at startup and not in a card', () => {
    const noProperties = { ...weapon(), properties: undefined } as unknown as ReturnType<typeof weapon>
    expect(() => createCatalog(withWeapons([noProperties]))).toThrow(/malformed/)
    expect(() => createCatalog(withWeapons([weapon({ damage: { dice: 'lots', type: 'Slashing' } })]))).toThrow(/malformed/)
  })

  it('the real seed carries its weapons', () => {
    expect(createCatalog(seed).weapons.map((w) => w.name)).toContain('Warhammer')
  })
})

describe('traits', () => {
  const withTraits = (traits: SeedData['traits']): SeedData => ({ ...seedWith([bless]), character: { ...seedWith([bless]).character, features: [layOnHands] }, traits })

  it('finds a trait by id and names it', () => {
    const catalog = createCatalog(withTraits([trait({ id: 'trait:a', name: 'Alpha' })]))
    expect(catalog.traitById('trait:a')?.name).toBe('Alpha')
    expect(catalog.nameOf('trait:a')).toBe('Alpha')
    expect(catalog.traitById('trait:b')).toBeUndefined()
  })

  it('accepts a trait that points at a real spell and feature', () => {
    expect(() => createCatalog(withTraits([trait({ related: [bless.id, layOnHands.id] })]))).not.toThrow()
  })

  it('rejects a trait that points at something that does not exist, and duplicate ids', () => {
    expect(() => createCatalog(withTraits([trait({ related: ['spell:nope'] })]))).toThrow(/unknown spell or feature "spell:nope"/)
    expect(() => createCatalog(withTraits([trait(), trait()]))).toThrow(/duplicate trait id/)
  })

  it('rejects a kind or timing the cards could not label, and a seed with no traits list', () => {
    expect(() => createCatalog(withTraits([trait({ kind: 'mystery' as never })]))).toThrow(/unknown kind or timing/)
    expect(() => createCatalog(withTraits([trait({ when: 'sometimes' as never })]))).toThrow(/unknown kind or timing/)
    expect(() => createCatalog({ ...withTraits([]), traits: undefined as never })).toThrow(/no traits list/)
  })
})
