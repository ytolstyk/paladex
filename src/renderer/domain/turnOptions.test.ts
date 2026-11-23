import { describe, expect, it } from 'vitest'
import { adjustCounter } from './actions'
import { bless, freshState, layOnHands, mistyStep, smite, spell, testCatalog, vowOfEnmity } from './testing'
import { turnOptions } from './turnOptions'

const shield = spell({ id: 'spell:shield', name: 'Shield', level: 1, castTime: 'reaction' })
const flame = spell({ id: 'spell:flame', name: 'Flame', level: 1, castTime: 'bonus' }) // a chosen spell, not always prepared
const divineSense = { ...layOnHands, id: 'feature:divine-sense', name: 'Divine Sense', counterId: 'channel-divinity', spend: { kind: 'uses' as const } }
const catalog = testCatalog([bless, smite, mistyStep, shield, flame], [layOnHands, vowOfEnmity, divineSense])
const names = (list: { name: string }[]) => list.map((o) => o.name)

describe('turnOptions', () => {
  it('sorts the character\'s spells and features by casting time: bonus action and reaction', () => {
    const options = turnOptions(catalog, freshState(catalog))
    expect(names(options.bonus)).toEqual(expect.arrayContaining(['Divine Smite', 'Lay On Hands', 'Divine Sense']))
    expect(names(options.bonus)).not.toContain('Bless') // an action
    expect(names(options.bonus)).not.toContain('Vow of Enmity') // an action
    expect(names(options.reaction)).toEqual(['Shield'])
  })

  it('leaves out a spell that is not prepared, and lists it once it is', () => {
    const fresh = freshState(catalog)
    const unprepared = { ...fresh, prepared: fresh.prepared.filter((id) => id !== flame.id) }
    expect(names(turnOptions(catalog, unprepared).bonus)).not.toContain('Flame')
    expect(names(turnOptions(catalog, { ...unprepared, prepared: [...unprepared.prepared, flame.id] }).bonus)).toContain('Flame')
  })

  it('marks an option not ready when nothing is left to pay for it', () => {
    const fresh = freshState(catalog)
    const spent = { ...fresh, slotsUsed: { '1': 4, '2': 2 } }
    const smiteOption = (state: typeof fresh) => turnOptions(catalog, state).bonus.find((o) => o.name === 'Divine Smite')!
    expect(smiteOption(fresh).ready).toBe(true)
    // Divine Smite has a free cast too, so it stays ready until that is used as well.
    expect(smiteOption(spent).ready).toBe(true)
    const noFree = { ...spent, counters: { ...spent.counters, 'free-smite': 1 } }
    expect(smiteOption(noFree).ready).toBe(false)
  })

  it('marks a feature not ready when its counter is empty', () => {
    const fresh = freshState(catalog)
    const empty = adjustCounter(fresh, catalog, 'channel-divinity', -99, 1)!.state
    const sense = (state: typeof fresh) => turnOptions(catalog, state).bonus.find((o) => o.name === 'Divine Sense')!
    expect(sense(fresh).ready).toBe(true)
    expect(sense(empty).ready).toBe(false)
  })
})
