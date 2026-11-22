import type { EffectId } from './effects'

/**
 * One piece of a cast effect. Everything is a number the stylesheet reads as a custom property (see `CastEffect`), so the
 * CSS only decides how a piece looks and moves, never where it goes. `x` and `y` are percentages of the card (0 to 100,
 * from its top-left); the pixel offsets start at that point. Angles are degrees, 0 = right, 90 = down.
 */
export interface Particle {
  x: number
  y: number
  /** A waypoint reached on the way out (a rocket's burst point). Zero for pieces that fly straight. */
  cx: number
  cy: number
  /** Where the piece ends up. Zero for rays and rings, which do not travel. */
  dx: number
  dy: number
  /** Direction of a ray. */
  angle: number
  /** How far a ray reaches from the card's middle. Zero for everything else. */
  reach: number
  /** Diameter, or a ray's thickness, or a ring's border width. */
  size: number
  /** Milliseconds before it starts, and how long it lasts. */
  delay: number
  dur: number
}

export interface EffectShow {
  particles: Particle[]
  /** When the whole show has finished (every piece and the card's aura), in milliseconds. */
  totalMs: number
}

/**
 * How long the stylesheet's aura (`fx-aura`, 0.8s) and halo (`fx-halo`, 0.9s) run. They are CSS-only, so the show
 * is never reported finished before this, or the layer would be removed mid-fade. Keep it at or above both.
 */
export const BACKDROP_MS = 900

type Range = readonly [min: number, max: number]
type Edge = 'top' | 'right' | 'bottom' | 'left'
type Rand = () => number

/** Where an edge's outward direction points. */
const OUTWARD: Record<Edge, number> = { top: -90, right: 0, bottom: 90, left: 180 }
const UP = -90
/** How far a rising piece leans away from the side it left. */
const SIDE_LEAN = 20
/** Keep origins off the corners so pieces don't all start from the same four points. */
const EDGE_MARGIN: Range = [8, 92]
const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left']
const UPPER_EDGES: readonly Edge[] = ['top', 'left', 'right']

/** A tiny seeded generator (mulberry32): the same seed always gives the same show, so it is testable. */
export function seededRandom(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number): number => Math.round(n * 10) / 10
const between = (rand: Rand, [min, max]: Range): number => min + rand() * (max - min)
/** A random amount from `-amount` to `amount`. */
const wobble = (rand: Rand, amount: number): number => (rand() * 2 - 1) * amount
const vector = (angle: number, dist: number): [number, number] => {
  const rad = (angle * Math.PI) / 180
  return [round(Math.cos(rad) * dist), round(Math.sin(rad) * dist)]
}

/** A piece with every field present; each builder names only what it uses. */
const piece = (fields: Partial<Particle> & Pick<Particle, 'delay' | 'dur'>): Particle => ({
  x: 50,
  y: 50,
  cx: 0,
  cy: 0,
  dx: 0,
  dy: 0,
  angle: 0,
  reach: 0,
  size: 4,
  ...fields
})

/** A point on one edge of the card, as percentages. */
function edgePoint(rand: Rand, edge: Edge): [x: number, y: number] {
  const along = between(rand, EDGE_MARGIN)
  switch (edge) {
    case 'top':
      return [along, 0]
    case 'bottom':
      return [along, 100]
    case 'left':
      return [0, along]
    case 'right':
      return [100, along]
  }
}

/** Which way a rising piece leans: away from the side it left. */
const leanAwayFrom = (edge: Edge): number => (edge === 'left' ? -SIDE_LEAN : edge === 'right' ? SIDE_LEAN : 0)

/** A random edge from a non-empty list. */
const pickEdge = (rand: Rand, edges: readonly Edge[]): Edge => edges[Math.floor(rand() * edges.length)] ?? 'top'

interface EdgeRecipe {
  count: number
  edges: readonly Edge[]
  /** `outward` leaves the way the edge faces; `up` always climbs, leaning away from the side it left. */
  heading: 'outward' | 'up'
  /** How far the direction may stray either side, in degrees. */
  spread: number
  dist: Range
  size: Range
  dur: Range
  /** The pieces start at random times within this many milliseconds. */
  stagger: number
}

/** Pieces that leave from behind the card's edges and fly out in a line. */
function fromEdges(rand: Rand, recipe: EdgeRecipe): Particle[] {
  return Array.from({ length: recipe.count }, () => {
    const edge = pickEdge(rand, recipe.edges)
    const [x, y] = edgePoint(rand, edge)
    const base = recipe.heading === 'up' ? UP + leanAwayFrom(edge) : OUTWARD[edge]
    const angle = base + wobble(rand, recipe.spread)
    const [dx, dy] = vector(angle, between(rand, recipe.dist))
    return piece({
      x,
      y,
      dx,
      dy,
      size: round(between(rand, recipe.size)),
      delay: Math.round(rand() * recipe.stagger),
      dur: Math.round(between(rand, recipe.dur))
    })
  })
}

