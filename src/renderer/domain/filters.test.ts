import { describe, expect, it } from 'vitest'
import type { PlayState } from '@shared/schema'
import { featureUsable, filterFeatures, filterSpells, hasActiveFilters, NO_FILTERS, type Filters } from './filters'
import { bless, cure, freshState, guidance, holdPerson, layOnHands, mistyStep, protection, smite, testCatalog, vowOfEnmity } from './testing'

const catalog = testCatalog()
const base = freshState(catalog)
// Only Bless is chosen today; Hold Person and Cure Wounds are not.
const today: PlayState = { ...base, prepared: [bless.id] }
const names = (state: PlayState, f: Partial<Filters>) => filterSpells(state, catalog, { ...NO_FILTERS, ...f }).map((s) => s.name)

describe('default view', () => {
  it('shows prepared, always-prepared, cantrips and charge-castable spells, hiding the rest', () => {
    expect(names(today, {})).toEqual([smite.name, bless.name, protection.name, guidance.name, mistyStep.name])
  })

  it('"show all" adds the unprepared spells', () => {
    expect(names(today, { showAll: true })).toContain(cure.name)
    expect(names(today, { showAll: true })).toContain(holdPerson.name)
  })
})

describe('intent chips (the "what do I need right now" question)', () => {
  it('Hurt enemies = offense + control', () => {
    expect(names(today, { intents: ['enemies'] })).toEqual([smite.name])
    expect(names(today, { intents: ['enemies'], showAll: true })).toEqual([smite.name, holdPerson.name])
  })

  it('Help allies = support', () => {
    expect(names(today, { intents: ['allies'] })).toEqual([bless.name, protection.name])
  })

  it('intents combine with OR', () => {
    expect(names(today, { intents: ['enemies', 'allies'] })).toEqual([smite.name, bless.name, protection.name])
  })

  it('a role override wins over the classification', () => {
    const overridden = { ...today, roleOverrides: { [bless.id]: 'offense' as const } }
    expect(names(overridden, { intents: ['enemies'] })).toContain(bless.name)
  })
})

describe('other facets', () => {
  it('cast time: bonus action only', () => {
    expect(names(today, { castTimes: ['bonus'] })).toEqual([smite.name, mistyStep.name])
  })

  it('cast times combine with OR', () => {
    expect(names(today, { castTimes: ['bonus', 'action'], intents: ['allies'] })).toEqual([bless.name, protection.name])
  })

  it('no concentration', () => {
    expect(names(today, { noConcentration: true })).toEqual([smite.name, guidance.name, mistyStep.name])
  })

  it('facets combine with AND: bonus action + offense', () => {
    expect(names(today, { castTimes: ['bonus'], intents: ['enemies'] })).toEqual([smite.name])
  })

  it('castable now drops spells with nothing left to pay', () => {
    const noSlots = { ...today, slotsUsed: { '1': 4, '2': 2 }, counters: { ...today.counters, 'free-smite': 1 } }
    // Smite (no free cast, no slots), Bless (no slots) and Misty Step are out; the item spell and the cantrip remain.
    expect(names(noSlots, { castableNow: true })).toEqual([protection.name, guidance.name])
  })

  it('castable now never offers an unprepared spell, even with slots available', () => {
    expect(names(today, { castableNow: true, showAll: true })).not.toContain(cure.name)
  })

  it('search matches name, summary and school, case-insensitively', () => {
    expect(names(today, { query: 'D4' })).toEqual([bless.name])
    expect(names(today, { query: 'smite' })).toEqual([smite.name])
    expect(names(today, { query: 'nothing matches this' })).toEqual([])
  })
})

describe('hasActiveFilters', () => {
  it('is false for the default view and for show-all alone (that is a view, not a filter)', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...NO_FILTERS, showAll: true })).toBe(false)
  })
  it('is true when any facet or a non-blank query is set', () => {
    expect(hasActiveFilters({ ...NO_FILTERS, intents: ['allies'] })).toBe(true)
    expect(hasActiveFilters({ ...NO_FILTERS, query: ' x ' })).toBe(true)
    expect(hasActiveFilters({ ...NO_FILTERS, query: '   ' })).toBe(false)
  })
})

describe('features share the same filters', () => {
  const featureNames = (state: PlayState, f: Partial<Filters>) => filterFeatures(state, catalog, { ...NO_FILTERS, ...f }).map((x) => x.name)

  it('Help allies finds Lay On Hands; Hurt enemies finds Vow of Enmity', () => {
    expect(featureNames(today, { intents: ['allies'] })).toEqual([layOnHands.name])
    expect(featureNames(today, { intents: ['enemies'] })).toEqual([vowOfEnmity.name])
  })

  it('bonus action finds the bonus-action feature only', () => {
    expect(featureNames(today, { castTimes: ['bonus'] })).toEqual([layOnHands.name])
    expect(featureNames(today, { castTimes: ['action'] })).toEqual([vowOfEnmity.name])
  })

  it('"No concentration" never hides a feature, and "show all" is irrelevant to them', () => {
    expect(featureNames(today, { noConcentration: true })).toHaveLength(2)
    expect(featureNames(today, { showAll: true })).toHaveLength(2)
  })

  it('castable now drops a feature whose resource is spent', () => {
    const spent = { ...today, counters: { ...today.counters, 'channel-divinity': 2 } }
    expect(featureUsable(spent, catalog, vowOfEnmity)).toBe(false)
    expect(featureNames(spent, { castableNow: true })).toEqual([layOnHands.name])
  })

  it('search matches feature names', () => {
    expect(featureNames(today, { query: 'vow' })).toEqual([vowOfEnmity.name])
  })
})
