import { describe, expect, it } from 'vitest'
import { groupSpells, orderFeatures, SORT_KEYS, SORT_LABEL, type SortKey } from './order'
import { freshState, layOnHands, spell, testCatalog, vowOfEnmity } from './testing'

const catalog = testCatalog()
const state = freshState(catalog)

const zone = spell({ id: 'spell:zone', name: 'Zone of Truth', level: 2, school: 'Enchantment', range: '60 ft', castTime: 'action', role: 'control' })
const aid = spell({ id: 'spell:aid', name: 'Aid', level: 2, school: 'Abjuration', range: '30 ft', castTime: 'action', role: 'support' })
const smiteLike = spell({ id: 'spell:smite', name: 'Wrathful Smite', level: 1, school: 'Necromancy', range: 'Self', castTime: 'bonus', role: 'offense' })
const cure = spell({ id: 'spell:cure', name: 'Cure Wounds', level: 1, school: 'Abjuration', range: 'Touch', castTime: 'action', role: 'support' })
const detect = spell({ id: 'spell:detect', name: 'Detect Magic', level: 1, school: 'Divination', range: 'Self (30 ft)', castTime: 'action', role: 'utility' })
const guidance = spell({ id: 'spell:guidance', name: 'Guidance', level: 0, school: 'Divination', range: 'Touch', castTime: 'action', role: 'support' })
const shield = spell({ id: 'spell:shield', name: 'Shield of Faith', level: 1, school: 'Abjuration', range: '60 ft', castTime: 'bonus', role: 'support' })
const ritual = spell({ id: 'spell:ceremony', name: 'Ceremony', level: 1, school: 'Abjuration', range: 'Touch', castTime: 'long', role: 'support' })

// Deliberately not in any sort order, so each sort has to do the work.
const spells = [zone, smiteLike, aid, cure, detect, guidance, shield, ritual]

const titles = (sort: SortKey) => groupSpells(state, spells, sort).map((g) => g.title)
const names = (sort: SortKey) => groupSpells(state, spells, sort).map((g) => g.spells.map((s) => s.name))

