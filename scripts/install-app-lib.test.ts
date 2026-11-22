import { describe, expect, it } from 'vitest'
import {
  assertIsOurApp,
  builtAppCandidates,
  DEFAULT_INSTALL_DIR,
  escapeRegex,
  findBuiltApp,
  LEGACY_APPS,
  parseArgs,
  stagingPath
} from './install-app-lib'

describe('parseArgs', () => {
  it('defaults: build, install to /Applications, no launch', () => {
    expect(parseArgs([])).toEqual({ build: true, dir: DEFAULT_INSTALL_DIR, open: false, dryRun: false, help: false })
  })

  it('reads every flag', () => {
    expect(parseArgs(['--no-build', '--open', '--dry-run', '--dir', '/tmp/x'])).toMatchObject({
      build: false,
      open: true,
      dryRun: true,
      dir: '/tmp/x'
    })
    expect(parseArgs(['-h']).help).toBe(true)
  })

  it('rejects unknown flags and a --dir without a folder', () => {
    expect(() => parseArgs(['--wat'])).toThrow(/Unknown option "--wat"/)
    expect(() => parseArgs(['--dir'])).toThrow(/--dir needs a folder/)
    expect(() => parseArgs(['--dir', '--open'])).toThrow(/--dir needs a folder/)
  })
})

describe('findBuiltApp', () => {
  const has = (...paths: string[]) => (p: string) => paths.includes(p)

  it('prefers the folder matching this CPU', () => {
    const both = has('dist/mac-arm64/App.app', 'dist/mac/App.app')
    expect(findBuiltApp('dist', 'App', 'arm64', both)).toBe('dist/mac-arm64/App.app')
    expect(findBuiltApp('dist', 'App', 'x64', both)).toBe('dist/mac/App.app')
  })

  it('falls back to the other architecture or a universal build, and returns null when there is none', () => {
    expect(findBuiltApp('dist', 'App', 'arm64', has('dist/mac/App.app'))).toBe('dist/mac/App.app')
    expect(findBuiltApp('dist', 'App', 'x64', has('dist/mac-universal/App.app'))).toBe('dist/mac-universal/App.app')
    expect(findBuiltApp('dist', 'App', 'arm64', has())).toBeNull()
  })

  it('always lists the universal build last', () => {
    expect(builtAppCandidates('arm64').at(-1)).toBe('mac-universal')
  })
})

describe('assertIsOurApp', () => {
  it('passes for our bundle id', () => {
    expect(() => assertIsOurApp('local.paladex', 'local.paladex', '/Applications/X.app')).not.toThrow()
  })

  it('refuses to remove a different app, or one it cannot read', () => {
    expect(() => assertIsOurApp('com.other.app', 'local.paladex', '/Applications/X.app')).toThrow(/not this app/)
    expect(() => assertIsOurApp(null, 'local.paladex', '/Applications/X.app')).toThrow(/unreadable/)
  })
})

describe('legacy installs', () => {
  it('knows the pre-rename app, so an old copy is cleaned up rather than left beside the new one', () => {
    expect(LEGACY_APPS).toContainEqual({ name: 'Havels Grimoire', bundleId: 'local.havels.grimoire' })
  })
})

describe('escapeRegex', () => {
  it('makes a path safe to use as a literal regular expression', () => {
    const path = '/Users/x/Apps (new)/Pal[a]dex+.app'
    expect(new RegExp(`^${escapeRegex(path)}$`).test(path)).toBe(true)
    expect(new RegExp(escapeRegex('a.b')).test('axb')).toBe(false) // the dot is literal now
    expect(escapeRegex('plain')).toBe('plain')
  })
})

describe('stagingPath', () => {
  it('is a hidden sibling of the target, never the target itself', () => {
    expect(stagingPath('/Applications', 'Paladex')).toBe('/Applications/.Paladex.app.installing')
  })
})
