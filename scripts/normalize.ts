import { createCatalog } from '../src/renderer/domain/catalog'
import { abilityMod, proficiencyForLevel } from '../src/renderer/domain/derived'
import { isChoosable } from '../src/renderer/domain/prepared'
import type { Character, CounterDef, Feature, OtherFeature, SeedData, Spell, Weapon } from '../src/shared/types'
import { componentsFromCode, componentsFromDdb } from './components'
import { ATTACK_RIDER_FEATURES, ATTACK_RIDER_SPELLS } from './data/attack-riders'
import { AUTHORED_SPELLS } from './data/authored-spells'
import { FEATURE_OVERLAYS } from './data/feature-overlay'
import { SPELL_OVERLAY, type SpellOverlay } from './data/spell-overlay'
import { DICE_PATTERN, SeedSchema } from './seed-schema'

// The DDB payload is large, undocumented and changes shape; this module reads only what it needs and is tolerant of the rest.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
type Ability = (typeof ABILITIES)[number]
const STAT_ID: Record<Ability, number> = { str: 1, dex: 2, con: 3, int: 4, wis: 5, cha: 6 }
const SCORE_SUBTYPE: Record<Ability, string> = {
  str: 'strength-score',
  dex: 'dexterity-score',
  con: 'constitution-score',
  int: 'intelligence-score',
  wis: 'wisdom-score',
  cha: 'charisma-score'
}
/** 8 + proficiency + ability modifier: the same base as `spellSaveDc` in the renderer's derived.ts. */
const SAVE_DC_BASE = 8
const SAVE_LABEL: Record<number, string> = { 1: 'STR', 2: 'DEX', 3: 'CON', 4: 'INT', 5: 'WIS', 6: 'CHA' }


export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ───────────────────────── placeholders and text ─────────────────────────

/**
 * Strict evaluator for `+ - * /` and parentheses over integers (with a unary minus on a number), e.g. `2*-1` = -2.
 * Division is exact (so `(1+6)/6` stays fractional until a rounding option is applied). Returns null for anything
 * malformed (`1+`, `5**3`, `--1`, `(1`, `1/0`, letters). Never uses eval.
 */
export function evalArithmetic(expr: string): number | null {
  // Tokenise the original text: stripping spaces first would merge `1 2` into `12`.
  const tokens = expr.match(/\d+|[-+*/()]|\S/g) ?? []
  let pos = 0

  const factor = (): number | null => {
    let sign = 1
    if (tokens[pos] === '-') {
      sign = -1
      pos++
    }
    const token = tokens[pos]
    if (token === '(') {
      pos++
      const inner = expression()
      if (inner === null || tokens[pos] !== ')') return null
      pos++
      return sign * inner
    }
    if (token === undefined || !/^\d+$/.test(token)) return null
    pos++
    return sign * Number(token)
  }
  const term = (): number | null => {
    let value = factor()
    while (value !== null && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++]
      const next = factor()
      if (next === null || (op === '/' && next === 0)) return null
      value = op === '*' ? value * next : value / next
    }
    return value
  }
  function expression(): number | null {
    let value = term()
    while (value !== null && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++]
      const next = term()
      value = next === null ? null : op === '+' ? value + next : value - next
    }
    return value
  }

  const result = expression()
  return result !== null && pos === tokens.length && Number.isFinite(result) ? result : null
}

interface PlaceholderContext {
  level: number
  proficiency: number
  mods: Record<Ability, number>
}