describe('groupSpells', () => {
  it('level: headed by level, in catalog order inside each', () => {
    expect(titles('level')).toEqual(['Cantrips', 'First level', 'Second level'])
    expect(names('level')).toEqual([
      ['Guidance'],
      ['Wrathful Smite', 'Cure Wounds', 'Detect Magic', 'Shield of Faith', 'Ceremony'],
      ['Zone of Truth', 'Aid']
    ])
  })

  it('name: one list, A to Z', () => {
    expect(titles('name')).toEqual(['A to Z'])
    expect(names('name')[0]).toEqual(['Aid', 'Ceremony', 'Cure Wounds', 'Detect Magic', 'Guidance', 'Shield of Faith', 'Wrathful Smite', 'Zone of Truth'])
  })

  it('range: nearest first, with Self (30 ft) still counting as Self', () => {
    expect(titles('range')).toEqual(['Self', 'Touch', 'Up to 30 ft', '31 to 60 ft'])
    expect(names('range')).toEqual([
      ['Detect Magic', 'Wrathful Smite'], // same reach (0): by name
      ['Ceremony', 'Cure Wounds', 'Guidance'],
      ['Aid'],
      ['Shield of Faith', 'Zone of Truth']
    ])
  })

  it('castTime: action, bonus, long, each by level then name', () => {
    expect(titles('castTime')).toEqual(['Action', 'Bonus action', 'Long casting time'])
    expect(names('castTime')[0]).toEqual(['Guidance', 'Cure Wounds', 'Detect Magic', 'Aid', 'Zone of Truth'])
    expect(names('castTime')[1]).toEqual(['Shield of Faith', 'Wrathful Smite'])
  })

  it('school: alphabetical headings', () => {
    expect(titles('school')).toEqual(['Abjuration', 'Divination', 'Enchantment', 'Necromancy'])
  })

  it('role: offense, control, support, utility, and a role override moves a spell', () => {
    expect(titles('role')).toEqual(['Offense', 'Control', 'Support', 'Utility'])
    const overridden = { ...state, roleOverrides: { [detect.id]: 'offense' as const } }
    const offense = groupSpells(overridden, spells, 'role')[0]
    expect(offense?.spells.map((s) => s.name)).toEqual(['Detect Magic', 'Wrathful Smite'])
  })

  it('never drops or repeats a spell, whatever the sort', () => {
    for (const sort of SORT_KEYS) {
      const out = groupSpells(state, spells, sort).flatMap((g) => g.spells.map((s) => s.id))
      expect(out.slice().sort()).toEqual(spells.map((s) => s.id).sort())
    }
  })

  it('gives each group a distinct id and no group is empty', () => {
    for (const sort of SORT_KEYS) {
      const groups = groupSpells(state, spells, sort)
      expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length)
      expect(groups.every((g) => g.spells.length > 0)).toBe(true)
    }
  })

  it('returns nothing for nothing, and does not reorder its input', () => {
    expect(groupSpells(state, [], 'range')).toEqual([])
    const before = spells.map((s) => s.id)
    groupSpells(state, spells, 'name')
    groupSpells(state, spells, 'range')
    expect(spells.map((s) => s.id)).toEqual(before)
  })

  describe('favorites', () => {
    const starred = { ...state, favorites: [zone.id, guidance.id, cure.id] }

    it('pins starred spells in a Favorites group above the sort, by level then name', () => {
      const groups = groupSpells(starred, spells, 'level')
      expect(groups.map((g) => g.title)).toEqual(['Favorites', 'First level', 'Second level'])
      expect(groups[0]?.spells.map((s) => s.name)).toEqual(['Guidance', 'Cure Wounds', 'Zone of Truth'])
      expect(groups[1]?.spells.map((s) => s.name)).toEqual(['Wrathful Smite', 'Detect Magic', 'Shield of Faith', 'Ceremony'])
    })

    it('goes above A to Z, and the Cantrips heading disappears when its only spell is starred', () => {
      expect(groupSpells(starred, spells, 'name').map((g) => g.title)).toEqual(['Favorites', 'A to Z'])
      expect(groupSpells(starred, spells, 'level').map((g) => g.title)).not.toContain('Cantrips')
    })

    it('shows only the starred spells that are in the list, and nothing when all are filtered away', () => {
      expect(groupSpells(starred, [zone, aid], 'level').map((g) => g.title)).toEqual(['Favorites', 'Second level'])
      expect(groupSpells({ ...state, favorites: [zone.id] }, [aid], 'level').map((g) => g.title)).toEqual(['Second level'])
    })

    it('never drops or repeats a spell, and keeps ids distinct, under every sort', () => {
      for (const sort of SORT_KEYS) {
        const groups = groupSpells(starred, spells, sort)
        expect(groups.flatMap((g) => g.spells.map((s) => s.id)).sort()).toEqual(spells.map((s) => s.id).sort())
        expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length)
      }
    })
  })

  it('every sort has a label', () => {
    for (const sort of SORT_KEYS) expect(SORT_LABEL[sort]).toBeTruthy()
  })
})

describe('orderFeatures', () => {
  const features = [vowOfEnmity, layOnHands]

  it('sorts by name, and by casting time (action before bonus)', () => {
    expect(orderFeatures(features, 'name').map((f) => f.name)).toEqual(['Lay On Hands', 'Vow of Enmity'])
    expect(orderFeatures(features, 'castTime').map((f) => f.name)).toEqual(['Vow of Enmity', 'Lay On Hands'])
  })

  it('sorts by role (offense before support)', () => {
    expect(orderFeatures(features, 'role').map((f) => f.name)).toEqual(['Vow of Enmity', 'Lay On Hands'])
  })

  it('keeps catalog order for sorts that mean nothing to a feature, and never mutates the input', () => {
    for (const sort of ['level', 'range', 'school'] as const) expect(orderFeatures(features, sort)).toEqual(features)
    orderFeatures(features, 'name')
    expect(features.map((f) => f.name)).toEqual(['Vow of Enmity', 'Lay On Hands'])
  })
})
