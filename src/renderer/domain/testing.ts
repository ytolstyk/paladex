// Shared test fixtures. Not imported by app code.
import type { PlayState } from '@shared/schema'
import type { CounterDef, Feature, SeedData, Spell } from '@shared/types'
import { createCatalog, type Catalog } from './catalog'
import { seedPlayState } from './hydrate'
import { isChoosable } from './prepared'

export function spell(over: Partial<Spell> = {}): Spell {
  return {
    id: 'spell:test',
    name: 'Test',
    level: 1,
    school: 'Evocation',
    castTime: 'action',
    concentration: false,
    components: { verbal: true, somatic: false, material: false },
    range: 'Self',
    duration: 'Instantaneous',
    role: 'utility',
    targets: ['self'],
    summary: '',
    source: 'class',
    costs: [{ kind: 'slot' }],
    verified: true,
    ...over
  }
}

export const testCounters: CounterDef[] = [
  { id: 'free-smite', label: 'Free Smite', max: 1, kind: 'uses', restore: { long: 'full' } },
  { id: 'ward', label: 'Ward', max: 6, kind: 'uses', restore: {} },
  { id: 'lay-on-hands', label: 'Lay On Hands', max: 25, kind: 'pool', restore: { long: 'full' } },
  { id: 'channel-divinity', label: 'Channel Divinity', max: 2, kind: 'uses', restore: { long: 'full' } }
]

export const layOnHands: Feature = {
  id: 'feature:lay-on-hands',
  name: 'Lay On Hands',
  castTime: 'bonus',
  role: 'support',
  targets: ['ally'],
  summary: 'Heal from a pool',
  source: 'class',
  counterId: 'lay-on-hands',
  spend: { kind: 'pool' }
}
export const vowOfEnmity: Feature = {
  id: 'feature:vow-of-enmity',
  name: 'Vow of Enmity',
  castTime: 'action',
  timing: 'with the Attack action',
  role: 'offense',
  targets: ['enemy'],
  summary: 'Vow against a creature',
  source: 'class',
  counterId: 'channel-divinity',
  spend: { kind: 'uses' }
}
/**
 * A pool feature with a per-use cap, to test `maxPerUse`. It draws on the Lay On Hands counter so the test catalog needs no
 * extra counter, and `source: 'homebrew'` is relied on by describe.test.ts.
 */
export const cappedPool: Feature = {
  id: 'feature:capped-pool',
  name: 'Capped Pool',
  castTime: 'bonus',
  role: 'offense',
  targets: ['enemy'],
  summary: 'Spend a few points from a shared pool at once',
  source: 'homebrew',
  counterId: 'lay-on-hands',
  spend: { kind: 'pool', maxPerUse: 3 }
}

export const smite = spell({
  id: 'spell:divine-smite',
  name: 'Divine Smite',
  castTime: 'bonus',
  role: 'offense',
  summary: 'Radiant damage after a melee hit',
  alwaysPrepared: true,
  costs: [{ kind: 'free', counterId: 'free-smite' }, { kind: 'slot' }]
})
export const bless = spell({ id: 'spell:bless', name: 'Bless', concentration: true, role: 'support', summary: 'Allies add a d4' })
export const holdPerson = spell({ id: 'spell:hold-person', name: 'Hold Person', level: 2, concentration: true, role: 'control' })
export const cure = spell({ id: 'spell:cure-wounds', name: 'Cure Wounds', role: 'support', summary: 'Heal a touched creature' })
export const mistyStep = spell({ id: 'spell:misty-step', name: 'Misty Step', level: 2, castTime: 'bonus', role: 'utility', alwaysPrepared: true })
export const protection = spell({
  id: 'spell:protection',
  name: 'Protection from Evil and Good',
  concentration: true,
  role: 'support',
  source: 'item',
  // Cast from the Ward's charges; also a real Paladin spell, so it can be prepared and cast from a slot.
  costs: [{ kind: 'charge', counterId: 'ward' }, { kind: 'slot' }]
})
export const guidance = spell({ id: 'spell:guidance', name: 'Guidance', level: 0, source: 'cantrip', costs: [{ kind: 'none' }] })

export function testCatalog(
  spells: Spell[] = [smite, bless, holdPerson, protection, guidance, cure, mistyStep],
  features: Feature[] = [layOnHands, vowOfEnmity]
): Catalog {
  const seed: SeedData = {
    character: {
      name: 'Test',
      race: 'Human',
      className: 'Paladin',
      subclass: 'Test',
      level: 5,
      abilities: { str: 16, dex: 11, con: 14, int: 10, wis: 14, cha: 15 },
      proficiencyBonus: 3,
      spellcastingAbility: 'cha',
      hpMax: 52,
      ac: 16,
      spells,
      counters: testCounters,
      features
    },
    // Like the real sheet: choosable spells start chosen, except the item-granted one (it is cast from the Ward instead).
    prepared: spells.filter((s) => isChoosable(s) && s.source !== 'item').map((s) => s.id),
    seededUsed: {},
    otherFeatures: []
  }
  return createCatalog(seed)
}

export function freshState(catalog: Catalog = testCatalog(), now = 0): PlayState {
  return seedPlayState(catalog, now)
}
