import { describe, expect, it } from 'vitest'
import type { LogEntry } from '@shared/schema'
import { castHistory, recentUses } from './recent'

const cast = (t: number, spellId: string, extra: Partial<LogEntry> = {}): LogEntry => ({ t, kind: 'cast', spellId, via: 'slot', level: 1, ...extra })
const feature = (t: number, featureId: string, amount = 1): LogEntry => ({ t, kind: 'feature', featureId, amount })
const at = (t: number, kind: LogEntry['kind']): LogEntry => ({ t, kind })

describe('recentUses', () => {
  it('lists the newest first and shows a repeated spell once, at its latest use', () => {
    const log = [cast(1, 'spell:bless'), cast(2, 'spell:shield'), cast(3, 'spell:bless')]
    expect(recentUses(log, 6).map((u) => u.id)).toEqual(['spell:bless', 'spell:shield'])
  })

  it('mixes spells and features and ignores every other kind of entry', () => {
    const log = [cast(1, 'spell:bless'), at(2, 'new-turn'), at(3, 'hp'), feature(4, 'feature:lay-on-hands', 5), at(5, 'favorite')]
    expect(recentUses(log, 6)).toEqual([
      { id: 'feature:lay-on-hands', kind: 'feature', t: 4, amount: 5 },
      { id: 'spell:bless', kind: 'cast', t: 1, level: 1, via: 'slot' }
    ])
  })

  it('stops at the limit', () => {
    const log = ['a', 'b', 'c', 'd'].map((id, i) => cast(i, `spell:${id}`))
    expect(recentUses(log, 2).map((u) => u.id)).toEqual(['spell:d', 'spell:c'])
  })

  it('skips an entry that lost its id (a hand-edited save)', () => {
    expect(recentUses([{ t: 1, kind: 'cast' }, { t: 2, kind: 'feature' }], 6)).toEqual([])
  })
})

describe('castHistory', () => {
  it('keeps repeats, newest first', () => {
    const log = [cast(1, 'spell:bless'), cast(2, 'spell:bless')]
    expect(castHistory(log, 10).map((r) => r.t)).toEqual([2, 1])
  })

  it('puts a break between the casts a new turn or a rest separates', () => {
    const log = [cast(1, 'spell:a'), at(2, 'new-turn'), cast(3, 'spell:b'), at(4, 'long-rest'), cast(5, 'spell:c')]
    expect(castHistory(log, 10).map((r) => (r.kind === 'break' ? r.label : r.kind === 'use' ? r.use.id : ''))).toEqual([
      'spell:c',
      'Long rest',
      'spell:b',
      'New turn',
      'spell:a'
    ])
  })

  it('shows one break for a run of them, and none at the top or the bottom', () => {
    const log = [at(0, 'new-turn'), cast(1, 'spell:a'), at(2, 'new-turn'), at(3, 'new-turn'), cast(4, 'spell:b'), at(5, 'new-turn')]
    expect(castHistory(log, 10).map((r) => r.kind)).toEqual(['use', 'break', 'use'])
  })

  it('counts only casts towards the limit', () => {
    const log = [cast(1, 'spell:a'), at(2, 'new-turn'), cast(3, 'spell:b'), at(4, 'new-turn')]
    expect(castHistory(log, 1).map((r) => r.t)).toEqual([3])
  })

  it('shows the rest, not the new turn after it, when both sit between two casts', () => {
    const log = [cast(1, 'spell:a'), at(2, 'long-rest'), at(3, 'new-turn'), cast(4, 'spell:b'), at(5, 'new-turn'), at(6, 'short-rest'), cast(7, 'spell:c')]
    const labels = castHistory(log, 10).flatMap((r) => (r.kind === 'break' ? [r.label] : []))
    expect(labels).toEqual(['Short rest', 'Long rest'])
  })
})
