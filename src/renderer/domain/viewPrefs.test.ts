import { describe, expect, it } from 'vitest'
import { emptyFacetChoices } from './facets'
import { NO_FILTERS, type Filters } from './filters'
import { DEFAULT_VIEW_PREFS, parseViewPrefs, serializeViewPrefs } from './viewPrefs'

const busy: Filters = {
  intents: ['enemies', 'utility'],
  castTimes: ['bonus'],
  facets: { ...emptyFacetChoices(), level: ['1', '2'], school: ['Evocation'], source: ['class'] },
  noConcentration: true,
  ritualOnly: true,
  castableNow: true,
  showAll: true,
  query: 'smite'
}

describe('viewPrefs', () => {
  it('round-trips filters and sort, but not the search text', () => {
    const back = parseViewPrefs(serializeViewPrefs(busy, 'range'))
    expect(back.sort).toBe('range')
    expect(back.filters).toEqual({ ...busy, query: '' })
  })

  it('the round-trip fixture covers every filter field, so a new field cannot slip past the test', () => {
    expect(Object.keys(busy).sort()).toEqual(Object.keys(NO_FILTERS).sort())
  })

  it('the same view always serializes to the same string, whatever the search text', () => {
    expect(serializeViewPrefs(busy, 'name')).toBe(serializeViewPrefs({ ...busy, query: 'other' }, 'name'))
    expect(serializeViewPrefs(busy, 'name')).not.toBe(serializeViewPrefs(busy, 'level'))
  })

  it('nothing stored, or unreadable, gives the defaults', () => {
    for (const raw of [null, '', 'not json', '42', 'null', '[]', '"text"', 'x'.repeat(20_000)]) {
      expect(parseViewPrefs(raw)).toEqual(DEFAULT_VIEW_PREFS)
    }
    expect(DEFAULT_VIEW_PREFS.filters).toEqual(NO_FILTERS)
  })

  it('a bad field loses only itself', () => {
    const back = parseViewPrefs(
      JSON.stringify({
        intents: ['enemies', 'nonsense', 'enemies', 7],
        castTimes: 'bonus',
        facets: { level: ['3', 4, ''], unknown: ['x'], school: 'Evocation' },
        noConcentration: 'yes',
        ritualOnly: true,
        sort: 'by-colour'
      })
    )
    expect(back.filters.intents).toEqual(['enemies'])
    expect(back.filters.castTimes).toEqual([])
    expect(back.filters.facets).toEqual({ ...emptyFacetChoices(), level: ['3'] })
    expect(back.filters.noConcentration).toBe(false)
    expect(back.filters.ritualOnly).toBe(true)
    expect(back.sort).toBe('level')
  })

  it('ignores a stored query', () => {
    expect(parseViewPrefs(JSON.stringify({ query: 'smite' })).filters.query).toBe('')
  })
})
