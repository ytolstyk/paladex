import { z } from 'zod'
import { CAST_TIMES, ROLES } from '../src/shared/constants'
import type { SeedData } from '../src/shared/types'

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
    tag: z.string().optional()
  })
  .strict()

const score = z.number().int().min(1).max(30)

const character = z
  .object({
    name: z.string().min(1),
    race: z.string().min(1),
    className: z.string().min(1),
    subclass: z.string(),
    level: z.number().int().min(1).max(20),
    abilities: z.object({ str: score, dex: score, con: score, int: score, wis: score, cha: score }).strict(),
    proficiencyBonus: z.number().int().min(2).max(6),
    spellcastingAbility: z.literal('cha'),
    hpMax: z.number().int().positive(),
    ac: z.number().int().positive(),
    spells: z.array(spell),
    counters: z.array(counter),
    features: z.array(feature)
  })
  .strict()

export const SeedSchema: z.ZodType<SeedData> = z
  .object({
    character,
    prepared: z.array(z.string()),
    seededUsed: z.record(z.string(), z.number().int().min(0)),
    otherFeatures: z.array(z.object({ name: z.string().min(1), text: z.string() }).strict())
  })
  .strict()
