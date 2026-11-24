import { describe, expect, it } from 'vitest'
import { filterTraits, groupTraits, hasTraitFilters, NO_TRAIT_FILTERS } from './traits'
import { trait } from './testing'

const vow = trait({ id: 'trait:vow', name: 'Vow of Enmity', kind: 'oath', when: 'triggered', summary: 'Advantage against one creature.' })
const flight = trait({ id: 'trait:flight', name: 'Draconic Flight', kind: 'species', when: 'bonus', text: 'Spectral wings, a Fly Speed.' })
const darkvision = trait({ id: 'trait:dv', name: 'Darkvision', kind: 'species', when: 'passive' })
const savage = trait({ id: 'trait:savage', name: 'Savage Attacker', kind: 'feat', when: 'triggered', text: 'Roll the damage dice twice.' })
const all = [vow, flight, darkvision, savage]
const character = { subclass: 'Oath of Vengeance', race: 'Dragonborn' }
const names = (list: readonly { name: string }[]) => list.map((t) => t.name)

describe('filterTraits', () => {
  it('passes everything when nothing is chosen', () => {
    expect(filterTraits(all, NO_TRAIT_FILTERS)).toEqual(all)
  })

  it('searches the name, summary and full text, every word in any order', () => {
    expect(names(filterTraits(all, { ...NO_TRAIT_FILTERS, query: 'wings fly' }))).toEqual(['Draconic Flight'])
    expect(names(filterTraits(all, { ...NO_TRAIT_FILTERS, query: 'advantage' }))).toEqual(['Vow of Enmity'])
    expect(names(filterTraits(all, { ...NO_TRAIT_FILTERS, query: 'dice twice' }))).toEqual(['Savage Attacker'])
  })

  it('combines chips within a group with OR and the groups with AND', () => {
    expect(names(filterTraits(all, { ...NO_TRAIT_FILTERS, kinds: ['oath', 'feat'] }))).toEqual(['Vow of Enmity', 'Savage Attacker'])
    expect(names(filterTraits(all, { ...NO_TRAIT_FILTERS, whens: ['triggered'] }))).toEqual(['Vow of Enmity', 'Savage Attacker'])
    expect(names(filterTraits(all, { ...NO_TRAIT_FILTERS, kinds: ['species'], whens: ['bonus'] }))).toEqual(['Draconic Flight'])
    expect(filterTraits(all, { ...NO_TRAIT_FILTERS, kinds: ['oath'], whens: ['bonus'] })).toEqual([])
  })

  it('narrows a search by the chips too', () => {
    expect(names(filterTraits(all, { query: 'draconic', kinds: ['species'], whens: [] }))).toEqual(['Draconic Flight'])
    expect(filterTraits(all, { query: 'draconic', kinds: ['feat'], whens: [] })).toEqual([])
  })
})

describe('hasTraitFilters', () => {
  it('is true for a chip or a real search word, and false for blank spaces', () => {
    expect(hasTraitFilters(NO_TRAIT_FILTERS)).toBe(false)
    expect(hasTraitFilters({ ...NO_TRAIT_FILTERS, query: '   ' })).toBe(false)
    expect(hasTraitFilters({ ...NO_TRAIT_FILTERS, query: 'fly' })).toBe(true)
    expect(hasTraitFilters({ ...NO_TRAIT_FILTERS, kinds: ['feat'] })).toBe(true)
    expect(hasTraitFilters({ ...NO_TRAIT_FILTERS, whens: ['passive'] })).toBe(true)
  })
})

describe('groupTraits', () => {
  it('orders the groups Oath, species, feats, homebrew whatever the order of the list, and names the first two for the character', () => {
    const groups = groupTraits([savage, darkvision, vow], character)
    expect(groups.map((g) => [g.kind, g.title])).toEqual([
      ['oath', 'Oath of Vengeance'],
      ['species', 'Dragonborn'],
      ['feat', 'Feats']
    ])
  })

  it('keeps the catalog order inside a group and leaves out an empty group', () => {
    const groups = groupTraits([flight, darkvision], character)
    expect(groups).toHaveLength(1)
    expect(names(groups[0]!.traits)).toEqual(['Draconic Flight', 'Darkvision'])
  })

  it('titles the homebrew group, and falls back when the character has no subclass', () => {
    const homebrew = trait({ id: 'trait:h', kind: 'homebrew' })
    expect(groupTraits([homebrew], character)[0]?.title).toBe('DM homebrew')
    expect(groupTraits([vow], { subclass: '', race: 'Dragonborn' })[0]?.title).toBe('Oath features')
  })
})
