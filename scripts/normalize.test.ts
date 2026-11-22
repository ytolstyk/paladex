import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import type { SeedData } from '../src/shared/types'
import { createCatalog } from '../src/renderer/domain/catalog'
import { abilityMod, proficiencyForLevel } from '../src/renderer/domain/derived'
import { evalArithmetic, htmlToText, normalizeDdb, resolvePlaceholder, resolvePlaceholders, slugify } from './normalize'
import { SeedSchema } from './seed-schema'

const SEED_PATH = 'data/havel.character.json'
const RAW_PATH = 'data/raw/ddb-character.json'
const seedText = readFileSync(SEED_PATH, 'utf8')
const seed: SeedData = JSON.parse(seedText)
const ref = JSON.parse(readFileSync('data/fixtures/ddb-reference.json', 'utf8'))
const spell = (name: string) => seed.character.spells.find((s) => s.name === name)
const counter = (id: string) => seed.character.counters.find((c) => c.id === id)

describe('seed matches the DDB reference sheet', () => {
  it('rendered numbers: HP max, AC, proficiency', () => {
    expect(seed.character.hpMax).toBe(ref.rendered.hpMax)
    expect(seed.character.ac).toBe(ref.rendered.armorClass)
    expect(seed.character.proficiencyBonus).toBe(ref.rendered.proficiencyBonus)
  })

  it('final ability scores include feat ASIs and the Amulet of Health', () => {
    expect(seed.character.abilities).toEqual(ref.abilityScores)
    expect(abilityMod(seed.character.abilities.dex)).toBe(ref.rendered.initiative)
  })

  it('resource pools', () => {
    expect(counter('lay-on-hands')?.max).toBe(ref.derived.layOnHandsPool)
    expect(counter('channel-divinity')?.max).toBe(ref.derived.channelDivinityUses)
    expect(counter('hit-dice')?.max).toBe(5)
    expect(counter('breath-weapon')?.max).toBe(3)
    expect(counter('death-coil')?.max).toBe(ref.derived.deathCoilDice)
  })

  it("the Arbiter's Ward is consumable and seeds from the sheet (1 charge left)", () => {
    const ward = counter('arbiters-ward')
    expect(ward).toMatchObject({ max: 6, restore: {} })
    expect(seed.seededUsed['arbiters-ward']).toBe(5)
  })

  it('chosen prepared spells are exactly what the sheet has', () => {
    expect([...seed.prepared].sort()).toEqual(['spell:bless', 'spell:lesser-restoration'])
  })

  it('always-prepared spells (oath, Smite, Steed) are flagged', () => {
    const always = seed.character.spells.filter((s) => s.alwaysPrepared).map((s) => s.name).sort()
    expect(always).toEqual(["Bane", 'Divine Smite', 'Find Steed', 'Hold Person', "Hunter's Mark", 'Misty Step'])
  })
})

describe('spell mechanics come from DDB (action economy is the whole point)', () => {
  it.each([
    ['Divine Smite', 'bonus', false],
    ["Hunter's Mark", 'bonus', true],
    ['Misty Step', 'bonus', false],
    ['Lesser Restoration', 'bonus', false],
    ['Bless', 'action', true],
    ['Bane', 'action', true],
    ['Hold Person', 'action', true],
    ['Find Steed', 'action', false],
    ['Protection from Evil and Good', 'action', true]
  ])('%s is a %s spell, concentration=%s', (name, castTime, concentration) => {
    expect(spell(name)).toMatchObject({ castTime, concentration })
  })

  it('Protection from Evil and Good is cast from the Ward first, and is a single card', () => {
    expect(spell('Protection from Evil and Good')?.costs[0]).toEqual({ kind: 'charge', counterId: 'arbiters-ward' })
    expect(seed.character.spells.filter((s) => s.id === 'spell:protection-from-evil-and-good')).toHaveLength(1)
  })

  it('Divine Smite and Find Steed list their free cast before a slot', () => {
    expect(spell('Divine Smite')?.costs).toEqual([{ kind: 'free', counterId: 'free-smite' }, { kind: 'slot' }])
    expect(spell('Find Steed')?.costs[0]).toEqual({ kind: 'free', counterId: 'free-find-steed' })
  })

  it('cantrips cost nothing', () => {
    for (const s of seed.character.spells.filter((x) => x.level === 0)) expect(s.costs).toEqual([{ kind: 'none' }])
  })

  it('saves are labelled from DDB', () => {
    expect(spell('Bane')?.tag).toBe('CHA save')
    expect(spell('Hold Person')?.tag).toBe('WIS save')
  })
})

