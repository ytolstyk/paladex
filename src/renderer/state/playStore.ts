import { create } from 'zustand'
import type { InspirationDie } from '@shared/constants'
import type { PaladexApi } from '@shared/ipc'
import type { PlayState } from '@shared/schema'
import type { Payment } from '@shared/types'
import * as actions from '@/domain/actions'
import * as table from '@/domain/tableActions'
import type { Catalog } from '@/domain/catalog'
import { formatLog } from '@/domain/log'
import { warningText } from '@/domain/turn'
import { reconcile, seedPlayState } from '@/domain/hydrate'
import type { RestKind } from '@/domain/rests'
import { popUndo, pushUndo, type UndoEntry } from '@/domain/undo'

export type Status = 'loading' | 'ready' | 'unreadable'

export interface Toast {
  id: number
  msg: string
  /** Only toasts that describe an action offer Undo; the "Undone" confirmation does not. */
  undoable: boolean
}

export interface PaladexStore {
  status: Status
  reason: string | null
  recoveredFromBackup: boolean
  play: PlayState | null
  /** In-memory only: a relaunch starts with an empty stack. */
  undo: UndoEntry[]
  saveError: string | null
  toast: Toast | null
  isDev: boolean

  /** Idempotent: safe to call twice (React StrictMode does in dev). */
  init(): Promise<void>
  /** Cast a spell. Omit `payment` to use the spell's preferred option (free casts before slots). */
  cast(spellId: string, payment?: Payment): void
  /** Manual gem correction: spend or restore one slot. */
  adjustSlot(level: number, direction: 'spend' | 'restore'): void
  newTurn(): void
  /** Use a class/race feature. `amount` only matters for pool features (Lay On Hands). */
  activateFeature(featureId: string, amount?: number): void
  /** Choose or un-choose a spell as prepared. */
  togglePrepared(spellId: string): void
  /** Spend (negative) or restore (positive) part of a resource. */
  adjustCounter(counterId: string, delta: number): void
  /** Damage (negative) or healing (positive). */
  adjustHp(delta: number): void
  takeRest(rest: RestKind): void
  /** Set this combat's initiative (1 to 25), or clear it with null. */
  setInitiative(value: number | null): void
  /** Receive (true) or spend (false) Bardic Inspiration. */
  setInspirationHeld(held: boolean): void
  setInspirationDie(die: InspirationDie): void
  dropConcentration(): void
  undoLast(): void
  dismissToast(): void
  exportRaw(): Promise<void>
  resetState(): Promise<void>
}

export interface StoreDeps {
  /** Persistence port. In the app this is `window.paladex`; tests pass a fake. */
  port: PaladexApi
  catalog: Catalog
  now?: () => number
}

/** A thin dispatcher: every rule lives in `domain/actions`. The store owns session state, persistence and undo bookkeeping. */
export function createPlayStore({ port, catalog, now = Date.now }: StoreDeps) {
  let toastSeq = 0
  let initPromise: Promise<void> | null = null

  return create<PaladexStore>((set, get) => {
    const persist = (state: PlayState): void => {
      port.saveState(state).then(
        () => {
          if (get().saveError !== null) set({ saveError: null })
        },
        (err: unknown) => set({ saveError: err instanceof Error ? err.message : String(err) })
      )
    }

    const apply = (result: actions.ActionResult | null): void => {
      const { play, undo } = get()
      if (!play || !result) return
      // A stale toast must never offer to undo something other than the latest action, so non-cast actions clear it.
      const base =
        result.toast ?? (result.entry.kind === 'cast' || result.entry.kind === 'feature' ? formatLog(result.entry, catalog.nameOf) : null)
      const warning = result.warnings ? warningText(result.warnings) : ''
      const message = base && warning ? `${base}. Heads up: ${warning}` : base
      const toast: Toast | null = message ? { id: ++toastSeq, msg: message, undoable: true } : null
      set({ play: result.state, undo: pushUndo(undo, play, result.undo, result.entry.t), toast })
      persist(result.state)
    }

    const load = async (): Promise<void> => {
      try {
        const [loaded, profile] = await Promise.all([port.loadState(), port.profileInfo()])
        set({ isDev: profile.isDev })
        if (loaded.status === 'unreadable') {
          set({ status: 'unreadable', reason: loaded.reason })
        } else if (loaded.status === 'empty') {
          const fresh = seedPlayState(catalog, now())
          set({ status: 'ready', play: fresh })
          persist(fresh)
        } else {
          const { state: play, repaired } = reconcile(loaded.state, catalog)
          set({ status: 'ready', play, recoveredFromBackup: loaded.recoveredFromBackup })
          // Write back anything we repaired so a damaged primary file doesn't linger.
          if (repaired || loaded.recoveredFromBackup) persist(play)
        }
      } catch (err) {
        set({ status: 'unreadable', reason: err instanceof Error ? err.message : String(err) })
      }
    }

    const current = (): PlayState | null => get().play

    return {
      status: 'loading',
      reason: null,
      recoveredFromBackup: false,
      play: null,
      undo: [],
      saveError: null,
      toast: null,
      isDev: false,

      init() {
        initPromise ??= load()
        return initPromise
      },

      cast(spellId, payment) {
        const play = current()
        if (play) apply(actions.castSpell(play, catalog, spellId, payment, now()))
      },

      adjustSlot(level, direction) {
        const play = current()
        if (play) apply(actions.adjustSlot(play, catalog, level, direction, now()))
      },

      newTurn() {
        const play = current()
        if (play) apply(actions.startNewTurn(play, now()))
      },

      activateFeature(featureId, amount = 1) {
        const play = current()
        if (play) apply(actions.activateFeature(play, catalog, featureId, amount, now()))
      },

      togglePrepared(spellId) {
        const play = current()
        if (play) apply(actions.togglePrepared(play, catalog, spellId, now()))
      },

      adjustCounter(counterId, delta) {
        const play = current()
        if (play) apply(actions.adjustCounter(play, catalog, counterId, delta, now()))
      },

      adjustHp(delta) {
        const play = current()
        if (play) apply(actions.adjustHp(play, catalog, delta, now()))
      },

      takeRest(rest) {
        const play = current()
        if (play) apply(actions.takeRest(play, catalog, rest, now()))
      },

      setInitiative(value) {
        const play = current()
        if (play) apply(table.setInitiative(play, value, now()))
      },

      setInspirationHeld(held) {
        const play = current()
        if (play) apply(table.setInspirationHeld(play, held, now()))
      },

      setInspirationDie(die) {
        const play = current()
        if (play) apply(table.setInspirationDie(play, die, now()))
      },

      dropConcentration() {
        const play = current()
        if (play) apply(actions.dropConcentration(play, now()))
      },

      undoLast() {
        const popped = popUndo(get().undo)
        if (!popped) return
        set({
          play: popped.restored,
          undo: popped.stack,
          toast: { id: ++toastSeq, msg: 'Undone', undoable: false }
        })
        persist(popped.restored)
      },

      dismissToast() {
        set({ toast: null })
      },

      async exportRaw() {
        await port.exportState()
      },

      async resetState() {
        // Leave the playable state first so no action can persist old state into the files being moved aside.
        set({ status: 'loading', reason: null, play: null, undo: [], recoveredFromBackup: false, toast: null })
        await port.resetState()
        initPromise = null
        await get().init()
      }
    }
  })
}

export type PlayStoreHook = ReturnType<typeof createPlayStore>
