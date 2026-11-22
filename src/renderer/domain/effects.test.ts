import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { seed } from '@/data/character'
import { BACKDROP_MS } from './particles'
import {
  DEFAULT_EFFECT_PREFS,
  EFFECTS,
  EFFECT_CHOICES,
  MATCHED_EFFECTS,
  effectName,
  isEffectId,
  parseEffectPrefs,
  resolveEffect,
  withOverride,
  type EffectPrefs
} from './effects'

const prefs = (over: Partial<EffectPrefs> = {}): EffectPrefs => ({ ...DEFAULT_EFFECT_PREFS, ...over })

describe('MATCHED_EFFECTS', () => {
  const spellIds = new Set(seed.character.spells.map((s) => s.id))

  it('only names spells and effects that exist (a typo would silently fall back to the default)', () => {
    for (const [spellId, effect] of Object.entries(MATCHED_EFFECTS)) {
      expect(spellIds.has(spellId), spellId).toBe(true)
      expect(isEffectId(effect), `${spellId} -> ${effect}`).toBe(true)
    }
  })

  it('leaves some spells unmatched, so the default effect has a job', () => {
    expect([...spellIds].some((id) => !(id in MATCHED_EFFECTS))).toBe(true)
  })

  it('uses every effect at least once, so none is unreachable without an override', () => {
    const used = new Set(Object.values(MATCHED_EFFECTS))
    for (const e of EFFECTS) expect(used.has(e.id), e.id).toBe(true)
  })
})

describe('the stylesheet', () => {
  const css = readFileSync(resolve(import.meta.dirname, '../styles/app.css'), 'utf8')

  it('draws every effect (an effect with no CSS would silently play nothing)', () => {
    for (const { id } of EFFECTS) expect(css, id).toContain(`.fx-layer[data-effect='${id}'] .fx-piece`)
  })
})

describe('the stylesheet\'s backdrop animations', () => {
  const css = readFileSync(resolve(import.meta.dirname, '../styles/app.css'), 'utf8')

  it('finish within BACKDROP_MS, or the layer would be removed mid-fade', () => {
    const durations = [...css.matchAll(/animation:\s*(fx-(?:aura|halo))\s+([\d.]+)s/g)].map((m) => ({
      name: m[1],
      ms: Number(m[2]) * 1000
    }))
    expect(durations.map((d) => d.name).sort()).toEqual(['fx-aura', 'fx-halo'])
    for (const d of durations) expect(d.ms, d.name).toBeLessThanOrEqual(BACKDROP_MS)
  })
})

describe('EFFECT_CHOICES', () => {
  it('lists every effect, then "no effect", with unique ids', () => {
    expect(EFFECT_CHOICES.map((c) => c.id)).toEqual([...EFFECTS.map((e) => e.id), 'none'])
  })
})

describe('resolveEffect', () => {
  it('uses the curated match when there is no override', () => {
    expect(resolveEffect('spell:cure-wounds', prefs())).toEqual({ effect: 'motes', source: 'matched', automatic: 'motes' })
  })

  it('uses the player default for a spell with no match', () => {
    expect(resolveEffect('spell:detect-magic', prefs({ fallback: 'smoke' }))).toEqual({
      effect: 'smoke',
      source: 'default',
      automatic: 'smoke'
    })
  })

  it('lets an override beat the match, including "none"', () => {
    expect(resolveEffect('spell:cure-wounds', prefs({ overrides: { 'spell:cure-wounds': 'fireworks' } }))).toEqual({
      effect: 'fireworks',
      source: 'override',
      automatic: 'motes' // what "Automatic" would give, so Settings can say so
    })
    expect(resolveEffect('spell:cure-wounds', prefs({ overrides: { 'spell:cure-wounds': 'none' } })).effect).toBe('none')
  })

  it('treats a default of "none" as silence for unmatched spells only', () => {
    const quiet = prefs({ fallback: 'none' })
    expect(resolveEffect('spell:detect-magic', quiet).effect).toBe('none')
    expect(resolveEffect('spell:cure-wounds', quiet).effect).toBe('motes')
  })

  it('reports the fallback as "Automatic" for an unmatched spell, even when it has an override', () => {
    const custom = prefs({ fallback: 'ward', overrides: { 'spell:detect-magic': 'smoke' } })
    expect(resolveEffect('spell:detect-magic', custom)).toEqual({ effect: 'smoke', source: 'override', automatic: 'ward' })
  })

  it('is not fooled by ids that collide with Object.prototype', () => {
    expect(resolveEffect('constructor', prefs()).source).toBe('default')
    expect(resolveEffect('__proto__', prefs()).source).toBe('default')
  })
})

describe('withOverride', () => {
  it('sets and replaces an override without touching the original', () => {
    const base = prefs()
    const set = withOverride(base, 'spell:bless', 'ward')
    expect(set.overrides).toEqual({ 'spell:bless': 'ward' })
    expect(base.overrides).toEqual({})
    expect(withOverride(set, 'spell:bless', 'none').overrides).toEqual({ 'spell:bless': 'none' })
  })

  it('removes the override for "auto"', () => {
    const set = withOverride(prefs(), 'spell:bless', 'ward')
    expect(withOverride(set, 'spell:bless', 'auto').overrides).toEqual({})
  })
})

describe('parseEffectPrefs', () => {
  it('falls back to the defaults for missing or unreadable input', () => {
    expect(parseEffectPrefs(null)).toEqual(DEFAULT_EFFECT_PREFS)
    expect(parseEffectPrefs('')).toEqual(DEFAULT_EFFECT_PREFS)
    expect(parseEffectPrefs('{nope')).toEqual(DEFAULT_EFFECT_PREFS)
    expect(parseEffectPrefs('42')).toEqual(DEFAULT_EFFECT_PREFS)
    expect(parseEffectPrefs('null')).toEqual(DEFAULT_EFFECT_PREFS)
  })

  it('keeps valid choices and drops ones for effects that no longer exist', () => {
    const raw = JSON.stringify({
      fallback: 'fireworks',
      overrides: { 'spell:bless': 'ward', 'spell:aid': 'confetti', 'spell:bane': 7, 'spell:command': 'none' }
    })
    expect(parseEffectPrefs(raw)).toEqual({
      fallback: 'fireworks',
      overrides: { 'spell:bless': 'ward', 'spell:command': 'none' }
    })
  })

  it('ignores a stored value too large to be real', () => {
    const huge = JSON.stringify({ fallback: 'smoke', overrides: Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`spell:s${i}`, 'ward'])) })
    expect(huge.length).toBeGreaterThan(64_000)
    expect(parseEffectPrefs(huge)).toEqual(DEFAULT_EFFECT_PREFS)
  })

  it('replaces an unknown default but keeps the overrides', () => {
    const parsed = parseEffectPrefs(JSON.stringify({ fallback: 'confetti', overrides: { 'spell:bless': 'ward' } }))
    expect(parsed.fallback).toBe(DEFAULT_EFFECT_PREFS.fallback)
    expect(parsed.overrides).toEqual({ 'spell:bless': 'ward' })
  })
})

describe('effectName', () => {
  it('names effects and "none"', () => {
    expect(effectName('motes')).toBe('Motes of light')
    expect(effectName('none')).toBe('No effect')
  })
})