describe('authored spells', () => {
  it('adds the rest of the 2024 Paladin level 1-2 list without duplicating sheet spells', () => {
    const ids = seed.character.spells.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(seed.character.spells.filter((s) => !s.ddbId)).toHaveLength(28)
    expect(seed.character.spells.every((s) => s.level <= 2)).toBe(true)
  })

  it('every spell is classified and described in one line', () => {
    for (const s of seed.character.spells) {
      expect(s.summary.length, s.name).toBeGreaterThan(5)
      expect(s.targets.length, s.name).toBeGreaterThan(0)
    }
  })

  it('long casting times carry their note', () => {
    for (const s of seed.character.spells.filter((x) => x.castTime === 'long')) expect(s.castingNote, s.name).toBeTruthy()
    expect(spell('Prayer of Healing')?.castingNote).toBe('10 minutes')
  })
})

describe('seed hygiene', () => {
  it('passes the seed schema exactly (no drift between the importer, the JSON and the types)', () => {
    expect(SeedSchema.safeParse(seed).success).toBe(true)
  })

  it('the schema rejects a malformed seed', () => {
    const broken = structuredClone(seed)
    ;(broken.character.spells[0] as unknown as { role: string }).role = 'wizard'
    expect(SeedSchema.safeParse(broken).success).toBe(false)
    const extra = { ...structuredClone(seed), surprise: 1 }
    expect(SeedSchema.safeParse(extra).success).toBe(false)
  })

  it('spell descriptions are plain text, never markup', () => {
    for (const s of seed.character.spells) expect(s.description ?? '', s.name).not.toMatch(/<[a-z!/][^>]*>/i)
  })

  it('builds a valid catalog (unique ids, every cost names a real counter)', () => {
    expect(() => createCatalog(seed)).not.toThrow()
  })

  it('contains no account identifiers', () => {
    for (const key of ['"userId"', '"username"', '"avatarUrl"', '"readonlyUrl"', '"isAssignedToPlayer"']) {
      expect(seedText).not.toContain(key)
    }
  })

  it('has no unresolved placeholders or empty fragments in any text', () => {
    expect(seedText).not.toMatch(/\{\{|\}\}|\[\[|\]\]/)
    expect(seedText).not.toContain('see D&D Beyond') // the marker for a placeholder we could not resolve
  })

  it('homebrew without a tile stays read-only; Death Coil became a tile with its dice count resolved', () => {
    const names = seed.otherFeatures.map((f) => f.name)
    expect(names.some((n) => n.startsWith('Circle Spell'))).toBe(true)
    expect(names).toContain('Undead Steed: Ghostly Stride')
    expect(names.some((n) => n.startsWith('Death Coil'))).toBe(false)
    const coil = seed.character.features.find((f) => f.id === 'feature:death-coil')
    expect(coil?.description).toContain('maximum number of dice you can expend at once equals 3') // CHA modifier, resolved from {{...}}
    expect(seed.character.counters.find((c) => c.id === 'death-coil')?.max).toBe(ref.derived.deathCoilDice)
  })
})

