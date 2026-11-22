/**
 * `npm run icon`: build/icon.svg -> build/icon.png (1024) -> build/icon.icns (all macOS sizes).
 * The generated files are committed, so a normal build never needs this; run it after editing the SVG.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import electron from 'electron'

const SVG = resolve('build/icon.svg')
const PNG = resolve('build/icon.png')
const ICNS = resolve('build/icon.icns')
const ICONSET = resolve('build/icon.iconset')

/** macOS iconset file name -> pixel size. */
const ICONSET_FILES: Record<string, number> = {
  'icon_16x16.png': 16,
  'icon_16x16@2x.png': 32,
  'icon_32x32.png': 32,
  'icon_32x32@2x.png': 64,
  'icon_128x128.png': 128,
  'icon_128x128@2x.png': 256,
  'icon_256x256.png': 256,
  'icon_256x256@2x.png': 512,
  'icon_512x512.png': 512,
  'icon_512x512@2x.png': 1024
}

function main(): void {
  console.log('Rendering the SVG…')
  execFileSync(electron as unknown as string, ['scripts/render-icon.cjs', SVG, PNG], { stdio: 'inherit' })

  rmSync(ICONSET, { recursive: true, force: true })
  mkdirSync(ICONSET, { recursive: true })
  for (const [name, size] of Object.entries(ICONSET_FILES)) {
    execFileSync('sips', ['-z', String(size), String(size), PNG, '--out', join(ICONSET, name)], { stdio: 'ignore' })
  }
  execFileSync('iconutil', ['-c', 'icns', ICONSET, '-o', ICNS], { stdio: 'inherit' })
  rmSync(ICONSET, { recursive: true, force: true })
  console.log(`Wrote ${PNG} and ${ICNS}`)
}

main()
