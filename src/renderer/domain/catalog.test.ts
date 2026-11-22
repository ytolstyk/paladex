import { describe, expect, it } from 'vitest'
import type { SeedData } from '@shared/types'
import { seed } from '@/data/character'
import { createCatalog } from './catalog'
import { bless, guidance, layOnHands, protection, spell, testCounters } from './testing'

function seedWith(spells: SeedData['character']['spells'], seededUsed: Record<string, number> = {}): SeedData {
  const base = createCatalog({ ...seed }).character
  return { character: { ...base, spells, counters: testCounters, features: [] }, prepared: [], seededUsed, otherFeatures: [] }
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
