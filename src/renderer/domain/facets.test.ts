import { describe, expect, it } from 'vitest'
import { emptyFacetChoices, FACETS, facetOptions } from './facets'
import { spell } from './testing'

const spells = [
  spell({ id: 'a', level: 2, school: 'Enchantment', range: '60 ft', tag: 'WIS save', source: 'class' }),
  spell({ id: 'b', level: 0, school: 'Abjuration', range: 'Touch', source: 'cantrip' }),
  spell({ id: 'c', level: 1, school: 'Abjuration', range: 'Self (30 ft)', tag: 'CHA save', source: 'oath' }),
  spell({ id: 'd', level: 1, school: 'Evocation', range: '30 ft', tag: 'WIS save', source: 'class' })
]

describe('facetOptions', () => {
  const options = facetOptions(spells)

  it('lists only values that occur, in display order', () => {
    expect(options.level).toEqual(['0', '1', '2'])
    expect(options.range).toEqual(['self', 'touch', 'close', 'mid'])
    expect(options.school).toEqual(['Abjuration', 'Enchantment', 'Evocation'])
    expect(options.save).toEqual(['CHA save', 'WIS save'])
    expect(options.source).toEqual(['cantrip', 'class', 'oath'])
  })

  it('has nothing to offer for no spells', () => {
    expect(facetOptions([])).toEqual(emptyFacetChoices())
  })
})

describe('facet definitions', () => {
  const byId = Object.fromEntries(FACETS.map((f) => [f.id, f]))

  it('read each spell once, with no save tag meaning no value', () => {
    expect(byId['level']?.valueOf(spells[1]!)).toBe('0')
    expect(byId['range']?.valueOf(spells[2]!)).toBe('self')
    expect(byId['save']?.valueOf(spells[1]!)).toBeNull()
  })

  it('title their values for a chip', () => {
    expect(byId['level']?.title('0')).toBe('Cantrip')
    expect(byId['level']?.title('3')).toBe('3rd')
    expect(byId['range']?.title('close')).toBe('Up to 30 ft')
    expect(byId['source']?.title('oath')).toBe('Oath')
  })

  it('give every facet a distinct id and label', () => {
    expect(new Set(FACETS.map((f) => f.id)).size).toBe(FACETS.length)
    expect(new Set(FACETS.map((f) => f.label)).size).toBe(FACETS.length)
  })
})