/** Resolve DDB's `{{1+modifier:cha@min:1#unsigned}}` style placeholders. Returns null when something is unknown. */
export function resolvePlaceholder(inner: string, ctx: PlaceholderContext): string | null {
  const [body = '', hash = ''] = inner.split('#')
  const [expression = '', ...options] = body.split('@')
  let failed = false
  let isSaveDc = false
  // Own keys only: a hostile placeholder like `modifier:constructor` must not reach Object.prototype.
  const modOf = (key: string): number | undefined => (Object.hasOwn(ctx.mods, key) ? ctx.mods[key as Ability] : undefined)
  const withValues = expression
    .replace(/modifier:(\w+)/g, (_, key: string) => {
      const mod = modOf(key)
      if (mod === undefined) failed = true
      return String(mod ?? 0) // a negative becomes e.g. `2*-1`, which the strict parser handles
    })
    .replace(/savedc:(\w+)/g, (_, key: string) => {
      const mod = modOf(key)
      if (mod === undefined) failed = true
      isSaveDc = true
      return String(SAVE_DC_BASE + ctx.proficiency + (mod ?? 0))
    })
    .replace(/characterlevel|classlevel/g, String(ctx.level))
    .replace(/proficiency/g, String(ctx.proficiency))
  if (failed) return null
  let value = evalArithmetic(withValues)
  if (value === null) return null
  for (const option of options) {
    const min = /^min:(-?\d+)$/.exec(option)
    if (min) value = Math.max(value, Number(min[1]))
    else if (option === 'rounddown') value = Math.floor(value)
    else if (option === 'roundup') value = Math.ceil(value)
    else return null // an option we don't understand must not be silently ignored: a wrong number is worse than a gap
  }
  if (!Number.isInteger(value)) return null // a fraction with no rounding rule is not a number we can show
  // Only a bare ability modifier (optionally plus proficiency) reads as a signed bonus ("+3").
  // Pool sizes, dice counts, DCs and anything with a rounding or minimum rule are plain numbers.
  const isBonus = /^modifier:\w+(\+proficiency)?$/.test(expression) && options.length === 0 && !hash.includes('unsigned')
  return isBonus && value >= 0 ? `+${value}` : String(value)
}

export function resolvePlaceholders(text: string, ctx: PlaceholderContext): string {
  return text.replace(/\{\{([^{}]{0,200})\}\}/g, (_, inner: string) => resolvePlaceholder(inner, ctx) ?? '[see D&D Beyond]')
}

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&rsquo;': '’', '&lsquo;': '‘', '&quot;': '"', '&ndash;': '–', '&mdash;': '—', '&times;': '×', '&lt;': '<', '&gt;': '>' }

/**
 * D&D Beyond marks cross-references in text as `[rules]Disadvantage[/rules]`, `[wprop]Thrown[/wprop]` or
 * `[action]Opportunity Attack;Opportunity Attacks[/action]` (the part after `;` is what is displayed). Any such pair is
 * replaced by its display text.
 */
function stripDdbTags(text: string): string {
  return text.replace(/\[([a-z]{1,20})\]([^[\]]{0,200})\[\/\1\]/gi, (_match, _tag: string, inner: string) => inner.slice(inner.lastIndexOf(';') + 1))
}

