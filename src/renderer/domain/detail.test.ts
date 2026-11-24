import { describe, expect, it } from 'vitest'
import { describeDetail, detailEntry } from './detail'
import { bless, layOnHands, testCatalog, trait, weapon } from './testing'

const HEAVY = { name: 'Heavy', text: 'Disadvantage if too weak.' }
const warhammer = weapon({
  id: 'weapon:warhammer',
  name: 'Warhammer',
  baseType: 'Warhammer',
  damage: { dice: '1d8', type: 'Bludgeoning', versatile: '1d10' },
  properties: [HEAVY],
  mastery: { name: 'Push', text: 'Shove it.', known: false }
})
const ward = weapon({ id: 'weapon:ward', name: 'The Ward', magic: true, attunement: 'not-attuned', description: 'Six charges.\n\nIt fades.' })
const darkvision = trait({ id: 'trait:darkvision', name: 'Darkvision', kind: 'species', origin: 'Dragonborn', when: 'passive', text: 'Sixty feet.\nSee in the dark.' })
const oathSpells = trait({ id: 'trait:oath-spells', name: 'Oath Spells', kind: 'oath', origin: 'Oath of Vengeance, level 3', related: [bless.id, layOnHands.id] })
const catalog = testCatalog([bless], [layOnHands], [warhammer, ward], [darkvision, oathSpells])

describe('detailEntry', () => {
  it('finds a spell, a feature, a weapon and a trait by id, and nothing else', () => {
    expect(detailEntry(catalog, 'trait:darkvision')?.kind).toBe('trait')
    expect(detailEntry(catalog, 'trait:nope')).toBeNull()
    expect(detailEntry(catalog, bless.id)?.kind).toBe('spell')
    expect(detailEntry(catalog, layOnHands.id)?.kind).toBe('feature')
    expect(detailEntry(catalog, 'weapon:warhammer')?.kind).toBe('weapon')
    expect(detailEntry(catalog, 'weapon:nope')).toBeNull()
  })
})

describe('describeDetail', () => {
  const model = (id: string) => describeDetail(detailEntry(catalog, id)!, catalog)

  it('a spell lists its facts and leaves out the ones it has nothing to say for', () => {
    const labels = model(bless.id).facts.map((f) => f.label)
    expect(labels).toContain('Casting time')
    expect(labels).toContain('Costs')
    expect(labels).not.toContain('Ritual')
  })

  it('a weapon shows its numbers from the character and one paragraph per property, then the mastery', () => {
    const detail = model('weapon:warhammer')
    expect(detail.title).toBe('Warhammer')
    expect(detail.kind).toBe('Melee weapon, Warhammer')
    expect(Object.fromEntries(detail.facts.map((f) => [f.label, f.text]))).toMatchObject({
      'To hit': '+6 (STR +3, proficiency +3)',
      Damage: '1d8+3 bludgeoning, 1d10+3 with two hands',
      'Reach or range': 'Reach 5 ft'
    })
    expect(detail.paragraphs.map((p) => p.lead)).toEqual(['Heavy', 'Mastery: Push (not chosen)'])
  })

  it('a magic weapon names its attunement and carries its own description, a paragraph per line', () => {
    const detail = model('weapon:ward')
    expect(detail.facts.find((f) => f.label === 'Attunement')?.text).toBe('Needs attunement (not attuned)')
    expect(detail.paragraphs.map((p) => p.text)).toEqual(['Six charges.', 'It fades.'])
  })

  it('a trait says where it is from and when it applies, with a paragraph per line of its text', () => {
    const detail = model('trait:darkvision')
    expect(detail.title).toBe('Darkvision')
    expect(detail.kind).toBe('Species trait')
    expect(Object.fromEntries(detail.facts.map((f) => [f.label, f.text]))).toEqual({ From: 'Dragonborn', When: 'Always on' })
    expect(detail.paragraphs.map((p) => p.text)).toEqual(['Sixty feet.', 'See in the dark.'])
  })

  it('a trait names the spells and tiles it points at', () => {
    expect(model('trait:oath-spells').facts.find((f) => f.label === 'See also')?.text).toBe('Bless, Lay On Hands')
  })
})