describe('feature tiles', () => {
  const feature = (id: string) => seed.character.features.find((f) => f.id === `feature:${id}`)

  it.each([
    ['lay-on-hands', 'bonus'],
    ['divine-sense', 'bonus'],
    ['draconic-flight', 'bonus'],
    ['death-coil', 'bonus'],
    ['vow-of-enmity', 'action'],
    ['breath-weapon', 'action']
  ])('%s takes a %s, as the sheet says (Vow and Breath Weapon are Attack-action riders, not bonus actions)', (id, castTime) => {
    expect(feature(id)?.castTime).toBe(castTime)
  })

  it('riders say when they apply', () => {
    expect(feature('vow-of-enmity')?.timing).toBe('with the Attack action')
    expect(feature('breath-weapon')?.timing).toBe('replaces one attack')
  })

  it('Lay On Hands spends from the 25-point pool; Vow and Divine Sense share Channel Divinity', () => {
    expect(feature('lay-on-hands')).toMatchObject({ counterId: 'lay-on-hands', spend: { kind: 'pool' } })
    expect(feature('vow-of-enmity')?.counterId).toBe('channel-divinity')
    expect(feature('divine-sense')?.counterId).toBe('channel-divinity')
  })

  it('Death Coil spends at most CHA-modifier dice at once (3 with CHA 16)', () => {
    expect(feature('death-coil')?.spend).toEqual({ kind: 'pool', maxPerUse: 3 })
  })

  it('Breath Weapon names its save and DC from the sheet text and our numbers (8 + CON + proficiency)', () => {
    expect(feature('breath-weapon')?.tag).toBe(`DEX save, DC ${ref.derived.breathWeaponDc}`)
  })

  it('every feature has full text', () => {
    for (const f of seed.character.features) expect(f.description?.length, f.name).toBeGreaterThan(20)
  })
})

// Regeneration check: only runs where the (gitignored) raw payload exists.
describe.skipIf(!existsSync(RAW_PATH))('regeneration from the raw payload', () => {
  it('reproduces the committed seed exactly, with no warnings', () => {
    const { seed: fresh, warnings } = normalizeDdb(JSON.parse(readFileSync(RAW_PATH, 'utf8')))
    expect(warnings).toEqual([])
    expect(fresh).toEqual(seed)
  })
})

