import { describe, expect, it } from 'vitest'
import { featureFoundBeyondCard, featureMatches, matchesTokens, otherFeatureMatches, searchTokens, spellFoundBeyondCard, spellMatches } from './search'
import { layOnHands, spell } from './testing'

const hunters = spell({
  name: "Hunter's Mark",
  summary: 'Mark a creature',
  description: 'You choose a creature and deal extra necrotic damage whenever you hit it.',
  school: 'Divination',
  role: 'offense',
  castTime: 'bonus',
  concentration: true,
  ritual: false,
  range: '90 ft',
  duration: '1 hour',
  source: 'oath',
  tag: 'on weapon hit'
})

const matches = (query: string, target = hunters) => spellMatches(target, searchTokens(query))

describe('searchTokens', () => {
  it('splits on spaces, ignoring case, apostrophes and extra whitespace', () => {
    expect(searchTokens("  Hunter's   MARK ")).toEqual(['hunters', 'mark'])
    expect(searchTokens('   ')).toEqual([])
    expect(searchTokens('')).toEqual([])
  })
})

describe('what a spell is found by', () => {
  it('its name, however it is typed', () => {
    expect(matches("hunter's mark")).toBe(true)
    expect(matches('hunters mark')).toBe(true)
    expect(matches('HUNTER')).toBe(true)
  })

  it('every word, in any order', () => {
    expect(matches('mark hunter')).toBe(true)
    expect(matches('mark zzz')).toBe(false)
  })

  it('the summary, school, range and duration', () => {
    expect(matches('creature')).toBe(true)
    expect(matches('divination')).toBe(true)
    expect(matches('90 ft')).toBe(true)
    expect(matches('1 hour')).toBe(true)
  })

  it('the full description, which no card shows', () => {
    expect(matches('necrotic')).toBe(true)
  })

  it('the words the filters use: role, casting time, level, source and flags', () => {
    expect(matches('offense')).toBe(true)
    expect(matches('bonus action')).toBe(true)
    expect(matches('level 1')).toBe(true)
    expect(matches('oath')).toBe(true)
    expect(matches('concentration')).toBe(true)
    expect(matches('weapon hit')).toBe(true)
  })

  it('calls cantrips cantrips, and only flags real rituals', () => {
    const cantrip = spell({ name: 'Resistance', level: 0, source: 'cantrip' })
    expect(matches('cantrip', cantrip)).toBe(true)
    expect(matches('ritual', cantrip)).toBe(false)
    expect(matches('ritual', spell({ name: 'Ceremony', ritual: true }))).toBe(true)
    expect(matches('concentration', cantrip)).toBe(false)
  })

  it('matches everything for an empty query', () => {
    expect(matches('')).toBe(true)
  })

  it('does not match on nothing at all', () => {
    expect(matches('banana')).toBe(false)
  })
})

describe('features, and reference-only features', () => {
  it('finds a feature by name, summary and kind', () => {
    expect(featureMatches(layOnHands, searchTokens('lay on hands'))).toBe(true)
    expect(featureMatches(layOnHands, searchTokens('heal'))).toBe(true)
    expect(featureMatches(layOnHands, searchTokens('class feature'))).toBe(true)
    expect(featureMatches(layOnHands, searchTokens('bonus action'))).toBe(true)
    expect(featureMatches(layOnHands, searchTokens('fireball'))).toBe(false)
  })

  it('finds a reference feature in its text', () => {
    const circle = { name: 'Circle Spell', text: 'Once per long rest you may cast a spell of the circle.' }
    expect(otherFeatureMatches(circle, searchTokens('long rest'))).toBe(true)
    expect(otherFeatureMatches(circle, searchTokens('circle spell'))).toBe(true)
    expect(otherFeatureMatches(circle, searchTokens('dragon'))).toBe(false)
  })
})

describe('found beyond the card', () => {
  it('is false when the card itself shows the match', () => {
    expect(spellFoundBeyondCard(hunters, searchTokens('hunter'))).toBe(false)
    expect(spellFoundBeyondCard(hunters, searchTokens('divination'))).toBe(false)
    expect(spellFoundBeyondCard(hunters, searchTokens('90 ft'))).toBe(false)
  })

  it('is true when only the description (or hidden details) matched', () => {
    expect(spellFoundBeyondCard(hunters, searchTokens('necrotic'))).toBe(true)
    expect(spellFoundBeyondCard(hunters, searchTokens('bonus action'))).toBe(true) // the roundel shows only a letter
    expect(spellFoundBeyondCard(hunters, searchTokens('mark necrotic'))).toBe(true) // one word shown, one not
  })

  it('is false for an empty query', () => {
    expect(spellFoundBeyondCard(hunters, [])).toBe(false)
  })

  it('works for features too', () => {
    expect(featureFoundBeyondCard(layOnHands, searchTokens('lay'))).toBe(false)
    expect(featureFoundBeyondCard(layOnHands, searchTokens('bonus action'))).toBe(true)
  })
})

describe('matchesTokens', () => {
  it('requires every token', () => {
    expect(matchesTokens('alpha beta', ['alpha', 'beta'])).toBe(true)
    expect(matchesTokens('alpha beta', ['alpha', 'gamma'])).toBe(false)
    expect(matchesTokens('anything', [])).toBe(true)
  })
})
