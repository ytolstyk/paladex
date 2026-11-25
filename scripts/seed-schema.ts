import { z } from 'zod'
import { ABILITIES, CAST_TIMES, ROLES, SKILL_IDS, TRAIT_KINDS, TRAIT_WHENS } from '../src/shared/constants'
import type { SeedData, SkillId } from '../src/shared/types'

/**
 * Runtime validator for the generated seed. It lives under scripts/ so zod stays out of the renderer bundle:
 * the importer parses its own output with it (generation fails loudly on drift) and the tests parse the committed JSON.
 * Typed as `z.ZodType<SeedData>`, so changing `SeedData`/`Spell`/`CounterDef` without updating this file is a compile error.
 * Objects are `.strict()`: an unexpected field means the importer and the types have drifted apart.
 */
const costOption = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('slot') }).strict(),
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('free'), counterId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('charge'), counterId: z.string().min(1) }).strict()
])

const restore = z.union([
  z.literal('full'),
  z.object({ add: z.number().int().positive() }).strict(),
  z.object({ fraction: z.number().gt(0).lte(1) }).strict()
])

const counter = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    max: z.number().int().positive(),
    kind: z.enum(['pool', 'uses']),
    restore: z.object({ short: restore.optional(), long: restore.optional() }).strict(),
    note: z.string().optional()
  })
  .strict()

const components = z
  .object({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: z.boolean(),
    materialText: z.string().min(1).max(300).optional()
  })
  .strict()
  // Text without a material component would be a contradiction.
  .refine((c) => c.material || c.materialText === undefined, 'materialText requires material')

const spell = z
  .object({
    id: z.string().regex(/^spell:[a-z0-9-]+$/),
    ddbId: z.number().int().optional(),
    name: z.string().min(1),
    level: z.number().int().min(0).max(9),
    school: z.string().min(1),
    castTime: z.enum(CAST_TIMES),
    castingNote: z.string().optional(),
    ritual: z.boolean().optional(),
    concentration: z.boolean(),
    components,
    range: z.string().min(1),
    duration: z.string().min(1),
    role: z.enum(ROLES),
    targets: z.array(z.enum(['enemy', 'ally', 'self'])).min(1),
    summary: z.string().min(1),
    description: z.string().optional(),
    source: z.enum(['class', 'oath', 'feature', 'item', 'cantrip']),
    costs: z.array(costOption).min(1),
    tag: z.string().optional(),
    alwaysPrepared: z.boolean().optional(),
    attackRider: z.boolean().optional(),
    verified: z.boolean()
  })
  .strict()

const feature = z
  .object({
    id: z.string().regex(/^feature:[a-z0-9-]+$/),
    name: z.string().min(1),
    castTime: z.enum(CAST_TIMES),
    timing: z.string().optional(),
    role: z.enum(ROLES),
    targets: z.array(z.enum(['enemy', 'ally', 'self'])).min(1),
    summary: z.string().min(1),
    description: z.string().optional(),
    source: z.enum(['class', 'race', 'homebrew']),
    counterId: z.string().min(1),
    spend: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('uses') }).strict(),
      z.object({ kind: z.literal('pool'), maxPerUse: z.number().int().positive().optional() }).strict()
    ]),
    tag: z.string().optional(),
    attackRider: z.boolean().optional()
  })
  .strict()

/** Dice as the sheet prints them: "1d8". Shared with the importer, which parses the same text. */
export const DICE_PATTERN = /^\d+d\d+$/

const weaponProperty = z.object({ name: z.string().min(1), text: z.string() }).strict()

const weapon = z
  .object({
    id: z.string().regex(/^weapon:[a-z0-9-]+$/),
    name: z.string().min(1),
    baseType: z.string().min(1),
    melee: z.boolean(),
    proficient: z.boolean(),
    magic: z.boolean(),
    attunement: z.enum(['attuned', 'not-attuned']).optional(),
    damage: z
      .object({ dice: z.string().regex(DICE_PATTERN), type: z.string().min(1), versatile: z.string().regex(DICE_PATTERN).optional() })
      .strict(),
    range: z.object({ normal: z.number().int().min(0), long: z.number().int().min(0).optional() }).strict(),
    properties: z.array(weaponProperty),
    mastery: z.object({ name: z.string().min(1), text: z.string(), known: z.boolean() }).strict().optional(),
    description: z.string().min(1).optional()
  })
  .strict()

const trait = z
  .object({
    id: z.string().regex(/^trait:[a-z0-9-]+$/),
    name: z.string().min(1),
    kind: z.enum(TRAIT_KINDS),
    origin: z.string().min(1),
    when: z.enum(TRAIT_WHENS),
    summary: z.string().min(1),
    text: z.string().min(1),
    related: z.array(z.string().regex(/^(spell|feature):[a-z0-9-]+$/)).min(1).optional()
  })
  .strict()

const score = z.number().int().min(1).max(30)

const ability = z.enum(ABILITIES)
const skillIds = SKILL_IDS as [SkillId, ...SkillId[]] // z.enum needs a non-empty tuple; SKILL_IDS is never empty

const proficiencies = z
  .object({
    saves: z.array(ability).refine((list) => new Set(list).size === list.length, 'a saving throw is listed once'),
    skills: z.partialRecord(z.enum(skillIds), z.enum(['proficient', 'expertise']))
  })
  .strict()

const character = z
  .object({
    name: z.string().min(1),
    race: z.string().min(1),
    className: z.string().min(1),
    subclass: z.string(),
    level: z.number().int().min(1).max(20),
    abilities: z.object({ str: score, dex: score, con: score, int: score, wis: score, cha: score }).strict(),
    proficiencyBonus: z.number().int().min(2).max(6),
    proficiencies,
    spellcastingAbility: z.literal('cha'),
    hpMax: z.number().int().positive(),
    ac: z.number().int().positive(),
    spells: z.array(spell),
    counters: z.array(counter),
    features: z.array(feature),
    weapons: z.array(weapon)
  })
  .strict()

export const SeedSchema: z.ZodType<SeedData> = z
  .object({
    character,
    prepared: z.array(z.string()),
    seededUsed: z.record(z.string(), z.number().int().min(0)),
    traits: z.array(trait)
  })
  .strict()