export function htmlToText(html: string): string {
  return stripDdbTags(html)
    .replace(/<\/(p|li|h\d|div|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^<>]{0,2000}>/g, '')
    .replace(/&[a-z]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

// ───────────────────────── character numbers ─────────────────────────

function activeItemIds(data: Json): Set<number> {
  const ids = new Set<number>()
  for (const item of data.inventory ?? []) {
    const def = item.definition
    // Equipped, and attuned if the item needs it: only then do its modifiers apply.
    if (item.equipped && (!def.canAttune || item.isAttuned)) ids.add(def.id)
  }
  return ids
}

/** Every modifier that currently applies (item modifiers only for equipped/attuned items). */
function activeModifiers(data: Json): Json[] {
  const items = activeItemIds(data)
  const out: Json[] = []
  for (const [group, list] of Object.entries<Json[]>(data.modifiers ?? {})) {
    for (const m of list ?? []) {
      if (group === 'item' && !items.has(m.componentId)) continue
      out.push(m)
    }
  }
  return out
}

export function finalAbilities(data: Json): Record<Ability, number> {
  const mods = activeModifiers(data)
  const out = {} as Record<Ability, number>
  for (const key of ABILITIES) {
    const id = STAT_ID[key]
    const base: number = data.stats.find((s: Json) => s.id === id)?.value ?? 10
    const override = data.overrideStats?.find((s: Json) => s.id === id)?.value
    const manualBonus = data.bonusStats?.find((s: Json) => s.id === id)?.value ?? 0
    const subType = SCORE_SUBTYPE[key]
    const bonus = mods.filter((m) => m.subType === subType && m.type === 'bonus').reduce((n, m) => n + (m.value ?? 0), 0)
    const sets = mods.filter((m) => m.subType === subType && m.type === 'set').map((m) => m.value as number)
    // ASIs cap at 20; a "set" (e.g. Amulet of Health) is a floor: "no effect if already that high".
    const natural = override ?? Math.min(20, base + manualBonus + bonus)
    out[key] = Math.max(natural, ...sets)
  }
  return out
}

export function hitPointMax(data: Json, abilities: Record<Ability, number>, level: number): number {
  if (data.overrideHitPoints) return data.overrideHitPoints
  const perLevel = activeModifiers(data)
    .filter((m) => m.type === 'bonus' && m.subType === 'hit-points-per-level')
    .reduce((n, m) => n + (m.value ?? 0), 0)
  return data.baseHitPoints + (data.bonusHitPoints ?? 0) + (abilityMod(abilities.con) + perLevel) * level
}

/** Armor class from worn armor, shield and flat bonuses. Does not model class-specific unarmored formulas. */
export function armorClass(data: Json, abilities: Record<Ability, number>): number {
  const dex = abilityMod(abilities.dex)
  let base = 10 + dex
  let shield = 0
  for (const item of data.inventory ?? []) {
    const def = item.definition
    if (!item.equipped || !def.armorClass) continue
    if (def.armorTypeId === 4) shield += def.armorClass
    else if (def.armorTypeId === 1) base = def.armorClass + dex
    else if (def.armorTypeId === 2) base = def.armorClass + Math.min(dex, 2)
    else if (def.armorTypeId === 3) base = def.armorClass
  }
  const flat = activeModifiers(data)
    .filter((m) => m.type === 'bonus' && m.subType === 'armor-class')
    .reduce((n, m) => n + (m.value ?? 0), 0)
  return base + shield + flat
}

// ───────────────────────── counters ─────────────────────────

function buildCounters(data: Json, level: number, prof: number, mods: Record<Ability, number>): { counters: CounterDef[]; seededUsed: Record<string, number> } {
  const counters: CounterDef[] = [
    { id: 'lay-on-hands', label: 'Lay On Hands', kind: 'pool', max: 5 * level, restore: { long: 'full' } }
  ]
  if (level >= 3) {
    counters.push({
      id: 'channel-divinity',
      label: 'Channel Divinity',
      kind: 'uses',
      max: level >= 11 ? 3 : 2,
      restore: { short: { add: 1 }, long: 'full' }
    })
  }
  counters.push({ id: 'free-smite', label: 'Free Divine Smite', kind: 'uses', max: 1, restore: { long: 'full' } })
  if (level >= 5) counters.push({ id: 'free-find-steed', label: 'Free Find Steed', kind: 'uses', max: 1, restore: { long: 'full' } })
  counters.push({ id: 'breath-weapon', label: 'Breath Weapon', kind: 'uses', max: prof, restore: { long: 'full' } })
  if (level >= 5) counters.push({ id: 'draconic-flight', label: 'Draconic Flight', kind: 'uses', max: 1, restore: { long: 'full' } })
  counters.push({ id: 'hit-dice', label: 'Hit Dice (d10)', kind: 'pool', max: level, restore: { long: { fraction: 0.5 } } })

  const seededUsed: Record<string, number> = {}
  for (const item of data.inventory ?? []) {
    const lim = item.limitedUse
    // Consumable item charges never come back with a rest, and seed from the sheet rather than "fully rested".
    if (lim?.maxUses && lim.resetType === 'Consumable') {
      const itemName: string = item.definition.name.replace(/^The\s+/i, '') // "The Arbiter's Ward" -> "arbiters-ward"
      const id = slugify(itemName)
      counters.push({ id, label: itemName, kind: 'uses', max: lim.maxUses, restore: {} })
      seededUsed[id] = lim.numberUsed ?? 0
    }
  }
  return { counters, seededUsed }
}

// ───────────────────────── spells ─────────────────────────

function castTimeOf(def: Json): { castTime: Spell['castTime']; castingNote?: string } {
  switch (def.activation?.activationType) {
    case 1:
      return { castTime: 'action' }
    case 3:
      return { castTime: 'bonus' }
    case 4:
      return { castTime: 'reaction' }
    default:
      return { castTime: 'long', castingNote: def.castingTimeDescription || 'longer than an action' }
  }
}

function rangeText(def: Json): string {
  const r = def.range
  if (!r) return 'Self'
  if (r.origin === 'Ranged' && r.rangeValue) return `${r.rangeValue} ft`
  if (r.origin === 'Self') return r.aoeValue ? `Self (${r.aoeValue} ft)` : 'Self'
  return r.origin ?? 'Self'
}

function durationText(def: Json): string {
  const d = def.duration ?? {}
  if (d.durationType === 'Instantaneous') return 'Instantaneous'
  const unit = String(d.durationUnit ?? '').toLowerCase()
  const n = d.durationInterval
  return n && unit ? `${n} ${unit}${n > 1 ? 's' : ''}` : (d.durationType ?? 'Special')
}

const TAG_ROLE: Record<string, SpellOverlay['role']> = { Damage: 'offense', Debuff: 'control', Control: 'control', Buff: 'support', Healing: 'support' }

interface SheetSpell {
  def: Json
  alwaysPrepared: boolean
  inClassSpells: boolean
}

function collectSheetSpells(data: Json): Map<string, SheetSpell> {
  const bySlug = new Map<string, SheetSpell>()
  const add = (entry: Json, inClassSpells: boolean): void => {
    const def = entry.definition
    const slug = slugify(def.name)
    const existing = bySlug.get(slug)
    // The sheet lists some spells several times (2014 and 2024 versions); prefer the current one.
    const better = !existing || (existing.def.isLegacy && !def.isLegacy)
    bySlug.set(slug, {
      def: better ? def : existing.def,
      alwaysPrepared: Boolean(existing?.alwaysPrepared || entry.alwaysPrepared),
      inClassSpells: Boolean(existing?.inClassSpells || inClassSpells)
    })
  }
  for (const group of ['class', 'race', 'background', 'feat', 'item'] as const) {
    for (const entry of data.spells?.[group] ?? []) add(entry, false)
  }
  for (const cs of data.classSpells ?? []) for (const entry of cs.spells ?? []) add(entry, true)
  return bySlug
}

function buildSpells(data: Json, ctx: PlaceholderContext, warnings: string[]): { spells: Spell[]; prepared: string[] } {
  const sheet = collectSheetSpells(data)
  const spells: Spell[] = []
  const prepared: string[] = []

  for (const [slug, { def, alwaysPrepared, inClassSpells }] of sheet) {
    const overlay = Object.hasOwn(SPELL_OVERLAY, slug) ? SPELL_OVERLAY[slug] : undefined
    if (!overlay) warnings.push(`No overlay for "${def.name}": role guessed from DDB tags; add it to scripts/data/spell-overlay.ts`)
    const tags: string[] = def.tags ?? []
    const role = overlay?.role ?? tags.map((t) => TAG_ROLE[t]).find(Boolean) ?? 'utility'
    const save = def.requiresSavingThrow && SAVE_LABEL[def.saveDcAbilityId] ? `${SAVE_LABEL[def.saveDcAbilityId]} save` : undefined
    const tag = overlay?.tag ?? save ?? (def.requiresAttackRoll ? 'spell attack' : undefined)
    const id = `spell:${slug}`
    const components = componentsFromDdb(def.components, def.componentsDescription)
    // Absent is not "none": a missing list would otherwise print as a spell you can cast gagged and bound.
    if (!components) throw new Error(`DDB spell "${def.name}" has no components list; the payload shape may have changed`)
    const built: Spell = {
      id,
      ddbId: def.id,
      name: def.name,
      level: def.level,
      school: def.school,
      ...castTimeOf(def),
      ...(def.ritual ? { ritual: true } : {}),
      concentration: Boolean(def.concentration),
      components,
      range: rangeText(def),
      duration: durationText(def),
      role,
      targets: overlay?.targets ?? [],
      summary: overlay?.summary ?? '',
      // Plain text, not HTML: the seed is data we render, and raw markup from a sheet is never trusted.
      description: htmlToText(resolvePlaceholders(def.description ?? '', ctx)),
      source: def.level === 0 ? 'cantrip' : (overlay?.source ?? 'class'),
      costs: def.level === 0 ? [{ kind: 'none' }] : (overlay?.costs ?? [{ kind: 'slot' }]),
      ...(tag ? { tag } : {}),
      ...(alwaysPrepared ? { alwaysPrepared: true } : {}),
      verified: true
    }
    spells.push(built)
    // Chosen prepared spells: on the class list and choosable (not granted for free).
    if (inClassSpells && isChoosable(built)) prepared.push(id)
  }

  for (const a of AUTHORED_SPELLS) {
    const slug = slugify(a.name)
    if (sheet.has(slug)) continue
    spells.push({
      id: `spell:${slug}`,
      name: a.name,
      level: a.level,
      school: a.school,
      castTime: a.castTime,
      ...(a.castingNote ? { castingNote: a.castingNote } : {}),
      ...(a.ritual ? { ritual: true } : {}),
      concentration: a.concentration,
      components: componentsFromCode(a.components, a.materialText),
      range: a.range,
      duration: a.duration,
      role: a.role,
      targets: a.targets,
      summary: a.summary,
      source: 'class',
      costs: [{ kind: 'slot' }],
      ...(a.tag ? { tag: a.tag } : {}),
      verified: true
    })
  }

  spells.sort((x, y) => x.level - y.level || x.name.localeCompare(y.name))
  return { spells, prepared }
}

// ───────────────────────── features ─────────────────────────

const SAVE_ABILITY = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i
const CAST_TIME_BY_ACTIVATION: Record<number, Feature['castTime']> = { 1: 'action', 3: 'bonus', 4: 'reaction' }

function allActions(data: Json): Json[] {
  return Object.values<Json[]>(data.actions ?? {}).flatMap((group) => group ?? [])
}

function buildFeatures(data: Json, ctx: PlaceholderContext, warnings: string[]): Feature[] {
  const actions = allActions(data)
  const features: Feature[] = []
  for (const overlay of FEATURE_OVERLAYS) {
    const action = actions.find((a) => a.name === overlay.payloadName)
    if (!action) {
      warnings.push(`Feature "${overlay.name}" skipped: the sheet has no action named "${overlay.payloadName}"`)
      continue
    }
    const castTime = CAST_TIME_BY_ACTIVATION[action.activation?.activationType]
    if (!castTime) {
      warnings.push(`Feature "${overlay.name}" skipped: unsupported activation type ${action.activation?.activationType}`)
      continue
    }
    // The snippet is the text for this specific action; `description` is often the whole parent feature.
    const text = htmlToText(resolvePlaceholders(action.snippet ?? action.description ?? '', ctx))
    const dc = overlay.save ? SAVE_DC_BASE + ctx.proficiency + ctx.mods[overlay.save.ability] : undefined
    // The short snippet may not name the save; the longer description usually does.
    const fullText = htmlToText(resolvePlaceholders(action.description ?? '', ctx))
    const saveAbility = (SAVE_ABILITY.exec(text) ?? SAVE_ABILITY.exec(fullText))?.[1]?.slice(0, 3).toUpperCase()
    const tag = overlay.tag ?? (dc !== undefined ? `${saveAbility ?? ''} save, DC ${dc}`.trim() : undefined)
    features.push({
      id: overlay.id,
      name: overlay.name,
      castTime,
      ...(overlay.timing ? { timing: overlay.timing } : {}),
      role: overlay.role,
      targets: overlay.targets,
      summary: overlay.summary,
      ...(text ? { description: text } : {}),
      source: overlay.source,
      counterId: overlay.counterId,
      spend: overlay.spend === 'uses' ? { kind: 'uses' } : { kind: 'pool' },
      ...(tag ? { tag } : {})
    })
  }
  return features
}

// ───────────────────────── weapons ─────────────────────────

/** The 2024 weapon mastery properties. The sheet lists the one a weapon has among its ordinary properties. */
const MASTERY_NAMES = ['Cleave', 'Graze', 'Nick', 'Push', 'Sap', 'Slow', 'Topple', 'Vex']
/** DDB's `attackType` on a weapon definition. */
const DDB_ATTACK_TYPE = { melee: 1, ranged: 2 } as const
/** DDB weapon category ids. Only martial (2) is seen in the reference sheet; an id outside this list is warned about. */
const WEAPON_CATEGORY_PROFICIENCY: Record<number, string> = { 1: 'simple-weapons', 2: 'martial-weapons' }
/** A melee weapon prints 5 ft on the sheet; a ranged one prints its distances. */
const DEFAULT_WEAPON_RANGE_FT = 5

/** Compares weapon kinds regardless of word order or punctuation: "Crossbow, Heavy" and "Heavy Crossbow" are one kind. */
export function weaponKindKey(name: string): string {
  return name.toLowerCase().split(/[^a-z]+/).filter(Boolean).sort().join(' ')
}

/** One chosen mastery for one kind of weapon. Built here and read in `parseWeaponProperties`, so both sides agree. */
const masteryKey = (mastery: string, kind: string): string => `${mastery}|${weaponKindKey(kind)}`

/** The masteries the sheet lists as chosen: feat actions named like "Cleave (Halberd)". */
function chosenMasteries(data: Json): Set<string> {
  const chosen = new Set<string>()
  for (const action of data.actions?.feat ?? []) {
    const match = /^([A-Za-z]+) \((.+)\)$/.exec(action.name ?? '')
    const [, mastery, kind] = match ?? []
    if (mastery && kind && MASTERY_NAMES.includes(mastery)) chosen.add(masteryKey(mastery, kind))
  }
  return chosen
}

/** Proficiency ids the character has (`martial-weapons`, `heavy-armor`...), from every source that applies. */
function proficiencyIds(data: Json): Set<string> {
  return new Set(
    activeModifiers(data)
      .filter((modifier) => modifier.type === 'proficiency')
      .map((modifier) => modifier.subType as string)
  )
}

interface WeaponDamage {
  dice: string
  type: string
  melee: boolean
}

function parseWeaponDamage(def: Json, warnings: string[]): WeaponDamage | null {
  const dice: unknown = def.damage?.diceString
  const melee = def.attackType === DDB_ATTACK_TYPE.melee
  if (typeof dice !== 'string' || !DICE_PATTERN.test(dice) || !def.damageType || (!melee && def.attackType !== DDB_ATTACK_TYPE.ranged)) {
    warnings.push(`Weapon "${def.name}" skipped: it has no usable damage or attack type`)
    return null
  }
  return { dice, type: def.damageType, melee }
}

interface WeaponProperties {
  properties: Weapon['properties']
  mastery?: Weapon['mastery']
  /** Two-handed dice of a Versatile weapon. */
  versatile?: string
}

/** Splits the sheet's property list into ordinary properties, the mastery (with whether it was chosen), and Versatile's dice. */
function parseWeaponProperties(def: Json, ctx: PlaceholderContext, chosen: Set<string>, warnings: string[]): WeaponProperties {
  const result: WeaponProperties = { properties: [] }
  for (const prop of def.properties ?? []) {
    const text = htmlToText(resolvePlaceholders(prop.description ?? '', ctx))
    if (MASTERY_NAMES.includes(prop.name)) {
      result.mastery = { name: prop.name, text, known: chosen.has(masteryKey(prop.name, def.type ?? def.name)) }
    } else if (prop.name === 'Versatile' && typeof prop.notes === 'string' && DICE_PATTERN.test(prop.notes)) {
      result.versatile = prop.notes
      result.properties.push({ name: prop.name, text: `${text} Two-handed damage: ${prop.notes}.` })
    } else {
      if (prop.name === 'Versatile') warnings.push(`Weapon "${def.name}" has a Versatile property without valid damage dice in its notes`)
      result.properties.push({ name: prop.name, text })
    }
  }
  return result
}

/** A repeated name (two Daggers) still needs a unique id, or the catalog check would refuse the whole seed. */
function uniqueWeaponId(slug: string, seen: Map<string, number>): string {
  const count = (seen.get(slug) ?? 0) + 1
  seen.set(slug, count)
  return count === 1 ? `weapon:${slug}` : `weapon:${slug}-${count}`
}

function buildWeapons(data: Json, ctx: PlaceholderContext, warnings: string[]): Weapon[] {
  const chosen = chosenMasteries(data)
  const proficiencies = proficiencyIds(data)
  const seenSlugs = new Map<string, number>()
  const weapons: Weapon[] = []

  for (const item of data.inventory ?? []) {
    const def = item.definition
    if (def?.filterType !== 'Weapon') continue
    const damage = parseWeaponDamage(def, warnings)
    if (!damage) continue
    const { properties, mastery, versatile } = parseWeaponProperties(def, ctx, chosen, warnings)

    const category = WEAPON_CATEGORY_PROFICIENCY[def.categoryId as number]
    if (!category) warnings.push(`Weapon "${def.name}" has an unknown category ${String(def.categoryId)}: shown as not proficient`)
    const normal: number = def.range ?? DEFAULT_WEAPON_RANGE_FT
    const description = def.magic || def.isHomebrew ? htmlToText(resolvePlaceholders(def.description ?? '', ctx)) : ''

    weapons.push({
      id: uniqueWeaponId(slugify(def.name), seenSlugs),
      name: def.name,
      baseType: def.type ?? def.name,
      melee: damage.melee,
      proficient: category !== undefined && proficiencies.has(category),
      magic: Boolean(def.magic),
      ...(def.canAttune ? { attunement: item.isAttuned ? ('attuned' as const) : ('not-attuned' as const) } : {}),
      damage: { dice: damage.dice, type: damage.type, ...(versatile ? { versatile } : {}) },
      range: { normal, ...(def.longRange && def.longRange !== normal ? { long: def.longRange as number } : {}) },
      properties,
      ...(mastery ? { mastery } : {}),
      ...(description ? { description } : {})
    })
  }
  // Magic first (the item you would reach for), then by name.
  return weapons.sort((a, b) => Number(b.magic) - Number(a.magic) || a.name.localeCompare(b.name))
}

/** Flags what `attack-riders.ts` lists. A listed id the sheet does not produce is an error: a rename must not drop a rider silently. */
function markAttackRiders(spells: Spell[], features: Feature[]): { spells: Spell[]; features: Feature[] } {
  const missing = [
    ...ATTACK_RIDER_SPELLS.filter((id) => !spells.some((s) => s.id === id)),
    ...ATTACK_RIDER_FEATURES.filter((id) => !features.some((f) => f.id === id))
  ]
  if (missing.length > 0) throw new Error(`scripts/data/attack-riders.ts lists ids the sheet does not produce: ${missing.join(', ')}`)
  return {
    spells: spells.map((s) => (ATTACK_RIDER_SPELLS.includes(s.id) ? { ...s, attackRider: true } : s)),
    features: features.map((f) => (ATTACK_RIDER_FEATURES.includes(f.id) ? { ...f, attackRider: true } : f))
  }
}

// ───────────────────────── other features ─────────────────────────

// Homebrew with no tile. This is an allowlist: a new action on the sheet is not shown until it is listed here.
// The sheet also carries a "Death Coil" that the table never used; it is left off on purpose, do not add it.
const HOMEBREW_PREFIXES = ['Initiate a Circle Spell', 'Circle Spell', 'Undead Steed']

function buildOtherFeatures(data: Json, ctx: PlaceholderContext): OtherFeature[] {
  const seen = new Set<string>()
  const out: OtherFeature[] = []
  for (const group of Object.values<Json[]>(data.actions ?? {})) {
    for (const action of group ?? []) {
      const name: string = action.name ?? ''
      if (seen.has(name) || !HOMEBREW_PREFIXES.some((p) => name.startsWith(p))) continue
      seen.add(name)
      out.push({ name, text: htmlToText(resolvePlaceholders(action.snippet ?? action.description ?? '', ctx)) })
    }
  }
  return out
}

// ───────────────────────── entry point ─────────────────────────

export interface NormalizeResult {
  seed: SeedData
  warnings: string[]
}

/** Turn a raw DDB character payload into the app's seed data. Drops every account identifier. */
export function normalizeDdb(payload: Json): NormalizeResult {
  const data = payload.data
  const warnings: string[] = []
  const cls = data.classes[0]
  const level: number = cls.level
  const abilities = finalAbilities(data)
  const mods = Object.fromEntries(ABILITIES.map((k) => [k, abilityMod(abilities[k])])) as Record<Ability, number>
  const proficiency = proficiencyForLevel(level)
  const ctx: PlaceholderContext = { level, proficiency, mods }

  const { counters, seededUsed } = buildCounters(data, level, proficiency, mods)
  const { spells: builtSpells, prepared } = buildSpells(data, ctx, warnings)
  const { spells, features } = markAttackRiders(builtSpells, buildFeatures(data, ctx, warnings))

  const character: Character = {
    name: data.name,
    race: data.race?.fullName ?? data.race?.baseRaceName ?? 'Unknown',
    className: cls.definition.name,
    subclass: cls.subclassDefinition?.name ?? '',
    level,
    abilities,
    proficiencyBonus: proficiency,
    spellcastingAbility: 'cha',
    hpMax: hitPointMax(data, abilities, level),
    ac: armorClass(data, abilities),
    spells,
    counters,
    features,
    weapons: buildWeapons(data, ctx, warnings)
  }
  // Parsing our own output means any drift between the importer and the types fails here, not at runtime in the app.
  const seed = SeedSchema.parse({ character, prepared, seededUsed, otherFeatures: buildOtherFeatures(data, ctx) })
  createCatalog(seed) // the app's own startup invariants (unique ids, real counters, choosable prepared spells) run at generation time too
  return { seed, warnings }
}
