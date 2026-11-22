/**
 * `npm run install-app`: build the app and install it to /Applications, replacing the old version safely.
 *
 *   1. build (skippable) and find the built .app for this CPU
 *   2. check everything that could go wrong BEFORE touching anything: the built app is sound, the install folder is
 *      writable, and any old copy really is this app (never delete something that merely shares the name)
 *   3. copy the new build in beside the old one (a hidden staging folder) and verify it
 *   4. only then: quit the old app if it is running (gracefully, so it saves), remove it, and rename the new one in
 *   5. verify the result and optionally launch it
 *
 * If the copy fails the old app is untouched. Play state lives in ~/Library/Application Support/<app>, outside the
 * bundle, so replacing the app never touches it.
 */
import { execFileSync } from 'node:child_process'
import { accessSync, constants, existsSync, lstatSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { assertIsOurApp, escapeRegex, findBuiltApp, LEGACY_APPS, parseArgs, stagingPath, USAGE } from './install-app-lib'

const QUIT_TIMEOUT_MS = 15_000
const QUIT_POLL_MS = 250

// System tools by absolute path, so a hostile PATH entry cannot stand in for them.
const PLUTIL = '/usr/bin/plutil'
const DITTO = '/usr/bin/ditto'
const OSASCRIPT = '/usr/bin/osascript'
const PGREP = '/usr/bin/pgrep'
const XATTR = '/usr/bin/xattr'
const OPEN = '/usr/bin/open'

const INFO_PLIST = 'Contents/Info.plist'
const MACOS_DIR = 'Contents/MacOS'

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { build: { appId: string; productName: string } }
const { appId, productName } = pkg.build

/** True if anything exists at the path, including a dangling symlink (`existsSync` would say no and let ditto write through it). */
function pathExists(path: string): boolean {
  return lstatSync(path, { throwIfNoEntry: false }) !== undefined
}

function plistValue(appPath: string, key: string): string | null {
  try {
    return execFileSync(PLUTIL, ['-extract', key, 'raw', '-o', '-', join(appPath, INFO_PLIST)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return null
  }
}

/** A bundle is only worth installing if it is ours and its executable is there. */
function assertSoundBundle(appPath: string, bundleId: string, name: string): void {
  assertIsOurApp(plistValue(appPath, 'CFBundleIdentifier'), bundleId, appPath)
  if (!existsSync(join(appPath, MACOS_DIR, name))) throw new Error(`${appPath} has no executable (${name}); it looks incomplete.`)
}

/** Is a copy of the app running from exactly this path? pgrep exits 1 for "none"; anything else is a real error. */
function isRunningFrom(appPath: string): boolean {
  try {
    execFileSync(PGREP, ['-f', '--', `^${escapeRegex(appPath)}/${MACOS_DIR}/`], { stdio: 'ignore' })
    return true
  } catch (err) {
    if ((err as { status?: number }).status === 1) return false
    throw new Error(`Could not check whether ${appPath} is running: ${(err as Error).message}`)
  }
}

/** Ask the app to quit (it flushes unsaved play state on the way out) and wait. Never force-kills. */
async function quitGracefully(appPath: string, bundleId: string, name: string): Promise<void> {
  console.log(`${name} is running: asking it to quit so it can be replaced…`)
  try {
    execFileSync(OSASCRIPT, ['-e', `tell application id "${bundleId}" to quit`], { stdio: 'ignore' })
  } catch {
    throw new Error(`Could not ask ${name} to quit (macOS may have blocked the request). Quit it yourself, then run this again.`)
  }
  const deadline = Date.now() + QUIT_TIMEOUT_MS
  while (isRunningFrom(appPath)) {
    if (Date.now() > deadline) throw new Error(`${name} did not quit within ${QUIT_TIMEOUT_MS / 1000}s. Quit it yourself, then run this again.`)
    await sleep(QUIT_POLL_MS)
  }
}

/** Remove an installed copy after proving it is the app we think it is. */
async function removeInstalled(path: string, bundleId: string, name: string): Promise<void> {
  if (isRunningFrom(path)) await quitGracefully(path, bundleId, name)
  rmSync(path, { recursive: true, force: true })
}

async function main(): Promise<void> {
  if (process.platform !== 'darwin') throw new Error('install-app only supports macOS.')
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(USAGE)
    return
  }

  const installDir = resolve(options.dir.replace(/^~(?=$|\/)/, homedir()))
  const target = join(installDir, `${productName}.app`)
  const staging = stagingPath(installDir, productName)
  const dry = options.dryRun
  const say = (message: string): void => console.log(dry ? `[dry run] ${message}` : message)

  // 1. build and locate
  if (options.build) {
    say('Building the app (npm run build:app)…')
    if (!dry) execFileSync('npm', ['run', 'build:app'], { stdio: 'inherit' })
  }
  const built = findBuiltApp(resolve('dist'), productName, process.arch, existsSync)
  if (!built) {
    if (dry && options.build) return say('The built app would be found in dist/ after the build. Nothing more to check.')
    throw new Error('No built app found in dist/. Run without --no-build, or run "npm run build:app" first.')
  }
  assertSoundBundle(built, appId, productName)

  // 2. check everything before changing anything
  if (!existsSync(installDir)) throw new Error(`Install folder ${installDir} does not exist.`)
  try {
    accessSync(installDir, constants.W_OK)
  } catch {
    throw new Error(`No permission to write to ${installDir}. Try --dir ~/Applications, or run from an admin account.`)
  }
  if (pathExists(target)) assertIsOurApp(plistValue(target, 'CFBundleIdentifier'), appId, target)
  const legacyToRemove = LEGACY_APPS.map((l) => ({ ...l, path: join(installDir, `${l.name}.app`) })).filter((l) => {
    if (!pathExists(l.path)) return false
    if (plistValue(l.path, 'CFBundleIdentifier') === l.bundleId) return true
    console.warn(`Leaving ${l.path} alone: it is not the old ${l.name} (different bundle id).`)
    return false
  })

  const oldVersion = pathExists(target) ? (plistValue(target, 'CFBundleShortVersionString') ?? 'unknown version') : null
  say(oldVersion ? `Replacing the installed ${productName} (${oldVersion}) at ${target}` : `No previous install at ${target}`)
  for (const l of legacyToRemove) say(`Will also remove the old ${l.name} at ${l.path}`)
  say(`Installing ${built} -> ${target}`)
  if (dry) return

  // 3. stage the new copy and verify it; on any failure here the old app is untouched
  rmSync(staging, { recursive: true, force: true }) // leftover from an interrupted run
  try {
    execFileSync(DITTO, [built, staging], { stdio: 'inherit' }) // keeps symlinks, permissions and signatures intact
    assertSoundBundle(staging, appId, productName)
  } catch (err) {
    rmSync(staging, { recursive: true, force: true })
    throw err
  }

  // 4. swap: the old app goes only now that a verified replacement is sitting next to it
  try {
    if (pathExists(target)) await removeInstalled(target, appId, productName)
    for (const l of legacyToRemove) await removeInstalled(l.path, l.bundleId, l.name)
    renameSync(staging, target)
  } catch (err) {
    throw new Error(`${(err as Error).message}\nThe new, verified copy is waiting at ${staging}. Once the problem is fixed, run this again (or move it to ${target} yourself).`)
  }
  try {
    execFileSync(XATTR, ['-dr', 'com.apple.quarantine', target], { stdio: 'ignore' })
  } catch {
    // Nothing to clear on a locally built app; harmless either way.
  }

  // 5. verify and report
  assertSoundBundle(target, appId, productName)
  const version = plistValue(target, 'CFBundleShortVersionString') ?? 'unknown version'
  console.log(`Installed ${productName} ${version} at ${target}`)
  console.log(`Your play state is untouched (${join(homedir(), 'Library/Application Support', productName)}).`)
  if (options.open) execFileSync(OPEN, [target])
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
