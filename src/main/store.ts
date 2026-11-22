import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parsePlayState, type PlayState } from '../shared/schema'
import type { LoadResult } from '../shared/ipc'

const STATE_FILE = 'play-state.json'
/** A real state file is tens of KB; refuse to parse anything wildly larger. */
const MAX_STATE_BYTES = 5 * 1024 * 1024

/**
 * `invalid` = we read the file and its content is bad (safe to fall back to the backup).
 * `unreadable` = we could not read it at all (permissions, I/O, oversize): the content may be fine, so never
 * fall back to an older backup, reseed, or overwrite it.
 */
type ReadResult =
  | { kind: 'ok'; state: PlayState }
  | { kind: 'missing' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'unreadable'; reason: string }

interface Waiter {
  resolve(): void
  reject(err: unknown): void
}

function errorCode(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException | null)?.code
}

/**
 * Durable single-file store for live play state.
 *  - saves are coalesced latest-wins: every save is a full snapshot, so a burst of taps becomes one disk write
 *    and each caller's promise resolves once a write containing its snapshot (or a newer one) has landed
 *  - each write goes to a unique tmp file then renames over the target (atomic on POSIX)
 *  - the previous file is copied to `.bak` first, but only if it parses (a corrupt primary must not clobber a good backup)
 *  - only a genuinely missing file counts as "no state"; a file we cannot read is reported, never replaced, and a
 *    corrupt (readable) primary is set aside as `.corrupt-<stamp>` before the first overwrite
 *  - nothing is ever deleted outright: a reset moves files aside with a timestamp
 */
export class StateStore {
  private readonly file: string
  private readonly backup: string
  private pending: { json: string; waiters: Waiter[] } | null = null
  private draining: Promise<void> | null = null
  private tmpCounter = 0
  private dirReady = false
  private primaryVerified = false

  constructor(private readonly dir: string) {
    this.file = join(dir, STATE_FILE)
    this.backup = `${this.file}.bak`
  }

  get directory(): string {
    return this.dir
  }

  async load(): Promise<LoadResult> {
    await this.flush()
    const primary = await this.readState(this.file)
    if (primary.kind === 'ok') return { status: 'ok', state: primary.state, recoveredFromBackup: false }
    // A primary we couldn't read may be perfectly good: don't substitute an older backup for it.
    if (primary.kind === 'unreadable') return { status: 'unreadable', reason: primary.reason }

    const backup = await this.readState(this.backup)
    if (backup.kind === 'ok') return { status: 'ok', state: backup.state, recoveredFromBackup: true }

    if (primary.kind === 'missing' && backup.kind === 'missing') return { status: 'empty' }
    return { status: 'unreadable', reason: describeFailure(primary, backup) }
  }

  /** Queue a save. Resolves once a write that includes this snapshot (or a newer one) is on disk. */
  save(state: PlayState): Promise<void> {
    const json = JSON.stringify(state)
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject }
      if (this.pending) {
        this.pending.json = json
        this.pending.waiters.push(waiter)
      } else {
        this.pending = { json, waiters: [waiter] }
      }
      this.kick()
    })
  }

  /** Wait for every queued write. Call on before-quit. */
  async flush(): Promise<void> {
    while (this.draining) await this.draining
  }

  /** The raw state file, or null if there isn't one. Other read errors are thrown, not hidden. */
  async readRaw(): Promise<string | null> {
    await this.flush()
    try {
      return await readFile(this.file, 'utf8')
    } catch (err) {
      if (errorCode(err) === 'ENOENT') return null
      throw err
    }
  }

  /** Move state aside (never delete) so a mistaken reset is recoverable by hand. */
  async reset(): Promise<void> {
    await this.flush()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    for (const path of [this.file, this.backup]) {
      await rename(path, `${path}.reset-${stamp}`).catch((err: unknown) => {
        if (errorCode(err) !== 'ENOENT') throw err
      })
    }
    this.primaryVerified = false
  }

  /** Test helper / cleanup. */
  async destroy(): Promise<void> {
    await this.flush()
    await rm(this.dir, { recursive: true, force: true })
  }

  /**
   * Start draining unless a drain is already running. The `finally` re-kick covers a save() that lands in the
   * microtask gap after the drain loop sees `pending === null` but before `draining` is cleared.
   */
  private kick(): void {
    if (this.draining) return
    this.draining = this.drain().finally(() => {
      this.draining = null
      if (this.pending) this.kick() // a save arrived while we were finishing
    })
  }

  /** Never rejects: failures go to the waiters of the batch that failed. */
  private async drain(): Promise<void> {
    while (this.pending) {
      const batch = this.pending
      this.pending = null
      try {
        await this.write(batch.json)
        for (const waiter of batch.waiters) waiter.resolve()
      } catch (err) {
        for (const waiter of batch.waiters) waiter.reject(err)
      }
    }
  }

  private async write(json: string): Promise<void> {
    if (!this.dirReady) {
      await mkdir(this.dir, { recursive: true })
      this.dirReady = true
    }
    const tmp = `${this.file}.${process.pid}.${++this.tmpCounter}.tmp`
    try {
      await writeFile(tmp, json, 'utf8')
      await this.backUpPrimary()
      await rename(tmp, this.file)
    } catch (err) {
      await rm(tmp, { force: true })
      throw err
    }
    this.primaryVerified = true // we just wrote it, so it is known good
  }

  /** Best effort: a failed backup must not block saving. */
  private async backUpPrimary(): Promise<void> {
    if (!this.primaryVerified) {
      const current = await this.readState(this.file)
      if (current.kind === 'unreadable') throw new Error(`Refusing to overwrite a state file that cannot be read: ${current.reason}`)
      this.primaryVerified = true
      if (current.kind === 'invalid') {
        // Keep the corrupt file for manual recovery instead of silently destroying the only copy.
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        await rename(this.file, `${this.file}.corrupt-${stamp}`)
        return
      }
      if (current.kind === 'missing') return
    }
    try {
      await copyFile(this.file, this.backup)
    } catch (err) {
      if (errorCode(err) !== 'ENOENT') console.error('Could not refresh state backup:', err)
    }
  }

  private async readState(path: string): Promise<ReadResult> {
    let text: string
    try {
      const info = await stat(path)
      if (info.size > MAX_STATE_BYTES) return { kind: 'unreadable', reason: `file is unexpectedly large (${info.size} bytes)` }
      text = await readFile(path, 'utf8')
    } catch (err) {
      if (errorCode(err) === 'ENOENT') return { kind: 'missing' }
      const detail = errorCode(err) ?? (err instanceof Error ? err.message : String(err))
      return { kind: 'unreadable', reason: `cannot read file (${detail})` }
    }
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch (err) {
      return { kind: 'invalid', reason: `not valid JSON (${err instanceof Error ? err.message : String(err)})` }
    }
    const parsed = parsePlayState(raw)
    return parsed.ok ? { kind: 'ok', state: parsed.state } : { kind: 'invalid', reason: parsed.reason }
  }
}

function describeFailure(primary: ReadResult, backup: ReadResult): string {
  for (const result of [primary, backup]) {
    if (result.kind === 'invalid' || result.kind === 'unreadable') return result.reason
  }
  return 'unknown'
}
