import { describe, expect, it } from 'vitest'
import { DIFF_KEYS, describeDifference, sheetDiffers } from './stateDiff'
import { bless, freshState, testCatalog } from './testing'

const catalog = testCatalog()
const base = freshState(catalog)

describe('describeDifference', () => {
  it('words every key of the play state, reports it generically, or ignores it on purpose', () => {
    for (const key of Object.keys(base)) expect(DIFF_KEYS, key).toContain(key)
  })

  it('says nothing for an unchanged sheet, and ignores the log', () => {
    expect(describeDifference(base, { ...base, log: [] }, catalog)).toEqual([])
    expect(sheetDiffers(base, { ...base, log: [] })).toBe(false)
  })

  it('words the parts of the sheet that changed', () => {
    const next = {
      ...base,
      vitals: { ...base.vitals, hp: 40 },
      slotsUsed: { '1': 2 },
      counters: { 'free-smite': 1 },
      concentration: bless.id,
      timers: [{ spellId: bless.id, remaining: 54, total: 60 }],
      prepared: [],
      favorites: [bless.id],
      initiative: 12
    }
    const lines = describeDifference(base, next, catalog)
    expect(lines).toEqual(
      expect.arrayContaining([
        'Hit points: 52 → 40',
        'Level 1 slots used: 0 → 2',
        'Free Smite used: 0 → 1',
        'Concentration: none → Bless',
        'Bless timer: not running → 54 s left',
        'Favorites: + Bless',
        'Initiative: none → 12'
      ])
    )
    expect(lines.some((l) => l.startsWith('Prepared: −'))).toBe(true)
  })

  it('still reports a key it has no wording for, so a difference never looks empty', () => {
    const lines = describeDifference(base, { ...base, roleOverrides: { [bless.id]: 'control' } }, catalog)
    expect(lines).toEqual(['roleOverrides changes'])
  })
})
