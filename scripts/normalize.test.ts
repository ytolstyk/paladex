import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import type { SeedData } from '../src/shared/types'
import { createCatalog } from '../src/renderer/domain/catalog'
import { abilityMod, proficiencyForLevel } from '../src/renderer/domain/derived'
import { evalArithmetic, htmlToText, normalizeDdb, resolvePlaceholder, resolvePlaceholders, slugify, weaponKindKey } from './normalize'
import { ATTACK_RIDER_FEATURES, ATTACK_RIDER_SPELLS } from './data/attack-riders'
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

describe('spell components', () => {
  it('come from the DDB codes (1 verbal, 2 somatic, 3 material) and name the item', () => {
    expect(spell('Misty Step')?.components).toEqual({ verbal: true, somatic: false, material: false })
    expect(spell('Lesser Restoration')?.components).toEqual({ verbal: true, somatic: true, material: false })
    expect(spell('Bane')?.components).toEqual({ verbal: true, somatic: true, material: true, materialText: 'a drop of blood' })
    expect(spell('Protection from Evil and Good')?.components.materialText).toMatch(/Holy Water worth 25\+ GP, which the spell consumes/)
  })

  it('authored spells carry them too, with the item where the page could be read', () => {
    expect(spell('Command')?.components).toEqual({ verbal: true, somatic: false, material: false })
    expect(spell('Searing Orb')?.components).toEqual({ verbal: false, somatic: true, material: true })
    expect(spell('Shield of Faith')?.components.materialText).toBe('a prayer scroll')
  })

  it('every material component either names its item or is one of the few we could not read', () => {
    const unnamed = seed.character.spells.filter((s) => s.components.material && !s.components.materialText).map((s) => s.name)
    expect(unnamed.sort()).toEqual(['Ceremony', 'Dueling Ground', 'Searing Orb', 'Wardaway'])
  })

  it('the schema rejects item text on a spell with no material component', () => {
    const broken = structuredClone(seed)
    const [first] = broken.character.spells
    if (!first) throw new Error('seed has no spells')
    first.components = { verbal: true, somatic: false, material: false, materialText: 'a feather' }
    expect(SeedSchema.safeParse(broken).success).toBe(false)
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

  it('homebrew without a tile stays read-only, as traits of the homebrew kind', () => {
    const homebrew = seed.traits.filter((t) => t.kind === 'homebrew').map((t) => t.name)
    expect(homebrew.some((n) => n.startsWith('Circle Spell'))).toBe(true)
    expect(homebrew).toContain('Undead Steed: Ghostly Stride')
  })

  it('Death Coil is on the DDB sheet but the table never used it, so it stays out of the app (the regeneration check below makes this hold for a re-import too)', () => {
    expect(JSON.stringify(seed)).not.toMatch(/death.?coil/i)
  })
})

describe('feats and traits', () => {
  const trait = (name: string) => seed.traits.find((t) => t.name === name)
  const names = (kind: string) => seed.traits.filter((t) => t.kind === kind).map((t) => t.name)

  it('lists the Oath features reached so far (level 5), with the later ones left for a level-up re-seed', () => {
    expect(names('oath')).toEqual(['Oath of Vengeance Spells', 'Vow of Enmity'])
    expect(trait('Vow of Enmity')?.origin).toBe('Oath of Vengeance, level 3')
    expect(trait('Relentless Avenger')).toBeUndefined() // level 7
  })

  it('lists the Dragonborn traits that matter at the table, not size, speed or the one-time score choice', () => {
    expect(names('species')).toEqual(['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance', 'Darkvision', 'Draconic Flight', 'Languages'])
    for (const ignored of ['Creature Type', 'Size', 'Speed', 'Ability Score Increases']) expect(trait(ignored)).toBeUndefined()
  })

  it('lists the feats and the Fighting Style, but not the ability score improvements', () => {
    expect(names('feat')).toEqual(['Savage Attacker', 'Blessed Warrior', 'Weapon Mastery', 'Dark Bargain'])
    expect(JSON.stringify(seed.traits)).not.toContain('Ability Score Improvement')
  })

  it('reads the chosen dragon, not the generic table: the ancestor is Black and the breath and resistance are acid', () => {
    expect(trait('Draconic Ancestry')?.text).toBe('You have a Black Dragon ancestor.')
    expect(trait('Breath Weapon')?.text).toContain('Acid damage')
    expect(trait('Damage Resistance')?.text).toContain('Acid')
  })

  it('adds what the sheet chose elsewhere: the languages known and the weapon masteries picked', () => {
    expect(trait('Languages')?.text).toContain('Languages you know from your species: Common, Draconic, Orc.')
    expect(trait('Languages')?.text).not.toContain('Sigil') // the sheet appends the whole Standard Languages table; its rows are cut
    expect(trait('Weapon Mastery')?.text).toMatch(/Chosen on the sheet .*Cleave \(Halberd\)/)
  })

  it('keeps a rules table on readable lines, one row each', () => {
    expect(trait('Oath of Vengeance Spells')?.text).toMatch(/^3 \| Bane, Hunter’s Mark$/m)
  })

  it('points at spells and tiles that exist, so a card can open them', () => {
    const ids = new Set([...seed.character.spells, ...seed.character.features].map((x) => x.id))
    const related = seed.traits.flatMap((t) => t.related ?? [])
    expect(related.length).toBeGreaterThan(0)
    for (const id of related) expect(ids.has(id), id).toBe(true)
    expect(trait('Oath of Vengeance Spells')?.related).toEqual(['spell:bane', 'spell:hunters-mark', 'spell:hold-person', 'spell:misty-step'])
  })

  it('every trait has a summary and its text, with no markup or leftover placeholder', () => {
    for (const t of seed.traits) {
      expect(t.summary.length, t.name).toBeGreaterThan(10)
      expect(t.text.length, t.name).toBeGreaterThan(10)
      expect(t.text, t.name).not.toMatch(/<[a-z!/][^>]*>|\{\{|\[\/?[a-z]+\]/i)
    }
  })

  it('ids are unique and made from the name', () => {
    const ids = seed.traits.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(trait('Circle Spell: Augment')?.id).toBe('trait:circle-spell-augment')
  })
})

describe('feature tiles', () => {
  const feature = (id: string) => seed.character.features.find((f) => f.id === `feature:${id}`)

  it.each([
    ['lay-on-hands', 'bonus'],
    ['divine-sense', 'bonus'],
    ['draconic-flight', 'bonus'],
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

  it('Breath Weapon names its save and DC from the sheet text and our numbers (8 + CON + proficiency)', () => {
    expect(feature('breath-weapon')?.tag).toBe(`DEX save, DC ${ref.derived.breathWeaponDc}`)
  })

  it('every feature has full text', () => {
    for (const f of seed.character.features) expect(f.description?.length, f.name).toBeGreaterThan(20)
  })
})

// Regeneration check: only runs where the (gitignored) raw payload exists.
describe.skipIf(!existsSync(RAW_PATH))('regeneration from the raw payload', () => {
  it('gives a second weapon of the same name its own id, so the catalog accepts the seed', () => {
    const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'))
    const warhammer = raw.data.inventory.find((i: { definition: { name: string } }) => i.definition.name === 'Warhammer')
    raw.data.inventory.push(structuredClone(warhammer))
    const { seed: twice } = normalizeDdb(raw)
    expect(twice.character.weapons.filter((w) => w.name === 'Warhammer').map((w) => w.id)).toEqual(['weapon:warhammer', 'weapon:warhammer-2'])
  })

  it('reproduces the committed seed exactly, with no warnings', () => {
    const { seed: fresh, warnings } = normalizeDdb(JSON.parse(readFileSync(RAW_PATH, 'utf8')))
    expect(warnings).toEqual([])
    expect(fresh).toEqual(seed)
  })
})

describe.skipIf(!existsSync(RAW_PATH))('traits and a changing sheet', () => {
  const raw = (): { data: Record<string, any> } => JSON.parse(readFileSync(RAW_PATH, 'utf8')) // eslint-disable-line @typescript-eslint/no-explicit-any

  it('warns about a feat the overlay does not know, so it is not lost silently', () => {
    const payload = raw()
    const [first] = payload.data.feats
    payload.data.feats.push({ ...structuredClone(first), definition: { ...structuredClone(first.definition), name: 'Tough' } })
    const { warnings, seed: next } = normalizeDdb(payload)
    expect(warnings.join('\n')).toContain('the feat "Tough"')
    expect(next.traits.some((t) => t.name === 'Tough')).toBe(false)
  })

  it('shows an Oath feature once the level is reached', () => {
    const payload = raw()
    payload.data.classes[0].level = 7
    const { seed: leveled } = normalizeDdb(payload)
    expect(leveled.traits.map((t) => t.name)).toContain('Relentless Avenger')
    expect(leveled.traits.find((t) => t.name === 'Relentless Avenger')?.origin).toBe('Oath of Vengeance, level 7')
  })

  it('skips an entry the sheet no longer has, with a warning', () => {
    const payload = raw()
    payload.data.feats = payload.data.feats.filter((f: { definition: { name: string } }) => f.definition.name !== 'Savage Attacker')
    const { warnings, seed: next } = normalizeDdb(payload)
    expect(warnings.join('\n')).toContain('Trait "Savage Attacker" skipped')
    expect(next.traits.some((t) => t.name === 'Savage Attacker')).toBe(false)
  })
})

describe('weapons', () => {
  const weapon = (name: string) => seed.character.weapons.find((w) => w.name === name)

  it('lists the four carried weapons, the magic one first', () => {
    expect(seed.character.weapons.map((w) => w.name)).toEqual(['The Arbiter’s Ward', 'Crossbow, Heavy', 'Halberd', 'Warhammer'])
    expect(seed.character.weapons.map((w) => w.id)).toEqual([
      'weapon:the-arbiters-ward',
      'weapon:crossbow-heavy',
      'weapon:halberd',
      'weapon:warhammer'
    ])
  })

  it('reads melee or ranged, damage and range from the sheet', () => {
    expect(weapon('Warhammer')).toMatchObject({ melee: true, damage: { dice: '1d8', type: 'Bludgeoning', versatile: '1d10' }, range: { normal: 5 } })
    expect(weapon('Crossbow, Heavy')).toMatchObject({ melee: false, damage: { dice: '1d10', type: 'Piercing' }, range: { normal: 100, long: 400 } })
    expect(weapon('Halberd')).toMatchObject({ melee: true, baseType: 'Halberd', damage: { dice: '1d10', type: 'Slashing' } })
  })

  it('the Arbiter’s Ward is a magic Halberd that needs attunement and has not got it', () => {
    expect(weapon('The Arbiter’s Ward')).toMatchObject({ baseType: 'Halberd', magic: true, attunement: 'not-attuned' })
    expect(weapon('Halberd')?.attunement).toBeUndefined()
    expect(weapon('The Arbiter’s Ward')?.description).toContain('6 charges')
    expect(weapon('Warhammer')?.description).toBeUndefined()
  })

  it('every weapon is proficient (the class modifiers list simple and martial weapons)', () => {
    expect(seed.character.weapons.every((w) => w.proficient)).toBe(true)
  })

  it('masteries: only the Halberd kind is chosen on the sheet, so the Ward and Halberd have Cleave and Push is not available', () => {
    expect(weapon('Halberd')?.mastery).toMatchObject({ name: 'Cleave', known: true })
    expect(weapon('The Arbiter’s Ward')?.mastery).toMatchObject({ name: 'Cleave', known: true })
    expect(weapon('Warhammer')?.mastery).toMatchObject({ name: 'Push', known: false })
    expect(weapon('Crossbow, Heavy')?.mastery).toMatchObject({ name: 'Push', known: false })
    // The mastery is a field of its own, not also an ordinary property.
    expect(weapon('Halberd')?.properties.map((p) => p.name)).toEqual(['Heavy', 'Reach', 'Two-Handed'])
  })

  it('a level 5 Paladin knows at most two kinds of mastery', () => {
    const kinds = new Set(seed.character.weapons.filter((w) => w.mastery?.known).map((w) => weaponKindKey(w.baseType)))
    expect(kinds.size).toBeLessThanOrEqual(2)
  })

  it('"Graze (Greatsword)" is chosen on the sheet but no Greatsword is carried: a deliberate tripwire, so a new Greatsword shows Graze as known', () => {
    expect(seed.character.weapons.some((w) => weaponKindKey(w.baseType) === weaponKindKey('Greatsword'))).toBe(false)
  })

  it('the Versatile property carries its two-handed dice, and rules text has no markup or reference tags', () => {
    expect(weapon('Warhammer')?.properties[0]).toMatchObject({ name: 'Versatile' })
    expect(weapon('Warhammer')?.properties[0]?.text).toContain('1d10')
    expect(JSON.stringify(seed.character.weapons)).not.toMatch(/\[\/?[a-z]+\]|<\/?[a-z]/i)
    expect(weapon('Halberd')?.properties.find((p) => p.name === 'Heavy')?.text).toContain('Disadvantage on attack rolls')
  })

  it('kinds compare regardless of word order, so "Crossbow, Heavy" is the Heavy Crossbow', () => {
    expect(weaponKindKey('Crossbow, Heavy')).toBe(weaponKindKey('Heavy Crossbow'))
    expect(weaponKindKey('Halberd')).not.toBe(weaponKindKey('Glaive'))
  })

  it('every rider id the importer is told about exists and is flagged, and only those', () => {
    const flaggedSpells = seed.character.spells.filter((s) => s.attackRider).map((s) => s.id)
    const flaggedFeatures = seed.character.features.filter((f) => f.attackRider).map((f) => f.id)
    expect(flaggedSpells.sort()).toEqual([...ATTACK_RIDER_SPELLS].sort())
    expect(flaggedFeatures.sort()).toEqual([...ATTACK_RIDER_FEATURES].sort())
  })

  it('keeps the cells of a table row on one line, separated by a bar, and rows on their own lines', () => {
    expect(htmlToText('<table><tr><th>Level</th><th>Spells</th></tr><tr><td>3</td><td>Bane</td></tr></table>')).toBe('Level | Spells\n3 | Bane')
  })

  it('strips D&D Beyond reference tags, keeping the display text after a semicolon', () => {
    expect(htmlToText('<p>[rules]Disadvantage[/rules] and [action]Opportunity Attack;Opportunity Attacks[/action] ([wprop]Thrown[/wprop])</p>')).toBe(
      'Disadvantage and Opportunity Attacks (Thrown)'
    )
  })

  it('the schema rejects a weapon with a malformed damage die', () => {
    const bad = structuredClone(seed)
    bad.character.weapons[0]!.damage.dice = 'lots'
    expect(SeedSchema.safeParse(bad).success).toBe(false)
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
