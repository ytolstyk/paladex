import { z } from 'zod'
import {
  DEFAULT_INSPIRATION_DIE,
  emptyTurn,
  INITIATIVE_MAX,
  INITIATIVE_MIN,
  LOG_CAP,
  MAX_TIMERS,
  LOG_KINDS,
  PAYMENT_KINDS,
  ROLES,
  SCHEMA_VERSION,
  TURN_STEPS
} from './constants'

// Runtime (zod) consumers: main process only. Renderer and preload use `import type` from here,
// and take constants from ./constants.

/** Structured, not free text: the UI renders it, so wording can change without migrating saved state. */
const LogEntrySchema = z.object({
  t: z.number(),
  kind: z.enum(LOG_KINDS),
  spellId: z.string().max(100).optional(),
  featureId: z.string().max(100).optional(),
  level: z.number().int().optional(),
  via: z.enum(PAYMENT_KINDS).optional(),
  /** Spell whose concentration this action ended. */
  endedSpellId: z.string().max(100).optional(),
  counterId: z.string().max(100).optional(),
  /** Signed: negative = spent / damage taken, positive = restored / healed. For `initiative`, the value set. */
  amount: z.number().int().optional(),
  /** Bardic Inspiration die size. */
  die: z.number().int().optional(),
  /** The turn step a `turn-step` entry changed, and whether it is now marked (true) or cleared (false). */
  step: z.enum(TURN_STEPS).optional(),
  on: z.boolean().optional()
})

const TimerSchema = z
  .object({
    spellId: z.string().max(100),
    remaining: z.number().int().min(0),
    total: z.number().int().min(1)
  })
  // A hand-edited timer that has more left than it began with would draw a bar past full.
  .transform((t) => ({ ...t, remaining: Math.min(t.remaining, t.total) }))

/** Spelled out (not built from INSPIRATION_DICE) so the inferred type is the literal union 6 | 8 | 10 | 12. */
const InspirationDieSchema = z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)])

/**
 * Live play state. Unknown fields are tolerated; every field added after v1 MUST use `.default()`.
 * Bumping SCHEMA_VERSION requires a `migrate` step below plus a frozen fixture test.
 */
export const PlayStateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  slotsUsed: z.record(z.string(), z.number().int().min(0)).default({}),
  vitals: z.object({
    hp: z.number().int(),
    hpMax: z.number().int().min(1),
    tempHp: z.number().int().min(0).default(0),
    ac: z.number().int().min(0)
  }),
  /** Spell id currently concentrated on, if any. */
  concentration: z.string().nullable().default(null),
  /** Counter id -> amount used. */
  counters: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Chosen (non-always-prepared) spell ids. */
  prepared: z.array(z.string()).max(200).default([]),
  roleOverrides: z.record(z.string(), z.enum(ROLES)).default({}),
  /** Spell ids the player starred. The grid pins them in a "Favorites" group, ordered by level then name (the order here is only the order they were starred in). */
  favorites: z.array(z.string().max(100)).max(200).default([]),
  turn: z
    .object({
      slotSpellCast: z.boolean().default(false),
      bonusActionSpent: z.boolean().default(false),
      actionSpent: z.boolean().default(false),
      moved: z.boolean().default(false),
      reactionSpent: z.boolean().default(false),
      castsSinceNewTurn: z.number().int().min(0).default(0)
    })
    .default(() => emptyTurn()),
  /**
   * This combat's initiative, set on the dial. Null until rolled; it is never cleared by a rest. An impossible value (a
   * hand-edited file, a later version with a narrower dial) falls back to "not set" rather than failing the whole save.
   */
  initiative: z.number().int().min(INITIATIVE_MIN).max(INITIATIVE_MAX).nullable().catch(null).default(null),
  /** Bardic Inspiration granted to this character by someone else: whether it is held, and the die the Bard gave. */
  inspiration: z
    .object({
      held: z.boolean().default(false),
      die: InspirationDieSchema.catch(DEFAULT_INSPIRATION_DIE).default(DEFAULT_INSPIRATION_DIE)
    })
    .default(() => ({ held: false, die: DEFAULT_INSPIRATION_DIE })),
  /**
   * Running duration timers, ticked by "New turn". Read entry by entry: one damaged timer is dropped, it does not make the whole
   * save unreadable. A timer for an unknown spell, or a second one for the same spell, is dropped by `reconcile`.
   */
  timers: z
    .array(z.unknown())
    .default([])
    .transform((entries) => entries.flatMap((e) => { const t = TimerSchema.safeParse(e); return t.success ? [t.data] : [] }).slice(0, MAX_TIMERS)),
  log: z
    .array(LogEntrySchema)
    .default([])
    .transform((entries) => entries.slice(-LOG_CAP))
})

export type PlayState = z.infer<typeof PlayStateSchema>
export type LogEntry = z.infer<typeof LogEntrySchema>

/** Upgrade older persisted shapes to the current schema. v1 is the first version, so this is identity. */
export function migrate(raw: unknown): unknown {
  return raw
}

export type ParseResult = { ok: true; state: PlayState } | { ok: false; reason: string }

export function parsePlayState(raw: unknown): ParseResult {
  const result = PlayStateSchema.safeParse(migrate(raw))
  if (result.success) return { ok: true, state: result.data }
  return { ok: false, reason: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
}
