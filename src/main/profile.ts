import { cpSync, existsSync, renameSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'

/** Folder names under Application Support. The app was called "Havels Grimoire" before it became Paladex. */
export const PROFILE_NAME = 'Paladex'
export const LEGACY_PROFILE_NAME = 'Havels Grimoire'

export interface ProfileOptions {
  /** `app.getPath('appData')`. */
  appData: string
  /** Packaged or `PALADEX_PROFILE=prod`: the real profile. Otherwise a separate "(dev)" one that can't touch real state. */
  isProd: boolean
  /** `PALADEX_USER_DATA`: tests and launch checks point the app at a throwaway folder. */
  override?: string
}

export function profileDir({ appData, isProd, override }: ProfileOptions): string {
  if (override) return override
  return join(appData, isProd ? PROFILE_NAME : `${PROFILE_NAME} (dev)`)
}

export function legacyProfileDir({ appData, isProd }: Pick<ProfileOptions, 'appData' | 'isProd'>): string {
  return join(appData, isProd ? LEGACY_PROFILE_NAME : `${LEGACY_PROFILE_NAME} (dev)`)
}

/** Chromium's per-process lock files must never be carried to a new profile (a copied lock confuses single-instance). */
const isChromiumLock = (source: string): boolean => /^Singleton/.test(basename(source))

/**
 * Carry play state across the rename: copy the old profile to the new one once. The old folder is never deleted
 * or modified. The copy goes to a temporary name and is renamed into place, so an interrupted copy can never leave a
 * half-filled profile that blocks a retry. Nothing is copied if the new profile already exists or an explicit
 * override is in use. Returns true when a copy happened.
 */
export function migrateLegacyProfile(options: ProfileOptions): boolean {
  if (options.override) return false
  const target = profileDir(options)
  const legacy = legacyProfileDir(options)
  if (existsSync(target) || !existsSync(legacy)) return false

  const staging = `${target}.migrating`
  rmSync(staging, { recursive: true, force: true }) // leftover from an earlier interrupted attempt
  try {
    cpSync(legacy, staging, { recursive: true, filter: (source) => !isChromiumLock(source) })
    renameSync(staging, target)
  } catch (err) {
    rmSync(staging, { recursive: true, force: true })
    throw err
  }
  return true
}
