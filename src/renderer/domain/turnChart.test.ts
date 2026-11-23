import { describe, expect, it } from 'vitest'
import { emptyTurn } from '@shared/constants'
import { stillAvailable } from './turn'
import { buildTurnChart, type ChartNode } from './turnChart'
import { NO_TURN_OPTIONS } from './turnOptions'

const base = { attacksPerAction: 2, turn: emptyTurn(), concentrationName: null, options: NO_TURN_OPTIONS }
const find = (nodes: ChartNode[], key: string): ChartNode => nodes.find((n) => n.key === key)!

describe('buildTurnChart', () => {
  it('goes through the turn in order, ending with what is left', () => {
    expect(buildTurnChart(base).map((n) => n.key)).toEqual(['start', 'move', 'action', 'bonus', 'free', 'reaction', 'end'])
  })

  it('a step the player tracks shows ready or used, in words', () => {
    const fresh = buildTurnChart(base)
    expect(find(fresh, 'move').status).toEqual({ text: 'Not moved', used: false })
    expect(find(fresh, 'reaction').status).toEqual({ text: 'Reaction ready', used: false })
    const spent = buildTurnChart({ ...base, turn: { ...emptyTurn(), moved: true, bonusActionSpent: true, actionSpent: true, reactionSpent: true } })
    expect(find(spent, 'move').status).toEqual({ text: 'Moved', used: true })
    expect(find(spent, 'bonus').status).toEqual({ text: 'Bonus action used', used: true })
    expect(find(spent, 'action').status).toEqual({ text: 'Action used', used: true })
    expect(find(spent, 'reaction').status).toEqual({ text: 'Reaction used', used: true })
  })

  it('names the attack count, and links to the weapons view', () => {
    const attack = find(buildTurnChart(base), 'action').children.find((c) => c.key === 'attack')!
    expect(attack.hint).toContain('2 attacks')
    expect(attack.link).toEqual({ label: 'Weapons & attacks', to: 'attacks' })
    expect(find(buildTurnChart({ ...base, attacksPerAction: 1 }), 'action').children[0]?.hint).toContain('1 attack ')
  })

  it('shows whether the one slot for the turn is spent', () => {
    const magic = (turn = emptyTurn()) => find(buildTurnChart({ ...base, turn }), 'action').children.find((c) => c.key === 'magic')!
    expect(magic().status).toEqual({ text: 'Spell slot free', used: false })
    expect(magic({ ...emptyTurn(), slotSpellCast: true }).status).toEqual({ text: 'Spell slot spent', used: true })
  })

  it('reminds you what you are concentrating on', () => {
    expect(find(buildTurnChart(base), 'start').leaves).toEqual([])
    expect(find(buildTurnChart({ ...base, concentrationName: 'Bless' }), 'start').leaves[0]?.text).toContain('Bless')
  })

  it('lists the bonus action options (dimmed when unusable) and says so when there are none', () => {
    const options = { bonus: [{ id: 'spell:a', name: 'A', ready: true }, { id: 'spell:b', name: 'B', ready: false }], reaction: [] }
    expect(find(buildTurnChart({ ...base, options }), 'bonus').leaves).toEqual([
      { text: 'A', id: 'spell:a', ready: true },
      { text: 'B', id: 'spell:b', ready: false }
    ])
    expect(find(buildTurnChart(base), 'bonus').leaves[0]?.text).toContain('Nothing')
  })

  it('the reaction always lists the Opportunity Attack, then the character\'s own', () => {
    const options = { bonus: [], reaction: [{ id: 'spell:shield', name: 'Shield', ready: true }] }
    expect(find(buildTurnChart({ ...base, options }), 'reaction').leaves.map((l) => l.text)).toEqual(['Opportunity Attack', 'Shield'])
    expect(find(buildTurnChart(base), 'reaction').leaves.map((l) => l.text)).toEqual(['Opportunity Attack'])
  })
})

describe('stillAvailable', () => {
  const ready = { bonus: [{ id: 'x', name: 'X', ready: true }], reaction: [] }

  it('reminds of the bonus action only when something could use it, and always of the reaction', () => {
    expect(stillAvailable(emptyTurn(), ready)).toEqual(['Bonus action', 'Reaction'])
    expect(stillAvailable(emptyTurn(), NO_TURN_OPTIONS)).toEqual(['Reaction'])
    expect(stillAvailable(emptyTurn(), { bonus: [{ id: 'x', name: 'X', ready: false }], reaction: [] })).toEqual(['Reaction'])
  })

  it('leaves out what was used, and never nags about the action or movement', () => {
    expect(stillAvailable({ ...emptyTurn(), bonusActionSpent: true, reactionSpent: true }, ready)).toEqual([])
    expect(stillAvailable(emptyTurn(), NO_TURN_OPTIONS)).not.toContain('Action')
    expect(stillAvailable(emptyTurn(), NO_TURN_OPTIONS)).not.toContain('Move')
  })

  it('says there is nothing left to remember on the end node', () => {
    const done = { ...emptyTurn(), bonusActionSpent: true, reactionSpent: true }
    expect(find(buildTurnChart({ ...base, turn: done, options: ready }), 'end').hint).toBe('Nothing left to remember.')
    expect(find(buildTurnChart({ ...base, options: ready }), 'end').hint).toBe('Still available: Bonus action, Reaction.')
  })
})
