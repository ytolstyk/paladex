import { z } from 'zod'
import { emptyTurn, LOG_CAP, LOG_KINDS, PAYMENT_KINDS, ROLES, SCHEMA_VERSION } from './constants'

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
  /** Signed: negative = spent / damage taken, positive = restored / healed. */
  amount: z.number().int().optional()
})

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
  turn: z
    .object({
      slotSpellCast: z.boolean().default(false),
      bonusActionSpent: z.boolean().default(false),
      castsSinceNewTurn: z.number().int().min(0).default(0)
    })
    .default(() => emptyTurn()),
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