describe('placeholder resolution', () => {
  const ctx = { level: 5, proficiency: 3, mods: { str: 4, dex: 1, con: 4, int: 0, wis: 2, cha: 3 } }

  it('evaluates + - * arithmetic without eval', () => {
    expect(evalArithmetic('1+3')).toBe(4)
    expect(evalArithmetic('5*5')).toBe(25)
    expect(evalArithmetic('2+3*4-1')).toBe(13)
    expect(evalArithmetic('process.exit()')).toBeNull()
    expect(evalArithmetic('1; 2')).toBeNull()
  })

  it('handles a negative number substituted into a product or sum (a bug in the first version)', () => {
    expect(evalArithmetic('2*-1')).toBe(-2)
    expect(evalArithmetic('3*-2+1')).toBe(-5)
    expect(evalArithmetic('1+-1')).toBe(0)
    expect(evalArithmetic('5--1')).toBe(6)
    expect(evalArithmetic('-2*-3')).toBe(6)
  })

  it('handles parentheses and division (the sheet uses both for Breath Weapon damage)', () => {
    expect(evalArithmetic('(1+2)*3')).toBe(9)
    expect(evalArithmetic('1+((1+5)/6)')).toBe(2)
    expect(evalArithmetic('7/2')).toBe(3.5) // exact: rounding is a separate, explicit step
    expect(evalArithmetic('2*(3+4)-(1)')).toBe(13)
  })

  it('rejects malformed expressions instead of guessing', () => {
    for (const bad of ['1+', '*2', '5**3', '--1', '1 2', '', '+1', '1+*2', '(1', '1)', '()', '1/0', '(1+)', '2(3)']) {
      expect(evalArithmetic(bad), bad).toBeNull()
    }
  })

  it('resolves the sheet\'s Breath Weapon dice, save DC and rounding rules', () => {
    expect(resolvePlaceholder('1+((1+characterlevel)/6)@rounddown', ctx)).toBe('2') // 2d10 at level 5
    expect(resolvePlaceholder('modifier:cha', ctx)).toBe('+3') // a modifier is a signed bonus
    expect(resolvePlaceholder('modifier:int', { ...ctx, mods: { ...ctx.mods, int: -1 } })).toBe('-1')
    expect(resolvePlaceholder('savedc:con', ctx)).toBe('15') // a DC has no sign: 8 + 4 + 3
    expect(resolvePlaceholder('characterlevel/2@roundup#unsigned', ctx)).toBe('3')
    expect(resolvePlaceholder('characterlevel/2#unsigned', ctx)).toBeNull() // 2.5 with no rounding rule
  })

  it('an option it does not understand makes the placeholder unresolvable instead of being ignored', () => {
    expect(resolvePlaceholder('modifier:cha@max:5', ctx)).toBeNull()
    expect(resolvePlaceholder('proficiency@bogus', ctx)).toBeNull()
    expect(resolvePlaceholder('modifier:cha@min:1#unsigned', ctx)).toBe('3')
  })

  it('only a bare modifier is signed; a minimum or any arithmetic makes it a plain number', () => {
    expect(resolvePlaceholder('modifier:cha', ctx)).toBe('+3')
    expect(resolvePlaceholder('modifier:cha+proficiency', ctx)).toBe('+6')
    expect(resolvePlaceholder('modifier:cha@min:1', ctx)).toBe('3')
    expect(resolvePlaceholder('2*modifier:cha', ctx)).toBe('6')
  })

  it('a placeholder with a negative modifier resolves correctly', () => {
    const negative = { level: 5, proficiency: 3, mods: { str: 0, dex: 0, con: 0, int: -1, wis: 0, cha: 0 } }
    expect(resolvePlaceholder('2*modifier:int#unsigned', negative)).toBe('-2')
  })

  it('placeholder keys cannot reach Object.prototype', () => {
    expect(resolvePlaceholder('modifier:constructor', ctx)).toBeNull()
    expect(resolvePlaceholder('modifier:__proto__', ctx)).toBeNull()
  })

  it('resolves DDB placeholders', () => {
    expect(resolvePlaceholder('5*classlevel', ctx)).toBe('25')
    expect(resolvePlaceholder('1+modifier:cha@min:1#unsigned', ctx)).toBe('4')
    expect(resolvePlaceholder('modifier:cha@min:1#unsigned', ctx)).toBe('3')
    expect(resolvePlaceholder('modifier:int@min:1#unsigned', ctx)).toBe('1') // floor of 1
    expect(resolvePlaceholder('savedc:con', ctx)).toBe('15')
    expect(resolvePlaceholder('mystery', ctx)).toBeNull()
  })

  it('replaces whole strings, marking anything unknown', () => {
    expect(resolvePlaceholders('pool of {{1+modifier:cha@min:1#unsigned}} dice', ctx)).toBe('pool of 4 dice')
    expect(resolvePlaceholders('{{weird}}', ctx)).toBe('[see D&D Beyond]')
  })

  it('slugifies names, dropping apostrophes', () => {
    expect(slugify("Hunter's Mark")).toBe('hunters-mark')
    expect(slugify('Protection from Evil and Good')).toBe('protection-from-evil-and-good')
  })

  it('strips tags and entities from HTML', () => {
    expect(htmlToText('<p>You&nbsp;gain&rsquo;s <b>this</b>.</p>')).toBe('You gain’s this.')
  })

  it('proficiency by level', () => {
    expect([1, 4, 5, 9, 13, 17].map(proficiencyForLevel)).toEqual([2, 2, 3, 4, 5, 6])
  })
})
