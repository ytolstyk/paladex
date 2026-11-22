import { describe, expect, it } from 'vitest'
import { describeCastTime, describeFeatureCost, describeFeatureKind, describeSpellCost, describeSpellKind } from './describe'
import { bless, deathCoil, guidance, layOnHands, protection, smite, testCatalog, vowOfEnmity } from './testing'

const catalog = testCatalog(undefined, [layOnHands, vowOfEnmity, deathCoil])

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
    expect(describeFeatureCost(deathCoil, catalog)).toBe('up to 3 from Lay On Hands at once')
  })
})

describe('kinds and cast times', () => {
  it('names the kind of spell and feature', () => {
    expect(describeSpellKind(bless)).toBe('1st-level Evocation')
    expect(describeSpellKind(guidance)).toBe('Evocation cantrip')
    expect(describeFeatureKind(layOnHands)).toBe('Class feature')
    expect(describeFeatureKind(deathCoil)).toBe('DM homebrew feature')
  })

  it('cast time carries a rider or a long casting note', () => {
    expect(describeCastTime(bless)).toBe('Action')
    expect(describeCastTime(smite)).toBe('Bonus action')
    expect(describeCastTime(vowOfEnmity)).toBe('Action, with the Attack action')
    expect(describeCastTime({ castTime: 'long', castingNote: '1 hour' })).toBe('1 hour')
  })
})
