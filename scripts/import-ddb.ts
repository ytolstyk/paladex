/**
 * One-shot developer tool: raw D&D Beyond payload -> data/havel.character.json (the app's seed).
 *
 *   npm run seed                      reads data/raw/ddb-character.json
 *   npm run seed -- --fetch 156485418 fetches the PUBLIC API first (sheet must be Public), saves the raw file, then seeds
 *
 * The app itself never touches the network. Raw payloads contain account identifiers, so data/raw/ is gitignored;
 * the normalized output drops them.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { normalizeDdb } from './normalize'

const RAW_PATH = resolve('data/raw/ddb-character.json')
const OUT_PATH = resolve('data/havel.character.json')
const API = 'https://character-service.dndbeyond.com/character/v5/character/'
const FETCH_TIMEOUT_MS = 15_000
const MAX_PAYLOAD_BYTES = 5_000_000 // a real sheet is a few hundred KB

async function fetchRaw(characterId: string): Promise<string> {
  if (!/^\d{1,12}$/.test(characterId)) throw new Error('Character id must be digits only')
  // Host is fixed and redirects are refused, so this can only ever talk to the DDB character service.
  const response = await fetch(`${API}${characterId}`, { redirect: 'error', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) {
    throw new Error(`DDB returned HTTP ${response.status}. A private sheet answers 403: set it to Public, then retry.`)
  }
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_PAYLOAD_BYTES) throw new Error(`Refusing a ${declared}-byte response`)
  const text = await response.text()
  if (text.length > MAX_PAYLOAD_BYTES) throw new Error('Refusing an oversized response')
  await mkdir(dirname(RAW_PATH), { recursive: true })
  await writeFile(RAW_PATH, text, 'utf8')
  return text
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const fetchIndex = args.indexOf('--fetch')
  const raw = fetchIndex >= 0 ? await fetchRaw(args[fetchIndex + 1] ?? '') : await readFile(RAW_PATH, 'utf8')

  const { seed, warnings } = normalizeDdb(JSON.parse(raw))
  await mkdir(dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, `${JSON.stringify(seed, null, 2)}\n`, 'utf8')

  const c = seed.character
  console.log(`Wrote ${OUT_PATH}`)
  console.log(`${c.name}: ${c.race} ${c.className} ${c.level}, HP ${c.hpMax}, AC ${c.ac}`)
  console.log(`${c.spells.length} spells, ${c.counters.length} counters, ${seed.traits.length} feats and traits`)
  console.log(`prepared (chosen): ${seed.prepared.join(', ') || 'none'}`)
  for (const w of warnings) console.warn(`WARNING: ${w}`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
