import { describe, expect, it } from 'vitest'
import { emptyFacetChoices } from './facets'
import { filterFeatures, filterSpells, hasActiveFilters, NO_FILTERS, panelFilterCount, type Filters } from './filters'
import { freshState, layOnHands, spell, testCatalog, vowOfEnmity } from './testing'

const bless = spell({
  id: 'spell:bless',
  name: 'Bless',
  level: 1,
  school: 'Enchantment',
  range: '30 ft',
  duration: '1 minute',
  concentration: true,
  role: 'support',
  summary: 'Allies add a d4',
  description: 'You bless up to three creatures. Each adds a radiant boon to its next roll.'
})
const bane = spell({ id: 'spell:bane', name: 'Bane', level: 1, school: 'Enchantment', range: '30 ft', concentration: true, role: 'control', tag: 'CHA save', source: 'oath' })
const guidance = spell({ id: 'spell:guidance', name: 'Guidance', level: 0, school: 'Divination', range: 'Touch', role: 'support', source: 'cantrip', costs: [{ kind: 'none' }] })
const hold = spell({ id: 'spell:hold', name: 'Hold Person', level: 2, school: 'Enchantment', range: '60 ft', concentration: true, role: 'control', tag: 'WIS save' })
const ceremony = spell({ id: 'spell:ceremony', name: 'Ceremony', level: 1, school: 'Abjuration', range: 'Touch', ritual: true, castTime: 'long', role: 'support' })
const detect = spell({ id: 'spell:detect', name: 'Detect Magic', level: 1, school: 'Divination', range: 'Self (30 ft)', ritual: true, role: 'utility' })

const catalog = testCatalog([bless, bane, guidance, hold, ceremony, detect])
const state = freshState(catalog)
const names = (f: Partial<Filters>) => filterSpells(state, catalog, { ...NO_FILTERS, showAll: true, ...f }).map((s) => s.name)
const facets = (f: Partial<Filters['facets']>): Filters['facets'] => ({ ...emptyFacetChoices(), ...f })

describe('facet filters', () => {
  it('level: one or more levels (OR within the facet)', () => {
    expect(names({ facets: facets({ level: ['0'] }) })).toEqual(['Guidance'])
    expect(names({ facets: facets({ level: ['0', '2'] }) })).toEqual(['Guidance', 'Hold Person'])
  })

  it('range: by band, with Self (30 ft) counting as Self and not as 30 ft', () => {
    expect(names({ facets: facets({ range: ['touch'] }) })).toEqual(['Guidance', 'Ceremony'])
    expect(names({ facets: facets({ range: ['self'] }) })).toEqual(['Detect Magic'])
    expect(names({ facets: facets({ range: ['close'] }) })).toEqual(['Bless', 'Bane'])
    expect(names({ facets: facets({ range: ['mid'] }) })).toEqual(['Hold Person'])
    expect(names({ facets: facets({ range: ['far'] }) })).toEqual([])
  })

  it('school, and save or attack (a spell with no tag never matches a save chip)', () => {
    expect(names({ facets: facets({ school: ['Divination'] }) })).toEqual(['Guidance', 'Detect Magic'])
    expect(names({ facets: facets({ save: ['CHA save'] }) })).toEqual(['Bane'])
    expect(names({ facets: facets({ save: ['CHA save', 'WIS save'] }) })).toEqual(['Bane', 'Hold Person'])
  })

  it('source', () => {
    expect(names({ facets: facets({ source: ['oath'] }) })).toEqual(['Bane'])
    expect(names({ facets: facets({ source: ['cantrip', 'oath'] }) })).toEqual(['Bane', 'Guidance'])
  })

  it('facets combine with AND, and with the other filters', () => {
    expect(names({ facets: facets({ level: ['1'], school: ['Enchantment'] }) })).toEqual(['Bless', 'Bane'])
    expect(names({ facets: facets({ level: ['1'], school: ['Enchantment'] }), intents: ['enemies'] })).toEqual(['Bane'])
    expect(names({ facets: facets({ level: ['0'], school: ['Enchantment'] }) })).toEqual([])
  })

  it('ritual only', () => {
    expect(names({ ritualOnly: true })).toEqual(['Ceremony', 'Detect Magic'])
    expect(names({ ritualOnly: true, facets: facets({ range: ['touch'] }) })).toEqual(['Ceremony'])
  })

  it('no concentration still works beside the new filters', () => {
    expect(names({ noConcentration: true, facets: facets({ level: ['1'] }) })).toEqual(['Ceremony', 'Detect Magic'])
  })
})

describe('full-text search in the filters', () => {
  it('finds a spell by a word that only its description has', () => {
    expect(names({ query: 'radiant' })).toEqual(['Bless'])
  })

  it('every word must match, in any order', () => {
    expect(names({ query: 'bless radiant' })).toEqual(['Bless'])
    expect(names({ query: 'bless necrotic' })).toEqual([])
  })

  it('combines with facets', () => {
    expect(names({ query: 'enchantment', facets: facets({ level: ['2'] }) })).toEqual(['Hold Person'])
  })
})

describe('features and the spell-only filters', () => {
  const featureNames = (f: Partial<Filters>) => filterFeatures(state, catalog, { ...NO_FILTERS, ...f }).map((x) => x.name)

  it('are hidden while a spell-only filter is set, rather than passing it by accident', () => {
    expect(featureNames({})).toEqual([layOnHands.name, vowOfEnmity.name])
    expect(featureNames({ facets: facets({ level: ['1'] }) })).toEqual([])
    expect(featureNames({ facets: facets({ school: ['Divination'] }) })).toEqual([])
    expect(featureNames({ ritualOnly: true })).toEqual([])
  })

  it('stay when only shared filters are set', () => {
    expect(featureNames({ intents: ['allies'] })).toEqual([layOnHands.name])
    expect(featureNames({ noConcentration: true })).toHaveLength(2)
  })

  it('are found by their description-level words', () => {
    expect(featureNames({ query: 'class feature' })).toHaveLength(2)
    expect(featureNames({ query: 'bonus action' })).toEqual([layOnHands.name])
  })
})

describe('active-filter bookkeeping', () => {
  it('counts only what lives in the panel', () => {
    expect(panelFilterCount(NO_FILTERS)).toBe(0)
    expect(panelFilterCount({ ...NO_FILTERS, facets: facets({ level: ['0', '1'], school: ['Abjuration'] }), ritualOnly: true, noConcentration: true })).toBe(5)
    expect(panelFilterCount({ ...NO_FILTERS, intents: ['allies'], castableNow: true, showAll: true })).toBe(0)
  })

  it('treats any panel filter as active', () => {
    expect(hasActiveFilters({ ...NO_FILTERS, facets: facets({ range: ['touch'] }) })).toBe(true)
    expect(hasActiveFilters({ ...NO_FILTERS, ritualOnly: true })).toBe(true)
    expect(hasActiveFilters({ ...NO_FILTERS, noConcentration: true })).toBe(true)
    expect(hasActiveFilters(NO_FILTERS)).toBe(false)
  })
})
