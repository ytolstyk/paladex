import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { legacyProfileDir, migrateLegacyProfile, profileDir } from './profile'

const roots: string[] = []
async function appData(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'paladex-profile-'))
  roots.push(dir)
  return dir
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((d) => rm(d, { recursive: true, force: true })))
})

async function seedLegacy(root: string, isProd: boolean, hp: number): Promise<string> {
  const legacy = legacyProfileDir({ appData: root, isProd })
  await mkdir(join(legacy, 'state'), { recursive: true })
  await writeFile(join(legacy, 'state', 'play-state.json'), JSON.stringify({ hp }), 'utf8')
  return legacy
}

describe('profileDir', () => {
  it('real profile for production, separate "(dev)" profile otherwise, explicit override wins', () => {
    expect(profileDir({ appData: '/a', isProd: true })).toBe('/a/Paladex')
    expect(profileDir({ appData: '/a', isProd: false })).toBe('/a/Paladex (dev)')
    expect(profileDir({ appData: '/a', isProd: true, override: '/tmp/x' })).toBe('/tmp/x')
  })
})

describe('migrateLegacyProfile', () => {
  it('copies the old profile to the new one, leaving the old one untouched', async () => {
    const root = await appData()
    const legacy = await seedLegacy(root, true, 7)
    expect(migrateLegacyProfile({ appData: root, isProd: true })).toBe(true)
    expect(JSON.parse(await readFile(join(root, 'Paladex', 'state', 'play-state.json'), 'utf8'))).toEqual({ hp: 7 })
    expect(JSON.parse(await readFile(join(legacy, 'state', 'play-state.json'), 'utf8'))).toEqual({ hp: 7 })
  })

  it('leaves no temporary folder behind and skips Chromium lock files', async () => {
    const root = await appData()
    const legacy = await seedLegacy(root, true, 7)
    await writeFile(join(legacy, 'SingletonLock'), 'x', 'utf8')
    expect(migrateLegacyProfile({ appData: root, isProd: true })).toBe(true)
    const names = await readdir(root)
    expect(names.some((n) => n.endsWith('.migrating'))).toBe(false)
    expect(await readdir(join(root, 'Paladex'))).not.toContain('SingletonLock')
  })

  it('retries cleanly after an interrupted attempt (a stale temporary folder is replaced)', async () => {
    const root = await appData()
    await seedLegacy(root, true, 7)
    await mkdir(join(root, 'Paladex.migrating'), { recursive: true })
    await writeFile(join(root, 'Paladex.migrating', 'junk'), 'partial', 'utf8')
    expect(migrateLegacyProfile({ appData: root, isProd: true })).toBe(true)
    expect(await readdir(join(root, 'Paladex'))).not.toContain('junk')
  })

  it('migrates the dev profile separately from the real one', async () => {
    const root = await appData()
    await seedLegacy(root, false, 3)
    expect(migrateLegacyProfile({ appData: root, isProd: false })).toBe(true)
    expect(JSON.parse(await readFile(join(root, 'Paladex (dev)', 'state', 'play-state.json'), 'utf8'))).toEqual({ hp: 3 })
    expect(migrateLegacyProfile({ appData: root, isProd: true })).toBe(false) // no prod legacy exists
  })

  it('never overwrites a profile that already exists', async () => {
    const root = await appData()
    await seedLegacy(root, true, 7)
    await mkdir(join(root, 'Paladex', 'state'), { recursive: true })
    await writeFile(join(root, 'Paladex', 'state', 'play-state.json'), JSON.stringify({ hp: 50 }), 'utf8')
    expect(migrateLegacyProfile({ appData: root, isProd: true })).toBe(false)
    expect(JSON.parse(await readFile(join(root, 'Paladex', 'state', 'play-state.json'), 'utf8'))).toEqual({ hp: 50 })
  })

  it('does nothing when there is no old profile, or when an override is in use', async () => {
    const root = await appData()
    expect(migrateLegacyProfile({ appData: root, isProd: true })).toBe(false)
    await seedLegacy(root, true, 7)
    expect(migrateLegacyProfile({ appData: root, isProd: true, override: join(root, 'elsewhere') })).toBe(false)
  })
})
