import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEMES, isThemeId, parseTheme, type ThemeId } from './themes'

// WCAG 2.x thresholds.
const AA_NORMAL_TEXT = 4.5
const AA_LARGE_TEXT = 3
/** Role stripes are decorative (the role is also written as text), so they are held below WCAG 1.4.11's 3:1. */
const STRIPE_MIN_CONTRAST = 1.8
/** The secondary and tertiary accents must be their own colors, not shades of the primary or of each other. */
const MIN_HUE_GAP = 40

const STYLES_DIR = resolve(import.meta.dirname, '../styles')
const readCss = (file: string): string => readFileSync(resolve(STYLES_DIR, file), 'utf8')
const tokensCss = readCss('tokens.css')
const themesCss = readCss('themes.css')

/** Where each theme's palette block lives: the default in tokens.css, the rest in themes.css. */
function paletteBlock(id: ThemeId): string {
  const [source, selector] =
    id === DEFAULT_THEME
      ? [tokensCss, `:root,\\s*\\[data-theme='${id}'\\]`]
      : [themesCss, `\\[data-theme='${id}'\\]`]
  const body = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(source)?.[1]
  if (body === undefined) throw new Error(`No palette block for theme "${id}"`)
  return body
}

/** Every custom property a block declares, by name: values that are not hex (grain, color-scheme) still count. */
function declaredNames(block: string): string[] {
  return [...block.matchAll(/(--[\w-]+|color-scheme)\s*:/g)].map((m) => m[1] as string).sort()
}

/** The block's color tokens, which must all be plain hex literals (3 or 6 digits) so they can be measured. */
function hexTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = m as unknown as [string, string, string]
    if (name.startsWith('grain')) continue // an image, not a color
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())) {
      throw new Error(`Palette token --${name} must be a 3- or 6-digit hex literal, got "${value.trim()}"`)
    }
    tokens[name] = value.trim()
  }
  return tokens
}

/** Hue of a hex color in degrees, 0 to 360. */
function hue(hex: string): number {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

function hueGap(a: string, b: string): number {
  const gap = Math.abs(hue(a) - hue(b))
  return Math.min(gap, 360 - gap)
}

/** WCAG 2.x relative luminance of an sRGB hex color. */
function luminance(hex: string): number {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** [foreground, background] token pairs the UI actually draws as text. All must reach AA for normal text. */
const TEXT_PAIRS: readonly [string, string][] = [
  ['bone', 'oak'],
  ['bone', 'oak-shadow'],
  ['bone', 'vellum-deep'],
  ['bone', 'vellum'],
  ['bone', 'vellum-raised'],
  ['bone-dim', 'oak'],
  ['bone-dim', 'oak-shadow'],
  ['bone-dim', 'vellum-deep'],
  ['bone-dim', 'vellum'],
  ['bone-dim', 'vellum-raised'],
  ['gold', 'vellum-deep'],
  ['gold', 'vellum-raised'],
  ['gold-bright', 'oak-shadow'],
  ['gold-bright', 'oak'],
  ['gold-bright', 'vellum'],
  ['gold-bright', 'vellum-raised'],
  ['gules-lit', 'oak'],
  ['gules-lit', 'vellum'],
  ['purpure-lit', 'vellum'],
  ['vert-lit', 'vellum'],
  ['azure-lit', 'vellum'],
  ['azure-lit', 'oak-shadow'],
  ['second-lit', 'oak-shadow'],
  ['second-lit', 'oak'],
  ['second-lit', 'vellum-deep'],
  ['second-lit', 'vellum'],
  ['second-lit', 'vellum-raised'],
  ['third-lit', 'oak-shadow'],
  ['third-lit', 'oak'],
  ['third-lit', 'vellum-deep'],
  ['third-lit', 'vellum'],
  ['third-lit', 'vellum-raised'],
  ['on-gold', 'gold'],
  ['on-gold', 'gold-bright'],
  ['on-vert', 'vert'],
  ['on-gules', 'gules'],
  ['on-azure', 'azure'],
  ['on-second', 'second'],
  ['on-third', 'third']
]

/** The disabled cast button: deliberately muted, still readable. Held to the large-text bar, not AA. */
const MUTED_PAIRS: readonly [string, string][] = [['bone-dim', 'iron']]

/**
 * Candlelit Oak predates these checks. These specific pairs sit between 3.4:1 and 4.5:1 and are left as originally
 * designed, held to the large-text bar; every other Oak pair gets the full AA bar. Do not add to this list: new
 * themes meet AA everywhere.
 */
const KNOWN_BELOW_AA = new Set(['oak|gules-lit|oak', 'oak|gules-lit|vellum', 'oak|purpure-lit|vellum', 'oak|on-azure|azure'])

describe('theme registry', () => {
  it('has unique ids and a valid default', () => {
    const ids = THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(isThemeId(DEFAULT_THEME)).toBe(true)
  })

  it('parses stored values, falling back to the default', () => {
    expect(parseTheme('moon')).toBe('moon')
    expect(parseTheme('nonsense')).toBe(DEFAULT_THEME)
    expect(parseTheme(null)).toBe(DEFAULT_THEME)
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME)
  })

  it('has a registry entry for every theme block in themes.css (no orphans)', () => {
    const inCss = [...themesCss.matchAll(/\[data-theme='([\w-]+)'\]\s*\{/g)].map((m) => m[1])
    const registered = THEMES.map((t) => t.id).filter((id) => id !== DEFAULT_THEME)
    expect([...inCss].sort()).toEqual([...registered].sort())
  })
})

describe.each(THEMES.map((t) => t.id))('theme "%s"', (id) => {
  const block = paletteBlock(id)
  const tokens = hexTokens(block)

  it('declares exactly the properties the default theme declares', () => {
    expect(declaredNames(block)).toEqual(declaredNames(paletteBlock(DEFAULT_THEME)))
  })

  it.each(TEXT_PAIRS)('%s on %s meets AA for text', (fg, bg) => {
    const required = KNOWN_BELOW_AA.has(`${id}|${fg}|${bg}`) ? AA_LARGE_TEXT : AA_NORMAL_TEXT
    expect(contrast(tokens[fg] as string, tokens[bg] as string)).toBeGreaterThanOrEqual(required)
  })

  it.each(MUTED_PAIRS)('%s on %s stays readable (large-text bar)', (fg, bg) => {
    expect(contrast(tokens[fg] as string, tokens[bg] as string)).toBeGreaterThanOrEqual(AA_LARGE_TEXT)
  })

  it('gives the secondary and tertiary accents hues of their own', () => {
    const [gold, second, third] = [tokens['gold'], tokens['second'], tokens['third']] as [string, string, string]
    expect(hueGap(gold, second)).toBeGreaterThanOrEqual(MIN_HUE_GAP)
    expect(hueGap(gold, third)).toBeGreaterThanOrEqual(MIN_HUE_GAP)
    expect(hueGap(second, third)).toBeGreaterThanOrEqual(MIN_HUE_GAP)
  })

  it('keeps accent fills visible against panels', () => {
    for (const accent of ['second', 'third']) {
      expect(contrast(tokens[accent] as string, tokens['vellum'] as string)).toBeGreaterThanOrEqual(STRIPE_MIN_CONTRAST)
    }
  })

  it('keeps spell-role stripes visible against panels', () => {
    for (const role of ['gules', 'purpure', 'vert', 'azure']) {
      expect(contrast(tokens[role] as string, tokens['vellum'] as string)).toBeGreaterThanOrEqual(STRIPE_MIN_CONTRAST)
    }
  })
})
