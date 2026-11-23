import { describe, expect, it } from 'vitest'
import {
  describeCastTime,
  describeFeatureCost,
  describeFeatureKind,
  describeMastery,
  describeSpellCost,
  describeSpellKind,
  describeWeaponKind,
  paragraphsOf,
  plural
} from './describe'
import { bless, cappedPool, guidance, layOnHands, protection, smite, testCatalog, vowOfEnmity, weapon } from './testing'

const catalog = testCatalog(undefined, [layOnHands, vowOfEnmity, cappedPool])

describe('describeSpellCost', () => {
  it('lists options in the order the app offers them', () => {
    expect(describeSpellCost(smite, catalog)).toBe('a free cast (Free Smite), then a spell slot')
    expect(describeSpellCost(protection, catalog)).toBe('a charge (Ward), then a spell slot')
    expect(describeSpellCost(bless, catalog)).toBe('a spell slot')
    expect(describeSpellCost(guidance, catalog)).toBe('nothing (a cantrip)')
  })
})

describe('describeFeatureCost', () => {
  it('uses, pools, and per-use limits', () => {
    expect(describeFeatureCost(vowOfEnmity, catalog)).toBe('1 use of Channel Divinity')
    expect(describeFeatureCost(layOnHands, catalog)).toBe('any amount from Lay On Hands')
    expect(describeFeatureCost(cappedPool, catalog)).toBe('up to 3 from Lay On Hands at once')
  })
})

describe('kinds and cast times', () => {
  it('names the kind of spell and feature', () => {
    expect(describeSpellKind(bless)).toBe('1st-level Evocation')
    expect(describeSpellKind(guidance)).toBe('Evocation cantrip')
    expect(describeFeatureKind(layOnHands)).toBe('Class feature')
    expect(describeFeatureKind(cappedPool)).toBe('DM homebrew feature')
  })

  it('cast time carries a rider or a long casting note', () => {
    expect(describeCastTime(bless)).toBe('Action')
    expect(describeCastTime(smite)).toBe('Bonus action')
    expect(describeCastTime(vowOfEnmity)).toBe('Action, with the Attack action')
    expect(describeCastTime({ castTime: 'long', castingNote: '1 hour' })).toBe('1 hour')
  })
})

describe('weapon text', () => {
  it('names the kind: magic, melee or ranged, and the base weapon', () => {
    expect(describeWeaponKind(weapon({ baseType: 'Halberd', magic: true }))).toBe('Magic melee weapon, Halberd')
    expect(describeWeaponKind(weapon({ baseType: 'Heavy Crossbow', melee: false }))).toBe('Ranged weapon, Heavy Crossbow')
  })

  it('a mastery you chose is lit and keeps its rules text', () => {
    expect(describeMastery({ name: 'Cleave', text: 'Hit a second creature.', known: true })).toEqual({
      tone: 'mastery',
      label: 'Cleave',
      tooltip: 'Hit a second creature.'
    })
  })

  it('a mastery you did not choose is marked, never hidden, and says so in its tooltip', () => {
    const result = describeMastery({ name: 'Push', text: 'Shove it 10 feet.', known: false })
    expect(result).toMatchObject({ tone: 'muted', label: 'Push, not mastered' })
    expect(result.tooltip).toContain('have not chosen the Push mastery')
    expect(result.tooltip).toContain('Shove it 10 feet.')
  })
})

describe('paragraphsOf and plural', () => {
  it('splits on lines and drops the empty ones', () => {
    expect(paragraphsOf('One\n\n  \nTwo')).toEqual(['One', 'Two'])
    expect(paragraphsOf(undefined)).toEqual([])
    expect(paragraphsOf('')).toEqual([])
  })

  it('counts with the right word', () => {
    expect(plural(1, 'attack', 'attacks')).toBe('1 attack')
    expect(plural(0, 'attack', 'attacks')).toBe('0 attacks')
    expect(plural(2, 'attack', 'attacks')).toBe('2 attacks')
  })
})