const SPARKS: EdgeRecipe = {
  count: 28,
  edges: ALL_EDGES,
  heading: 'outward',
  spread: 35,
  dist: [80, 190],
  size: [4, 7],
  dur: [450, 800],
  stagger: 140
}
const SMOKE: EdgeRecipe = {
  count: 9,
  edges: ALL_EDGES,
  heading: 'outward',
  spread: 30,
  dist: [30, 80],
  size: [50, 80],
  dur: [900, 1300],
  stagger: 300
}
const EMBERS: EdgeRecipe = {
  count: 20,
  edges: UPPER_EDGES,
  heading: 'up',
  spread: 30,
  dist: [90, 190],
  size: [4, 8],
  dur: [1000, 1600],
  stagger: 600
}
const MOTES: EdgeRecipe = {
  count: 18,
  edges: UPPER_EDGES,
  heading: 'up',
  spread: 25,
  dist: [80, 160],
  size: [11, 20],
  dur: [1100, 1700],
  stagger: 600
}

const ROCKET = {
  /** One per upper edge. */
  count: UPPER_EDGES.length,
  piecesPerRocket: 10,
  gapMs: 260,
  /** How far it climbs before it bursts. */
  rise: [46, 64] as Range,
  /** The burst's radius. */
  burst: [34, 52] as Range,
  /** How far the climb may stray from its heading, in degrees. */
  aim: 14,
  /** The ring is turned by up to this many degrees, so no two bursts line up. */
  turn: 36,
  jitterMs: 40,
  size: 5,
  dur: 1100
}

/** Rockets: each rises from an edge as one bundle, then bursts into a ring. */
function rockets(rand: Rand): Particle[] {
  const pieces: Particle[] = []
  for (let r = 0; r < ROCKET.count; r++) {
    const edge = UPPER_EDGES[r] ?? 'top'
    const [x, y] = edgePoint(rand, edge)
    const [cx, cy] = vector(UP + leanAwayFrom(edge) + wobble(rand, ROCKET.aim), between(rand, ROCKET.rise))
    const radius = between(rand, ROCKET.burst)
    const turn = rand() * ROCKET.turn
    for (let i = 0; i < ROCKET.piecesPerRocket; i++) {
      const [rx, ry] = vector(turn + (i * 360) / ROCKET.piecesPerRocket, radius)
      pieces.push(
        piece({
          x,
          y,
          cx,
          cy,
          dx: round(cx + rx),
          dy: round(cy + ry),
          size: ROCKET.size,
          delay: Math.round(r * ROCKET.gapMs + rand() * ROCKET.jitterMs),
          dur: ROCKET.dur
        })
      )
    }
  }
  return pieces
}

const RAYS = {
  count: 12,
  /** Cards are much wider than tall, so a beam that leaves sideways is longer than one that leaves upward; */
  baseReach: 160,
  /** the sideways ones get this much extra, so both clear the edge by a similar amount. */
  sidewaysExtra: 190,
  reachWobble: 30,
  angleWobble: 10,
  thickness: [3, 6] as Range,
  dur: [800, 1000] as Range,
  stagger: 90
}

/** Beams from the card's center, fanned evenly with a little wobble. Most of each beam is hidden behind the card. */
function rays(rand: Rand): Particle[] {
  return Array.from({ length: RAYS.count }, (_, i) => {
    const angle = (i * 360) / RAYS.count + wobble(rand, RAYS.angleWobble)
    const sideways = Math.abs(Math.cos((angle * Math.PI) / 180))
    return piece({
      angle: round(angle),
      reach: Math.round(RAYS.baseReach + sideways * RAYS.sidewaysExtra + wobble(rand, RAYS.reachWobble)),
      size: round(between(rand, RAYS.thickness)),
      delay: Math.round(rand() * RAYS.stagger),
      dur: Math.round(between(rand, RAYS.dur))
    })
  })
}

const RINGS = { count: 3, gapMs: 170, dur: 900, borderPx: 2 }

/** Card-shaped rings, one after another. Same pieces every time: nothing random in a ward. */
function rings(): Particle[] {
  return Array.from({ length: RINGS.count }, (_, i) => piece({ size: RINGS.borderPx, delay: i * RINGS.gapMs, dur: RINGS.dur }))
}

/** One builder per effect. A new `EffectId` fails to compile until it has one here. */
const BUILDERS: Record<EffectId, (rand: Rand) => Particle[]> = {
  sparks: (rand) => fromEdges(rand, SPARKS),
  smoke: (rand) => fromEdges(rand, SMOKE),
  embers: (rand) => fromEdges(rand, EMBERS),
  motes: (rand) => fromEdges(rand, MOTES),
  fireworks: rockets,
  radiance: rays,
  ward: rings
}

/** The pieces of one cast. Same effect and seed, same show. */
export function buildShow(effect: EffectId, seed: number): EffectShow {
  const particles = BUILDERS[effect](seededRandom(seed))
  const totalMs = particles.reduce((end, p) => Math.max(end, p.delay + p.dur), BACKDROP_MS)
  return { particles, totalMs }
}
