/** Pure helpers for scripts/install-app.ts, kept separate so they can be unit-tested without touching the disk. */

export interface InstallOptions {
  /** Run `npm run build:app` first (default). `--no-build` reuses the app already in dist/. */
  build: boolean
  /** Folder to install into. Default /Applications. */
  dir: string
  /** Launch the app afterwards. */
  open: boolean
  /** Print what would happen and change nothing. */
  dryRun: boolean
  help: boolean
}

export const DEFAULT_INSTALL_DIR = '/Applications'

/** Earlier names of this app. If one is installed it is removed too, so there is never a stale second copy. */
export const LEGACY_APPS: readonly { name: string; bundleId: string }[] = [
  { name: 'Havels Grimoire', bundleId: 'local.havels.grimoire' }
]

export const USAGE = `Usage: npm run install-app -- [options]

Builds the app and installs it into /Applications, replacing any previous version.
Your play state (in ~/Library/Application Support) is never touched.

Options:
  --no-build     reuse the app already built in dist/ instead of rebuilding
  --dir <path>   install into <path> instead of /Applications (e.g. ~/Applications)
  --open         launch the app when done
  --dry-run      show what would happen without changing anything
  --help         show this message`

export function parseArgs(argv: readonly string[]): InstallOptions {
  const options: InstallOptions = { build: true, dir: DEFAULT_INSTALL_DIR, open: false, dryRun: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--no-build':
        options.build = false
        break
      case '--open':
        options.open = true
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      case '--dir': {
        const value = argv[++i]
        if (!value || value.startsWith('--')) throw new Error('--dir needs a folder, e.g. --dir ~/Applications')
        options.dir = value
        break
      }
      default:
        throw new Error(`Unknown option "${arg}". Run with --help.`)
    }
  }
  return options
}

/** electron-builder's output folder for each CPU architecture. */
export function builtAppCandidates(arch: string): string[] {
  const folders = arch === 'arm64' ? ['mac-arm64', 'mac'] : ['mac', 'mac-arm64']
  return [...folders, 'mac-universal']
}

/** First existing built app for this machine's architecture, or null. */
export function findBuiltApp(
  distDir: string,
  productName: string,
  arch: string,
  exists: (path: string) => boolean
): string | null {
  for (const folder of builtAppCandidates(arch)) {
    const candidate = `${distDir}/${folder}/${productName}.app`
    if (exists(candidate)) return candidate
  }
  return null
}

/**
 * Refuse to delete anything that isn't this app. The install folder may hold an unrelated app that happens to share
 * the name, and a delete is the one step here that cannot be undone.
 */
export function assertIsOurApp(foundBundleId: string | null, expectedBundleId: string, path: string): void {
  if (foundBundleId !== expectedBundleId) {
    throw new Error(
      `${path} exists but is not this app (bundle id ${foundBundleId ?? 'unreadable'}, expected ${expectedBundleId}). ` +
        'Not removing it. Move or delete it yourself, then run this again.'
    )
  }
}

/** Escape text for use inside a regular expression (pgrep -f takes a regex, and install paths can contain `(` or `.`). */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Hidden sibling of the target where the new copy is built and checked before it replaces the old one. */
export function stagingPath(installDir: string, productName: string): string {
  return `${installDir}/.${productName}.app.installing`
}
